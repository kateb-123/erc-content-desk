import test from 'node:test';
import assert from 'node:assert/strict';
import { SHEET_COLUMNS } from '../js/schema.js';
import { createDb, diffRows } from '../api/_lib/db.js';

/** A query function that records every call and answers from a script. */
function fakeQuery(answers = []) {
  const calls = [];
  const query = async (text, params = []) => {
    calls.push({ text, params });
    return answers.shift() ?? [];
  };
  query.calls = calls;
  return query;
}

const sample = {
  date: '2026-09-01', headline: 'A', link: 'https://x', type: 'research', subtype: 'Report',
  source: 'S', topic: '', blurb: 'B', deadline: '', medium: '', authors: '', time: '', location: '',
  infographic: '', id: 'id-1', status: 'kept', submitter: 'KB', submitted_at: '2026-09-01T00:00:00Z',
  spotlight_request: true, note: '', original_text: '', published_at: '', newsletter_issue: '',
  auto_filled: '', link_checked: '', rewrite_checked: '', submitter_email: '', needs_review: '',
};

test('ensureSchema makes an items table with every sheet column, quoted, plus schedule', async () => {
  const q = fakeQuery();
  await createDb(q).ensureSchema();
  const all = q.calls.map(c => c.text).join('\n');
  assert.match(all, /CREATE TABLE IF NOT EXISTS items/);
  for (const col of SHEET_COLUMNS) assert.match(all, new RegExp(`"${col}" text`));
  assert.match(all, /CREATE TABLE IF NOT EXISTS schedule/);
});

test('upsertRows sends one insert per chunk with ON CONFLICT (id)', async () => {
  const q = fakeQuery();
  const rows = [sample, { ...sample, id: 'id-2', _rowNumber: 3 }];
  await createDb(q).upsertRows(rows);
  assert.equal(q.calls.length, 1);
  const { text, params } = q.calls[0];
  assert.match(text, /INSERT INTO items/);
  assert.match(text, /ON CONFLICT \("id"\) DO UPDATE/);
  // sheet_row + every column, per row
  assert.equal(params.length, rows.length * (SHEET_COLUMNS.length + 1));
  assert.equal(params[0], null);            // sample has no _rowNumber
  assert.equal(params[SHEET_COLUMNS.length + 1], 3);
  assert.equal(params[params.length - 1], '');   // needs_review, last sheet column
});

test('upsertRows refuses a row with no id rather than inventing one', async () => {
  const q = fakeQuery();
  await assert.rejects(() => createDb(q).upsertRows([{ ...sample, id: '' }]), /id/);
  assert.equal(q.calls.length, 0);
});

test('readAllRows comes back in seq order, shaped like a sheet row', async () => {
  const dbRow = { seq: 7, sheet_row: 9, ...Object.fromEntries(SHEET_COLUMNS.map(c => [c, ''])), id: 'id-1', spotlight_request: 'TRUE', headline: 'A' };
  const q = fakeQuery([[dbRow]]);
  const rows = await createDb(q).readAllRows();
  assert.match(q.calls[0].text, /ORDER BY seq/);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].headline, 'A');
  assert.equal(rows[0].spotlight_request, true);   // text in the table, boolean in the app
  assert.equal(rows[0]._rowNumber, 7);
});

test('updateRow writes every column by id and throws when nothing matched', async () => {
  const q = fakeQuery([[{ id: 'id-1' }]]);
  await createDb(q).updateRow(sample);
  const { text, params } = q.calls[0];
  assert.match(text, /UPDATE items SET/);
  assert.match(text, /WHERE "id" = \$\d+/);
  assert.equal(params[params.length - 1], 'id-1');
  await assert.rejects(() => createDb(fakeQuery([[]])).updateRow(sample), /id-1/);
});

test('appendRow inserts one row', async () => {
  const q = fakeQuery();
  await createDb(q).appendRow(sample);
  assert.match(q.calls[0].text, /INSERT INTO items/);
  assert.equal(q.calls[0].params.length, SHEET_COLUMNS.length);
});

test('schedule round trip: replace, then read back as [[date], ...]', async () => {
  const q = fakeQuery([[], [], [{ issue_date: '2026-09-22' }, { issue_date: '2026-10-06' }]]);
  const db = createDb(q);
  await db.replaceSchedule(['2026-09-22', '2026-10-06']);
  assert.deepEqual(await db.readScheduleRows(), [['2026-09-22'], ['2026-10-06']]);
});

test('diffRows: identical data is silent, a changed field or a missing row is named', () => {
  assert.deepEqual(diffRows([sample], [{ ...sample, _rowNumber: 99 }]), []);
  assert.deepEqual(diffRows([sample], [{ ...sample, headline: 'Z' }]),
    [{ id: 'id-1', field: 'headline', sheet: 'A', db: 'Z' }]);
  assert.deepEqual(diffRows([sample], []), [{ id: 'id-1', field: '*', sheet: 'present', db: 'missing' }]);
});

test('meta: get reads one key, set upserts it', async () => {
  const q = fakeQuery([[{ value: '2026-09-10T18:00:00.000Z' }], []]);
  const store = createDb(q);
  assert.equal(await store.getMeta('schedule_synced_at'), '2026-09-10T18:00:00.000Z');
  assert.deepEqual(q.calls[0].params, ['schedule_synced_at']);
  await store.setMeta('schedule_synced_at', 'later');
  assert.match(q.calls[1].text, /INSERT INTO meta/);
  assert.match(q.calls[1].text, /ON CONFLICT \(key\) DO UPDATE/);
  assert.deepEqual(q.calls[1].params, ['schedule_synced_at', 'later']);
  assert.equal(await createDb(fakeQuery([[]])).getMeta('nothing'), null);
});

test('ensureSchema also makes the meta table', async () => {
  const q = fakeQuery();
  await createDb(q).ensureSchema();
  assert.match(q.calls.map(c => c.text).join('\n'), /CREATE TABLE IF NOT EXISTS meta/);
});

test('ensureSchema adds columns the live items table predates, starting with pending_read', async () => {
  const { createDb } = await import('../api/_lib/db.js');
  const sql = [];
  const store = createDb(async text => { sql.push(text); return []; });
  await store.ensureSchema();
  assert.ok(sql.some(t => /ALTER TABLE items[\s\S]*ADD COLUMN IF NOT EXISTS "pending_read" text NOT NULL DEFAULT ''/.test(t)),
    'expected an ALTER TABLE that adds pending_read when missing');
});
