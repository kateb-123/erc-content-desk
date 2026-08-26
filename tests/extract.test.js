import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import {
  EXTRACT_MODEL, EXTRACTION_SCHEMA, buildExtractionPrompt,
  parseExtraction, normalizeExtraction,
} from '../api/_lib/extract.js';

test('extraction runs on Haiku with a strict metadata-only schema', () => {
  assert.equal(EXTRACT_MODEL, 'claude-haiku-4-5');
  assert.equal(EXTRACTION_SCHEMA.additionalProperties, false);
  assert.deepEqual(Object.keys(EXTRACTION_SCHEMA.properties).sort(), [
    'authors', 'date', 'deadline', 'location', 'medium',
    'needs_review', 'source', 'time', 'topic',
  ]);
  assert.equal(EXTRACTION_SCHEMA.required.length, 9);
  assert.equal('headline' in EXTRACTION_SCHEMA.properties, false);
});

test('the prompt carries the typed fields and the raw text, and forbids invention', () => {
  const row = blankRow({
    headline: 'AEI debate', type: 'event', subtype: 'Webinar-Online',
    blurb: 'Sept 2, 6:30pm ET, hybrid.', link: 'https://aei.org/e', submitter: 'KB',
  });
  const prompt = buildExtractionPrompt(row);
  assert.ok(prompt.includes('AEI debate'));
  assert.ok(prompt.includes('event / Webinar-Online'));
  assert.ok(prompt.includes('Sept 2, 6:30pm ET, hybrid.'));
  assert.ok(prompt.includes('https://aei.org/e'));
  assert.ok(prompt.includes('Never invent'));
  assert.ok(prompt.includes('Central'));
});

test('parseExtraction rejects non-JSON', () => {
  assert.throws(() => parseExtraction('sorry, here is prose'), /valid JSON/);
});

test('normalizeExtraction keeps only the metadata fields and surfaces needs_review', () => {
  const { fields, warnings } = normalizeExtraction({
    date: '2026-09-02', time: 305, headline: 'sneaky', needs_review: true, bogus: 'x',
  });
  assert.deepEqual(Object.keys(fields).sort(), ['date', 'time']);
  assert.equal(fields.time, '305');
  assert.equal('headline' in fields, false);
  assert.equal(warnings.length, 1);
});
