/**
 * The newsletter pool without a DOM: which pool rows wait for an issue and
 * which it has outrun.
 */
import { buildPool } from './workflow.js';
import { eventTiming, deadlineState } from './schedule.js';
import { isoToShort } from './queue-view.js';

/** The pool for an issue, split in two: live rows wait to be added; past
 *  rows are what the issue has outrun (an event that happens before it
 *  lands, an opportunity that closes first), each with why and when. One
 *  answer for Next issue's Ready to add and the front page's Newsletter lane. */
export function splitPool(rows, schedule, issue, today) {
  const pool = buildPool(rows);
  const pastEntry = r => {
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
