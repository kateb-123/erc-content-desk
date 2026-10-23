import test from 'node:test';
import assert from 'node:assert/strict';
import { pickType, typeChoices, bulkSubmissionBody, typeRowFor, bulkRowProblem, bulkConfirmLabel, dateFieldFor, bulkSubmitter, bulkInitialsPrefill } from '../js/submit-form.js';
import { TYPE_ORDER, subtypesFor } from '../js/schema.js';

test('pickType clears the subtype when the type changes', () => {
  assert.deepEqual(
    pickType({ type: 'research', subtype: 'Report' }, 'event'),
    { type: 'event', subtype: '' },
  );
});

test('pickType keeps the subtype when re-picking the same type', () => {
  const selection = { type: 'research', subtype: 'Report' };
  assert.deepEqual(pickType(selection, 'research'), selection);
});

test('pickType starts a fresh selection from blank', () => {
  assert.deepEqual(
    pickType({ type: '', subtype: '' }, 'headline'),
    { type: 'headline', subtype: '' },
  );
});

test('a bulk item posts its description and its extra columns as separate fields', () => {
  const body = bulkSubmissionBody({
    title: 'Symposium', blurb: '', link: 'x.org/s', type: 'event', subtype: 'A&M',
    original_text: 'When: Sept 12, 2 PM\nWhere: Harrington 108',
  }, 'KB');
  assert.equal(body.blurb, '');
  assert.equal(body.original_text, 'When: Sept 12, 2 PM\nWhere: Harrington 108');
  assert.equal(body.link, 'https://x.org/s');
  assert.equal(body.submitter, 'KB');
});

// ── The type pills (Claude Design round two, Kate's pick Sep 16) ──

test('typeChoices lists every type as a pill and marks the picked one', () => {
  const { types, subtypes } = typeChoices({ type: '', subtype: '' });
  assert.deepEqual(types.map(t => t.value), TYPE_ORDER);
  assert.equal(types.filter(t => t.picked).length, 0);
  assert.deepEqual(subtypes, []);
});

test('typeChoices opens the subtype pills for the picked type only', () => {
  const { types, subtypes } = typeChoices({ type: 'event', subtype: 'A&M' });
  assert.deepEqual(types.filter(t => t.picked).map(t => t.value), ['event']);
  assert.deepEqual(subtypes.map(s => s.value), subtypesFor('event'));
  assert.deepEqual(subtypes.filter(s => s.picked).map(s => s.value), ['A&M']);
});

test('ERC Event is flat: no subtype pills, and the hint that tells it apart from Event', () => {
  const { subtypes, hint } = typeChoices({ type: 'erc_event', subtype: '' });
  assert.deepEqual(subtypes, []);
  assert.equal(hint, 'an event the ERC runs');
  assert.equal(typeChoices({ type: 'event', subtype: '' }).hint, '');
});

// ── The type error lands on the row it names (audit round two, d6) ──

test('typeRowFor says which pill row a type message is about', () => {
  assert.equal(typeRowFor('Pick a subtype.'), 'subtype');
  assert.equal(typeRowFor('Pick a type.'), 'type');
  assert.equal(typeRowFor('Pick a type before a subtype.'), 'type');
  assert.equal(typeRowFor(''), 'type');
});

// ── Failed bulk rows keep their reason (audit round two, e16) ──

test('bulkRowProblem: no link says so before any attempt; a failed attempt keeps its message', () => {
  assert.equal(bulkRowProblem({ title: 'A', link: '' }), 'No link');
  assert.equal(bulkRowProblem({ title: 'A', link: 'https://x.org' }), '');
  assert.equal(bulkRowProblem({ title: 'A', link: 'https://x.org', error: "Couldn't save that." }), "Couldn't save that.");
  assert.equal(bulkRowProblem({ title: 'A', link: '', error: 'Add a link.' }), 'No link');
});

// ── The bulk button's word survives a redraw (audit round two, f10) ──

