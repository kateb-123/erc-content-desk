import test from 'node:test';
import assert from 'node:assert/strict';
import { readAllWaiting } from '../js/reader-client.js';

test('keeps calling the catch-up until nothing is left, and reports the totals', async () => {
  const calls = [];
  const replies = [{ read: 8, failed: 0, left: 3 }, { read: 3, failed: 0, left: 0 }];
  const post = async ids => { calls.push(ids); return replies.shift(); };
  const progress = [];
  const out = await readAllWaiting(['a', 'b'], post, done => progress.push(done));
  assert.equal(calls.length, 2);
  assert.deepEqual(out, { read: 11, failed: 0 });
  assert.deepEqual(progress, [8, 11]);
});

test('stops when a call makes no progress, so a row that always fails cannot loop forever', async () => {
  let calls = 0;
  const post = async () => { calls++; return { read: 0, failed: 1, left: 0 }; };
  const out = await readAllWaiting(['a'], post);
  assert.equal(calls, 1);
  assert.deepEqual(out, { read: 0, failed: 1 });
});

test('a call that says items are left but reads none stops too', async () => {
  let calls = 0;
  const post = async () => { calls++; return { read: 0, failed: 2, left: 5 }; };
  await readAllWaiting(['a', 'b'], post);
  assert.equal(calls, 1);
});

test('nothing to read means no call', async () => {
  let calls = 0;
  const out = await readAllWaiting([], async () => { calls++; });
  assert.equal(calls, 0);
  assert.deepEqual(out, { read: 0, failed: 0 });
});
