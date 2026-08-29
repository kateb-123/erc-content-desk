import test from 'node:test';
import assert from 'node:assert/strict';
import { sortStream, sortCounts, filterStream } from '../js/sort-view.js';

// Shuffled on purpose: statuses mixed in, groups interleaved, dates unordered.
const rows = [
  { id: 'h1', status: 'new', type: 'headline', submitted_at: '2026-08-20T10:00:00Z' },
  { id: 'r2', status: 'new', type: 'research', submitted_at: '2026-08-26T09:00:00Z' },
  { id: 'kept', status: 'kept', type: 'event', submitted_at: '2026-08-19T09:00:00Z' },
  { id: 'u1', status: 'new', type: '', submitted_at: '2026-08-25T12:00:00Z' },
  { id: 'e1', status: 'new', type: 'event', submitted_at: '2026-08-24T08:00:00Z' },
  { id: 'r1', status: 'new', type: 'research', submitted_at: '2026-08-22T08:00:00Z' },
  { id: 'o1', status: 'new', type: 'opportunity', submitted_at: '2026-08-23T08:00:00Z' },
  { id: 'weird', status: 'new', type: 'legacy-type', submitted_at: '2026-08-21T08:00:00Z' },
  { id: 'r3', status: 'new', type: 'research', submitted_at: '' },
];

test('sortStream groups untyped first, then newsletter order, oldest first inside a group', () => {
  assert.deepEqual(sortStream(rows).map(r => r.id),
    ['u1', 'r1', 'r2', 'r3', 'e1', 'o1', 'h1', 'weird']);
});

test('sortStream drops non-pending rows and does not mutate its input', () => {
  const before = rows.map(r => r.id).join(',');
  const out = sortStream(rows);
  assert.equal(out.some(r => r.id === 'kept'), false);
  assert.equal(rows.map(r => r.id).join(','), before);
});

test('sortCounts totals pending rows per bucket', () => {
  assert.deepEqual(sortCounts(rows), {
    all: 8, untyped: 1, research: 3, event: 1, opportunity: 1, headline: 1,
  });
});

test('filterStream: all, untyped, and one type', () => {
  const stream = sortStream(rows);
  assert.equal(filterStream(stream, '').length, 8);
  assert.deepEqual(filterStream(stream, 'untyped').map(r => r.id), ['u1']);
  assert.deepEqual(filterStream(stream, 'research').map(r => r.id), ['r1', 'r2', 'r3']);
});
