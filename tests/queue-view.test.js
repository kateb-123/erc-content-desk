import test from 'node:test';
import assert from 'node:assert/strict';
import { sortRows, isoToShort, queueRows } from '../js/queue-view.js';

// Deliberately NOT pre-sorted in any tested order, so an in-place sort or a
// wrong direction provably fails.
const rows = [
  { id: 'a', headline: 'Zebra funding', type: 'opportunity', subtype: 'Other', submitter: 'MG', submitted_at: '2026-08-24T10:00:00Z' },
  { id: 'b', headline: 'apple pipeline', type: 'research', subtype: 'Report', submitter: 'KB', submitted_at: '2026-08-26T09:00:00Z' },
  { id: 'c', headline: 'Mango webinar', type: 'event', subtype: 'A&M', submitter: 'AL', submitted_at: '2026-08-25T12:00:00Z' },
  { id: 'd', headline: 'no type yet', type: '', subtype: '', submitter: 'KB', submitted_at: '2026-08-23T08:00:00Z' },
];

test('sortRows by title is case-insensitive and non-mutating', () => {
  const before = rows.map(r => r.id).join('');
  const sorted = sortRows(rows, 'title', 'asc');
  assert.deepEqual(sorted.map(r => r.id), ['b', 'c', 'd', 'a']);
  assert.equal(rows.map(r => r.id).join(''), before);
});

test('sortRows desc reverses', () => {
  assert.deepEqual(sortRows(rows, 'title', 'desc').map(r => r.id), ['a', 'd', 'c', 'b']);
});

test('sortRows by type uses the display label, empty type sinks last both ways', () => {
  // labels: event->Event, research->New Ed Policy Research, opportunity->Opportunity
  assert.deepEqual(sortRows(rows, 'type', 'asc').map(r => r.id), ['c', 'b', 'a', 'd']);
  assert.deepEqual(sortRows(rows, 'type', 'desc').map(r => r.id), ['a', 'b', 'c', 'd']);
});

test('sortRows by submitted desc puts newest first', () => {
  assert.deepEqual(sortRows(rows, 'submitted', 'desc').map(r => r.id), ['b', 'c', 'a', 'd']);
});

test('sortRows title falls back to link, empty sinks last', () => {
  const mixed = [
    { id: 'x', headline: '', link: 'https://b.org' },
    { id: 'y', headline: '', link: '' },
    { id: 'z', headline: 'Alpha', link: 'https://z.org' },
  ];
  assert.deepEqual(sortRows(mixed, 'title', 'asc').map(r => r.id), ['z', 'x', 'y']);
});

test('sortRows by submitter is stable and ascending', () => {
  assert.deepEqual(sortRows(rows, 'submitter', 'asc').map(r => r.id), ['c', 'b', 'd', 'a']);
});


test('queueRows lists what is waiting, newest circle-backs after pending', () => {
  const rows = [
    { id: 'a', status: 'new' },
    { id: 'b', status: 'circleback' },
    { id: 'c', status: 'kept' },
    { id: 'd', status: 'trashed' },
  ];
  assert.deepEqual(queueRows(rows).map(r => r.id), ['a', 'b']);
});

test('a row deleted from the queue this session stays listed, so it can be undone', () => {
  const rows = [
    { id: 'a', status: 'new' },
    { id: 'b', status: 'trashed' },
    { id: 'c', status: 'trashed' },
  ];
  // 'b' was just deleted here; 'c' was trashed long ago and stays gone.
  assert.deepEqual(queueRows(rows, new Set(['b'])).map(r => r.id), ['a', 'b']);
});

test('queueRows never lists the same row twice', () => {
  const rows = [{ id: 'a', status: 'circleback' }];
  assert.equal(queueRows(rows, new Set(['a'])).length, 1);
});

test('isoToShort gives "Aug 26", adding the year only when it is not this year', () => {
  assert.equal(isoToShort('2026-08-26', '2026-09-15'), 'Aug 26');
  assert.equal(isoToShort('2026-05-03', '2026-09-15'), 'May 3');
  assert.equal(isoToShort('2025-12-09', '2026-09-15'), 'Dec 9, 2025');
  assert.equal(isoToShort('2027-01-02', '2026-09-15'), 'Jan 2, 2027');
  assert.equal(isoToShort('2026-08-26'), 'Aug 26, 2026');                       // no today: always say the year
  assert.equal(isoToShort('2026-08-26T14:00:00Z', '2026-09-15'), 'Aug 26');    // a timestamp works too
  assert.equal(isoToShort(''), '');
  assert.equal(isoToShort('2026-13-01', '2026-09-15'), '');
  assert.equal(isoToShort('garbage', '2026-09-15'), '');
});
