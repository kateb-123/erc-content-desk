// tests/paper-read.test.js: the browser side of the paper read (Kate, Oct 22,
// 2026). pdf.js hands back a page as text items; pageText lays them out as
// lines; fillFromPaper decides which boxes the answer may fill: only the
// empty ones, never what she typed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageText, fillFromPaper, PAPER_PAGES, PAPER_TEXT_CAP, PDFJS_URL, PDFJS_WORKER_URL } from '../js/paper-read.js';

test('pageText joins a page\'s text items into lines, a break where pdf.js marks the end of a line', () => {
  const items = [
    { str: 'Screen or Barrier?', hasEOL: false }, { str: ' Science of Reading', hasEOL: true },
    { str: 'Andrew Avitabile', hasEOL: true }, { str: '', hasEOL: false }, { str: 'University of Virginia', hasEOL: false },
  ];
  assert.equal(pageText(items), 'Screen or Barrier? Science of Reading\nAndrew Avitabile\nUniversity of Virginia');
});

test('pageText survives items without strings and squeezes runs of blanks', () => {
  assert.equal(pageText([{ str: 'a   b', hasEOL: false }, {}, { str: 'c', hasEOL: true }, { str: '  ' }]), 'a b c');
});

test('pageText uses the items\' geometry: a word split across two touching items stays one word, a gap becomes a space', () => {
  const at = (str, x, width, size = 10) => ({ str, width, transform: [size, 0, 0, size, x, 700] });
  assert.equal(pageText([at('Scre', 100, 20), at('en', 120, 10), at('or', 135, 10), at('Barrier?', 150, 40)]), 'Screen or Barrier?');
});

test('fillFromPaper fills only the empty boxes, and the last name from the first author', () => {
  const found = { title: 'Race, Nativity', authors: 'Brian Holzman, Jeehee Han', journal: 'AERA Open', year: '2026', firstAuthorLast: 'Holzman' };
  assert.deepEqual(fillFromPaper(found, { paperTitle: '', authors: '', journal: '', year: '', authorLast: '' }),
    { paperTitle: 'Race, Nativity', authors: 'Brian Holzman, Jeehee Han', journal: 'AERA Open', year: '2026', authorLast: 'Holzman' });
  assert.deepEqual(fillFromPaper(found, { paperTitle: 'Her title', authors: ' ', journal: 'EEPA', year: '2026', authorLast: 'Chukhray' }),
    { authors: 'Brian Holzman, Jeehee Han' }, 'what she typed stays; a box of spaces counts as empty');
});

test('fillFromPaper: the year box starts with this year filled in, so the paper\'s year may replace a default year', () => {
  const found = { title: 't', authors: 'a', journal: 'j', year: '2025', firstAuthorLast: 'a' };
  assert.equal(fillFromPaper(found, { paperTitle: '', authors: '', journal: '', year: '2026', authorLast: '' }, { defaultYear: '2026' }).year, '2025');
  assert.equal('year' in fillFromPaper(found, { paperTitle: '', authors: '', journal: '', year: '2024', authorLast: '' }, { defaultYear: '2026' }), false, 'a year she changed stays');
  assert.equal('year' in fillFromPaper({ ...found, year: '' }, { paperTitle: '', authors: '', journal: '', year: '2026', authorLast: '' }, { defaultYear: '2026' }), false, 'no year from the paper, nothing to fill');
});

test('fillFromPaper leaves blanks alone and never invents', () => {
  assert.deepEqual(fillFromPaper({ title: '', authors: '', journal: '', year: '', firstAuthorLast: '' }, { paperTitle: '', authors: '', journal: '', year: '', authorLast: '' }), {});
  assert.deepEqual(fillFromPaper(null, { paperTitle: '', authors: '', journal: '', year: '', authorLast: '' }), {});
});

test('the pdf.js build is pinned on cdnjs and reads two pages at most, capped', () => {
  assert.match(PDFJS_URL, /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/4\.10\.38\/pdf\.min\.mjs$/);
  assert.match(PDFJS_WORKER_URL, /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/4\.10\.38\/pdf\.worker\.min\.mjs$/);
  assert.equal(PAPER_PAGES, 2);
  assert.equal(PAPER_TEXT_CAP, 8000);
});
