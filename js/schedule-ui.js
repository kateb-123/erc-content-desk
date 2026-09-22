/**
 * Newsletter's Schedule tab (Kate, Sep 22): each upcoming send date with
 * how far off it is and how many items are stamped for it; the next one is
 * marked. Read only: the dates are edited on the Sheet's schedule tab. A
 * date opens its issue on Next issue.
 */
import { scheduleRows } from './issue-view.js';
import { newsletterPageHead } from './page-head.js';
import { isoToShort } from './queue-view.js';
import { el, button } from './ui-aids.js';

export function renderSchedule(container, { rows, schedule, today, loaded, onGoTo, onPick }) {
  const parts = [newsletterPageHead({ active: 'schedule', onGoTo })];
  const list = el('div', 'nl-list sched-list');
  const entries = loaded ? scheduleRows(rows, schedule, today) : [];
  if (!loaded) list.append(el('p', 'nl-empty', 'Loading'));
  else if (!entries.length) list.append(el('p', 'nl-empty', 'No send dates ahead. Add one on the Sheet\'s schedule tab.'));
  for (const entry of entries) {
    const row = button('', 'sched-row', { focus: `sched:${entry.date}`, onClick: () => onPick(entry.date) });
    const when = el('span', 'sched-date', isoToShort(entry.date, today));
    const words = el('span', 'sched-words');
    words.append(el('span', 'sched-when', entry.when));
    if (entry.next) words.append(el('span', 'badge', 'Next'));
    const count = el('span', 'sched-count', entry.count ? `${entry.count} in the issue` : 'Nothing in it yet');
    row.append(when, words, count);
    list.append(row);
  }
  parts.push(list, el('p', 'nl-meta sched-note', 'Send dates are edited on the Sheet\'s schedule tab.'));
  container.replaceChildren(...parts);
}
