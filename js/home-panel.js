/** Pure helpers for the front page: the lanes' counts and the newest items. */
import { pendingRows, circlebackRows, readyToPublish } from './workflow.js';
import { splitPool } from './newsletter-view.js';

/** The queue count, shown on the front page's Sort lane and Sort's own head:
 *  everything still waiting on a decision. */
export function queueBadgeCount(rows) {
  return pendingRows(rows).length + circlebackRows(rows).length;
}

/** The three lanes' counts, each the work waiting on its page (design
 *  critique, Sep 18): Sort the queue, Newsletter what waits to be added to
 *  the next issue, Policy Exchange what Publish would add. Publish's number
 *  needs the live Exchange check (preview); until it lands, the kept rows
 *  ticked for the Exchange stand in. */
export function laneCounts(rows, { schedule, issue, today, preview }) {
  return {
    sort: queueBadgeCount(rows),
    newsletter: splitPool(rows, schedule, issue, today).live.length,
    exchange: preview ? preview.adding.length : readyToPublish(rows).length,
  };
}

/** Recently added: the newest rows first, deleted ones left out. */
export function recentlyAdded(rows, count = 4) {
  return rows.filter(r => r.status !== 'trashed')
    .sort((a, b) => String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? '')))
    .slice(0, count);
}
