import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
const { default: hubUpdated } = await import('../api/hub-updated.js');

function fakeRes() {
  return {
    code: 0, body: null,
    status(c) { this.code = c; return this; },
    json(o) { this.body = o; return this; },
  };
}
async function withFetch(reply, fn) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method });
    if (reply instanceof Error) throw reply;
    return reply;
  };
  try { await fn(); } finally { globalThis.fetch = real; }
  return calls;
}
const headers = (v) => ({ get: (k) => (k.toLowerCase() === 'last-modified' ? v : null) });

test('only GET is accepted', async () => {
  const res = fakeRes();
  await hubUpdated({ method: 'POST' }, res);
  assert.equal(res.code, 405);
});

test('it asks the live file with a HEAD and hands back its Last-Modified', async () => {
  const res = fakeRes();
  const stamp = 'Thu, 10 Sep 2026 00:44:08 GMT';
  const calls = await withFetch({ ok: true, headers: headers(stamp) },
    () => hubUpdated({ method: 'GET' }, res));
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, lastModified: stamp });
  assert.equal(calls[0].method, 'HEAD');
  assert.match(calls[0].url, /data\/news\.csv$/);
});

test('an upstream miss leaves the dash rather than erroring', async () => {
  for (const reply of [{ ok: false, headers: headers(null) },
                       { ok: true, headers: headers(null) },
                       new Error('offline')]) {
    const res = fakeRes();
    await withFetch(reply, () => hubUpdated({ method: 'GET' }, res));
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { ok: true, lastModified: '' });
  }
});
