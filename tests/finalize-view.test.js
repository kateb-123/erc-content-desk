import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeStage, finalizeGroups, finalizeProgress, pickSelection, editChanges, fieldsForType, dateField, editFields, editBase, finalizeWaiting, onTheWay } from '../js/finalize-view.js';

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

test('fieldsForType: the edit form shows only the fields a type uses (design audit b4)', () => {
  assert.deepEqual(fieldsForType('event'), ['headline', 'date', 'time', 'location', 'source', 'blurb']);
  assert.deepEqual(fieldsForType('erc_event'), ['headline', 'date', 'time', 'location', 'source', 'blurb']);
  assert.deepEqual(fieldsForType('opportunity'), ['headline', 'deadline', 'topic', 'source', 'blurb']);
  assert.deepEqual(fieldsForType('research'), ['headline', 'authors', 'source', 'topic', 'blurb']);
  assert.deepEqual(fieldsForType('headline'), ['headline', 'source', 'blurb']);
  assert.deepEqual(fieldsForType(''), ['headline', 'date', 'source', 'topic', 'blurb', 'deadline', 'authors', 'time', 'location']);
});

test('dateField: dates and deadlines are date inputs, the rest text', () => {
  assert.equal(dateField('date'), true);
  assert.equal(dateField('deadline'), true);
  assert.equal(dateField('time'), false);
  assert.equal(dateField('headline'), false);
});

// Audit round two, e11: one edit form on Sort and Finalize: the type's fields plus the link.
test('editFields: the fields for the type, then the link, once', () => {
  assert.deepEqual(editFields('headline'), ['headline', 'source', 'blurb', 'link']);
  assert.deepEqual(editFields('event'), ['headline', 'date', 'time', 'location', 'source', 'blurb', 'link']);
  assert.equal(editFields('').filter(f => f === 'link').length, 1);
});

// Audit round two, e8: the description opens with the original text when there is
// no rewrite yet, and that prefill is not a change until it is edited.
test('editBase: the description falls back to the original text', () => {
  assert.equal(editBase({ blurb: '', original_text: 'The original.' }).blurb, 'The original.');
  assert.equal(editBase({ blurb: 'Rewritten.', original_text: 'The original.' }).blurb, 'Rewritten.');
  assert.equal(editBase({}).blurb, '');
});
test('editChanges: an untouched prefill is no change; an edited one is', () => {
  const row = { headline: 'T', blurb: '', original_text: 'The original.' };
  const base = editBase(row);
  assert.deepEqual(editChanges(row, { headline: 'T', blurb: 'The original.' }, base), {});
  assert.deepEqual(editChanges(row, { headline: 'T', blurb: 'The original, trimmed.' }, base), { blurb: 'The original, trimmed.' });
});

// The Finalize tab's count (Kate's wireframes, Sep 17): the kept items whose
// rewrite is still to do or still to check this visit.
test('finalizeWaiting counts the rewrites to do or to check, not the ones checked this visit or needing none', () => {
  const rows = [
    { id: 'e1', status: 'kept', type: 'event', blurb: 'Some text' },
    { id: 'e2', status: 'kept', type: 'event', blurb: 'Some text' },
    { id: 'h1', status: 'kept', type: 'headline', blurb: 'x' },
    { id: 'o1', status: 'kept', type: 'opportunity', blurb: 'x', rewrite_checked: '2026-09-01T00:00:00Z' },
    { id: 'p1', status: 'kept', type: 'event', blurb: 'x', published_at: 'x' },
    { id: 'n1', status: 'new', type: 'event', blurb: 'x' },
  ];
  assert.equal(finalizeWaiting(rows, new Set()), 2);
  assert.equal(finalizeWaiting(rows, new Set(['e2'])), 1);
});

test('rewrites on their way stand in their own group, before Needs a rewrite', () => {
  const groups = finalizeGroups(keeps, { pending: new Set(['b']), review: new Set(), verified: new Set(), rewriting: new Set(['a']) });
  assert.deepEqual(groups.map(g => [g.key, g.label, g.rows.map(r => r.id)]), [
    ['rewriting', 'Rewriting', ['a']],
    ['rewrite', 'Needs a rewrite', ['b']],
    ['none', 'No rewrite needed', ['c', 'd', 'e']],
  ]);
});

test('onTheWay says how many rewrites are still coming back, or nothing', () => {
  assert.equal(onTheWay(0), '');
  assert.equal(onTheWay(1), '1 rewrite on its way');
  assert.equal(onTheWay(3), '3 rewrites on their way');
});
