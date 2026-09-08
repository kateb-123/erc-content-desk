import test from 'node:test';
import assert from 'node:assert/strict';

// The endpoints construct an Anthropic client at import; nothing here calls it.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
delete process.env.TURNSTILE_SECRET_KEY;

const { tokenRequired, verifyToken, checkRequest, REJECTED } = await import('../api/_lib/turnstile.js');
const { default: submit } = await import('../api/submit.js');
const { default: newsletterImage } = await import('../api/newsletter-image.js');

const DESK = 'erc-content-desk.vercel.app';
const HUB = 'https://kateb-123.github.io';

function fakeRes() {
  return {
    code: 0, body: null, headers: {},
    status(code) { this.code = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    end() { return this; },
  };
}

function fakeFetch(reply) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (reply instanceof Error) throw reply;
    return { json: async () => reply };
  };
  fn.calls = calls;
  return fn;
}

test('the token is required from other origins and from callers with no origin', () => {
  assert.equal(tokenRequired({ headers: { host: DESK, origin: HUB } }), true);
  assert.equal(tokenRequired({ headers: { host: DESK } }), true);
  assert.equal(tokenRequired({ headers: { host: DESK, origin: 'null' } }), true);
});

test('the desk itself and localhost dev skip the token', () => {
  assert.equal(tokenRequired({ headers: { host: DESK, origin: `https://${DESK}` } }), false);
  assert.equal(tokenRequired({ headers: { host: 'localhost:3000', origin: 'http://localhost:3000' } }), false);
});

test('verifyToken posts secret + response to siteverify and reads success', async () => {
  const fetchImpl = fakeFetch({ success: true, 'error-codes': [] });
  const out = await verifyToken('tok.123', { secret: 's3cret', remoteip: '203.0.113.9', fetchImpl });
  assert.equal(out.ok, true);
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  const sent = fetchImpl.calls[0].init.body;
  assert.equal(sent.get('secret'), 's3cret');
  assert.equal(sent.get('response'), 'tok.123');
  assert.equal(sent.get('remoteip'), '203.0.113.9');
});

test('verifyToken fails closed: no secret, no token, oversize token, or a network error', async () => {
  const fetchImpl = fakeFetch({ success: true });
  assert.deepEqual(await verifyToken('tok', { secret: '', fetchImpl }), { ok: false, codes: ['missing-input-secret'] });
  assert.deepEqual(await verifyToken('', { secret: 's', fetchImpl }), { ok: false, codes: ['missing-input-response'] });
  assert.deepEqual(await verifyToken('x'.repeat(2049), { secret: 's', fetchImpl }), { ok: false, codes: ['missing-input-response'] });
  assert.equal(fetchImpl.calls.length, 0, 'nothing reached Cloudflare');
  const broken = fakeFetch(new Error('ECONNRESET'));
  assert.deepEqual(await verifyToken('tok', { secret: 's', fetchImpl: broken }), { ok: false, codes: ['internal-error'] });
});

test('verifyToken passes Cloudflare error codes through', async () => {
  const fetchImpl = fakeFetch({ success: false, 'error-codes': ['timeout-or-duplicate'] });
  assert.deepEqual(await verifyToken('tok', { secret: 's', fetchImpl }), { ok: false, codes: ['timeout-or-duplicate'] });
});

test('checkRequest lets the desk through untouched and gates the hub', async () => {
  const fetchImpl = fakeFetch({ success: true });
  assert.equal(await checkRequest({ headers: { host: DESK, origin: `https://${DESK}` }, body: {} }, { secret: 's', fetchImpl }), '');
  assert.equal(fetchImpl.calls.length, 0);
  const hubReq = { headers: { host: DESK, origin: HUB, 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }, body: { turnstile_token: 'tok' } };
  assert.equal(await checkRequest(hubReq, { secret: 's', fetchImpl }), '');
  assert.equal(fetchImpl.calls[0].init.body.get('remoteip'), '198.51.100.4');
  const bad = fakeFetch({ success: false, 'error-codes': ['invalid-input-response'] });
  assert.equal(await checkRequest(hubReq, { secret: 's', fetchImpl: bad }), REJECTED);
});

test('POST /api/submit from the hub without a token is refused before validation', async () => {
  const res = fakeRes();
  await submit({ method: 'POST', headers: { host: DESK, origin: HUB }, body: {} }, res);
  assert.equal(res.code, 403);
  assert.deepEqual(res.body, { ok: false, errors: [REJECTED] });
});

test('POST /api/submit from the desk skips the gate and reaches validation', async () => {
  const res = fakeRes();
  await submit({ method: 'POST', headers: { host: DESK, origin: `https://${DESK}` }, body: {} }, res);
  assert.equal(res.code, 400, 'validation ran, so the gate was skipped');
  assert.equal(res.body.ok, false);
});

test('POST /api/newsletter-image from the hub without a token is refused', async () => {
  const res = fakeRes();
  await newsletterImage({ method: 'POST', headers: { host: DESK, origin: HUB }, body: { type: 'png', file: '' } }, res);
  assert.equal(res.code, 403);
  assert.deepEqual(res.body, { ok: false, error: REJECTED });
});

test('POST /api/newsletter-image from the desk skips the gate', async () => {
  const res = fakeRes();
  await newsletterImage({ method: 'POST', headers: { host: DESK, origin: `https://${DESK}` }, body: { type: 'bmp' } }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /PNG/);
});
