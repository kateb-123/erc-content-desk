/** Pure text helpers for Home's stat cards and the hand-out lines. */
import { pendingRows, circlebackRows } from './workflow.js';

/** The queue count, shown on Home's tile and the fold's badge: everything
 *  still waiting on a decision. */
export function queueBadgeCount(rows) {
  return pendingRows(rows).length + circlebackRows(rows).length;
}

/**
 * The newest issue in the builder's archive index (builder/newsletters/
 * index.json, a list of { date, file, label }). The list is newest-first by
 * convention, but the tile should not depend on that: take the max. A
 * missing or malformed index gives '' and the tile says None yet.
 */
export function latestIssue(index) {
  if (!Array.isArray(index)) return '';
  return index
    .map(entry => String(entry?.date ?? ''))
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1) ?? '';
}

/** The line the Share an item link copies: one sentence, the link last so
 *  it survives being pasted into an email as-is. */
export function shareLine(url) {
  return `Have something for the ERC newsletter or the Policy Exchange? Send it here: ${url}`;
}

/** The line the Listserv sign-up link copies. */
export function signupLine(url) {
  return `Want the ERC newsletter in your inbox? Sign up here: ${url}`;
}

// ── The next-issue card ──

/** What the card counts: the rows stamped for this issue. */
export function issueSummary(rows, issue) {
  return { inIssue: rows.filter(r => String(r.newsletter_issue ?? '') === issue).length };
}

/** How many are in the next newsletter, in words. */
export function issueTally(count) {
  return count === 0 ? 'nothing in yet' : `${count} item${count === 1 ? '' : 's'} so far`;
}

