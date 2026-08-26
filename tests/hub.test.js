import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, CSV_COLUMNS } from '../js/schema.js';
import { parseCsv, csvLinks, diffAgainstHub, appendRowsToCsv } from '../api/_lib/hub.js';

const HEADER = CSV_COLUMNS.join(',');
const CSV = `${HEADER}\n2026-07-23,"A, quoted title",https://x.org/1,event,Webinar-Online,Src,Topic,"He said ""hi""",,,,1:00 PM CT,Virtual,\n`;

test('parseCsv handles quoted commas, doubled quotes, and CRLF', () => {
  const rows = parseCsv(CSV.replace(/\n/g, '\r\n'));
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], 'A, quoted title');
  assert.equal(rows[1][7], 'He said "hi"');
  assert.equal(rows[1][2], 'https://x.org/1');
});

test('csvLinks pulls the link column by header position', () => {
  assert.deepEqual([...csvLinks(CSV)], ['https://x.org/1']);
});

test('diffAgainstHub splits by link membership', () => {
  const dupe = blankRow({ id: 'a', link: 'https://x.org/1' });
  const fresh = blankRow({ id: 'b', link: 'https://x.org/2' });
  const linkless = blankRow({ id: 'c', link: '' });
  const { newRows, skipped } = diffAgainstHub(CSV, [dupe, fresh, linkless]);
  assert.deepEqual(newRows.map(r => r.id), ['b', 'c']);
  assert.deepEqual(skipped.map(r => r.id), ['a']);
});

test('appendRowsToCsv appends lines and never touches existing content', () => {
  const row = blankRow({ date: '2026-09-01', headline: 'New', link: 'https://x.org/2', type: 'research', subtype: 'Report' });
  const out = appendRowsToCsv(CSV, [row]);
  assert.ok(out.startsWith(CSV.trimEnd()));
  assert.ok(out.endsWith('\n'));
  assert.equal(out.trimEnd().split('\n').length, 3);
  assert.ok(out.includes('2026-09-01,New,https://x.org/2,research,Report'));
});

test('appendRowsToCsv preserves input without trailing newline', () => {
  const noTrail = CSV.trimEnd();
  const row = blankRow({ date: '2026-09-01', headline: 'New', link: 'https://x.org/2', type: 'research', subtype: 'Report' });
  const out = appendRowsToCsv(noTrail, [row]);
  assert.equal(out.slice(0, noTrail.length), noTrail);
  assert.ok(out.endsWith('\n'));
  assert.equal(out.trimEnd().split('\n').length, 3);
});
