/**
 * The Next issue page's view model (Kate, Sep 15: the newsletter's current
 * state "should pretty much show a list like a table"). Pure, so node --test
 * can hold it.
 */

/** Newest submission first; a row with no timestamp sorts last, never first. */
function bySubmittedDesc(a, b) {
  const left = String(a.submitted_at ?? '');
  const right = String(b.submitted_at ?? '');
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

/** What is stamped for the issue: the table on the page. A trashed row is
 *  out even if a stamp survived on it. */
export function issueRows(rows, issue) {
  if (!issue) return [];
  return rows
    .filter(r => String(r.newsletter_issue ?? '') === issue && r.status !== 'trashed')
    .sort(bySubmittedDesc);
}
