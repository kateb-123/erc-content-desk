/**
 * The rewrite that starts the moment an item is kept (Kate, Sep 22): Sort
 * asks /api/rewrite for that one row in the background, and Finalize shows
 * the answer when it lands. Pure, so node --test can hold the two rules:
 * which ids are worth asking for, and which answers may still land.
 */
import { canRewrite } from './workflow.js';

/** Still on its way through the pipeline: kept, not published, not in an issue. */
const onItsWay = row => row?.status === 'kept' && !row.published_at && !row.newsletter_issue;

/** The ids to send: kept, unpublished, rewritable, and not already waiting
 *  to be checked, checked, or out for a rewrite right now. */
export function rewriteTargets(rows, ids, { review, verified, inFlight }) {
  const byId = new Map(rows.map(r => [r.id, r]));
  return ids.filter(id => {
    const row = byId.get(id);
    return row && onItsWay(row) && canRewrite(row)
      && !review.has(id) && !verified.has(id) && !inFlight.has(id);
  });
}

/** The answers come back: swap each description in and keep the old one for
 *  the check, but only for rows that were asked for and are still on their
 *  way (a Keep undone while the rewrite ran is left alone, and so is a row
 *  already waiting to be checked). */
export function landRewrites(rows, rewrites, { wanted, review, verified }) {
  const fresh = new Map();
  for (const r of rewrites ?? []) {
    if (wanted.has(r.id) && !review.has(r.id) && !verified.has(r.id)) fresh.set(r.id, r.blurb);
  }
  const landed = [];
  const next = rows.map(row => {
    if (!fresh.has(row.id) || !onItsWay(row)) return row;
    landed.push({ id: row.id, old: row.blurb ?? '' });
    return { ...row, blurb: fresh.get(row.id) };
  });
  return { rows: next, landed };
}
