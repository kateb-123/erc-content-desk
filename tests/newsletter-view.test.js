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