test('bulkConfirmLabel: Add N, Retry N after a failed run, and a disabled word when nothing is left', () => {
  assert.equal(bulkConfirmLabel(3, false), 'Add 3 to the queue');
  assert.equal(bulkConfirmLabel(2, true), 'Retry 2');
  assert.equal(bulkConfirmLabel(0, false), 'Nothing left to add');
  assert.equal(bulkConfirmLabel(0, true), 'Nothing left to add');
});

// Kate, Oct 6: Quick add's Date field, for every type; an opportunity's date
// is its deadline, so the field says so and fills that column.
test('dateFieldFor: Deadline for an opportunity, Date for everything else, Date before a type is picked', () => {
  assert.deepEqual(dateFieldFor('opportunity'), { field: 'deadline', label: 'Deadline' });
  for (const t of ['', 'headline', 'research', 'event', 'erc_event']) assert.deepEqual(dateFieldFor(t), { field: 'date', label: 'Date' }, t);
});

test('Quick add on Next issue asks for the Date field; the team page does not', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../js/issue-ui.js', import.meta.url), 'utf8'), /renderSubmitForm\(mount, \{[\s\S]*?dateField: true/);
  assert.doesNotMatch(readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8'), /dateField/);
});

// ── The bulk review's own initials box (Kate, Oct 23, INT-11) ──
// The door used to read Your initials from the form above it, out of view
// once the door is open; the review now carries its own box right above
// Add N to the queue, prefilled from the form's.

const submitSource = async () => {
  const { readFileSync } = await import('node:fs');
  return readFileSync(new URL('../js/submit-form.js', import.meta.url), 'utf8');
};

test('bulkSubmitter: the bulk box\'s initials, trimmed; blank still says bulk upload', () => {
  assert.equal(bulkSubmitter('  RV '), 'RV');
  assert.equal(bulkSubmitter(''), 'bulk upload');
  assert.equal(bulkSubmitter('   '), 'bulk upload');
  assert.equal(bulkSubmitter(undefined), 'bulk upload');
});

test('bulkInitialsPrefill: the form\'s initials fill the box until the box is typed in', () => {
  assert.equal(bulkInitialsPrefill({ current: '', formValue: 'RV', touched: false }), 'RV');
  assert.equal(bulkInitialsPrefill({ current: 'RV', formValue: 'TX', touched: false }), 'TX');
  assert.equal(bulkInitialsPrefill({ current: 'MB', formValue: 'RV', touched: true }), 'MB');
  assert.equal(bulkInitialsPrefill({ current: '', formValue: '', touched: false }), '');
});

test('the bulk review draws a Your initials box right above the Add button', async () => {
  const src = await submitSource();
  assert.match(src, /<div class="bulk-review" hidden>\s*<div class="bulk-items"><\/div>\s*<div class="bulk-initials"><label for="sf-bulk-submitter">Your initials<\/label>\s*<input id="sf-bulk-submitter" type="text" autocomplete="off"><\/div>\s*<button type="button" class="primary bulk-confirm-btn"/);
});

test('the form keeps its own Your initials field in its foot', async () => {
  const src = await submitSource();
  assert.match(src, /<div class="sf-initials"><label for="sf-submitter">Your initials<\/label>\s*<input id="sf-submitter" type="text" autocomplete="off"><\/div>/);
});

test('Add N to the queue takes the submitter from the bulk box, not the form above', async () => {
  const src = await submitSource();
  const handler = src.match(/bulkConfirm\.addEventListener\('click'[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
  assert.ok(handler, 'the Add handler is found');
  assert.doesNotMatch(handler, /#sf-submitter/);
  assert.match(handler, /bulkSubmitter\(bulkInitials\.value\)/);
});

test('a split prefills the bulk box from the form\'s initials as the review opens', async () => {
  const src = await submitSource();
  const split = src.match(/async function splitFile\(file\)[\s\S]*?\n {2}\}\n/)?.[0] ?? '';
  assert.ok(split, 'splitFile is found');
  assert.match(split, /bulkInitialsPrefill\(/);
  assert.match(split, /#sf-submitter/);
});
