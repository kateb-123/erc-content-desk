import test from 'node:test';
import assert from 'node:assert/strict';
import { queueBadgeCount, issueSummary, laneCounts, recentlyAdded } from '../js/home-panel.js';

test('queueBadgeCount counts new plus parked rows', () => {
  const rows = [
    { status: 'new' }, { status: 'new' }, { status: 'kept' },
    { status: 'circleback' }, { status: 'trashed' },
  ];
  assert.equal(queueBadgeCount(rows), 3);
});

test('queueBadgeCount handles an empty desk', () => {
  assert.equal(queueBadgeCount([]), 0);
});

// ── The next issue's count ──

test('issueSummary counts what is stamped for the issue', () => {
  const rows = [
    { status: 'kept', newsletter_issue: '2026-09-22', published_at: 'x' },
    { status: 'kept', newsletter_issue: '2026-09-22' },
    { status: 'kept', newsletter_issue: '2026-10-06', published_at: 'x' },
    { status: 'kept', published_at: 'x' },
    { status: 'kept', type: 'event', spotlight_request: true },
    { status: 'kept' },
    { status: 'new' },
  ];
  assert.deepEqual(issueSummary(rows, '2026-09-22'), { inIssue: 2 });
});

// ── The front page's lanes and its Recently added list (Kate's wireframes, Sep 17) ──

test('laneCounts: Sort counts the queue, Newsletter the rows in the next issue, Policy Exchange the kept rows still to publish', () => {
  const rows = [
    { status: 'new' }, { status: 'circleback' },
    { status: 'kept', newsletter_issue: '2026-09-22' },
    { status: 'kept', newsletter_issue: '2026-10-06' },
    { status: 'kept' },
    { status: 'kept', published_at: '2026-09-01T10:00:00Z' },
    { status: 'trashed' },
  ];
  assert.deepEqual(laneCounts(rows, '2026-09-22'), { sort: 2, newsletter: 1, exchange: 1 });
  assert.deepEqual(laneCounts([], ''), { sort: 0, newsletter: 0, exchange: 0 });
});

test('recentlyAdded: the newest rows first, deleted ones left out, capped at the count asked for', () => {
  const rows = [
    { id: 'a', status: 'new', submitted_at: '2026-09-12T10:00:00Z' },
    { id: 'b', status: 'kept', submitted_at: '2026-09-15T10:00:00Z' },
    { id: 'c', status: 'trashed', submitted_at: '2026-09-16T10:00:00Z' },
    { id: 'd', status: 'new', submitted_at: '2026-09-14T10:00:00Z' },
    { id: 'e', status: 'circleback', submitted_at: '' },
    { id: 'f', status: 'new', submitted_at: '2026-09-11T10:00:00Z' },
  ];
  assert.deepEqual(recentlyAdded(rows, 4).map(r => r.id), ['b', 'd', 'a', 'f']);
  assert.deepEqual(recentlyAdded(rows, 2).map(r => r.id), ['b', 'd']);
  assert.deepEqual(recentlyAdded([], 4), []);
});
