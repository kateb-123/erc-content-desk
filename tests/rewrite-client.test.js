import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteTargets, landRewrites } from '../js/rewrite-client.js';

const kept = (id, extra = {}) => ({ id, status: 'kept', type: 'event', subtype: 'A&M', blurb: `old ${id}`, published_at: '', newsletter_issue: '', ...extra });

test('rewriteTargets keeps only the ids the rewrite can still use: kept, unpublished, rewritable, not already handled or in flight', () => {
  const rows = [
    kept('a'),
    kept('b', { status: 'new' }),
    kept('c', { published_at: '2026-09-01T00:00:00Z' }),
    kept('d', { type: 'research', subtype: 'ERC Research', blurb: 'has text' }),   // ERC voice already
    kept('e'), kept('f'), kept('g'),
  ];
  const got = rewriteTargets(rows, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'zz'], {
    review: new Set(['e']), verified: new Set(['f']), inFlight: new Set(['g']),
  });
  assert.deepEqual(got, ['a']);
});

test('landRewrites swaps the description in and remembers the old one, only for rows still on their way', () => {
  const rows = [kept('a'), kept('b'), kept('c', { status: 'new' }), kept('d')];
  const { rows: next, landed } = landRewrites(rows, [
    { id: 'a', blurb: 'new a' },
    { id: 'b', blurb: 'new b' },
    { id: 'c', blurb: 'new c' },   // undone back to new while the rewrite ran: left alone
    { id: 'd', blurb: 'new d' },   // not asked for
    { id: 'x', blurb: 'new x' },   // unknown
  ], { wanted: new Set(['a', 'b', 'c']), review: new Set(['b']), verified: new Set() });
  assert.deepEqual(landed, [{ id: 'a', old: 'old a' }]);
  assert.equal(next.find(r => r.id === 'a').blurb, 'new a');
  assert.equal(next.find(r => r.id === 'b').blurb, 'old b');   // already waiting to be checked: not overwritten
  assert.equal(next.find(r => r.id === 'c').blurb, 'old c');
  assert.equal(next.find(r => r.id === 'd').blurb, 'old d');
});
