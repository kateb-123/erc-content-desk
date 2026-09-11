/**
 * Postgres access (Vercel's Neon store). Server-side only: reads
 * DATABASE_URL from the environment and must never be imported by browser
 * code.
 *
 * Same five verbs as sheets.js, same row shape in and out, so the rest of
 * the API cannot tell which store it is talking to. The items table is
 * deliberately sheet-shaped: one text column per SHEET_COLUMNS, converted
 * with the same rowToValues/valuesToRow the Sheet uses, so the row vocabulary
 * stays defined in exactly one place (js/schema.js).
 *
 * `seq` is the insert order and stands in for the Sheet's row number: the
 * copy inserts in sheet order, so ORDER BY seq is the order Kate is used to.
 * `sheet_row` remembers where a copied row came from, for the diff.
 */

import { neon } from '@neondatabase/serverless';
import { SHEET_COLUMNS, rowToValues, valuesToRow } from '../../js/schema.js';

const q = name => `"${name}"`;
const COLS = SHEET_COLUMNS.map(q).join(', ');
const UPSERT_CHUNK = 100;

/**
 * Build the store over any query(text, params) -> rows function. The tests
 * hand in a recorder; production hands in Neon.
 */
export function createDb(query) {
  async function ensureSchema() {
    await query(`CREATE TABLE IF NOT EXISTS items (
      seq bigserial PRIMARY KEY,
      sheet_row integer,
      ${SHEET_COLUMNS.map(c => `${q(c)} text NOT NULL DEFAULT ''`).join(',\n      ')},
      CONSTRAINT items_id_key UNIQUE (${q('id')}),
      CONSTRAINT items_id_present CHECK (${q('id')} <> '')
    )`);
    // CREATE TABLE IF NOT EXISTS leaves an existing table as it was, so a column
    // added to SHEET_COLUMNS later (pending_read, Sep 10) is added here.
    await query(`ALTER TABLE items ${SHEET_COLUMNS.map(c => `ADD COLUMN IF NOT EXISTS ${q(c)} text NOT NULL DEFAULT ''`).join(', ')}`);
    await query(`CREATE TABLE IF NOT EXISTS schedule (issue_date text PRIMARY KEY)`);
    // Odds and ends with no table of their own, e.g. when the schedule copy was
    // last refreshed from the Sheet.
    await query(`CREATE TABLE IF NOT EXISTS meta (key text PRIMARY KEY, value text NOT NULL)`);
  }

  async function getMeta(key) {
    const rows = await query(`SELECT value FROM meta WHERE key = $1`, [key]);
    return rows[0]?.value ?? null;
  }

  async function setMeta(key, value) {
    await query(`INSERT INTO meta (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, value]);
  }

  async function readAllRows() {
    const rows = await query(`SELECT seq, sheet_row, ${COLS} FROM items ORDER BY seq`);
    return rows.map(r => ({
      ...valuesToRow(SHEET_COLUMNS.map(c => r[c] ?? '')),
      _rowNumber: Number(r.seq),
    }));
  }

  /** Insert or overwrite by id, in chunks. Refuses a blank id outright. */
  async function upsertRows(rows) {
    for (const row of rows) {
      if (!String(row.id ?? '').trim()) throw new Error(`Row with no id: ${row.headline || '(untitled)'}`);
    }
    const width = SHEET_COLUMNS.length + 1;   // sheet_row + the columns
    for (let at = 0; at < rows.length; at += UPSERT_CHUNK) {
      const chunk = rows.slice(at, at + UPSERT_CHUNK);
      const groups = chunk.map((_, i) =>
        `(${Array.from({ length: width }, (_, j) => `$${i * width + j + 1}`).join(', ')})`);
      const params = chunk.flatMap(row => [row._rowNumber ?? null, ...rowToValues(row).map(String)]);
      await query(`INSERT INTO items (sheet_row, ${COLS}) VALUES ${groups.join(', ')}
        ON CONFLICT (${q('id')}) DO UPDATE SET sheet_row = EXCLUDED.sheet_row,
        ${SHEET_COLUMNS.map(c => `${q(c)} = EXCLUDED.${q(c)}`).join(', ')}`, params);
    }
  }

  async function appendRow(row) {
    const params = rowToValues(row).map(String);
    await query(`INSERT INTO items (${COLS}) VALUES (${params.map((_, i) => `$${i + 1}`).join(', ')})`, params);
  }

  async function updateRow(row) {
    const values = rowToValues(row).map(String);
    const sets = SHEET_COLUMNS.map((c, i) => `${q(c)} = $${i + 1}`).join(', ');
    const hit = await query(`UPDATE items SET ${sets} WHERE ${q('id')} = $${values.length + 1} RETURNING ${q('id')}`,
      [...values, row.id]);
    if (!hit.length) throw new Error(`updateRow: no row with id ${row.id}`);
  }

  async function readScheduleRows() {
    const rows = await query(`SELECT issue_date FROM schedule ORDER BY issue_date`);
    return rows.map(r => [r.issue_date]);
  }

  async function replaceSchedule(dates) {
    await query(`DELETE FROM schedule`);
    if (!dates.length) return;
    await query(`INSERT INTO schedule (issue_date) VALUES ${dates.map((_, i) => `($${i + 1})`).join(', ')}`, dates);
  }

  return { ensureSchema, readAllRows, upsertRows, appendRow, updateRow, readScheduleRows, replaceSchedule, getMeta, setMeta };
}

/** The production store. Lazy so importing this file never needs the env. */
let live;
export function db() {
  if (!live) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL must be set');
    const sql = neon(url);
    live = createDb((text, params = []) => sql.query(text, params));
  }
  return live;
}

/**
 * Field-by-field comparison of two row lists by id, for the copy's proof.
 * _rowNumber is not data (it is a Sheet row number on one side and a seq on
 * the other), so it is left out.
 */
export function diffRows(sheetRows, dbRows) {
  const byId = new Map(dbRows.map(r => [r.id, r]));
  const out = [];
  for (const s of sheetRows) {
    const d = byId.get(s.id);
    if (!d) { out.push({ id: s.id, field: '*', sheet: 'present', db: 'missing' }); continue; }
    for (const field of SHEET_COLUMNS) {
      if (String(s[field] ?? '') !== String(d[field] ?? '')) out.push({ id: s.id, field, sheet: s[field], db: d[field] });
    }
  }
  return out;
}
