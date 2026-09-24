import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS, COOKIE, issueToken, verifyToken, passwordMatches, readCookie, sessionCookie, clearCookie,
  authReply, signedIn, refuseUnlessSignedIn, refuseUnlessPassword,
} from '../api/_lib/session.js';

// Kate, Sep 23: the front page, Content Sort and Publish are hers alone. One
// sign-in lasts a day; Publish's Confirm asks for the password again.

const SECRET = 'correct horse';
const NOW = Date.parse('2026-09-23T20:00:00.000Z');

function fakeRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(o) { this.body = o; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

test('a token holds for a day and then expires', async () => {
  const token = await issueToken(SECRET, NOW);
  assert.match(token, /^\d+\.[A-Za-z0-9_-]+$/);
  assert.equal(await verifyToken(token, SECRET, NOW), true);
  assert.equal(await verifyToken(token, SECRET, NOW + DAY_MS - 1000), true);
  assert.equal(await verifyToken(token, SECRET, NOW + DAY_MS + 1000), false);
});

test('a tampered, foreign or empty token never verifies', async () => {
  const token = await issueToken(SECRET, NOW);
  const [exp, sig] = token.split('.');
  assert.equal(await verifyToken(`${Number(exp) + 999999}.${sig}`, SECRET, NOW), false);   // a later expiry with the old signature
  assert.equal(await verifyToken(`${exp}.${sig.slice(1)}x`, SECRET, NOW), false);
  assert.equal(await verifyToken(token, 'another password', NOW), false);   // changing the password signs everyone out
  assert.equal(await verifyToken('', SECRET, NOW), false);
  assert.equal(await verifyToken('garbage', SECRET, NOW), false);
  assert.equal(await verifyToken(token, '', NOW), false);   // no password set: nothing verifies
});

test('passwordMatches compares the whole password, and never matches when none is set', async () => {
  assert.equal(await passwordMatches('correct horse', SECRET), true);
  assert.equal(await passwordMatches('correct hors', SECRET), false);
  assert.equal(await passwordMatches('correct horse ', SECRET), false);
  assert.equal(await passwordMatches('', SECRET), false);
  assert.equal(await passwordMatches('', ''), false);
  assert.equal(await passwordMatches(undefined, SECRET), false);
});

test('the cookie: read by name, written HttpOnly for a day, cleared with Max-Age=0', async () => {
  assert.equal(readCookie('a=1; desk=abc.def; b=2', COOKIE), 'abc.def');
  assert.equal(readCookie('desk=abc.def', COOKIE), 'abc.def');
  assert.equal(readCookie('', COOKIE), '');
  assert.equal(readCookie(undefined, COOKIE), '');
  assert.equal(readCookie('desks=nope', COOKIE), '');
  const set = sessionCookie('t.s', { secure: true });
  assert.equal(set, `${COOKIE}=t.s; Path=/; Max-Age=${DAY_MS / 1000}; HttpOnly; SameSite=Lax; Secure`);
  assert.equal(sessionCookie('t.s', { secure: false }), `${COOKIE}=t.s; Path=/; Max-Age=${DAY_MS / 1000}; HttpOnly; SameSite=Lax`);
  assert.equal(clearCookie({ secure: true }), `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
});

test('POST /api/auth with the password signs in for a day; the wrong one is refused with no cookie', async () => {
  const ok = await authReply({ method: 'POST', body: { password: SECRET }, cookie: '' }, { secret: SECRET, now: NOW, secure: true });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { ok: true, signedIn: true });
  const token = readCookie(ok.setCookie.split(';')[0], COOKIE);
  assert.equal(await verifyToken(token, SECRET, NOW + 1000), true);
  assert.match(ok.setCookie, /HttpOnly; SameSite=Lax; Secure$/);

  const bad = await authReply({ method: 'POST', body: { password: 'nope' }, cookie: '' }, { secret: SECRET, now: NOW });
  assert.equal(bad.status, 403);
  assert.deepEqual(bad.body, { ok: false, error: "That's not the password." });
  assert.equal(bad.setCookie, undefined);

  const blank = await authReply({ method: 'POST', body: {}, cookie: '' }, { secret: SECRET, now: NOW });
  assert.equal(blank.status, 400);
  assert.deepEqual(blank.body, { ok: false, error: 'Type the password.' });
});

test('with no password configured the desk stays shut and says so', async () => {
  const reply = await authReply({ method: 'POST', body: { password: 'x' }, cookie: '' }, { secret: '', now: NOW });
  assert.equal(reply.status, 503);
  assert.deepEqual(reply.body, { ok: false, error: 'The desk password is not set up yet. Add DESK_PASSWORD on Vercel.' });
  const status = await authReply({ method: 'GET', body: {}, cookie: '' }, { secret: undefined, now: NOW });
  assert.equal(status.status, 200);
  assert.deepEqual(status.body, { ok: true, signedIn: false });
});

test('GET /api/auth says whether the cookie still holds; DELETE signs out', async () => {
  const token = await issueToken(SECRET, NOW);
  const yes = await authReply({ method: 'GET', body: {}, cookie: `desk=${token}` }, { secret: SECRET, now: NOW });
  assert.deepEqual([yes.status, yes.body], [200, { ok: true, signedIn: true }]);
  const stale = await authReply({ method: 'GET', body: {}, cookie: `desk=${token}` }, { secret: SECRET, now: NOW + 2 * DAY_MS });
  assert.deepEqual([stale.status, stale.body], [200, { ok: true, signedIn: false }]);
  const out = await authReply({ method: 'DELETE', body: {}, cookie: `desk=${token}` }, { secret: SECRET, now: NOW, secure: true });
  assert.deepEqual([out.status, out.body], [200, { ok: true, signedIn: false }]);
  assert.match(out.setCookie, /^desk=; Path=\/; Max-Age=0/);
  const other = await authReply({ method: 'PUT', body: {}, cookie: '' }, { secret: SECRET, now: NOW });
  assert.equal(other.status, 405);
});

test('a node handler can ask whether the request is signed in, and refuse when it is not', async () => {
  const token = await issueToken(SECRET, NOW);
  const env = { secret: SECRET, now: () => NOW };
  assert.equal(await signedIn({ headers: { cookie: `desk=${token}` } }, env), true);
  assert.equal(await signedIn({ headers: {} }, env), false);

  const res = fakeRes();
  assert.equal(await refuseUnlessSignedIn({ headers: { cookie: `desk=${token}` } }, res, env), false);
  assert.equal(res.code, 0);   // nothing sent: the handler carries on

  const shut = fakeRes();
  assert.equal(await refuseUnlessSignedIn({ headers: {} }, shut, env), true);
  assert.equal(shut.code, 401);
  assert.deepEqual(shut.body, { ok: false, error: 'Sign in to the desk first.' });

  const none = fakeRes();
  assert.equal(await refuseUnlessSignedIn({ headers: { cookie: `desk=${token}` } }, none, { secret: '', now: () => NOW }), true);
  assert.equal(none.code, 503);
});

test("Publish's Confirm checks the password again, in the body", async () => {
  const env = { secret: SECRET };
  const ok = fakeRes();
  assert.equal(await refuseUnlessPassword({ body: { password: SECRET } }, ok, env), false);
  assert.equal(ok.code, 0);
  const bad = fakeRes();
  assert.equal(await refuseUnlessPassword({ body: { password: 'nope' } }, bad, env), true);
  assert.equal(bad.code, 403);
  assert.deepEqual(bad.body, { ok: false, error: "That's not the password." });
  const missing = fakeRes();
  assert.equal(await refuseUnlessPassword({ body: {} }, missing, env), true);
  assert.equal(missing.code, 400);
  assert.deepEqual(missing.body, { ok: false, error: 'Type the password to confirm.' });
});
