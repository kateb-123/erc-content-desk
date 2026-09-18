/**
 * The Newsletter page's view model (Kate's wireframes, Sep 17, and her
 * answers, Sep 18): the issue by section, what is ready to add to it, how far
 * off it is, and the last issue sent. Pure, so node --test can hold it.
 */
import { SECTION_REGISTRY } from '../builder/js/model.js';
import { defaultSection } from './rows-to-issue.js';
import { splitPool } from './newsletter-view.js';
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

const isIso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));

/** What is stamped for the issue. A trashed row is out even if a stamp survived on it. */
export function issueRows(rows, issue) {
  if (!issue) return [];
  return rows
    .filter(r => String(r.newsletter_issue ?? '') === issue && r.status !== 'trashed')
    .sort(bySubmittedDesc);
}

/** The issue by section, in the builder's order and under the builder's names,
 *  so the page reads the way the email will. A row the map does not place
 *  lands under Headlines, as the pull puts it. Empty sections drop out. */
export function issueSections(rows, issue) {
  const inIssue = issueRows(rows, issue);
  return SECTION_REGISTRY
    .map(reg => ({ key: reg.key, label: reg.label, rows: inIssue.filter(r => (defaultSection(r) || 'headlines') === reg.key) }))
    .filter(s => s.rows.length);
}

/** What waits to be added to the issue: newest first, then the events that
 *  belong to a later issue (laterIssue names it), nearest first. What the
 *  issue has outrun (an event before it, an opportunity closing first) is
 *  kept apart in past. */
export function readyToAdd(rows, schedule, issue, today) {
  const { live, past } = splitPool(rows, schedule, issue, today);
  const withTiming = live.map(row => {
    const t = row.type === 'event' ? eventTiming(schedule ?? [], issue, row.date) : { state: '' };
    return { row, laterIssue: t.state === 'later' ? t.issue : '' };
  });
  const now = withTiming.filter(r => !r.laterIssue).sort((a, b) => bySubmittedDesc(a.row, b.row));
  const later = withTiming.filter(r => r.laterIssue).sort((a, b) => String(a.row.date).localeCompare(String(b.row.date)));
  return { ready: [...now, ...later], past };
}

/** How far off the issue is, in words. */
export function sendsIn(issue, today) {
  if (!isIso(issue) || !isIso(today)) return '';
  const days = Math.round((Date.parse(issue) - Date.parse(today)) / 86400000);
  if (days <= 0) return 'Sends today';
  if (days === 1) return 'Sends tomorrow';
  return `Sends in ${days} days`;
}

/** The newest issue in the builder's archive index (a list of { date, file,
 *  label }, newest first by convention, but the max is taken), and how many
 *  desk items went out in it; null when there is none. */
export function lastIssue(index, rows) {
  if (!Array.isArray(index)) return null;
  const latest = index.filter(entry => isIso(entry?.date)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) return null;
  const items = rows.filter(r => r.newsletter_issue === latest.date && r.status !== 'trashed').length;
  return { date: latest.date, label: latest.label ?? latest.date, file: latest.file ?? `${latest.date}.html`, items };
}
