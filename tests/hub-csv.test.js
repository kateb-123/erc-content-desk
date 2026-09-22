import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, CSV_COLUMNS } from '../js/schema.js';
import { escapeCell, hubRowLine, hubCsvFilename, hubCsvText } from '../js/hub-csv.js';

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

test('the saved copy is named for the day it was published, so backups sort', () => {
  assert.equal(hubCsvFilename(new Date('2026-09-09T21:40:00Z')), 'erc-exchange-2026-09-09.csv');
  assert.equal(hubCsvFilename(new Date('2026-01-05T00:00:00Z')), 'erc-exchange-2026-01-05.csv');
});

test('hubCsvFilename falls back to a plain name rather than "Invalid Date"', () => {
  assert.equal(hubCsvFilename(new Date('nonsense')), 'erc-exchange.csv');
});

test('hubCsvText is the header line, then one hub line per row, for the copy downloaded before Publish', () => {
  const text = hubCsvText([
    { date: '2026-09-22', headline: 'One, with a comma', link: 'https://x.org/1', type: 'headline', subtype: 'Texas' },
    { date: '2026-09-23', headline: 'Two', link: 'https://x.org/2', type: 'research', subtype: 'Report' },
  ]);
  const lines = text.split('\n');
  assert.equal(lines[0], CSV_COLUMNS.join(','));
  assert.equal(lines.length, 4);   // header, two rows, the trailing newline
  assert.equal(lines[3], '');
  assert.ok(lines[1].startsWith('2026-09-22,"One, with a comma",https://x.org/1,'));
  assert.ok(lines[2].startsWith('2026-09-23,Two,https://x.org/2,'));
  assert.equal(hubCsvText([]), `${CSV_COLUMNS.join(',')}\n`);
});
