import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import {
  EXTRACT_MODEL, EXTRACTION_SCHEMA, buildExtractionPrompt,
  parseExtraction, normalizeExtraction,
} from '../api/_lib/extract.js';

test('extraction runs on Haiku and can also guess title, blurb, and typing', () => {
  assert.equal(EXTRACT_MODEL, 'claude-haiku-4-5');
  assert.equal(EXTRACTION_SCHEMA.additionalProperties, false);
  assert.deepEqual(Object.keys(EXTRACTION_SCHEMA.properties).sort(), [
    'authors', 'blurb', 'date', 'deadline', 'headline', 'location', 'medium',
    'needs_review', 'source', 'subtype', 'time', 'topic', 'type',
  ]);
  assert.equal(EXTRACTION_SCHEMA.required.length, 13);
  assert.deepEqual(EXTRACTION_SCHEMA.properties.type.enum,
    ['', 'research', 'event', 'opportunity', 'headline']);
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

test('normalizeExtraction keeps known fields, drops unknown keys, surfaces needs_review', () => {
  const { fields, warnings } = normalizeExtraction({
    date: '2026-09-02', time: 305, headline: 'A usable title', needs_review: true, bogus: 'x',
  }, blankRow());
  assert.deepEqual(Object.keys(fields).sort(), ['date', 'headline', 'time']);
  assert.equal(fields.time, '305');
  assert.equal('bogus' in fields, false);
  assert.equal(warnings.length, 1);
});

test('the prompt does not duplicate raw text when both blurb and original_text are present', () => {
  const row = blankRow({
    headline: 'AEI debate', type: 'event', subtype: 'Webinar-Online',
    blurb: 'Sept 2, 6:30pm ET, hybrid.', original_text: 'Sept 2, 6:30pm ET, hybrid.',
    link: 'https://aei.org/e', submitter: 'KB',
  });
  const prompt = buildExtractionPrompt(row);
  const occurrences = prompt.split('Sept 2, 6:30pm ET, hybrid.').length - 1;
  assert.equal(occurrences, 1, 'raw text should appear exactly once in the prompt');
});

test('the prompt embeds the fetched page text and the legal subtype lists', () => {
  const row = blankRow({ headline: 'X', type: '', subtype: '', link: 'https://a.org' });
  const prompt = buildExtractionPrompt(row, 'PAGE TEXT SENTINEL about a fellowship deadline.');
  assert.ok(prompt.includes('PAGE TEXT SENTINEL'));
  assert.ok(prompt.includes('Funding & Grants'));
  assert.ok(prompt.includes('Webinar-Online'));
  const bare = buildExtractionPrompt(row);
  assert.equal(bare.includes('PAGE TEXT SENTINEL'), false);
});

test('normalizeExtraction validates guessed typing against the schema', () => {
  const row = blankRow({ type: '', subtype: '' });
  const good = normalizeExtraction({ type: 'event', subtype: 'Webinar-Online' }, row);
  assert.equal(good.fields.type, 'event');
  assert.equal(good.fields.subtype, 'Webinar-Online');
  const badSub = normalizeExtraction({ type: 'event', subtype: 'Funding & Grants' }, row);
  assert.equal(badSub.fields.type, 'event');
  assert.equal('subtype' in badSub.fields, false);
  const typedRow = blankRow({ type: 'research', subtype: '' });
  const wrongForHuman = normalizeExtraction({ type: '', subtype: 'Texas' }, typedRow);
  assert.equal('subtype' in wrongForHuman.fields, false);
});
