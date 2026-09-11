import test from 'node:test';
import assert from 'node:assert/strict';
import { pickType } from '../js/submit-form.js';

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
