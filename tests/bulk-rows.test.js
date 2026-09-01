import test from 'node:test';
import assert from 'node:assert/strict';
import { rowsToItems } from '../api/_lib/bulk-rows.js';
import { normalizeBulkItems } from '../api/_lib/bulk-split.js';

test('one spreadsheet row becomes one item, recognizable headers mapped straight in', () => {
  const items = rowsToItems([
    ['Title', 'Description', 'URL', 'Type', 'Subtype'],
    ['Fall data conference', 'Registration open.', 'https://x.org/conf', 'event', 'A&M'],
    ['Tutoring grants', 'Planning grants.', 'https://x.org/grants', 'opportunity', 'Funding & Grants'],
  ]);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    title: 'Fall data conference', blurb: 'Registration open.', link: 'https://x.org/conf',
    type: 'event', subtype: 'A&M', original_text: '',
  });
});

test('type columns accept display labels and plurals, not just keys', () => {
  const items = rowsToItems([
    ['Headline', 'Category'],
    ['A paper', 'New Ed Policy Research'],
    ['A webinar', 'Events'],
  ]);
  assert.equal(items[0].type, 'research');
  assert.equal(items[0].title, 'A paper');
  assert.equal(items[1].type, 'event');
});

test('unrecognized columns fold into original_text for submit-time enrichment', () => {
  const items = rowsToItems([
    ['Title', 'Link', 'When', 'Where'],
    ['Symposium', 'https://x.org/s', 'Sept 12, 2 PM', 'Harrington 108'],
  ]);
  assert.equal(items[0].original_text, 'When: Sept 12, 2 PM\nWhere: Harrington 108');
});

test('junk types get untyped by the shared normalizer, and shells drop', () => {
  const raw = rowsToItems([
    ['Title', 'Type'],
    ['Mystery item', 'banana'],
    ['', ''],
  ]);
  const { items, warnings } = normalizeBulkItems({ items: raw });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, '');
  assert.equal(warnings.length, 1);
});
