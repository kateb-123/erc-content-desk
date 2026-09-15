/**
 * The Next issue page's view model (Kate, Sep 15: the newsletter's current
 * state "should pretty much show a list like a table. you can quick add to
 * that"). Pure, so node --test can hold it.
 */
import { buildPool } from './workflow.js';
import { eventTiming } from './schedule.js';

/** Newest submission first; a row with no timestamp sorts last, never first. */
function bySubmittedDesc(a, b) {
  const left = String(a.submitted_at ?? '');
  const right = String(b.submitted_at ?? '');
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

/** What is stamped for the issue: the table on the page. */
export function issueRows(rows, issue) {
  if (!issue) return [];
  return rows.filter(r => String(r.newsletter_issue ?? '') === issue).sort(bySubmittedDesc);
}

/**
 * Quick add's list: the kept-and-waiting pool Send to Newsletter offers, each
 * row flagged `later` when it is an event that belongs to a coming issue.
 * Those sink to the bottom, nearest first, so ticking one is a choice, not
 * an accident.
 */
export function poolRows(rows, schedule, issue) {
  const isLater = r => Boolean(issue) && r.type === 'event'
    && eventTiming(schedule, issue, r.date).state === 'later';
  const pool = buildPool(rows).map(r => ({ ...r, later: isLater(r) }));
  const now = pool.filter(r => !r.later).sort(bySubmittedDesc);
  const soon = pool.filter(r => r.later)
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
  return [...now, ...soon];
}
