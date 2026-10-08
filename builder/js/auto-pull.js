/**
 * auto-pull.js: the builder pulls without a button (Kate, Oct 7, 2026: "any
 * time you click a date or whatever, you don't need to pull something from
 * the desk"). Picking a date pulls, and so does each opening of that issue,
 * adding only what is new; a different date over an open draft asks first.
 * Remove sends an item back to Ready to add on the desk (her pick), so a later
 * pull never brings it back, and its Undo stamps it again. No DOM here.
 */

import { partitionPulled, mergeIssues, countIssueItems } from './model.js';
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
 * Merge a pull's reply into the issue, adding only what it does not hold yet
 * (by link and by desk id) and nothing removed here while the pull was out,
 * and say what happened. An empty date points at the next issue that has items.
 * @param {object} issue - mutated
 * @param {{ issue: object, staged?: object }} reply - GET /api/newsletter-pull?issue=
 * @param {string} iso - the issue pulled
 * @param {{ skip?: Set<string>, today?: string }} [o] - item ids removed here; College Station's today
 * @returns {{ fresh: number, message: string, pulled: object|null }} pulled: what was added
 */
export function applyPull(issue, reply, iso, { skip = new Set(), today = '' } = {}) {
  if (!countIssueItems(reply?.issue)) {
    const [next] = Object.entries(reply?.staged ?? {}).filter(([d]) => d !== iso && d >= today).sort(([a], [b]) => a.localeCompare(b));
    const none = `Nothing on the desk for ${isoToDisplayDate(iso)} yet.`;
    return { fresh: 0, message: next ? `${none} ${isoToDisplayDate(next[0])} has ${next[1]}.` : none, pulled: null };
  }
  const { pulled, already } = partitionPulled(reply.issue, issue);
  for (const sec of Object.values(pulled.sections ?? {})) {
    sec.items = (sec.items ?? []).filter((item) => !skip.has(item.id));
    sec.enabled = sec.items.length > 0;
  }
  const fresh = countIssueItems(pulled);
  if (!fresh) return { fresh, message: 'Nothing new from the desk.', pulled: null };
  pulled.date = '';   // never the ISO date the pull carries
  mergeIssues(issue, structuredClone(pulled));
  return { fresh, message: already ? `Pulled ${fresh} new from the desk.` : `Pulled ${fresh} from the desk.`, pulled };
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
