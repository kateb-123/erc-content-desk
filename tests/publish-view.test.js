import test from 'node:test';
import assert from 'node:assert/strict';
import { publishRows, legendItems, filterByFate, fateShares } from '../js/publish-view.js';

const rows = [
  { id: 'a1' }, { id: 'a2' }, { id: 'h1' }, { id: 'n1' }, { id: 'l1' }, { id: 'l2' }, { id: 'x' },
];
const preview = {
  adding: [{ id: 'a1' }, { id: 'a2' }],
  newsletterOnly: [{ id: 'h1' }],
  notReady: [{ id: 'n1' }],
  skipped: [{ id: 'l1' }, { id: 'l2' }],
};

test('publishRows is one list in fate order, each row wearing its fate', () => {
  const list = publishRows(preview, rows);
  assert.deepEqual(list.map(r => [r.row.id, r.fate]), [
    ['a1', 'adding'], ['a2', 'adding'], ['h1', 'held'], ['n1', 'fix'], ['l1', 'live'], ['l2', 'live'],
  ]);
});

test('publishRows skips ids the desk no longer holds, and a missing preview gives nothing', () => {
  assert.deepEqual(publishRows({ adding: [{ id: 'gone' }] }, rows), []);
  assert.deepEqual(publishRows(null, rows), []);
});

test('the legend counts every fate except Already live, which carries no number (Kate, Sep 1)', () => {
  assert.deepEqual(legendItems(publishRows(preview, rows)).map(i => [i.key, i.text]), [
    ['adding', '2 adding'],
    ['held', '1 held for the newsletter'],
    ['fix', '1 needs a fix'],
    ['live', 'Already live'],
  ]);
  const one = legendItems(publishRows({ notReady: [{ id: 'n1' }, { id: 'x' }] }, rows));
  assert.deepEqual(one.map(i => i.text), ['2 need a fix']);
});

test('filterByFate keeps one fate, and no filter keeps all', () => {
  const list = publishRows(preview, rows);
  assert.deepEqual(filterByFate(list, 'held').map(r => r.row.id), ['h1']);
  assert.equal(filterByFate(list, null).length, 6);
});

test('fateShares gives each fate that holds rows its share of the bar', () => {
  const shares = fateShares(publishRows(preview, rows));
  assert.deepEqual(shares.map(s => s.key), ['adding', 'held', 'fix', 'live']);
  assert.equal(Math.round(shares.reduce((n, s) => n + s.share, 0)), 100);
  assert.equal(Math.round(shares[0].share), 33);
});
