import test from 'node:test';
import assert from 'node:assert/strict';
import { issueRows, issueSections, readyToAdd, sendsIn, lastIssue, scheduleRows } from '../js/issue-view.js';

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

test('issueRows leaves out a trashed row even if a stamp survived on it', () => {
  const rows = [
    { id: 'a', status: 'kept', newsletter_issue: '2026-09-22' },
    { id: 't', status: 'trashed', newsletter_issue: '2026-09-22' },
    { id: 'n', status: 'new', newsletter_issue: '2026-09-22' },
  ];
  assert.deepEqual(issueRows(rows, '2026-09-22').map(r => r.id), ['a', 'n']);
});

// ── The Newsletter page (Kate's wireframes, Sep 17, and her answers, Sep 18) ──

test('issueSections: the issue by section, in the builder\'s order, a spotlight item under ERC Spotlight, an unmapped one under Headlines', () => {
  const rows = [
    { id: 'h', status: 'kept', type: 'headline', subtype: 'Texas', newsletter_issue: '2026-09-22', submitted_at: '2026-09-10T00:00:00Z' },
    { id: 's', status: 'kept', type: 'event', subtype: 'A&M', spotlight_request: true, newsletter_issue: '2026-09-22' },
    { id: 'o', status: 'kept', type: 'opportunity', subtype: 'Other', newsletter_issue: '2026-09-22' },
    { id: 'u', status: 'new', type: '', newsletter_issue: '2026-09-22', submitted_at: '2026-09-11T00:00:00Z' },
    { id: 'x', status: 'kept', type: 'headline', subtype: 'Texas', newsletter_issue: '2026-10-06' },
  ];
  assert.deepEqual(issueSections(rows, '2026-09-22').map(s => [s.key, s.label, s.rows.map(r => r.id)]), [
    ['spotlight', 'ERC Spotlight', ['s']],
    ['opportunities', 'Opportunities', ['o']],
    ['headlines', 'Education Headlines', ['u', 'h']],
  ]);
  assert.deepEqual(issueSections(rows, ''), []);
});

test('readyToAdd: what waits for the issue, a later issue\'s event at the bottom saying which issue, and what the issue has outrun kept apart', () => {
  const schedule = ['2026-09-22', '2026-10-06', '2026-10-20'];
  const kept = (id, extra) => ({ id, status: 'kept', send_to: 'both', submitted_at: '2026-09-01T00:00:00Z', ...extra });
  const rows = [
    kept('later', { type: 'event', subtype: 'A&M', date: '2026-10-08' }),
    kept('r', { type: 'research', subtype: 'Report', submitted_at: '2026-09-05T00:00:00Z' }),
    kept('now', { type: 'event', subtype: 'A&M', date: '2026-09-30' }),
    kept('gone', { type: 'event', subtype: 'A&M', date: '2026-09-19' }),
    kept('in', { type: 'research', subtype: 'Report', newsletter_issue: '2026-09-22' }),
  ];
  const { ready, past } = readyToAdd(rows, schedule, '2026-09-22', '2026-09-18');
  assert.deepEqual(ready.map(r => [r.row.id, r.laterIssue]), [['r', ''], ['now', ''], ['later', '2026-10-06']]);
  assert.deepEqual(past.map(p => p.row.id), ['gone']);
});

test('sendsIn: how far off the issue is, in words', () => {
  assert.equal(sendsIn('2026-09-22', '2026-09-22'), 'Sends today');
  assert.equal(sendsIn('2026-09-22', '2026-09-21'), 'Sends tomorrow');
  assert.equal(sendsIn('2026-09-22', '2026-09-18'), 'Sends in 4 days');
  assert.equal(sendsIn('', '2026-09-18'), '');
});

test('lastIssue: the newest archived issue, whatever order the index is in, and how many desk items went out in it', () => {
  const index = [
    { date: '2026-06-16', file: '2026-06-16.html', label: 'June 16, 2026' },
    { date: '2026-08-25', file: '2026-08-25.html', label: 'August 25, 2026' },
    { date: 'soon' },
  ];
  const rows = [{ newsletter_issue: '2026-08-25', status: 'kept' }, { newsletter_issue: '2026-08-25', status: 'trashed' }, { newsletter_issue: '2026-06-16' }];
  assert.deepEqual(lastIssue(index, rows), { date: '2026-08-25', label: 'August 25, 2026', file: '2026-08-25.html', items: 1 });
  assert.equal(lastIssue([], rows), null);
  assert.equal(lastIssue(null, rows), null);
});

// The Schedule tab (Kate, Sep 22): each upcoming send date with how many items are
// stamped for it; read only, the dates stay on the Sheet.
test('scheduleRows: the upcoming send dates in order, each with its count and its distance, the first marked next', () => {
  const rows = [
    { id: 'a', status: 'kept', newsletter_issue: '2026-09-22' },
    { id: 'b', status: 'kept', newsletter_issue: '2026-10-06' },
    { id: 'c', status: 'kept', newsletter_issue: '2026-09-22' },
    { id: 'd', status: 'kept', newsletter_issue: '2026-09-08' },   // already sent
    { id: 'e', status: 'trashed', newsletter_issue: '2026-10-06' },
  ];
  const out = scheduleRows(rows, ['2026-10-20', '2026-09-08', '2026-09-22', '2026-10-06'], '2026-09-18');
  assert.deepEqual(out, [
    { date: '2026-09-22', when: 'Sends in 4 days', count: 2, next: true },
    { date: '2026-10-06', when: 'Sends in 18 days', count: 1, next: false },
    { date: '2026-10-20', when: 'Sends in 32 days', count: 0, next: false },
  ]);
  assert.deepEqual(scheduleRows(rows, [], '2026-09-18'), []);
});
