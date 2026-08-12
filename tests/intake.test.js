import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmission, validateSubmission } from '../js/intake.js';

test('a submission needs content and a submitter name', () => {
  assert.deepEqual(validateSubmission({ content: 'https://example.com', submitter: 'Priya' }), []);
  assert.deepEqual(validateSubmission({ content: '   ', submitter: 'Priya' }), ['Add a link or paste some text.']);
  assert.deepEqual(validateSubmission({ content: 'x', submitter: '' }), ['Add your name.']);
  assert.equal(validateSubmission({ content: '', submitter: '' }).length, 2);
});

test('a bare URL becomes the row link and the original text', () => {
  const row = buildSubmission({
    content: '  https://www.edweek.org/policy/title-i  ',
    submitter: 'Priya',
    note: 'saw this in the listserv',
    submittedAt: '2026-08-12T15:00:00.000Z',
    id: 'row-1',
  });
  assert.equal(row.link, 'https://www.edweek.org/policy/title-i');
  assert.equal(row.original_text, 'https://www.edweek.org/policy/title-i');
  assert.equal(row.submitter, 'Priya');
  assert.equal(row.note, 'saw this in the listserv');
  assert.equal(row.submitted_at, '2026-08-12T15:00:00.000Z');
  assert.equal(row.status, 'new');
  assert.equal(row.id, 'row-1');
});

test('pasted prose keeps the text and pulls out the first URL it contains', () => {
  const row = buildSubmission({
    content: 'Great webinar coming up, register at https://ies.ed.gov/event before Friday',
    submitter: 'Sam',
    submittedAt: '2026-08-12T15:00:00.000Z',
    id: 'row-2',
  });
  assert.equal(row.link, 'https://ies.ed.gov/event');
  assert.ok(row.original_text.startsWith('Great webinar'));
});

test('text with no URL still submits, with an empty link', () => {
  const row = buildSubmission({
    content: 'ERC happy hour, third Thursday, Blackwater Draw',
    submitter: 'Kate',
    submittedAt: '2026-08-12T15:00:00.000Z',
    id: 'row-3',
  });
  assert.equal(row.link, '');
  assert.equal(row.original_text, 'ERC happy hour, third Thursday, Blackwater Draw');
});

test('a new submission carries no CSV fields yet', () => {
  const row = buildSubmission({ content: 'x', submitter: 'Kate', submittedAt: 't', id: 'i' });
  assert.equal(row.headline, '');
  assert.equal(row.type, '');
  assert.equal(row.blurb, '');
  assert.equal(row.newsletter, false);
});
