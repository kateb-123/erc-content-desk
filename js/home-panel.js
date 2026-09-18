/** Pure helpers for the front page: the lanes' counts, the newest items, the hand-out lines. */
import { pendingRows, circlebackRows, readyToPublish } from './workflow.js';

/** The queue count, shown on the front page's Sort lane and Sort's own head:
 *  everything still waiting on a decision. */
export function queueBadgeCount(rows) {
  return pendingRows(rows).length + circlebackRows(rows).length;
}

/** The three lanes' counts (Kate's wireframes, Sep 17): Sort the queue,
 *  Newsletter the rows in the next issue, Policy Exchange the kept rows
 *  still to publish. */
export function laneCounts(rows, issue) {
  return {
    sort: queueBadgeCount(rows),
    newsletter: issue ? issueSummary(rows, issue).inIssue : 0,
    exchange: readyToPublish(rows).length,
  };
}

/** Recently added: the newest rows first, deleted ones left out. */
export function recentlyAdded(rows, count = 4) {
  return rows.filter(r => r.status !== 'trashed')
    .sort((a, b) => String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? '')))
    .slice(0, count);
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

