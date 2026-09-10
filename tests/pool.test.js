import test from 'node:test';
import assert from 'node:assert/strict';
import { runPool } from '../js/pool.js';

const tick = ms => new Promise(r => setTimeout(r, ms));

test('results come back in input order even when workers finish out of order', async () => {
  const out = await runPool([30, 0, 15], 3, async ms => { await tick(ms); return ms; });
  assert.deepEqual(out, [
    { ok: true, value: 30 }, { ok: true, value: 0 }, { ok: true, value: 15 },
  ]);
});

test('never runs more than the limit at once', async () => {
  let live = 0;
  let peak = 0;
  await runPool([1, 2, 3, 4, 5, 6, 7], 3, async () => {
    live += 1;
    peak = Math.max(peak, live);
    await tick(5);
    live -= 1;
  });
  assert.equal(peak, 3);
});

test('one thrown item does not stop the rest', async () => {
  const out = await runPool([1, 2, 3], 2, async n => {
    if (n === 2) throw new Error('nope');
    return n;
  });
  assert.deepEqual(out.map(r => r.ok), [true, false, true]);
  assert.equal(out[1].error.message, 'nope');
});

test('progress is reported once per item and ends at the total', async () => {
  const seen = [];
  await runPool(['a', 'b', 'c'], 2, async () => {}, (done, total) => seen.push([done, total]));
  assert.deepEqual(seen, [[1, 3], [2, 3], [3, 3]]);
});

test('an empty list never calls the worker', async () => {
  let called = 0;
  const out = await runPool([], 4, async () => { called += 1; });
  assert.deepEqual(out, []);
  assert.equal(called, 0);
});

test('a limit larger than the list is fine', async () => {
  const out = await runPool([1, 2], 10, async n => n * 2);
  assert.deepEqual(out, [{ ok: true, value: 2 }, { ok: true, value: 4 }]);
});
