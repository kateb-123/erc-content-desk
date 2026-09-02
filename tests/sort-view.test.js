import test from 'node:test';
import assert from 'node:assert/strict';
import { keptUntyped, sortStream, sortCounts, streamFrom } from '../js/sort-view.js';

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

test('sortStream: To review leads, then ERC, then newsletter order, oldest first inside a group', () => {
  assert.deepEqual(sortStream(rows).map(r => r.id),
    ['weird', 'u1', 'erc2', 'erc1', 'r1', 'r2', 'r3', 'e1', 'o1', 'h1']);
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

test('streamFrom: sections are jump points, not walls — the stream continues past the group and wraps', () => {
  const stream = sortStream(rows);
  assert.deepEqual(streamFrom(stream, '').map(r => r.id), stream.map(r => r.id));
  assert.deepEqual(streamFrom(stream, 'event').map(r => r.id),
    ['e1', 'o1', 'h1', 'weird', 'u1', 'erc2', 'erc1', 'r1', 'r2', 'r3']);
  assert.deepEqual(streamFrom(stream, 'untyped').map(r => r.id), stream.map(r => r.id));
  assert.deepEqual(streamFrom(stream, 'erc').map(r => r.id),
    ['erc2', 'erc1', 'r1', 'r2', 'r3', 'e1', 'o1', 'h1', 'weird', 'u1']);
});

test('streamFrom: an empty anchor group starts at the next group after it, keeping every card', () => {
  const noEvents = rows.filter(r => !(r.type === 'event' && !r.spotlight_request));
  const stream = sortStream(noEvents);
  assert.deepEqual(streamFrom(stream, 'event').map(r => r.id),
    ['o1', 'h1', 'weird', 'u1', 'erc2', 'erc1', 'r1', 'r2', 'r3']);
});

test('kept rows without a type come back to Sort, unless already in an issue or live', () => {
  const rows = [
    { id: 1, status: 'kept', type: '' },
    { id: 2, status: 'kept', type: 'event' },
    { id: 3, status: 'kept', type: '', newsletter_issue: '2026-09-01' },
    { id: 4, status: 'kept', type: '', published_at: '2026-08-25' },
    { id: 5, status: 'new', type: '' },
  ];
  assert.deepEqual(keptUntyped(rows).map(r => r.id), [1]);
  // To review leads: pending untyped first, then the kept fix-ups.
  assert.deepEqual(sortStream(rows).map(r => r.id), [5, 1]);
});
