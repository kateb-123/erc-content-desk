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

test('missing link and submitter still get their own plain-English errors', () => {
  const errors = validateSubmission({});
  assert.ok(errors.includes('Add a link.'));
  assert.ok(errors.includes('Add your name or initials.'));
});

test('title is optional — a link-only submission validates clean', () => {
  assert.deepEqual(validateSubmission({ link: 'https://x.org/p', submitter: 'KB' }), []);
});

test('blurb is optional for every type, including non-headlines', () => {
  assert.deepEqual(validateSubmission({ ...good, blurb: '' }), []);
  assert.deepEqual(
    validateSubmission({ ...good, blurb: '', type: 'headline', subtype: 'Texas' }), []);
});

test('type is optional — a blank type validates clean', () => {
  assert.deepEqual(
    validateSubmission({ link: 'https://x.org/p', submitter: 'KB', type: '', subtype: '' }), []);
});

test('a non-blank invalid type is still rejected', () => {
  const errors = validateSubmission({ link: 'https://x.org/p', submitter: 'KB', type: 'bogus' });
  assert.ok(errors.includes('Pick a real type.'));
});

test('missing link is still rejected even with everything else present', () => {
  const errors = validateSubmission({ ...good, link: '' });
  assert.ok(errors.includes('Add a link.'));
});

test('missing submitter is still rejected even with everything else present', () => {
  const errors = validateSubmission({ ...good, submitter: '' });
  assert.ok(errors.includes('Add your name or initials.'));
});

test('validateSubmission rejects a link that is not http(s)', () => {
  const errors = validateSubmission({
    title: 'T', blurb: 'B', link: 'javascript:alert(1)',
    type: 'headline', subtype: 'Texas', submitter: 'KB',
  });
  assert.ok(errors.some(e => e.includes('web link')));
});

test('validateSubmission still accepts a normal https link', () => {
  assert.deepEqual(validateSubmission({
    title: 'T', blurb: 'B', link: 'https://example.org/a',
    type: 'headline', subtype: 'Texas', submitter: 'KB',
  }), []);
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

test('blank type with non-blank subtype is rejected', () => {
  const errors = validateSubmission({ link: 'https://x.org/p', submitter: 'KB', type: '', subtype: 'Texas' });
  assert.ok(errors.includes('Pick a type before a subtype.'));
});

test('blank type with blank subtype validates clean', () => {
  assert.deepEqual(
    validateSubmission({ link: 'https://x.org/p', submitter: 'KB', type: '', subtype: '' }), []);
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
