import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeStage, finalizeGroups, finalizeProgress, pickSelection, editChanges } from '../js/finalize-view.js';

const keeps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];

test('finalizeStage: before while rewrites wait, checking while checks are open, plain otherwise', () => {
  assert.equal(finalizeStage({ pending: 2, checks: 0 }), 'before');
  assert.equal(finalizeStage({ pending: 0, checks: 2 }), 'checking');
  assert.equal(finalizeStage({ pending: 1, checks: 2 }), 'checking');
  assert.equal(finalizeStage({ pending: 0, checks: 0 }), 'plain');
});

test('before the rewrite: Needs a rewrite, then No rewrite needed (folded)', () => {
  const groups = finalizeGroups(keeps, { pending: new Set(['a', 'b']), review: new Set(), verified: new Set() });
  assert.deepEqual(groups.map(g => [g.key, g.label, g.rows.map(r => r.id), g.fold]), [
    ['rewrite', 'Needs a rewrite', ['a', 'b'], false],
    ['none', 'No rewrite needed', ['c', 'd', 'e'], true],
  ]);
});

test('while checking: To check, Done, No rewrite needed; a row left unrewritten keeps its own group', () => {
  const groups = finalizeGroups(keeps, { pending: new Set(['e']), review: new Set(['a', 'b']), verified: new Set(['c']) });
  assert.deepEqual(groups.map(g => [g.key, g.rows.map(r => r.id)]), [
    ['check', ['a', 'b']],
    ['rewrite', ['e']],
    ['done', ['c']],
    ['none', ['d']],
  ]);
});

test('empty groups drop out', () => {
  const groups = finalizeGroups([{ id: 'x' }], { pending: new Set(), review: new Set(), verified: new Set() });
  assert.deepEqual(groups.map(g => g.key), ['none']);
});

test('finalizeProgress reads as the proposal wrote it, with the bar share', () => {
  assert.deepEqual(finalizeProgress('before', { pending: 2, keeps: 5 }), { text: '2 of 5 kept items need an ERC-voice description', pct: 0 });
  assert.deepEqual(finalizeProgress('checking', { total: 4, left: 1 }), { text: '3 of 4 rewrites checked', pct: 75 });
  assert.deepEqual(finalizeProgress('plain', { keeps: 5 }), { text: '', pct: 100 });
});

test('pickSelection keeps a row that is still listed, else takes the first row to check or rewrite, else none', () => {
  const groups = finalizeGroups(keeps, { pending: new Set(['e']), review: new Set(['a', 'b']), verified: new Set(['c']) });
  assert.equal(pickSelection(groups, 'd'), 'd');
  assert.equal(pickSelection(groups, 'gone'), 'a');
  assert.equal(pickSelection(groups, null), 'a');
  const plain = finalizeGroups(keeps, { pending: new Set(), review: new Set(), verified: new Set() });
  assert.equal(pickSelection(plain, null), null);
});

test('editChanges: only the fields that changed, trimmed, the media URL among them', () => {
  const row = { headline: 'Old', blurb: 'Same', infographic: '' };
  assert.deepEqual(
    editChanges(row, { headline: ' New ', blurb: 'Same', infographic: 'https://x.org/a.png' }),
    { headline: 'New', infographic: 'https://x.org/a.png' },
  );
  assert.deepEqual(editChanges(row, { headline: 'Old', blurb: 'Same', infographic: '' }), {});
  assert.deepEqual(editChanges({ headline: 'Old', infographic: 'https://x.org/a.png' }, { headline: 'Old', infographic: '' }), { infographic: '' });
});
