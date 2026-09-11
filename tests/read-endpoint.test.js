import test from 'node:test';
import assert from 'node:assert/strict';

// The endpoint builds an Anthropic client at import; these tests hand in fakes.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
const mod = await import('../api/read.js');

function fakeRes() {
  return {
    code: 0, body: null,
    status(code) { this.code = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

const rows = [
  { id: 'a', status: 'new', pending_read: 'yes', headline: 'A' },
  { id: 'b', status: 'new', pending_read: '', headline: 'B already read' },
  { id: 'c', status: 'new', pending_read: 'yes', headline: 'C' },
  { id: 'd', status: 'trashed', pending_read: 'yes', headline: 'D deleted' },
];

function deps(overrides = {}) {
  const saved = [];
  return {
    saved,
    readAllRows: async () => rows.map(r => ({ ...r })),
    readRow: async row => ({ ...row, blurb: `read ${row.id}`, pending_read: '' }),
    updateRow: async row => { saved.push(row); },
    ...overrides,
  };
}

test('reads only the asked-for rows that are still waiting, and saves each', async () => {
  assert.equal(typeof mod.createReadHandler, 'function');
  const d = deps();
  const res = fakeRes();
  await mod.createReadHandler(d)({ method: 'POST', body: { ids: ['a', 'b', 'c', 'd', 'zzz'] } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, read: 2, failed: 0, left: 0 });
  assert.deepEqual(d.saved.map(r => r.id).sort(), ['a', 'c']);
  assert.ok(d.saved.every(r => r.pending_read === ''));
});

test('one call reads at most a batch, and says how many are left', async () => {
  assert.equal(typeof mod.createReadHandler, 'function');
  const many = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, status: 'new', pending_read: 'yes' }));
  const d = deps({ readAllRows: async () => many.map(r => ({ ...r })) });
  const res = fakeRes();
  await mod.createReadHandler(d)({ method: 'POST', body: { ids: many.map(r => r.id) } }, res);
  assert.equal(res.body.read, mod.READ_BATCH);
  assert.equal(res.body.left, 11 - mod.READ_BATCH);
});

test('a row that fails to read stays waiting and is counted, and the rest still save', async () => {
  assert.equal(typeof mod.createReadHandler, 'function');
  const d = deps({
    readRow: async row => {
      if (row.id === 'a') throw new Error('timeout');
      return { ...row, pending_read: '' };
    },
  });
  const res = fakeRes();
  const original = console.error;
  console.error = () => {};
  try {
    await mod.createReadHandler(d)({ method: 'POST', body: { ids: ['a', 'c'] } }, res);
  } finally {
    console.error = original;
  }
  assert.deepEqual(res.body, { ok: true, read: 1, failed: 1, left: 0 });
  assert.deepEqual(d.saved.map(r => r.id), ['c']);
});

test('a row deleted while it was being read is not brought back', async () => {
  assert.equal(typeof mod.createReadHandler, 'function');
  let reads = 0;
  const d = deps({
    readAllRows: async () => (++reads === 1 ? rows : rows.map(r => (r.id === 'a' ? { ...r, status: 'trashed' } : r)))
      .map(r => ({ ...r })),
  });
  await mod.createReadHandler(d)({ method: 'POST', body: { ids: ['a', 'c'] } }, fakeRes());
  assert.deepEqual(d.saved.map(r => r.id), ['c']);
});

test('only POST with a list of ids is accepted', async () => {
  assert.equal(typeof mod.createReadHandler, 'function');
  const handler = mod.createReadHandler(deps());
  const get = fakeRes();
  await handler({ method: 'GET' }, get);
  assert.equal(get.code, 405);
  const bad = fakeRes();
  await handler({ method: 'POST', body: {} }, bad);
  assert.equal(bad.code, 400);
});
