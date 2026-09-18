/** Pure helpers for the front page: the lanes' counts and the newest items. */
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

/** The rows stamped for an issue. */
export function issueSummary(rows, issue) {
  return { inIssue: rows.filter(r => String(r.newsletter_issue ?? '') === issue).length };
}

