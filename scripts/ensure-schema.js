/**
 * Adds any column SHEET_COLUMNS gained since the items table was created
 * (pending_read, Sep 10; send_to, Sep 18), and any table the desk gained
 * since (drafts, Sep 23: the builder's discarded drafts, kept 90 days). Run
 * once against the live database BEFORE deploying code that reads the new
 * column or table, or every read of it fails:
 *   node --env-file=.env scripts/ensure-schema.js
 * Safe to rerun: every statement is IF NOT EXISTS and no data changes.
 */
import { db, liveQuery } from '../api/_lib/db.js';

const store = db();
await store.ensureSchema();
const rows = await store.readAllRows();
const [{ kept }] = await liveQuery()('SELECT count(*)::int AS kept FROM drafts');
console.log(`schema ok; ${rows.length} rows read back with every column present; drafts table ready, ${kept} kept`);
