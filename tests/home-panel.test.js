import test from 'node:test';
import assert from 'node:assert/strict';
import { queueBadgeCount, latestIssue, shareLine, signupLine, issueSummary, issueTally } from '../js/home-panel.js';

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

// ── The stat tiles and the sidebar's hand-out lines ──

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

test('issueTally is the count half of the line, on its own for the card (Kate\'s pick J, Sep 16)', () => {
  assert.equal(issueTally(4), '4 items so far');
  assert.equal(issueTally(1), '1 item so far');
  assert.equal(issueTally(0), 'nothing in yet');
});
