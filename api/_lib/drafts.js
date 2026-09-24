/**
 * The builder's discarded drafts (Kate, Sep 23, 2026). Discard sends the
 * in-progress issue here instead of throwing it away, and Review lists what
 * was discarded, newest first, with Restore. A draft is kept KEEP_DAYS; the
 * list drops anything older each time it is read.
 *
 * Postgres only, in a table of its own: the Sheet has no place for a whole
 * issue. The table is made by scripts/ensure-schema.js, run by hand (db.js
 * ensureSchema runs DRAFTS_SCHEMA); nothing here creates it, so a desk
 * without it answers NO_TABLE.
 *
 * Built over any query(text, params) -> rows function, like db.js: the tests
 * hand in a recorder; production hands in Neon.
 */
import { randomUUID } from 'node:crypto';
import { countIssueItems } from '../../builder/js/model.js';

export const KEEP_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** item_count is kept beside the body so the list never has to ship bodies. */
export const DRAFTS_SCHEMA = `CREATE TABLE IF NOT EXISTS drafts (
      id text PRIMARY KEY,
      issue_date text NOT NULL DEFAULT '',
      discarded_at timestamptz NOT NULL,
      item_count integer NOT NULL DEFAULT 0,
      body jsonb NOT NULL
    )`;

export const NEEDS_DB = 'Kept drafts need the database, and the desk is running on the Sheet.';
export const NO_TABLE = 'Kept drafts need the database, and its drafts table is not set up yet.';

/** Postgres's undefined_table, 42P01, or its words when a driver drops the code. */
export function isMissingTable(err) {
  return err?.code === '42P01' || /relation "drafts" does not exist/.test(String(err?.message ?? ''));
}

/** The driver hands timestamptz back as a Date and jsonb as an object; text is taken too. */
const isoOf = value => new Date(value).toISOString();
const parsed = value => (typeof value === 'string' ? JSON.parse(value) : value);

/** One list entry, the same shape everywhere the builder reads one. */
const entry = row => ({
  id: row.id,
  issueDate: row.issue_date,
  discardedAt: isoOf(row.discarded_at),
  items: Number(row.item_count),
});

export function createDrafts(query, { now = () => Date.now(), newId = randomUUID } = {}) {
  return {
    /** Keep one draft; answers with its list entry. */
    async save({ issueDate, body }) {
      const row = { id: newId(), issue_date: issueDate, discarded_at: new Date(now()).toISOString(), item_count: countIssueItems(body) };
      await query(`INSERT INTO drafts (id, issue_date, discarded_at, item_count, body) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [row.id, row.issue_date, row.discarded_at, row.item_count, JSON.stringify(body)]);
      return entry(row);
    },

    /** Everything kept, newest first, after dropping what is past its time. */
    async list() {
      await query(`DELETE FROM drafts WHERE discarded_at < $1`, [new Date(now() - KEEP_DAYS * DAY_MS).toISOString()]);
      const rows = await query(`SELECT id, issue_date, discarded_at, item_count FROM drafts ORDER BY discarded_at DESC, id`);
      return rows.map(entry);
    },

    /** One draft with its body, or null when it is gone. */
    async get(id) {
      const [row] = await query(`SELECT id, issue_date, discarded_at, item_count, body FROM drafts WHERE id = $1`, [id]);
      return row ? { ...entry(row), body: parsed(row.body) } : null;
    },

    /** Remove one; answers how many went (0 when it was already gone). */
    async remove(id) {
      const rows = await query(`DELETE FROM drafts WHERE id = $1 RETURNING id`, [id]);
      return rows.length;
    },
  };
}
