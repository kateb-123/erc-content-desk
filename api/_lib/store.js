/**
 * The desk's data store, step 2 of leaving Google Sheets (Sep 10, 2026).
 *
 * Reads come from Postgres. Every write goes to Postgres first and is then
 * mirrored to the Sheet, so the Sheet stays a complete backup and the whole
 * move can be flipped back by setting DESK_STORE=sheet in Vercel, no code
 * change. A mirror failure is logged with the row id and never fails the
 * request: Postgres is the truth, the Sheet is the copy.
 *
 * The one exception is the newsletter schedule: Kate still edits that tab by
 * hand, so it is read from the Sheet and copied INTO Postgres on each read,
 * with the database copy as the fallback when the Sheet does not answer.
 *
 * Call sites import the named verbs below and cannot tell which store they
 * are talking to. `_rowNumber` on a row is advisory either way (a Sheet row
 * number in sheet mode, the database seq in db mode); writes match by id.
 */

import * as sheet from './sheets.js';
import { db } from './db.js';
import { normalizeSchedule } from '../../js/schedule.js';

const MODES = ['db', 'sheet'];
/** How long the Sheet gets to answer for the schedule before the database copy
 *  is used instead. Apps Script was measured at 8s on a bad call (Sep 10) and
 *  the schedule changes a few times a semester, so a stale copy is cheap. */
export const SCHEDULE_SHEET_TIMEOUT_MS = 2500;

/** Look up each row's live Sheet row number by id, from a single Sheet read. */
async function sheetRowNumbers(sheetStore) {
  const live = await sheetStore.readAllRows();
  return new Map(live.map(r => [r.id, r._rowNumber]));
}

/**
 * Build a store over explicit backends. Production uses store() below; the
 * tests hand in fakes.
 */
export function createStore({ mode, db: dbStore, sheet: sheetStore, log = console }) {
  if (!MODES.includes(mode)) throw new Error(`DESK_STORE must be one of ${MODES.join(', ')}, not "${mode}"`);

  async function mirror(what, fn) {
    try { await fn(); } catch (err) { log.error(`sheet mirror failed (${what})`, err); }
  }

  if (mode === 'sheet') {
    return {
      readAllRows: () => sheetStore.readAllRows(),
      readScheduleRows: () => sheetStore.readScheduleRows(),
      appendRow: row => sheetStore.appendRow(row),
      async updateRows(rows) {
        // _rowNumber is advisory: a sort or delete made by hand in the Sheet
        // shifts every row below it, so re-resolve by id before writing.
        const byId = await sheetRowNumbers(sheetStore);
        let saved = 0, unmatched = 0;
        for (const row of rows) {
          const n = byId.get(row.id);
          if (!n) { unmatched += 1; continue; }
          await sheetStore.updateRow({ ...row, _rowNumber: n });
          saved += 1;
        }
        return { saved, unmatched };
      },
    };
  }

  return {
    readAllRows: () => dbStore.readAllRows(),

    async readScheduleRows() {
      try {
        const fromSheet = await sheetStore.readScheduleRows({ timeoutMs: SCHEDULE_SHEET_TIMEOUT_MS });
        const dates = normalizeSchedule(fromSheet);
        const have = normalizeSchedule(await dbStore.readScheduleRows());
        if (JSON.stringify(dates) !== JSON.stringify(have)) await dbStore.replaceSchedule(dates);
        return fromSheet;
      } catch (err) {
        log.error('schedule: sheet unreachable, using the database copy', err);
        return dbStore.readScheduleRows();
      }
    },

    async appendRow(row) {
      await dbStore.appendRow(row);
      await mirror(`append ${row.id}`, () => sheetStore.appendRow(row));
    },

    async updateRows(rows) {
      let saved = 0, unmatched = 0;
      const written = [];
      for (const row of rows) {
        try {
          await dbStore.updateRow(row);
          saved += 1;
          written.push(row);
        } catch (err) {
          if (!/no row with id/.test(err.message)) throw err;
          unmatched += 1;
        }
      }
      if (written.length) {
        await mirror(`update ${written.map(r => r.id).join(',')}`, async () => {
          const byId = await sheetRowNumbers(sheetStore);
          for (const row of written) {
            const n = byId.get(row.id);
            if (!n) { log.error(`sheet mirror: no sheet row for ${row.id}`); continue; }
            await sheetStore.updateRow({ ...row, _rowNumber: n });
          }
        });
      }
      return { saved, unmatched };
    },
  };
}

/** db when there is a database to talk to, sheet when there is not; DESK_STORE
 *  overrides either way. Without this, a deploy whose DATABASE_URL never
 *  arrived would fail every request instead of quietly running the old way. */
export function pickMode(env) {
  if (env.DESK_STORE) return env.DESK_STORE;
  if (env.DATABASE_URL) return 'db';
  console.error('store: no DATABASE_URL, running on the Sheet alone');
  return 'sheet';
}

let live;
export function store() {
  if (!live) {
    const mode = pickMode(process.env);
    live = createStore({ mode, db: mode === 'db' ? db() : null, sheet });
  }
  return live;
}

export const readAllRows = () => store().readAllRows();
export const readScheduleRows = () => store().readScheduleRows();
export const appendRow = row => store().appendRow(row);
export const updateRows = rows => store().updateRows(rows);
/** One row; the batch form is cheaper when you have several. */
export const updateRow = row => updateRows([row]).then(({ unmatched }) => {
  if (unmatched) throw new Error(`updateRow: no row with id ${row.id}`);
});
