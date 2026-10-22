// tests/paper-fields.test.js: the paper read (Kate, Oct 22, 2026: "id rather
// it read it and filled it in"). The model is handed the paper's first pages
// as text and answers with the title, the authors, the journal, the year and
// the first author's last name; these rules shape what it is asked and keep
// only what comes back well formed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPaperPrompt, normalizePaperFields, PAPER_TEXT_MAX, PAPER_SCHEMA } from '../api/_lib/paper-fields.js';

test('the model is held to a JSON schema with the five fields, and the live call uses it with room for thinking and a cut-off check (review, Oct 22)', () => {
  assert.deepEqual(Object.keys(PAPER_SCHEMA.properties), ['title', 'authors', 'journal', 'year', 'firstAuthorLast']);
  assert.deepEqual(PAPER_SCHEMA.required, ['title', 'authors', 'journal', 'year', 'firstAuthorLast']);
  assert.equal(PAPER_SCHEMA.additionalProperties, false);
  const src = readFileSync(new URL('../api/briefs.js', import.meta.url), 'utf8');
  assert.match(src, /output_config: \{ effort: 'low', format: \{ type: 'json_schema', schema: PAPER_SCHEMA \} \}/);
  assert.match(src, /max_tokens: 4000/);
  assert.match(src, /stop_reason === 'max_tokens'/);
});

test('buildPaperPrompt asks for one JSON object, hands over the text, and never more than the cap', () => {
  const prompt = buildPaperPrompt('Screen or Barrier? Science of Reading Certification Exams\nAndrew Avitabile\nUniversity of Virginia');
  assert.match(prompt, /JSON/);
  assert.match(prompt, /"title"/);
  assert.match(prompt, /"authors"/);
  assert.match(prompt, /"journal"/);
  assert.match(prompt, /"year"/);
  assert.match(prompt, /"firstAuthorLast"/);
  assert.match(prompt, /Screen or Barrier\?/);
  assert.ok(buildPaperPrompt('x'.repeat(PAPER_TEXT_MAX + 5000)).length < PAPER_TEXT_MAX + 2000, 'the text is cut at the cap');
});

test('normalizePaperFields keeps well-formed answers, trimmed and capped', () => {
  assert.deepEqual(normalizePaperFields({
    title: '  Race, Nativity, and the Labor Market Returns to College Major-Occupation Alignment ',
    authors: 'Brian Holzman, Jeehee Han, Bethany Lewis, and Irina Chukhray',
    journal: 'AERA Open', year: 2026, firstAuthorLast: 'Holzman',
  }), {
    title: 'Race, Nativity, and the Labor Market Returns to College Major-Occupation Alignment',
    authors: 'Brian Holzman, Jeehee Han, Bethany Lewis, and Irina Chukhray',
    journal: 'AERA Open', year: '2026', firstAuthorLast: 'Holzman',
  });
});

test('normalizePaperFields: a year that is not four digits in range is blank, a working paper has no journal, unknowns are empty strings', () => {
  assert.equal(normalizePaperFields({ year: '26' }).year, '');
  assert.equal(normalizePaperFields({ year: 'October 5, 2026' }).year, '');
  assert.equal(normalizePaperFields({ year: '1850' }).year, '');
  assert.equal(normalizePaperFields({ year: '2026' }).year, '2026');
  assert.deepEqual(normalizePaperFields({}), { title: '', authors: '', journal: '', year: '', firstAuthorLast: '' });
  assert.deepEqual(normalizePaperFields(null), { title: '', authors: '', journal: '', year: '', firstAuthorLast: '' });
  assert.equal(normalizePaperFields({ journal: null, title: 42 }).journal, '');
});

test('normalizePaperFields: the first author\'s last name falls back to the authors line when the model leaves it out', () => {
  assert.equal(normalizePaperFields({ authors: 'Andrew Avitabile' }).firstAuthorLast, 'Avitabile');
  assert.equal(normalizePaperFields({ authors: 'Brian Holzman, Jeehee Han and Irina Chukhray' }).firstAuthorLast, 'Holzman');
  assert.equal(normalizePaperFields({ authors: 'Holzman, B., Han, J.' }).firstAuthorLast, 'Holzman', 'surname-first lists');
  assert.equal(normalizePaperFields({ authors: 'Esmeralda Sanchez Salazar' }).firstAuthorLast, 'Salazar', 'the last word, since the paper does not say more');
  assert.equal(normalizePaperFields({ authors: '' }).firstAuthorLast, '');
});

test('normalizePaperFields caps runaway strings', () => {
  const out = normalizePaperFields({ title: 'a'.repeat(1000), authors: 'b'.repeat(1000), journal: 'c'.repeat(500) });
  assert.equal(out.title.length, 500);
  assert.equal(out.authors.length, 500);
  assert.equal(out.journal.length, 200);
});
