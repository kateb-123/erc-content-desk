/**
 * The listserv's sign-ups, as the desk keeps them (Kate's drawn map, Oct 6,
 * 2026). Every sign-up already passes through /api/listserv on its way to
 * her sign-up sheet; the desk keeps a copy here so the Listserv hub can say
 * how many wait to be added. The hub reads counts and dates only: the page
 * is open, so no name or email ever leaves this table through it. A row's
 * added_at is set when it is added to the listserv (the forthcoming
 * download); until then it waits.
 *
 * Postgres only, in a table of its own, made by scripts/ensure-schema.js,
 * run by hand (db.js ensureSchema runs SIGNUPS_SCHEMA); nothing here creates
 * it. Built over any query(text, params) -> rows function, like drafts.js.
 */
import { randomUUID } from 'node:crypto';
import { todayCentral } from '../../js/today.js';

export const SIGNUPS_SCHEMA = `CREATE TABLE IF NOT EXISTS signups (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      signed_up_at timestamptz NOT NULL,
      added_at timestamptz
    )`;

/** Postgres's undefined_table, 42P01, or its words when a driver drops the code. */
export function isMissingSignups(err) {
  return err?.code === '42P01' || /relation "signups" does not exist/.test(String(err?.message ?? ''));
}

/** A timestamp as College Station's date; '' for none. */
const day = value => (value ? todayCentral(new Date(value)) : '');

export function createSignups(query, { now = () => Date.now(), newId = randomUUID } = {}) {
  return {
    /** Keep one sign-up, not yet added. */
    async keep({ name, email }) {
      await query(`INSERT INTO signups (id, name, email, signed_up_at) VALUES ($1, $2, $3, $4)`,
        [newId(), String(name ?? '').trim(), String(email ?? '').trim(), new Date(now()).toISOString()]);
    },

    /** How many wait to be added, the last sign-up and the first kept: counts and dates only. */
    async summary() {
      const [row] = await query(`SELECT count(*) FILTER (WHERE added_at IS NULL)::int AS waiting,
        max(signed_up_at) AS last, min(signed_up_at) AS since FROM signups`);
      return { waiting: Number(row?.waiting ?? 0), last: day(row?.last), since: day(row?.since) };
    },
  };
}
