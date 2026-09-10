/**
 * Step 1 of leaving Google Sheets: copy the Sheet into Postgres and prove it.
 *
 *   node --env-file=.env scripts/copy-sheet-to-db.js
 *
 * Reads every row and the schedule tab from the Sheet, makes the tables if
 * they are missing, upserts by id (so re-running is safe and picks up edits),
 * then reads the database back and diffs it against the Sheet field by
 * field. Exits 1 if anything differs. Never writes to the Sheet.
 */
import { readAllRows, readScheduleRows } from '../api/_lib/sheets.js';
import { db, diffRows } from '../api/_lib/db.js';
import { normalizeSchedule } from '../js/schedule.js';

const sheetRows = await readAllRows();
const schedule = normalizeSchedule(await readScheduleRows());
console.log(`Sheet: ${sheetRows.length} rows, ${schedule.length} schedule dates`);

const store = db();
await store.ensureSchema();
await store.upsertRows(sheetRows);
await store.replaceSchedule(schedule);

const dbRows = await store.readAllRows();
const dbSchedule = normalizeSchedule(await store.readScheduleRows());
const diffs = diffRows(sheetRows, dbRows);
const extra = dbRows.filter(r => !sheetRows.some(s => s.id === r.id)).length;
const orderKept = dbRows.every((r, i) => sheetRows[i]?.id === r.id);
const scheduleSame = JSON.stringify(schedule) === JSON.stringify(dbSchedule);

console.log(`Database: ${dbRows.length} rows, ${dbSchedule.length} schedule dates`);
console.log(`Field differences: ${diffs.length}`);
for (const d of diffs.slice(0, 20)) console.log(`  ${d.id} ${d.field}: sheet=${JSON.stringify(d.sheet)} db=${JSON.stringify(d.db)}`);
console.log(`Rows only in the database: ${extra}`);
console.log(`Sheet order kept: ${orderKept ? 'yes' : 'NO'}`);
console.log(`Schedule matches: ${scheduleSame ? 'yes' : 'NO'}`);

const clean = diffs.length === 0 && extra === 0 && orderKept && scheduleSame && dbRows.length === sheetRows.length;
console.log(clean ? 'COPY VERIFIED' : 'COPY DIFFERS');
process.exit(clean ? 0 : 1);
