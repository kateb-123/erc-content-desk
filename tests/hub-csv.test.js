import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, CSV_COLUMNS } from '../js/schema.js';
import { escapeCell, hubRowLine } from '../js/hub-csv.js';

test('plain values are written bare', () => {
  assert.equal(escapeCell('Teacher pay'), 'Teacher pay');
  assert.equal(escapeCell(''), '');
});

test('commas, quotes, and newlines are quoted the way the hub CSV does it', () => {
  assert.equal(escapeCell('Promotion, Retention'), '"Promotion, Retention"');
  assert.equal(escapeCell('She said "no"'), '"She said ""no"""');
  assert.equal(escapeCell('line one\nline two'), '"line one\nline two"');
  // A blurb quoting someone mid-sentence hits both rules at once.
  assert.equal(escapeCell('He said "yes, maybe"'), '"He said ""yes, maybe"""');
  assert.equal(escapeCell('line one\rline two'), '"line one\rline two"');
});

test('hubRowLine emits all 14 hub columns positionally', () => {
  const row = blankRow();
  CSV_COLUMNS.forEach((col, i) => { row[col] = `v${i}-${col}`; });
  const cells = hubRowLine(row).split(',');
  assert.equal(cells.length, 14);
  assert.equal(cells[0], 'v0-date');
  assert.equal(cells[13], 'v13-infographic');
});
