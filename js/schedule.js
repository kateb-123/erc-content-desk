/** Newsletter schedule helpers. The schedule tab is Kate's to edit by hand. */
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
