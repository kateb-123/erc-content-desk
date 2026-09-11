/**
 * Adds any column SHEET_COLUMNS gained since the items table was created
 * (pending_read, Sep 10). Run once against the live database BEFORE deploying
 * code that reads the new column, or every read fails:
 *   node --env-file=.env scripts/ensure-schema.js
 * Safe to rerun: every statement is IF NOT EXISTS and no data changes.
 */
import { db } from '../api/_lib/db.js';

const store = db();
await store.ensureSchema();
const rows = await store.readAllRows();
console.log(`schema ok; ${rows.length} rows read back with every column present`);
