import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, CSV_COLUMNS } from '../js/schema.js';
import { escapeCell, rowsToCsv, hubCsvFor } from '../js/hub-csv.js';

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

test('the header is exactly the hub column list', () => {
  const csv = rowsToCsv([]);
  assert.equal(csv.trim(), CSV_COLUMNS.join(','));
});

test('rows are written in column order with no workflow columns', () => {
  const csv = rowsToCsv([blankRow({
    date: '2026-07-28', headline: 'A report', link: 'https://x.test', type: 'research',
    subtype: 'Report', source: 'TEA', blurb: 'Body.', submitter: 'Kate', status: 'processed',
  })]);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].startsWith('2026-07-28,A report,https://x.test,research,Report,TEA,'));
  assert.ok(!csv.includes('Kate'));
});

test('every column lands in its own position, not just the leading few', () => {
  // The hub reads news.csv by position, so a swap anywhere in the 14 columns
  // corrupts the public feed. Give each column a distinct value and check all
  // of them, rather than only the ones a sample row happens to fill.
  const marked = {};
  CSV_COLUMNS.forEach((col, i) => { marked[col] = `v${i}-${col}`; });
  const csv = rowsToCsv([blankRow({ ...marked, submitter: 'Kate', status: 'processed' })]);
  const cells = csv.trim().split('\n')[1].split(',');
  assert.equal(cells.length, CSV_COLUMNS.length);
  CSV_COLUMNS.forEach((col, i) => {
    assert.equal(cells[i], `v${i}-${col}`, `column ${i} should be ${col}`);
  });
});

test('hubCsvFor takes only processed, hub-flagged, not-yet-downloaded rows', () => {
  const rows = [
    blankRow({ headline: 'In', status: 'processed', hub: true, date: '2026-07-01' }),
    blankRow({ headline: 'Newsletter only', status: 'processed', newsletter: true, date: '2026-07-02' }),
    blankRow({ headline: 'Not processed', status: 'kept', hub: true, date: '2026-07-03' }),
    blankRow({ headline: 'Already sent', status: 'processed', hub: true, hub_used_at: '2026-07-04', date: '2026-07-04' }),
  ];
  const csv = hubCsvFor(rows);
  assert.ok(csv.includes('In'));
  assert.ok(!csv.includes('Newsletter only'));
  assert.ok(!csv.includes('Not processed'));
  assert.ok(!csv.includes('Already sent'));
});

test('hubCsvFor sorts newest first, blank dates last', () => {
  const rows = [
    blankRow({ headline: 'Older', status: 'processed', hub: true, date: '2026-06-01' }),
    blankRow({ headline: 'Newer', status: 'processed', hub: true, date: '2026-08-01' }),
    blankRow({ headline: 'Undated', status: 'processed', hub: true, date: '' }),
  ];
  const lines = hubCsvFor(rows).trim().split('\n');
  assert.ok(lines[1].includes('Newer'));
  assert.ok(lines[2].includes('Older'));
  assert.ok(lines[3].includes('Undated'));
});
