import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, buildSubmission } from '../js/intake.js';

const good = {
  title: 'Study on tutoring', blurb: 'A 40-word summary.', link: 'https://x.org/p',
  type: 'research', subtype: 'Working Paper', submitter: 'KB',
};

test('a complete submission validates clean', () => {
  assert.deepEqual(validateSubmission(good), []);
});

test('every missing field gets its own plain-English error', () => {
  const errors = validateSubmission({});
  assert.ok(errors.includes('Add a title.'));
  assert.ok(errors.includes('Add a link.'));
  assert.ok(errors.includes('Pick a type.'));
  assert.ok(errors.includes('Add your name or initials.'));
});

test('blurb is required except for headlines', () => {
  assert.ok(validateSubmission({ ...good, blurb: '' })
    .includes('Add a blurb — headlines are the only type that can skip it.'));
  assert.deepEqual(
    validateSubmission({ ...good, blurb: '', type: 'headline', subtype: 'Texas' }), []);
});

test('subtype must belong to the chosen type', () => {
  assert.ok(validateSubmission({ ...good, subtype: 'Texas' }).includes('Pick a subtype.'));
});

test('allowBlankSubtype lets a valid type through with no subtype, but not by default', () => {
  const blank = { ...good, subtype: '' };
  assert.ok(validateSubmission(blank).includes('Pick a subtype.'));
  assert.ok(!validateSubmission(blank, { allowBlankSubtype: true }).includes('Pick a subtype.'));
});

test('allowBlankSubtype does not excuse a non-blank invalid subtype', () => {
  const bad = { ...good, subtype: 'Texas' };
  assert.ok(validateSubmission(bad, { allowBlankSubtype: true }).includes('Pick a subtype.'));
});

test('buildSubmission fills a v2 row, trimmed and null-safe', () => {
  const row = buildSubmission({
    ...good, title: '  Study on tutoring  ', spotlight: true,
    submittedAt: '2026-08-26T15:00:00.000Z', id: 'fixed-id',
  });
  assert.equal(row.headline, 'Study on tutoring');
  assert.equal(row.blurb, 'A 40-word summary.');
  assert.equal(row.original_text, 'A 40-word summary.');
  assert.equal(row.link, 'https://x.org/p');
  assert.equal(row.type, 'research');
  assert.equal(row.subtype, 'Working Paper');
  assert.equal(row.spotlight_request, true);
  assert.equal(row.status, 'new');
  assert.equal(row.submitter, 'KB');
  assert.equal(row.submitted_at, '2026-08-26T15:00:00.000Z');
  assert.equal(row.id, 'fixed-id');
  const bare = buildSubmission({ id: 'x', submittedAt: 'y' });
  assert.equal(bare.headline, '');
  assert.equal(bare.spotlight_request, false);
});
