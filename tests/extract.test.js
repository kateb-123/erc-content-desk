import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, TYPE_ORDER } from '../js/schema.js';
import {
  EXTRACT_MODEL, EXTRACTION_SCHEMA, buildExtractionPrompt,
  parseExtraction, normalizeExtraction,
} from '../api/_lib/extract.js';

test('extraction runs on Haiku and can also guess title, blurb, and typing', () => {
  assert.equal(EXTRACT_MODEL, 'claude-haiku-4-5');
  assert.equal(EXTRACTION_SCHEMA.additionalProperties, false);
  assert.deepEqual(Object.keys(EXTRACTION_SCHEMA.properties).sort(), [
    'authors', 'blurb', 'clean_blurb', 'date', 'deadline', 'headline', 'link_matches', 'location', 'medium',
    'needs_review', 'source', 'subtype', 'time', 'topic', 'type',
  ]);
  assert.equal(EXTRACTION_SCHEMA.required.length, 15);
  // The type enum's contents are asserted against the schema further down,
  // rather than retyped here where a new type would go unnoticed.
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

test('normalizeExtraction rejects prototype-chain names via the safe schema helpers', () => {
  const row = blankRow({ type: '', subtype: '' });
  const guessed = normalizeExtraction({ type: 'constructor', subtype: 'toString' }, row);
  assert.equal('type' in guessed.fields, false);
  assert.equal('subtype' in guessed.fields, false);
  const typedRow = blankRow({ type: 'constructor', subtype: '' });
  const subtypeGuess = normalizeExtraction({ subtype: 'hasOwnProperty' }, typedRow);
  assert.equal('subtype' in subtypeGuess.fields, false);
});

test('the prompt uses hard imperatives when headline, blurb, or type are missing', () => {
  const blankFields = blankRow({ link: 'https://example.org' });
  const blankPrompt = buildExtractionPrompt(blankFields);
  assert.ok(blankPrompt.includes('you MUST write `headline`'), 'prompt should demand headline when missing');
  assert.ok(blankPrompt.includes('you MUST write `blurb`'), 'prompt should demand blurb when missing');
  assert.ok(blankPrompt.includes('you MUST pick `type`'), 'prompt should demand type when missing');

  const fullyProvided = blankRow({
    headline: 'Test Title', blurb: 'Test blurb.', type: 'event', subtype: 'Webinar-Online',
    link: 'https://example.org',
  });
  const filledPrompt = buildExtractionPrompt(fullyProvided);
  assert.ok(filledPrompt.includes('Return "" for headline'), 'prompt should allow empty values when provided');
  assert.equal(filledPrompt.includes('you MUST write `headline`'), false, 'prompt should not demand headline when provided');
  assert.equal(filledPrompt.includes('you MUST write `blurb`'), false, 'prompt should not demand blurb when provided');
  assert.equal(filledPrompt.includes('you MUST pick `type`'), false, 'prompt should not demand type when provided');
});

test('the type enum is built from the schema, so a new type is offered automatically', () => {
  assert.deepEqual(EXTRACTION_SCHEMA.properties.type.enum, ['', ...TYPE_ORDER]);
  assert.ok(EXTRACTION_SCHEMA.properties.type.enum.includes('erc_event'));
});

test('the prompt tells the reader what separates an ERC Event from an A&M event', () => {
  const prompt = buildExtractionPrompt({ headline: '', blurb: '', link: '', type: '', subtype: '' }, '');
  assert.match(prompt, /erc_event is for events the Education Research Center/);
  assert.match(prompt, /When in doubt use event, not erc_event/);
  // A flat type must not read as "erc_event: " with nothing after it.
  assert.match(prompt, /erc_event: \(no subtype/);
});

test('an extracted ERC Event keeps its blank subtype instead of being stripped', () => {
  const { fields } = normalizeExtraction(
    { type: 'erc_event', subtype: '', time: '3:30 PM CT', location: 'Harrington Tower' },
    { type: '', subtype: '' },
  );
  assert.equal(fields.type, 'erc_event');
  assert.equal(fields.location, 'Harrington Tower');
});

test('the reader also returns a cleaned description, kept out of the row columns', () => {
  assert.ok(EXTRACTION_SCHEMA.required.includes('clean_blurb'));
  assert.equal(EXTRACTION_SCHEMA.properties.clean_blurb.type, 'string');
  const { fields, cleanBlurb } = normalizeExtraction(
    { clean_blurb: 'Dr. Kinskey discusses socioscientific issues in elementary science.', date: '2026-09-11' },
    blankRow({ type: 'erc_event' }),
  );
  assert.equal(cleanBlurb, 'Dr. Kinskey discusses socioscientific issues in elementary science.');
  assert.equal('clean_blurb' in fields, false);
  assert.equal(fields.date, '2026-09-11');
});

test('for a pasted event or opportunity, the prompt asks for a short factual description without the logistics lines', () => {
  const pasted = 'Date: Friday, September 11, 2026\nTime: 11:30 a.m. – 1:00 p.m.\nLocation: Rudder 401\n\nPlease join the ERC for an Ed Talk.';
  for (const type of ['event', 'erc_event', 'opportunity']) {
    const prompt = buildExtractionPrompt(blankRow({ headline: 'Talk', type, blurb: pasted, original_text: pasted }));
    assert.match(prompt, /`clean_blurb`/, `${type}: should ask for clean_blurb`);
    assert.match(prompt, /date, time, or place/, `${type}: should drop the logistics lines`);
    assert.match(prompt, /who would find it useful/, `${type}: should ban reader-commentary`);
  }
});

test('research and headlines keep their text: the prompt returns an empty clean_blurb for them', () => {
  for (const type of ['research', 'headline']) {
    const prompt = buildExtractionPrompt(blankRow({ headline: 'Paper', type, blurb: 'An abstract.', original_text: 'An abstract.' }));
    assert.match(prompt, /Return "" for clean_blurb/, `${type}: clean_blurb should stay empty`);
  }
});

test('with no description, the reader must write one from the text and the page, except for a headline', () => {
  const extrasOnly = blankRow({ headline: 'A paper', type: 'research', blurb: '', original_text: 'date: 2026-07\nsource: NBER', link: 'https://a.org' });
  assert.match(buildExtractionPrompt(extrasOnly), /you MUST write `blurb`/);
  const headline = blankRow({ headline: 'A story', type: 'headline', blurb: '', original_text: 'date: 2026-07\nmedium: online', link: 'https://a.org' });
  assert.doesNotMatch(buildExtractionPrompt(headline), /you MUST write `blurb`/);
  assert.match(buildExtractionPrompt(headline), /Return "" for blurb/);
});

test('the reader says whether the page behind the link is about this item (F20)', () => {
  assert.equal(EXTRACTION_SCHEMA.properties.link_matches.type, 'boolean');
  assert.ok(EXTRACTION_SCHEMA.required.includes('link_matches'));
  const prompt = buildExtractionPrompt(blankRow({ headline: 'Teacher Sorting', type: 'research', link: 'https://a.org' }), 'PAGE about bureaucrats');
  assert.match(prompt, /link_matches/);
  const row = blankRow({ headline: 'T', type: 'research' });
  assert.equal(normalizeExtraction({ link_matches: false }, row).linkMismatch, true);
  assert.equal(normalizeExtraction({ link_matches: true }, row).linkMismatch, false);
  assert.equal(normalizeExtraction({}, row).linkMismatch, false);
});
