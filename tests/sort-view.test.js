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
  { id: 'erc1', status: 'new', type: 'event', subtype: 'A&M', spotlight_request: true, submitted_at: '2026-08-24T09:00:00Z' },
  { id: 'erc2', status: 'new', type: 'research', subtype: 'ERC Research', submitted_at: '2026-08-23T09:00:00Z' },
];

test('sortStream: ERC, then newsletter order, then to-review (untyped) last, oldest first inside a group', () => {
  assert.deepEqual(sortStream(rows).map(r => r.id),
    ['erc2', 'erc1', 'r1', 'r2', 'r3', 'e1', 'o1', 'h1', 'u1', 'weird']);
});

test('sortStream drops non-pending rows and does not mutate its input', () => {
  const before = rows.map(r => r.id).join(',');
  const out = sortStream(rows);
  assert.equal(out.some(r => r.id === 'kept'), false);
  assert.equal(rows.map(r => r.id).join(','), before);
});

test('sortCounts totals pending rows per bucket', () => {
  assert.deepEqual(sortCounts(rows), {
    all: 10, erc: 2, untyped: 1, research: 4, event: 2, opportunity: 1, headline: 1,
  });
});

test('filterStream: all, untyped, and one type', () => {
  const stream = sortStream(rows);
  assert.equal(filterStream(stream, '').length, 10);
  assert.deepEqual(filterStream(stream, 'untyped').map(r => r.id), ['u1']);
  assert.deepEqual(filterStream(stream, 'research').map(r => r.id), ['erc2', 'r1', 'r2', 'r3']);
});

test('isErc and the erc filter pick spotlight requests and ERC Research', () => {
  const stream = sortStream(rows);
  assert.deepEqual(filterStream(stream, 'erc').map(r => r.id), ['erc2', 'erc1']);
});
