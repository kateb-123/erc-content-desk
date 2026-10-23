/**
 * The spring dates note (Kate, Oct 23, her pick B of four, "don't make it so
 * wordy"): from the day after Thanksgiving, while the schedule tab holds no
 * date in the next year, a warning note sits under the top bar on every desk
 * page with a button to the spreadsheet. Tomorrow and Next week hide it on
 * that computer only; Done reloads the schedule and it stays until the dates
 * are there. It also shows whenever the dates have run out.
 */
import { DESK_SHEET, isIsoDate } from './schedule.js';
import { faIcon } from './icons.js';
import { el, button } from './ui-aids.js';

const KEY = 'desk.springSnooze';

/** The day after the fourth Thursday of November, as YYYY-MM-DD. */
export function dayAfterThanksgiving(year) {
  const firstDay = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const thursday = 1 + ((4 - firstDay + 7) % 7) + 21;
  return `${year}-11-${String(thursday + 1).padStart(2, '0')}`;
}

export function addDays(iso, days) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + days));
  return d.toISOString().slice(0, 10);
}

/** True when the note should show (before any snooze). */
export function springDatesDue(schedule, todayIso) {
  const dates = (schedule ?? []).filter(isIsoDate);
  if (!dates.length || !isIsoDate(todayIso)) return false;
  if (!dates.some(d => d >= todayIso)) return true;
  const year = +todayIso.slice(0, 4);
  return todayIso >= dayAfterThanksgiving(year) && !dates.some(d => +d.slice(0, 4) > year);
}

/** True while a snooze set for `until` still hides the note. */
export function snoozeUntil(until, todayIso) {
  return isIsoDate(until) && todayIso < until;
}

let checked = false;   // Done was pressed and the dates were still missing

/** Draws the note into slot, or empties it. */
export function renderSpringBanner(slot, { schedule, today, loaded, onDone }) {
  if (!slot) return;
  let until = '';
  try { until = localStorage.getItem(KEY) ?? ''; } catch { /* no storage, no snooze */ }
  if (!loaded || !springDatesDue(schedule, today) || snoozeUntil(until, today)) {
    checked = false;
    slot.replaceChildren();
    return;
  }
  const hide = days => () => {
    try { localStorage.setItem(KEY, addDays(today, days)); } catch { /* fine */ }
    slot.replaceChildren();
  };
  const box = el('div', 'spring-banner');
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Spring send dates');
  const mark = faIcon('triangle-exclamation');
  mark.classList.add('spring-mark');
  const words = el('p', 'spring-words', checked ? 'Not on the schedule yet.' : 'Add the spring send dates.');
  const open = button('Open the spreadsheet', 'spring-open', {
    focus: 'spring-open',
    onClick: () => window.open(DESK_SHEET, '_blank', 'noopener'),
  });
  open.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
  const later = el('span', 'spring-acts');
  later.append(
    button('Tomorrow', 'linkish', { focus: 'spring-tomorrow', onClick: hide(1) }),
    button('Next week', 'linkish', { focus: 'spring-week', onClick: hide(7) }),
    button('Done', 'linkish', { focus: 'spring-done', onClick: async () => { checked = true; await onDone(); } }),
  );
  box.append(mark, words, open, later);
  slot.replaceChildren(box);
}
