// tests/finalize-undo.test.js: Finalize's Keep and its Undo (bug, Oct 23).
// Undo after Keep the rest put each row's old description back as its text,
// so a row with no description of its own reopened with an empty After and
// only Keep: the rewrite was gone, and Keep would have saved a blank.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keptRow, undoKeep, checkSides, reapplyRewrites } from '../js/finalize-view.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const STAMP = '2026-10-23T15:00:00.000Z';
const readerOnly = { id: 'r', _rowNumber: 2, type: 'research', headline: 'Teacher Shortages in the Rural South: 2026 Landscape', blurb: 'The rewrite.', original_text: 'The reader\'s words.', rewrite_checked: '' };
const ownWords = { id: 'o', _rowNumber: 3, type: 'event', headline: 'Howdy Policy Trivia Night', blurb: 'The new words.', original_text: '', rewrite_checked: '' };

test('keptRow saves the rewrite with the stamp', () => {
  assert.deepEqual(keptRow(readerOnly, { rewrite: 'The rewrite.', stamp: STAMP }), { ...readerOnly, blurb: 'The rewrite.', rewrite_checked: STAMP });
});

test('keptRow never saves an empty description when there was a rewrite to keep', () => {
  const blanked = { ...readerOnly, blurb: '' };
  assert.equal(keptRow(blanked, { rewrite: 'The rewrite.', stamp: STAMP }).blurb, 'The rewrite.');
  assert.equal(keptRow({ ...readerOnly, blurb: '  ' }, { rewrite: 'The rewrite.', stamp: STAMP }).blurb, 'The rewrite.', 'blank space is no description');
  assert.equal(keptRow(blanked, { stamp: STAMP }).blurb, '', 'no rewrite at all: nothing invented');
});

test('undoKeep: the store gets the words it had before the keep, unchecked', () => {
  const kept = keptRow(ownWords, { rewrite: 'The new words.', stamp: STAMP });
  const { saved } = undoKeep(kept, { old: 'Its own words.', rewrite: 'The new words.' });
  assert.equal(saved.blurb, 'Its own words.');
  assert.equal(saved.rewrite_checked, '');
  assert.equal(saved._rowNumber, 3);
});

test('undoKeep: the check shows the rewrite as After, never the old words', () => {
  const kept = keptRow(ownWords, { rewrite: 'The new words.', stamp: STAMP });
  const { shown } = undoKeep(kept, { old: 'Its own words.', rewrite: 'The new words.' });
  assert.equal(shown.blurb, 'The new words.');
  assert.equal(shown.rewrite_checked, '');
  assert.deepEqual(checkSides(shown, 'Its own words.'), { before: 'Its own words.', marked: true, revert: true }, 'Before as it was, with Use original');
});

test('undoKeep on a row with no description of its own: the rewrite is back as After, the reader\'s words as Before', () => {
  const kept = keptRow(readerOnly, { rewrite: 'The rewrite.', stamp: STAMP });
  const { saved, shown } = undoKeep(kept, { old: '', rewrite: 'The rewrite.' });
  assert.equal(saved.blurb, '', 'the store had none of its own');
  assert.equal(shown.blurb, 'The rewrite.');
  assert.deepEqual(checkSides(shown, ''), { before: 'The reader\'s words.', marked: false, revert: false });
  // Keep after the Undo saves the rewrite, not a blank.
  assert.equal(keptRow(shown, { rewrite: 'The rewrite.', stamp: STAMP }).blurb, 'The rewrite.');
});

test('undoKeep falls back to the kept row\'s own text when no rewrite was recorded', () => {
  const kept = keptRow(ownWords, { rewrite: 'The new words.', stamp: STAMP });
  assert.equal(undoKeep(kept, { old: 'Its own words.' }).shown.blurb, 'The new words.');
});

test('Keep the rest then Undo, end to end: the saved copy merges in, the rewrite rides back over it', () => {
  // Before the keep: memory holds the rewrites, the check holds each row's old words.
  const review = new Map([['r', ''], ['o', 'Its own words.']]);
  const rewriteText = new Map([['r', 'The rewrite.'], ['o', 'The new words.']]);
  let rows = [readerOnly, ownWords];
  // Keep the rest.
  const record = rows.map(r => ({ id: r.id, old: review.get(r.id), rewrite: rewriteText.get(r.id) }));
  rows = rows.map(r => keptRow(r, { rewrite: rewriteText.get(r.id), stamp: STAMP }));
  review.clear();
  // Undo: the checks reopen, persist merges the saved copies, the rewrites ride back.
  const saved = [];
  for (const { id, old, rewrite } of record) {
    const way = undoKeep(rows.find(r => r.id === id), { old, rewrite });
    review.set(id, old);
    rewriteText.set(id, way.shown.blurb);
    saved.push(way.saved);
  }
  rows = rows.map(r => saved.find(s => s._rowNumber === r._rowNumber) ?? r);
  rows = reapplyRewrites(rows, rewriteText, review);
  assert.deepEqual(rows.map(r => [r.id, r.blurb, r.rewrite_checked]), [['r', 'The rewrite.', ''], ['o', 'The new words.', '']]);
  assert.deepEqual(rows, [readerOnly, ownWords], 'exactly as before the keep');
});

test('app.js: Keep and Keep the rest save through keptRow; their Undo reopens through undoKeep', () => {
  const app = read('js/app.js');
  const verify = app.slice(app.indexOf('onVerifyRewrite:'), app.indexOf('onVerifyAll:'));
  const all = app.slice(app.indexOf('onVerifyAll:'), app.indexOf('onUndoKeepAll:'));
  const undo = app.slice(app.indexOf('onUndoKeepAll:'), app.indexOf('onTrash:', app.indexOf('onUndoKeepAll:')));
  assert.match(verify, /keptRow\(/);
  assert.match(all, /keptRow\(/);
  assert.match(all, /rewrite:/, 'the record keeps each rewrite for the way back');
  assert.match(undo, /undoKeep\(/);
  assert.match(undo, /reapplyRewrites\(/, 'memory shows the rewrite once the saved copy lands');
  assert.doesNotMatch(undo, /blurb: old/, 'the old words never replace the rewrite in memory');
});
