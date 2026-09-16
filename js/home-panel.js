/** Pure text helpers for the Home links panel. */
import { pendingRows, circlebackRows, buildPool } from './workflow.js';

/** The number in Queue's alert circle: everything still waiting on a decision. */
export function queueBadgeCount(rows) {
  return pendingRows(rows).length + circlebackRows(rows).length;
}

/**
 * Pending rows in table order: newest submission first. Rows with no
 * submitted_at sort last rather than first, so a missing timestamp never
 * jumps the queue.
 */
export function queueOrder(rows) {
  return pendingRows(rows).slice().sort((a, b) => {
    const left = String(a.submitted_at ?? '');
    const right = String(b.submitted_at ?? '');
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return right.localeCompare(left);
  });
}

/**
 * The newest issue in the builder's archive index (builder/newsletters/
 * index.json, a list of { date, file, label }). The list is newest-first by
 * convention, but the strip should not depend on that: take the max. A
 * missing or malformed index gives '' and the strip shows a dash.
 */
export function latestIssue(index) {
  if (!Array.isArray(index)) return '';
  return index
    .map(entry => String(entry?.date ?? ''))
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1) ?? '';
}

/** The line the Share something link copies: one sentence, the link last so
 *  it survives being pasted into an email as-is. */
export function shareLine(url) {
  return `Have something for the ERC newsletter or the Policy Exchange? Send it here: ${url}`;
}

/** The line the Listserv sign-up link copies. */
export function signupLine(url) {
  return `Want the ERC newsletter in your inbox? Sign up here: ${url}`;
}

// ── The next-issue card (Kate's Sep 15 rail; quick add is her pick A) ──

/** What the card counts: rows stamped for this issue, and the kept rows still
 *  waiting for one (the same pool Send to Newsletter offers). */
export function issueSummary(rows, issue) {
  const inIssue = rows.filter(r => String(r.newsletter_issue ?? '') === issue).length;
  return { inIssue, waiting: buildPool(rows).length };
}

/** The Next newsletter card's one quiet line: the date, then how many so far. */
export function issueLine(count, when) {
  const tally = count === 0 ? 'nothing in yet' : `${count} item${count === 1 ? '' : 's'} so far`;
  return `${when} · ${tally}`;
}
