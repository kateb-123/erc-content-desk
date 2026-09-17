import test from 'node:test';
import assert from 'node:assert/strict';
import { sortRows, isoToShort, queueRows, queueMatch, partnerFocusKey } from '../js/queue-view.js';

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
  // in-app names: event->Event, research->New research, opportunity->Opportunity
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

// ── The link already in the queue (audit round two, e19) ──

test('queueMatch finds the waiting row with the same link and says when it came in', () => {
  const rows = [
    { id: 'a', status: 'new', headline: 'IES grants', link: 'https://ies.ed.gov/funding/305a', submitted_at: '2026-08-23T10:00:00Z' },
    { id: 'b', status: 'kept', headline: 'Kept one', link: 'https://kept.org/x', submitted_at: '2026-08-20T10:00:00Z' },
    { id: 'c', status: 'circleback', headline: 'Parked one', link: 'https://parked.org/y/', submitted_at: '2025-12-01T10:00:00Z' },
  ];
  assert.deepEqual(queueMatch('https://ies.ed.gov/funding/305a', rows, '2026-09-17'), { id: 'a', title: 'IES grants', when: 'Aug 23' });
  // The same page with a trailing slash, a bare scheme or a www is the same link.
  assert.equal(queueMatch('http://www.ies.ed.gov/funding/305a/', rows, '2026-09-17')?.id, 'a');
  assert.deepEqual(queueMatch('https://parked.org/y', rows, '2026-09-17'), { id: 'c', title: 'Parked one', when: 'Dec 1, 2025' });
  // A kept row is not in the queue, and an empty link matches nothing.
  assert.equal(queueMatch('https://kept.org/x', rows, '2026-09-17'), null);
  assert.equal(queueMatch('', rows, '2026-09-17'), null);
  assert.equal(queueMatch('https://nowhere.org', rows, '2026-09-17'), null);
});

test('queueMatch falls back to the link as the title when the row has none', () => {
  const rows = [{ id: 'a', status: 'new', headline: '', link: 'https://x.org/p', submitted_at: '' }];
  assert.deepEqual(queueMatch('https://x.org/p', rows, '2026-09-17'), { id: 'a', title: 'https://x.org/p', when: '' });
});

// ── The keyboard's place after a row action (audit round two, e17) ──

test('partnerFocusKey names the control that takes the place of the one just pressed', () => {
  assert.equal(partnerFocusKey('delete:r1'), 'undo:r1');        // after Delete, land on that row's Undo
  assert.equal(partnerFocusKey('undo:r1'), 'delete:r1');        // after Undo, back on its trash can
  assert.equal(partnerFocusKey('remove:r1', 'remove'), 'undo:r1');
  assert.equal(partnerFocusKey('undo:r1', 'remove'), 'remove:r1');
  assert.equal(partnerFocusKey('refresh'), '');                 // anything else has no partner
  assert.equal(partnerFocusKey(''), '');
  assert.equal(partnerFocusKey(null), '');
});

test('queueRows accepts the snapshot map the queue keeps for Undo', () => {
  const rows = [{ id: 'a', status: 'new' }, { id: 'b', status: 'trashed' }];
  const justDeleted = new Map([['b', { id: 'b', status: 'circleback', newsletter_issue: '2026-09-22' }]]);
  assert.deepEqual(queueRows(rows, justDeleted).map(r => r.id), ['a', 'b']);
});
