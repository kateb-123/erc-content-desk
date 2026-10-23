// tests/briefs-redraft-author.test.js: two fixes on the Research briefs hub
// (Kate, Oct 23, her yes on the intent audit). Redraft asks before it
// replaces the folder's draft (INT-3), and New brief's Brief author starts
// empty, never a person's name, and Create says so when it is still empty
// (INT-12, the brief part).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REDRAFT_ASK, briefAuthorStart, createProblem } from '../js/briefs-view.js';

const ui = readFileSync(new URL('../js/briefs-ui.js', import.meta.url), 'utf8');

test('Redraft asks first, in her words: "This replaces brief-draft.md and your edits in it." then Write it again or Cancel', () => {
  assert.deepEqual(REDRAFT_ASK, { words: 'This replaces brief-draft.md and your edits in it.', yes: 'Write it again', no: 'Cancel' });
});

test('Redraft no longer starts the draft over in one press: its own click only opens the ask', () => {
  assert.doesNotMatch(ui, /button\('Redraft'[^\n]*onWriteDraft/, 'the Redraft button calls onWriteDraft directly');
  assert.match(ui, /REDRAFT_ASK\.yes[^\n]*onWriteDraft\(\{ restart: true \}\)/, 'Write it again in the ask starts the draft over');
});

test('briefAuthorStart: the box starts empty on a computer that has typed no name, and with the name it typed last otherwise', () => {
  assert.equal(briefAuthorStart(null), '');
  assert.equal(briefAuthorStart(undefined), '');
  assert.equal(briefAuthorStart(''), '');
  assert.equal(briefAuthorStart('Reveille Aggie'), 'Reveille Aggie');
});

test('New brief puts no person\'s name in Brief author by default', () => {
  assert.doesNotMatch(ui, /Kate Barnes/);
});

const ready = { paper: true, notes: 'Lead with the howdy number.', authorLast: 'Aggie', year: '2026', topic: 'greeting', briefAuthor: 'Reveille Aggie' };

test('createProblem: nothing to say once every needed box is filled', () => {
  assert.equal(createProblem(ready), null);
});

test('createProblem: an empty Brief author is refused like any other needed box, never filled with a name', () => {
  assert.deepEqual(createProblem({ ...ready, briefAuthor: '' }), { why: "Add the brief author's name.", focus: 'briefAuthor' });
  assert.deepEqual(createProblem({ ...ready, briefAuthor: '   ' }), { why: "Add the brief author's name.", focus: 'briefAuthor' }, 'spaces are empty');
});

test('createProblem keeps the form\'s order and words: the paper, the notes, the folder name, then the brief author', () => {
  assert.deepEqual(createProblem({ ...ready, paper: false, briefAuthor: '' }), { why: 'Choose the paper, a PDF.', focus: 'paper' });
  assert.deepEqual(createProblem({ ...ready, notes: '  ', briefAuthor: '' }), { why: 'Choose your notes file, or paste them.', focus: 'notes' });
  assert.deepEqual(createProblem({ ...ready, authorLast: '', briefAuthor: '' }), { why: "Add the author's last name and a four-digit year.", focus: 'last' });
  assert.deepEqual(createProblem({ ...ready, year: '26' }), { why: "Add the author's last name and a four-digit year.", focus: 'last' });
});
