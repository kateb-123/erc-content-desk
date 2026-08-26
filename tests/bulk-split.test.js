import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BULK_MODEL, BULK_SCHEMA, buildBulkPrompt, parseBulk, normalizeBulkItems,
} from '../api/_lib/bulk-split.js';

test('bulk split runs on Haiku with a strict items schema', () => {
  assert.equal(BULK_MODEL, 'claude-haiku-4-5');
  assert.equal(BULK_SCHEMA.additionalProperties, false);
  assert.deepEqual(Object.keys(BULK_SCHEMA.properties), ['items']);
  const item = BULK_SCHEMA.properties.items.items;
  assert.deepEqual(Object.keys(item.properties).sort(),
    ['blurb', 'link', 'original_text', 'subtype', 'title', 'type']);
  assert.ok(item.properties.type.enum.includes(''));
});

test('the prompt embeds the document and explains the vocabulary', () => {
  const prompt = buildBulkPrompt('Tab 1\nSome event...');
  assert.ok(prompt.includes('Some event...'));
  assert.ok(prompt.includes('Webinar-Online'));
  assert.ok(prompt.includes('verbatim'));
});

test('parseBulk rejects prose', () => {
  assert.throws(() => parseBulk('here are your items!'), /valid JSON/);
});

test('normalizeBulkItems validates vocabulary and drops empty shells', () => {
  const { items, warnings } = normalizeBulkItems({ items: [
    { title: 'Good', blurb: 'b', link: 'https://x.org', type: 'event', subtype: 'A&M', original_text: 'raw' },
    { title: 'Bad type', blurb: '', link: 'https://y.org', type: 'party', subtype: 'A&M', original_text: 'raw' },
    { title: 'Bad subtype', blurb: '', link: 'https://z.org', type: 'event', subtype: 'Texas', original_text: 'raw' },
    { title: '', blurb: '', link: '', type: '', subtype: '', original_text: 'noise' },
  ] });
  assert.equal(items.length, 3);
  assert.equal(items[1].type, '');
  assert.equal(items[1].subtype, '');
  assert.equal(items[2].type, 'event');
  assert.equal(items[2].subtype, '');
  assert.equal(warnings.length, 2);
});
