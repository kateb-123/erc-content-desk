/**
 * Scrap the Ready to add pool (Kate, Sep 22): every kept row that was never
 * put in an issue goes to trashed, the desk's own delete. The Exchange site
 * is untouched (its CSV is append-only); rows already live there simply leave
 * the desk's lists. A snapshot of the rows goes to .superpowers/snapshots/
 * first, so the change can be walked back.
 *
 *   node --env-file=.env scripts/scrap-pool.js          # counts only, changes nothing
 *   node --env-file=.env scripts/scrap-pool.js --go     # snapshot, then trash
 */
import { writeFileSync } from 'node:fs';
import { readAllRows, updateRows } from '../api/_lib/store.js';
import { trash } from '../js/workflow.js';

const go = process.argv.includes('--go');
const day = new Date().toISOString().slice(0, 10);
const snapshot = `.superpowers/snapshots/desk-${day}-before-scrap.json`;

const all = await readAllRows();
const pool = all.filter(r => r.status === 'kept' && !r.newsletter_issue);
const live = pool.filter(r => r.published_at).length;
console.log(`${pool.length} kept rows not in an issue (${live} already on the Exchange, ${pool.length - live} not).`);
if (!go) { console.log('Dry run. Add --go to snapshot and trash them.'); process.exit(0); }

writeFileSync(snapshot, JSON.stringify(pool, null, 2));
console.log(`Snapshot: ${snapshot}`);
const result = await updateRows(pool.map(trash));
const unmatched = result?.unmatched?.length ?? 0;
const after = await readAllRows();
console.log(`Trashed ${pool.length - unmatched}${unmatched ? `, ${unmatched} not matched` : ''}. Now kept and not in an issue: ${after.filter(r => r.status === 'kept' && !r.newsletter_issue).length}.`);
