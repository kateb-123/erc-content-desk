import test from 'node:test';
import assert from 'node:assert/strict';
import { keptUntyped, sortStream, sortCounts, streamFrom, sectionOf } from '../js/sort-view.js';

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
    all: 10, erc: 2, untyped: 1, erc_event: 0, research: 4, event: 2, opportunity: 1, headline: 1,
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

test("sortStream holds this session's decided cards in their slot, so ‹ scrolls back to them", () => {
  const decided = rows.map(r => (r.id === 'r1' ? { ...r, status: 'kept' } : r));
  // Without the session set the decided row leaves the stream, as before.
  assert.equal(sortStream(decided).some(r => r.id === 'r1'), false);
  // With it, r1 keeps the exact slot it held while pending.
  assert.deepEqual(sortStream(decided, new Set(['r1'])).map(r => r.id),
    ['weird', 'u1', 'erc2', 'erc1', 'r1', 'r2', 'r3', 'e1', 'o1', 'h1']);
});

test('sortStream keeps trashed and skipped session cards too — any decision is reversible', () => {
  const decided = rows.map(r => {
    if (r.id === 'e1') return { ...r, status: 'trashed' };
    if (r.id === 'o1') return { ...r, status: 'circleback' };
    return r;
  });
  const ids = sortStream(decided, new Set(['e1', 'o1'])).map(r => r.id);
  assert.equal(ids.includes('e1'), true);
  assert.equal(ids.includes('o1'), true);
});

test('a session-decided row that is also a kept fix-up appears once, not twice', () => {
  const rows = [{ id: 1, status: 'kept', type: '' }, { id: 2, status: 'new', type: 'event' }];
  const ids = sortStream(rows, new Set([1])).map(r => r.id);
  assert.deepEqual(ids.filter(id => id === 1).length, 1);
});

test('the filter counts still mean work remaining — a decided card stops counting', () => {
  const decided = rows.map(r => (r.id === 'r1' ? { ...r, status: 'kept' } : r));
  assert.equal(sortCounts(decided).research, sortCounts(rows).research - 1);
});

test('ERC Events get their own counted section, separate from the ERC bucket', () => {
  const rows = [
    { id: 'x', status: 'new', type: 'erc_event', subtype: '', submitted_at: '2026-09-01T00:00:00Z' },
    { id: 'y', status: 'new', type: 'event', subtype: 'A&M', submitted_at: '2026-09-02T00:00:00Z' },
  ];
  assert.equal(sortCounts(rows).erc_event, 1);
  assert.equal(sortCounts(rows).event, 1);
  assert.equal(sectionOf(rows[0]), 'erc_event');
});

test('ERC Events lead the stream, ahead of research', () => {
  const rows = [
    { id: 'r', status: 'new', type: 'research', subtype: 'Report', submitted_at: '2026-09-01T00:00:00Z' },
    { id: 'e', status: 'new', type: 'erc_event', subtype: '', submitted_at: '2026-09-02T00:00:00Z' },
  ];
  assert.deepEqual(sortStream(rows).map(r => r.id), ['e', 'r']);
});

test('a row still waiting for the reader never reaches a card or a count', () => {
  const waiting = [
    { id: 'p1', status: 'new', type: 'event', pending_read: 'yes', submitted_at: '2026-09-10T10:00:00Z' },
    { id: 'p2', status: 'new', type: '', pending_read: 'yes', submitted_at: '2026-09-10T10:01:00Z' },
    { id: 'e9', status: 'new', type: 'event', pending_read: '', submitted_at: '2026-09-10T09:00:00Z' },
  ];
  assert.deepEqual(sortStream(waiting).map(r => r.id), ['e9']);
  const counts = sortCounts(waiting);
  assert.equal(counts.all, 1);
  assert.equal(counts.untyped, 0);
  assert.equal(counts.event, 1);
});

test('readerQueue lists the waiting rows Sort must have read, and only those', async () => {
  const { readerQueue } = await import('../js/sort-view.js');
  assert.equal(typeof readerQueue, 'function');
  const mix = [
    { id: 'w1', status: 'new', pending_read: 'yes' },
    { id: 'ok', status: 'new', pending_read: '' },
    { id: 'gone', status: 'trashed', pending_read: 'yes' },
    { id: 'w2', status: 'new', pending_read: 'yes' },
  ];
  assert.deepEqual(readerQueue(mix), ['w1', 'w2']);
});

test('a duplicate badge names the earlier item and what happened to it (F8)', async () => {
  const { dupeBadgeText } = await import('../js/sort-view.js');
  assert.equal(dupeBadgeText({ headline: 'Research Grants on Improving the Use of Research Evidence', status: 'trashed', submitted_at: '2026-09-03T14:00:00Z' }),
    'Same link as "Research Grants on Improving the Use of Research Evidence", deleted 9/3');
  assert.equal(dupeBadgeText({ headline: 'Research Grants on Improving the Use of Research Evidence — Letter of Inquiry', status: 'trashed', submitted_at: '2026-09-03T14:00:00Z' }),
    'Same link as "Research Grants on Improving the Use of Research Evidence…", deleted 9/3');
  assert.equal(dupeBadgeText({ headline: 'Short', status: 'kept', submitted_at: '2026-08-20T10:00:00Z' }), 'Same link as "Short", kept 8/20');
  assert.equal(dupeBadgeText({ headline: 'Parked one', status: 'circleback', submitted_at: '' }), 'Same link as "Parked one", parked');
  assert.equal(dupeBadgeText({ headline: 'Waiting', status: 'new', submitted_at: '2026-09-10T00:00:00Z' }), 'Same link as "Waiting", in the queue 9/10');
});

test('isNewToday marks what was submitted today, by the same UTC date the desk uses (F24)', async () => {
  const { isNewToday } = await import('../js/sort-view.js');
  assert.equal(isNewToday({ submitted_at: '2026-09-10T23:59:00Z' }, '2026-09-10'), true);
  assert.equal(isNewToday({ submitted_at: '2026-09-09T23:59:00Z' }, '2026-09-10'), false);
  assert.equal(isNewToday({ submitted_at: '' }, '2026-09-10'), false);
  assert.equal(isNewToday({ submitted_at: '2026-09-10T01:00:00Z' }, ''), false);
});
