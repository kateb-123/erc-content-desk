import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, SCHEDULE_SHEET_TIMEOUT_MS } from '../api/_lib/store.js';

const row = (id, extra = {}) => ({ id, headline: `H ${id}`, status: 'kept', ...extra });

/** A backend that records calls and can be told to fail a verb. */
function fake(rows = [], { fail = {} } = {}) {
  const calls = [];
  const maybe = verb => { if (fail[verb]) throw new Error(`${verb} down`); };
  return {
    calls,
    readAllRows: async () => { calls.push(['readAllRows']); maybe('readAllRows'); return rows.map(r => ({ ...r })); },
    appendRow: async r => { calls.push(['appendRow', r.id]); maybe('appendRow'); },
    updateRow: async r => {
      calls.push(['updateRow', r.id, r._rowNumber]); maybe('updateRow');
      if (!rows.some(x => x.id === r.id)) throw new Error(`no row with id ${r.id}`);
    },
    readScheduleRows: async (opts) => { calls.push(['readScheduleRows', opts?.timeoutMs]); maybe('readScheduleRows'); return [['2026-09-22']]; },
    replaceSchedule: async d => { calls.push(['replaceSchedule', d.join(',')]); },
  };
}

const quiet = { error() {} };

test('db mode: reads come from the database, never the sheet', async () => {
  const db = fake([row('a', { _rowNumber: 1 })]);
  const sheet = fake([row('a', { _rowNumber: 2 })]);
  const rows = await createStore({ mode: 'db', db, sheet, log: quiet }).readAllRows();
  assert.equal(rows[0]._rowNumber, 1);
  assert.equal(sheet.calls.length, 0);
});

test('db mode: append writes the database, then mirrors to the sheet', async () => {
  const db = fake(), sheet = fake();
  await createStore({ mode: 'db', db, sheet, log: quiet }).appendRow(row('n'));
  assert.deepEqual(db.calls, [['appendRow', 'n']]);
  assert.deepEqual(sheet.calls, [['appendRow', 'n']]);
});

test('db mode: a sheet mirror failure is logged, not thrown; a database failure is thrown and never mirrored', async () => {
  const logged = [];
  const log = { error: (...a) => logged.push(a.join(' ')) };
  const okDb = fake(), badSheet = fake([], { fail: { appendRow: true } });
  await createStore({ mode: 'db', db: okDb, sheet: badSheet, log }).appendRow(row('n'));
  assert.equal(logged.length, 1);
  assert.match(logged[0], /mirror/);

  const badDb = fake([], { fail: { appendRow: true } }), sheet = fake();
  await assert.rejects(() => createStore({ mode: 'db', db: badDb, sheet, log }).appendRow(row('n')), /appendRow down/);
  assert.equal(sheet.calls.length, 0);
});

test('db mode: updateRows writes each row by id, counts the unmatched, and mirrors with ONE sheet read', async () => {
  const db = fake([row('a'), row('b')]);
  const sheet = fake([row('b', { _rowNumber: 7 }), row('a', { _rowNumber: 9 })]);
  const out = await createStore({ mode: 'db', db, sheet, log: quiet })
    .updateRows([row('a', { _rowNumber: 1 }), row('gone', { _rowNumber: 2 }), row('b', { _rowNumber: 3 })]);
  assert.deepEqual(out, { saved: 2, unmatched: 1 });
  assert.equal(sheet.calls.filter(c => c[0] === 'readAllRows').length, 1);
  // mirrored at the SHEET's row numbers, not the database's
  assert.deepEqual(sheet.calls.filter(c => c[0] === 'updateRow'), [['updateRow', 'a', 9], ['updateRow', 'b', 7]]);
});

test('db mode: schedule comes from the sheet (Kate edits it there) and is copied into the database', async () => {
  const db = fake(), sheet = fake();
  db.readScheduleRows = async opts => { db.calls.push(['readScheduleRows', opts?.timeoutMs]); return []; };   // database copy is stale
  const store = createStore({ mode: 'db', db, sheet, log: quiet });
  assert.deepEqual(await store.readScheduleRows(), [['2026-09-22']]);
  assert.deepEqual(db.calls, [['readScheduleRows', undefined], ['replaceSchedule', '2026-09-22']]);
  // the sheet is asked with a deadline; the database copy is not
  assert.deepEqual(sheet.calls, [['readScheduleRows', SCHEDULE_SHEET_TIMEOUT_MS]]);
  // already in step: read only, no rewrite
  const fresh = fake();
  await createStore({ mode: 'db', db: fresh, sheet, log: quiet }).readScheduleRows();
  assert.deepEqual(fresh.calls, [['readScheduleRows', undefined]]);
});

test('db mode: when the sheet is down the schedule falls back to the database copy', async () => {
  const db = fake(), sheet = fake([], { fail: { readScheduleRows: true } });
  const rows = await createStore({ mode: 'db', db, sheet, log: quiet }).readScheduleRows();
  assert.deepEqual(rows, [['2026-09-22']]);
  assert.deepEqual(db.calls, [['readScheduleRows', undefined]]);
});

test('sheet mode: the old behaviour exactly, database untouched', async () => {
  const db = fake(), sheet = fake([row('a', { _rowNumber: 5 })]);
  const store = createStore({ mode: 'sheet', db, sheet, log: quiet });
  await store.readAllRows();
  await store.appendRow(row('n'));
  const out = await store.updateRows([row('a', { _rowNumber: 99 }), row('gone', { _rowNumber: 3 })]);
  assert.deepEqual(out, { saved: 1, unmatched: 1 });
  assert.deepEqual(sheet.calls.filter(c => c[0] === 'updateRow'), [['updateRow', 'a', 5]]);
  assert.equal(db.calls.length, 0);
});

test('an unknown mode is refused', () => {
  assert.throws(() => createStore({ mode: 'excel', db: fake(), sheet: fake(), log: quiet }), /DESK_STORE/);
});
