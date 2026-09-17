import test from 'node:test';
import assert from 'node:assert/strict';
import { pickType, typeChoices } from '../js/submit-form.js';
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

test('a bulk item posts its description and its extra columns as separate fields', async () => {
  const { bulkSubmissionBody } = await import('../js/submit-form.js');
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

test('typeRowFor says which pill row a type message is about', async () => {
  const { typeRowFor } = await import('../js/submit-form.js');
  assert.equal(typeRowFor('Pick a subtype.'), 'subtype');
  assert.equal(typeRowFor('Pick a real type.'), 'type');
  assert.equal(typeRowFor('Pick a type before a subtype.'), 'type');
  assert.equal(typeRowFor(''), 'type');
});

// ── Failed bulk rows keep their reason (audit round two, e16) ──

test('bulkRowProblem: no link says so before any attempt; a failed attempt keeps its message', async () => {
  const { bulkRowProblem } = await import('../js/submit-form.js');
  assert.equal(bulkRowProblem({ title: 'A', link: '' }), 'No link');
  assert.equal(bulkRowProblem({ title: 'A', link: 'https://x.org' }), '');
  assert.equal(bulkRowProblem({ title: 'A', link: 'https://x.org', error: "Couldn't save that." }), "Couldn't save that.");
  assert.equal(bulkRowProblem({ title: 'A', link: '', error: 'Add a link.' }), 'No link');
});

// ── The bulk button's word survives a redraw (audit round two, f10) ──

test('bulkConfirmLabel: Add N, Retry N after a failed run, and a disabled word when nothing is left', async () => {
  const { bulkConfirmLabel } = await import('../js/submit-form.js');
  assert.equal(bulkConfirmLabel(3, false), 'Add 3 to the queue');
  assert.equal(bulkConfirmLabel(2, true), 'Retry 2');
  assert.equal(bulkConfirmLabel(0, false), 'Nothing left to add');
  assert.equal(bulkConfirmLabel(0, true), 'Nothing left to add');
});
