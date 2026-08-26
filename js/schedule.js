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
