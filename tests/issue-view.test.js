import test from 'node:test';
import assert from 'node:assert/strict';
import { issueRows } from '../js/issue-view.js';

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
