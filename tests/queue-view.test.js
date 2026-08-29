import test from 'node:test';
import assert from 'node:assert/strict';
import { sortRows, isoToSlash } from '../js/queue-view.js';

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

test('isoToSlash renders M/D with no leading zeros and no year', () => {
  assert.equal(isoToSlash('2026-08-26'), '8/26');
  assert.equal(isoToSlash('2026-05-03'), '5/3');
  assert.equal(isoToSlash('2026-12-09'), '12/9');
  assert.equal(isoToSlash(''), '');
  assert.equal(isoToSlash('2026-13-01'), '');
  assert.equal(isoToSlash('garbage'), '');
});
