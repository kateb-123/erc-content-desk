/**
 * auto-pull.js: the builder pulls without a button (Kate, Oct 7, 2026: "any
 * time you click a date or whatever, you don't need to pull something from
 * the desk"). Picking a date pulls, and so does each opening of that issue,
 * adding only what is new; a different date over an open draft asks first.
 * Remove sends an item back to Ready to add on the desk (her pick), so a later
 * pull never brings it back, and its Undo stamps it again. A Remove on the
 * desk reaches the draft at the next pull (Kate, Oct 23). No DOM here.
 */

import { partitionPulled, mergeIssues, countIssueItems, deleteItem } from './model.js';
import { draftIsOpen } from './discarded.js';
import { displayDateToISO, isoToDisplayDate } from './wizard.js';
import { clearNewsletterIssue, markNewsletterIssue } from '../../js/workflow.js';

const isoOf = (issue) => displayDateToISO(issue?.date || '');

/** Picking `nextIso` asks first only over a draft that holds something under
 *  another date. A sample is never kept, so it is replaced without asking. */
export function pickNeedsAsk(issue, nextIso) {
  if (!issue || issue.sample) return false;
  const current = isoOf(issue);
  return Boolean(current) && current !== nextIso && draftIsOpen(issue);
}

/** An issue pulls once it has a date; a sample never takes the desk's items. */
export function shouldPull(issue) {
  return Boolean(issue && !issue.sample && isoOf(issue));
}

/**
 * Take out what the desk took out (Kate, Oct 23): every item that came from
 * the desk (a pulled id, desk_<row id>) whose row is no longer stamped for
 * this issue there, removed on Next issue, deleted, or moved to another
 * issue. An item added here by hand stays, whatever its deskId, and so does
 * one Undo put back here. What stays is never replaced, so its edits here
 * stand. A reply without the issue in it takes nothing out.
 * @param {object} issue - mutated
 * @param {object|undefined} deskIssue - the reply's issue: everything stamped for it on the desk
 * @param {Set<string>} keep - item ids Undo put back here
 * @returns {number} how many were taken out
 */
function dropUnstamped(issue, deskIssue, keep) {
  if (!issue?.sections || !deskIssue?.sections) return 0;
  const stamped = new Set(Object.values(deskIssue.sections).flatMap((sec) => (sec.items ?? []).map((item) => item.id)));
  const gone = Object.values(issue.sections).flatMap((sec) => (sec.items ?? [])
    .filter((item) => String(item?.id ?? '').startsWith('desk_') && !stamped.has(item.id) && !keep.has(item.id)));
  for (const item of gone) deleteItem(issue, item.id);   // an emptied section turns off, as Remove leaves it
  return gone.length;
}

/**
 * Merge a pull's reply into the issue: take out what left the issue on the
 * desk, add only what it does not hold yet (by link and by desk id) and
 * nothing removed here while the pull was out, and say what happened. An
 * empty date points at the next issue that has items.
 * @param {object} issue - mutated
 * @param {{ issue: object, staged?: object }} reply - GET /api/newsletter-pull?issue=
 * @param {string} iso - the issue pulled
 * @param {{ skip?: Set<string>, keep?: Set<string>, today?: string }} [o] - item ids removed here; item ids Undo put back here; College Station's today
 * @returns {{ fresh: number, dropped: number, message: string, pulled: object|null }} pulled: what was added; dropped: how many were taken out
 */
export function applyPull(issue, reply, iso, { skip = new Set(), keep = new Set(), today = '' } = {}) {
  const dropped = dropUnstamped(issue, reply?.issue, keep);
  const gone = dropped ? `Took out ${dropped} removed on the desk.` : '';
  if (!countIssueItems(reply?.issue)) {
    const [next] = Object.entries(reply?.staged ?? {}).filter(([d]) => d !== iso && d >= today).sort(([a], [b]) => a.localeCompare(b));
    const none = `Nothing on the desk for ${isoToDisplayDate(iso)} yet.`;
    const message = next ? `${none} ${isoToDisplayDate(next[0])} has ${next[1]}.` : none;
    return { fresh: 0, dropped, message: gone ? `${gone} ${message}` : message, pulled: null };
  }
  const { pulled, already } = partitionPulled(reply.issue, issue);
  for (const sec of Object.values(pulled.sections ?? {})) {
    sec.items = (sec.items ?? []).filter((item) => !skip.has(item.id));
    sec.enabled = sec.items.length > 0;
  }
  const fresh = countIssueItems(pulled);
  if (!fresh) return { fresh, dropped, message: gone || 'Nothing new from the desk.', pulled: null };
  pulled.date = '';   // never the ISO date the pull carries
  mergeIssues(issue, structuredClone(pulled));
  const came = already ? `Pulled ${fresh} new from the desk.` : `Pulled ${fresh} from the desk.`;
  return { fresh, dropped, message: gone ? `${came} ${gone}` : came, pulled };
}

/** Remove and Undo reach the desk only for a real issue still to go out: a
 *  sent issue keeps its record there, and a sample is never the desk's. */
export function tellsDesk(issue, today) {
  const iso = isoOf(issue);
  return Boolean(issue && !issue.sample && iso && iso >= today);
}

/** The desk row behind an item: a pulled item's id is desk_<row id>; one
 *  added by hand carries the row it was given as deskId. '' for neither. */
export function deskRowId(item) {
  if (item?.deskId) return String(item.deskId);
  const id = String(item?.id ?? '');
  return id.startsWith('desk_') ? id.slice('desk_'.length) : '';
}

const rowOf = (rows, item) => {
  const id = deskRowId(item);
  return id ? rows.find((r) => r.id === id) ?? null : null;
};

/** Remove: the row leaves the issue on the desk, back to Ready to add, but
 *  only while it is still stamped for this one. */
export function unstampedRow(rows, item, issueIso) {
  const row = rowOf(rows, item);
  if (!issueIso || !row || row.newsletter_issue !== issueIso) return null;
  return clearNewsletterIssue(row);
}

/** Undo: the stamp goes back while the row is in no issue and not deleted (a
 *  row added by hand or by Quick add can still be waiting in Sort). */
export function restampedRow(rows, item, issueIso) {
  const row = rowOf(rows, item);
  if (!issueIso || !row || row.newsletter_issue || row.status === 'trashed') return null;
  return markNewsletterIssue(row, issueIso);
}

/**
 * Tell the desk about one Remove (removed: true) or its Undo (false). An item
 * with no desk row costs nothing.
 * @param {object} item
 * @param {{ issueIso: string, removed: boolean, api: {
 *   rows: () => Promise<Array<object>>, save: (rows: Array<object>) => Promise<unknown> } }} o
 * @returns {Promise<boolean>} whether a row was written
 */
export async function syncRemoval(item, { issueIso, removed, api }) {
  if (!deskRowId(item) || !issueIso) return false;
  const rows = await api.rows();
  const next = (removed ? unstampedRow : restampedRow)(rows, item, issueIso);
  if (!next) return false;
  await api.save([next]);
  return true;
}
