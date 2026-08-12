import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import { EXTRACTION_SCHEMA, buildExtractionPrompt, parseExtraction, normalizeExtraction } from '../lib/extract.js';

test('the schema is strict and covers every CSV field Claude may fill', () => {
  assert.equal(EXTRACTION_SCHEMA.type, 'object');
  assert.equal(EXTRACTION_SCHEMA.additionalProperties, false);
  for (const key of ['headline', 'type', 'subtype', 'blurb', 'source', 'topic', 'date', 'link']) {
    assert.ok(EXTRACTION_SCHEMA.properties[key], `schema missing ${key}`);
  }
  assert.deepEqual(EXTRACTION_SCHEMA.required, ['headline', 'type', 'subtype', 'blurb']);
});

test('the prompt carries the raw text, the link, and the submitter note', () => {
  const prompt = buildExtractionPrompt(blankRow({
    original_text: 'IES grant, applications due Oct 1',
    link: 'https://ies.ed.gov/grant',
    submitter: 'Sam',
    note: 'deadline is firm',
  }));
  assert.ok(prompt.includes('IES grant, applications due Oct 1'));
  assert.ok(prompt.includes('https://ies.ed.gov/grant'));
  assert.ok(prompt.includes('deadline is firm'));
});

test('the prompt lists every allowed type and subtype', () => {
  const prompt = buildExtractionPrompt(blankRow({ original_text: 'x' }));
  assert.ok(prompt.includes('Funding & Grants'));
  assert.ok(prompt.includes('Peer-Reviewed'));
  assert.ok(prompt.includes('spotlight'));
});

test('parseExtraction reads plain JSON and rejects garbage', () => {
  assert.deepEqual(parseExtraction('{"headline":"Hi"}'), { headline: 'Hi' });
  assert.throws(() => parseExtraction('not json'), /Claude returned something that is not JSON/);
});

test('normalizeExtraction keeps a valid type and subtype', () => {
  const { fields, warnings } = normalizeExtraction({
    headline: 'TEA teacher pay report', type: 'research', subtype: 'Report', blurb: 'A blurb.',
  });
  assert.equal(fields.type, 'research');
  assert.equal(fields.subtype, 'Report');
  assert.deepEqual(warnings, []);
});

test('normalizeExtraction blanks an unknown type and says so', () => {
  const { fields, warnings } = normalizeExtraction({
    headline: 'X', type: 'newsletter', subtype: 'Whatever', blurb: 'b',
  });
  assert.equal(fields.type, '');
  assert.equal(fields.subtype, '');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /newsletter/);
});

test('normalizeExtraction blanks a subtype that does not belong to its type', () => {
  const { fields, warnings } = normalizeExtraction({
    headline: 'X', type: 'headline', subtype: 'Working Paper', blurb: 'b',
  });
  assert.equal(fields.type, 'headline');
  assert.equal(fields.subtype, '');
  assert.match(warnings[0], /Working Paper/);
});

test('normalizeExtraction drops keys that are not CSV columns', () => {
  const { fields } = normalizeExtraction({
    headline: 'X', type: 'headline', subtype: 'Texas', blurb: 'b', status: 'processed', id: 'nope',
  });
  assert.equal(fields.status, undefined);
  assert.equal(fields.id, undefined);
});

test('normalizeExtraction coerces every value to a string', () => {
  const { fields } = normalizeExtraction({ headline: 'X', type: 'headline', subtype: 'Texas', blurb: 'b', date: 2026 });
  assert.equal(fields.date, '2026');
});
