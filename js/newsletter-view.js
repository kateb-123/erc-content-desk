/**
 * The newsletter pool without a DOM: which pool rows wait for an issue and
 * which it has outrun.
 */
import { buildPool } from './workflow.js';
import { eventTiming, deadlineState } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { todayCentral } from './today.js';

/** The day a row came in, in College Station; '' when it carries none. */
const addedOn = row => {
  const t = Date.parse(String(row.submitted_at ?? ''));
  return Number.isNaN(t) ? '' : todayCentral(new Date(t));
};

/** The pool for an issue, split in two: live rows wait to be added; past
 *  rows are what the issue has outrun (an event that happens before it
 *  lands, an opportunity that closes first), each with why and when. One
 *  answer for Next issue's Ready to add and the front page's Newsletter lane. */
export function splitPool(rows, schedule, issue, today) {
  const pool = buildPool(rows);
  // The last issue that went out: the newest send date before this one, not
  // after today. Research and headlines added before it are old news (Kate,
  // Oct 6: "it should only have new research, headlines").
  const lastSent = [...(schedule ?? [])].filter(d => issue && d < issue && d <= today).sort().at(-1) ?? '';
  const pastEntry = r => {
    const added = addedOn(r);
    if ((r.type === 'research' || r.type === 'headline') && lastSent && added && added < lastSent) {
      return { row: r, why: `From before the ${isoToShort(lastSent, today)} issue`, when: `Added ${isoToShort(added, today)}` };
    }
    if (r.type === 'event' && eventTiming(schedule ?? [], issue, r.date).state === 'passed') {
      return { row: r, why: 'Before this issue', when: isoToShort(r.date, today) };
    }
    if (r.type === 'opportunity' && r.deadline && deadlineState(issue, r.deadline) === 'passed') {
      return { row: r, why: 'Closes before this issue', when: `Deadline ${isoToShort(r.deadline, today)}` };
    }
    return null;
  };
  const past = pool.map(pastEntry).filter(Boolean);
  const pastIds = new Set(past.map(p => p.row.id));
  return { live: pool.filter(r => !pastIds.has(r.id)), past };
}
