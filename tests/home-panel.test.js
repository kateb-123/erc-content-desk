import test from 'node:test';
import assert from 'node:assert/strict';
import { queueBadgeCount, queueOrder, latestIssue, shareLine, signupLine, issueSummary, issueLine } from '../js/home-panel.js';

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

test('queueOrder returns pending rows newest first', () => {
  const rows = [
    { id: 'a', status: 'new', submitted_at: '2026-08-20T10:00:00Z' },
    { id: 'b', status: 'new', submitted_at: '2026-08-26T09:00:00Z' },
    { id: 'c', status: 'new', submitted_at: '2026-08-24T14:00:00Z' },
  ];
  assert.deepEqual(queueOrder(rows).map(r => r.id), ['b', 'c', 'a']);
});

test('queueOrder puts rows with no submitted_at last', () => {
  const rows = [
    { id: 'a', status: 'new', submitted_at: '' },
    { id: 'b', status: 'new', submitted_at: '2026-08-26T09:00:00Z' },
  ];
  assert.deepEqual(queueOrder(rows).map(r => r.id), ['b', 'a']);
});

test('queueOrder skips rows that are not pending and never mutates its input', () => {
  const rows = [
    { id: 'a', status: 'new', submitted_at: '2026-08-20T09:00:00Z' },
    { id: 'b', status: 'kept', submitted_at: '2026-08-26T09:00:00Z' },
    { id: 'c', status: 'new', submitted_at: '2026-08-25T09:00:00Z' },
    { id: 'd', status: 'circleback', submitted_at: '2026-08-22T09:00:00Z' },
  ];
  const before = rows.map(r => r.id);
  assert.deepEqual(queueOrder(rows).map(r => r.id), ['c', 'a']);
  assert.deepEqual(rows.map(r => r.id), before);
});

// ── The stats strip and the quick links (main page, Sep 15 sketch) ──

test('latestIssue picks the newest archived date whatever order the index is in', () => {
  const index = [
    { date: '2026-06-16', file: '2026-06-16.html' },
    { date: '2026-08-25', file: '2026-08-25.html' },
    { date: '2026-05-12', file: '2026-05-12.html' },
  ];
  assert.equal(latestIssue(index), '2026-08-25');
});

test('latestIssue is blank for an empty, missing, or malformed index', () => {
  assert.equal(latestIssue([]), '');
  assert.equal(latestIssue(null), '');
  assert.equal(latestIssue([{ file: 'x.html' }, { date: 'soon' }]), '');
});

test('shareLine is one sentence with the public share page at the end', () => {
  const line = shareLine('https://erc-policy-exchange.vercel.app/share/');
  assert.ok(line.endsWith('https://erc-policy-exchange.vercel.app/share/'));
  assert.ok(!line.includes('\n'));
  assert.match(line, /^[A-Z]/);
});

test('signupLine is one sentence with the listserv page at the end', () => {
  const line = signupLine('https://erc-policy-exchange.vercel.app/newsletter/');
  assert.ok(line.endsWith('https://erc-policy-exchange.vercel.app/newsletter/'));
  assert.ok(!line.includes('\n'));
  assert.notEqual(line, shareLine('https://erc-policy-exchange.vercel.app/newsletter/'));
});

// ── The next-issue card and its quick add (Kate's pick A, Sep 15) ──

test('issueSummary counts what is stamped for the issue and what is kept and waiting', () => {
  const rows = [
    { status: 'kept', newsletter_issue: '2026-09-22', published_at: 'x' },
    { status: 'kept', newsletter_issue: '2026-09-22' },
    { status: 'kept', newsletter_issue: '2026-10-06', published_at: 'x' },
    { status: 'kept', published_at: 'x' },
    { status: 'kept', type: 'event', spotlight_request: true },
    { status: 'kept' },                       // kept, unpublished, not newsletter-only: not in the pool
    { status: 'new' },
  ];
  assert.deepEqual(issueSummary(rows, '2026-09-22'), { inIssue: 2, waiting: 2 });
});

test('issueLine is the date, then how many so far, singular when it must (Kate\'s pick A, Sep 15)', () => {
  assert.equal(issueLine(4, 'Sep 22'), 'Sep 22 · 4 items so far');
  assert.equal(issueLine(1, 'Sep 22'), 'Sep 22 · 1 item so far');
  assert.equal(issueLine(0, 'Sep 22'), 'Sep 22 · nothing in yet');
});
