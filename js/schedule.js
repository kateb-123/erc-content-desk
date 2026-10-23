/** Newsletter schedule helpers. The schedule tab is edited by hand. */

/** The desk's Sheet, where the schedule tab lives (review, Oct 23: the pages
 *  named it and never linked it). Its own sharing guards it, as the sign-up
 *  sheet's does. */
export const DESK_SHEET = 'https://docs.google.com/spreadsheets/d/1dvXdBhMgp1-XmijS0M8wtxARWjy3ejCCFcy-YGKjP4I/edit#gid=287660130';   // opens on the schedule tab
export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '').trim());
}

export function normalizeSchedule(values) {
  const dates = new Set();
  for (const rowValues of values ?? []) {
    const first = String(rowValues?.[0] ?? '').trim();
    if (isIsoDate(first)) dates.add(first);
  }
  return [...dates].sort();
}

/** The issue being assembled: first date on/after today, else the last one. */
export function nextIssueDate(schedule, todayIso) {
  if (!schedule?.length) return '';
  return schedule.find(d => d >= todayIso) ?? schedule[schedule.length - 1];
}

/** An event belongs to the LAST issue that lands before it happens (the
 *  two-week window between newsletters). Relative to the issue being
 *  assembled: 'now' (this window), 'later' (a coming issue — which one is in
 *  .issue), 'passed' (the event predates the issue), '' (no usable dates). */
export function eventTiming(schedule, issueIso, eventIso) {
  if (!isIsoDate(eventIso) || !isIsoDate(issueIso)) return { state: '' };
  if (eventIso < issueIso) return { state: 'passed' };
  const home = (schedule ?? []).filter(d => isIsoDate(d) && d <= eventIso).sort().pop() ?? '';
  return !home || home <= issueIso ? { state: 'now' } : { state: 'later', issue: home };
}

/** Opportunities run in every issue until their deadline. */
export function deadlineState(issueIso, deadlineIso) {
  if (!isIsoDate(deadlineIso) || !isIsoDate(issueIso)) return '';
  return deadlineIso < issueIso ? 'passed' : 'open';
}

/** The last send date on the schedule once it is `days` or fewer away (Kate,
 *  Oct 22, 2026: "warn a week before the last newsletter"), else ''. Past it,
 *  the pages already say to add one. */
export function scheduleEnding(schedule, todayIso, days = 7) {
  if (!isIsoDate(todayIso)) return '';
  const last = (schedule ?? []).filter(isIsoDate).sort().pop() ?? '';
  if (!last || last < todayIso) return '';
  const gap = Math.round((Date.UTC(+last.slice(0, 4), +last.slice(5, 7) - 1, +last.slice(8, 10)) - Date.UTC(+todayIso.slice(0, 4), +todayIso.slice(5, 7) - 1, +todayIso.slice(8, 10))) / 86400000);
  return gap <= days ? last : '';
}

/** The warning's words, shared by the Newsletter card and the Schedule tab. */
export function scheduleEndingWords(schedule, todayIso, short) {
  const last = scheduleEnding(schedule, todayIso);
  return last ? `Send dates end ${short(last)}. Add the next ones on the Sheet's schedule tab.` : '';
}
