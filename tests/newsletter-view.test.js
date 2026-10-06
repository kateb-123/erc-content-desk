import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPool } from '../js/newsletter-view.js';

// What waits to be added to an issue, and what the issue has outrun: one
// answer for Send to Newsletter's list and the front page's Newsletter lane.
const schedule = ['2026-09-22', '2026-10-06'];
const kept = (id, extra) => ({ id, status: 'kept', published_at: '2026-09-01T10:00:00Z', ...extra });

test('splitPool: the kept rows ticked for the newsletter and not in an issue wait; an event before the issue and an opportunity closing first are outrun', () => {
  const rows = [
    kept('a', { type: 'research' }),
    kept('b', { type: 'event', date: '2026-09-18' }),
    kept('c', { type: 'opportunity', deadline: '2026-09-20' }),
    kept('d', { type: 'opportunity', deadline: '2026-10-01' }),
    kept('e', { type: 'research', newsletter_issue: '2026-09-22' }),
    { id: 'f', status: 'new', type: 'research' },
    { id: 'g', status: 'kept', type: 'research' },   // not on the Exchange yet: waits all the same (Send it to, Sep 18)
    { id: 'h', status: 'kept', type: 'research', send_to: 'exchange' },   // not ticked for the newsletter
  ];
  const { live, past } = splitPool(rows, schedule, '2026-09-22', '2026-09-18');
  assert.deepEqual(live.map(r => r.id), ['a', 'd', 'g']);
  assert.deepEqual(past.map(p => [p.row.id, p.why, p.when]), [
    ['b', 'Before this issue', 'Sep 18'],
    ['c', 'Closes before this issue', 'Deadline Sep 20'],
  ]);
});

test('splitPool: with no issue nothing is outrun', () => {
  const rows = [kept('a', { type: 'event', date: '2026-09-18' })];
  assert.deepEqual(splitPool(rows, [], '', '2026-09-18').live.map(r => r.id), ['a']);
});

// Kate, Oct 6: "when we pick for newsletter, it should only have new
// research, headlines, that we just scraped." Her pick: new means added since
// the last issue went out (the newest send date before the one being built,
// not after today). Older research and headlines wait in Past items, with
// Delete; events and opportunities keep their own rules.
test('splitPool: research and headlines from before the last issue went out are outrun; events and opportunities are not', () => {
  const sched = ['2026-09-22', '2026-10-06', '2026-10-20'];
  const rows = [
    kept('old-r', { type: 'research', submitted_at: '2026-10-05T15:00:00Z' }),
    kept('day-r', { type: 'research', submitted_at: '2026-10-06T20:00:00Z' }),   // the send day itself, Central: new
    kept('new-h', { type: 'headline', submitted_at: '2026-10-07T09:00:00Z' }),
    kept('old-h', { type: 'headline', submitted_at: '2026-09-25T09:00:00Z' }),
    kept('undated', { type: 'headline' }),   // no way to tell: it stays in view
    kept('ev', { type: 'event', date: '2026-10-25', submitted_at: '2026-09-01T09:00:00Z' }),
    kept('op', { type: 'opportunity', deadline: '2026-11-30', submitted_at: '2026-09-01T09:00:00Z' }),
  ];
  const { live, past } = splitPool(rows, sched, '2026-10-20', '2026-10-07');
  assert.deepEqual(live.map(r => r.id), ['day-r', 'new-h', 'undated', 'ev', 'op']);
  assert.deepEqual(past.map(p => [p.row.id, p.why, p.when]), [
    ['old-r', 'From before the Oct 6 issue', 'Added Oct 5'],
    ['old-h', 'From before the Oct 6 issue', 'Added Sep 25'],
  ]);
});

test('splitPool: before any issue has gone out, nothing is old', () => {
  const rows = [kept('r', { type: 'research', submitted_at: '2026-01-01T09:00:00Z' })];
  assert.deepEqual(splitPool(rows, ['2026-10-20'], '2026-10-20', '2026-10-07').live.map(r => r.id), ['r']);
});
