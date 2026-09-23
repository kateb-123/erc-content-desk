import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// The archive of sent issues (builder/newsletters/): Past issues reads
// index.json newest first, and every entry opens its own file.
const root = new URL('../builder/newsletters/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', root), 'utf8'));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

test('the archive index is newest first, one file per issue, labelled by its date', () => {
  assert.ok(index.length >= 15, 'the archive holds the issues through September 22, 2026');
  for (let n = 0; n < index.length; n++) {
    const { date, label } = index[n];
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/, `${date} is a date`);
    if (n) assert.ok(index[n - 1].date > date, `${index[n - 1].date} comes before ${date}`);
    const [y, m, d] = date.split('-').map(Number);
    assert.equal(label, `${MONTHS[m - 1]} ${d}, ${y}`);
    assert.ok(existsSync(new URL(`${date}.html`, root)), `${date}.html exists`);
  }
});

test('the September 22, 2026 issue is the one that went out, with the hand edits', () => {
  const html = readFileSync(new URL('2026-09-22.html', root), 'utf8');
  assert.match(html, /Resource Spotlight: Federal Data at Texas A&amp;M/);
  assert.match(html, /Let us know here!/);
  assert.match(html, /View more/);
  assert.doesNotMatch(html, /View on ERC website/i);
});
