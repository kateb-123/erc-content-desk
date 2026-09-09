import test from 'node:test';
import assert from 'node:assert/strict';

// The endpoints construct an Anthropic client at import; nothing here calls it.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
delete process.env.TURNSTILE_SECRET_KEY;

const { default: listserv, stamp, validateSignup } = await import('../api/listserv.js');

const DESK = 'erc-content-desk.vercel.app';
const SAME_ORIGIN = { host: DESK, origin: `https://${DESK}` }; // skips the token
const HUB = 'https://erc-policy-exchange.vercel.app';
const SCRIPT = 'https://script.google.com/macros/s/test/exec';

function fakeRes() {
  return {
    code: 0, body: null, headers: {},
    status(code) { this.code = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    end() { return this; },
  };
}

/** Swap global fetch for the duration of one call; returns what was sent. */
async function withFetch(reply, fn) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (reply instanceof Error) throw reply;
    return reply;
  };
  try { await fn(); } finally { globalThis.fetch = real; }
  return calls;
}

test('a preflight is answered before anything else', async () => {
  const res = fakeRes();
  await listserv({ method: 'OPTIONS', headers: { origin: HUB } }, res);
  assert.equal(res.code, 204);
  assert.equal(res.headers['Access-Control-Allow-Methods'], 'POST');
  assert.equal(res.headers['Access-Control-Allow-Origin'], HUB);
});

test('only POST is accepted', async () => {
  const res = fakeRes();
  await listserv({ method: 'GET', headers: SAME_ORIGIN }, res);
  assert.equal(res.code, 405);
});

test('a cross-origin caller with no Turnstile token is refused', async () => {
  process.env.LISTSERV_URL = SCRIPT;
  const res = fakeRes();
  await listserv({ method: 'POST', headers: { host: DESK, origin: HUB }, body: { name: 'A', email: 'a@b.edu' } }, res);
  assert.equal(res.code, 403);
  assert.match(res.body.errors[0], /person/i);
});

test('a missing LISTSERV_URL fails closed and never pretends to have signed anyone up', async () => {
  delete process.env.LISTSERV_URL;
  const res = fakeRes();
  await listserv({ method: 'POST', headers: SAME_ORIGIN, body: { name: 'A', email: 'a@b.edu' } }, res);
  assert.equal(res.code, 500);
  assert.equal(res.body.ok, false);
});

test('name and a plausible address are both required', async () => {
  process.env.LISTSERV_URL = SCRIPT;
  for (const [body, expected] of [
    [{ email: 'a@b.edu' }, /name/i],
    [{ name: 'A' }, /email/i],
    [{ name: 'A', email: 'nope' }, /look right/i],
    [{ name: 'A'.repeat(201), email: 'a@b.edu' }, /too long/i],
  ]) {
    const res = fakeRes();
    await listserv({ method: 'POST', headers: SAME_ORIGIN, body }, res);
    assert.equal(res.code, 400, JSON.stringify(body));
    assert.match(res.body.errors[0], expected);
  }
});

test('a good signup forwards the listserv_signup record to the script and reports ok', async () => {
  process.env.LISTSERV_URL = SCRIPT;
  const res = fakeRes();
  const calls = await withFetch({ ok: true, status: 200 }, () =>
    listserv({ method: 'POST', headers: SAME_ORIGIN, body: { name: '  Kate Barnes ', email: ' kate@tamu.edu ' } }, res));
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, SCRIPT);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.action, 'listserv_signup');
  assert.equal(sent.name, 'Kate Barnes');       // trimmed
  assert.equal(sent.email, 'kate@tamu.edu');
  assert.match(sent.date_subscribed, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(sent.time, /^\d{2}:\d{2}:\d{2}$/);
});

test('the script refusing, or being unreachable, is reported as a failure', async () => {
  process.env.LISTSERV_URL = SCRIPT;
  for (const reply of [{ ok: false, status: 500 }, new Error('network down')]) {
    const res = fakeRes();
    await withFetch(reply, () =>
      listserv({ method: 'POST', headers: SAME_ORIGIN, body: { name: 'A', email: 'a@b.edu' } }, res));
    assert.equal(res.code, 502);
    assert.equal(res.body.ok, false);
  }
});

test('the stamp is the ERC timezone, not the visitor clock or UTC', () => {
  // 03:30 UTC on Jan 2 is still Jan 1, 21:30, in College Station.
  const { date_subscribed, time } = stamp(new Date('2026-01-02T03:30:00Z'));
  assert.equal(date_subscribed, '2026-01-01');
  assert.equal(time, '21:30:00');
});

test('validateSignup is the one place the rules live', () => {
  assert.equal(validateSignup({ name: 'A', email: 'a@b.edu' }), '');
  assert.match(validateSignup({ name: '', email: 'a@b.edu' }), /name/i);
});
