import test from 'node:test';
import assert from 'node:assert/strict';
import { issueRows, poolRows } from '../js/issue-view.js';

const schedule = ['2026-09-22', '2026-10-06', '2026-10-20'];

test('issueRows is what is stamped for the issue, newest submission first', () => {
  const rows = [
    { id: 'a', status: 'kept', newsletter_issue: '2026-09-22', submitted_at: '2026-08-20T10:00:00Z' },
    { id: 'b', status: 'kept', newsletter_issue: '2026-10-06', submitted_at: '2026-08-26T09:00:00Z' },
    { id: 'c', status: 'kept', newsletter_issue: '2026-09-22', submitted_at: '2026-08-26T09:00:00Z' },
    { id: 'd', status: 'kept', newsletter_issue: '2026-09-22' },
    { id: 'e', status: 'kept', newsletter_issue: '' },
  ];
  assert.deepEqual(issueRows(rows, '2026-09-22').map(r => r.id), ['c', 'a', 'd']);
});

test('poolRows is the kept-and-waiting pool, later-issue events flagged and sunk', () => {
  const rows = [
    { id: 'p1', status: 'kept', published_at: 'x', type: 'research', submitted_at: '2026-08-20T00:00:00Z' },
    { id: 'p2', status: 'kept', published_at: 'x', type: 'event', date: '2026-10-15', submitted_at: '2026-08-27T00:00:00Z' },
    { id: 'p3', status: 'kept', published_at: 'x', type: 'event', date: '2026-09-25', submitted_at: '2026-08-25T00:00:00Z' },
    { id: 'p4', status: 'kept', published_at: 'x', type: 'event', date: '2026-11-02', submitted_at: '2026-08-28T00:00:00Z' },
    { id: 'in', status: 'kept', published_at: 'x', newsletter_issue: '2026-09-22' },
    { id: 'no', status: 'new' },
  ];
  const pool = poolRows(rows, schedule, '2026-09-22');
  assert.deepEqual(pool.map(r => r.id), ['p3', 'p1', 'p2', 'p4']);
  assert.deepEqual(pool.map(r => r.later), [false, false, true, true]);
});

test('poolRows without a schedule flags nothing', () => {
  const rows = [{ id: 'p', status: 'kept', published_at: 'x', type: 'event', date: '2026-12-01' }];
  assert.deepEqual(poolRows(rows, [], '').map(r => r.later), [false]);
});
