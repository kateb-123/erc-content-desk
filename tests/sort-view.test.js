import test from 'node:test';
import assert from 'node:assert/strict';
import { keptUntyped, readerQueue, sortList, oldestWait, fixReasons, dupeReason, dupeBadgeText, isNewToday, keepBlock, nextSelected, undoWords, withoutRow, adjacentTab } from '../js/sort-view.js';

// ── One list, newest first (Kate's wireframes and her answers, Sep 18) ──

const at = (id, status, submitted_at, extra = {}) => ({ id, status, type: 'research', subtype: 'Report', submitted_at, ...extra });

test('sortList: the waiting rows newest first, the skipped ones under them newest first, this visit\'s decisions greyed last', () => {
  const rows = [
    at('n1', 'new', '2026-09-10T10:00:00Z'),
    at('n2', 'new', '2026-09-12T10:00:00Z'),
    at('n0', 'new', ''),
    at('s1', 'circleback', '2026-09-11T10:00:00Z'),
    at('s2', 'circleback', '2026-09-09T10:00:00Z'),
    at('k1', 'kept', '2026-09-13T10:00:00Z'),
    at('t1', 'trashed', '2026-09-08T10:00:00Z'),
    at('old', 'kept', '2026-09-01T10:00:00Z'),
  ];
  const { live, done } = sortList(rows, new Set(['k1', 't1']));
  assert.deepEqual(live.map(r => r.id), ['n2', 'n1', 'n0', 's1', 's2']);
  assert.deepEqual(done.map(r => r.id), ['k1', 't1']);
});

test('sortList: a row skipped this visit is still live, at the bottom with the skipped; a row kept from Skipped greys', () => {
  const rows = [at('a', 'circleback', '2026-09-12T10:00:00Z'), at('b', 'new', '2026-09-10T10:00:00Z'), at('c', 'kept', '2026-09-11T10:00:00Z')];
  const { live, done } = sortList(rows, new Set(['a', 'c']));
  assert.deepEqual(live.map(r => r.id), ['b', 'a']);
  assert.deepEqual(done.map(r => r.id), ['c']);
});

test('sortList: kept rows that lost their type come back, since typing is their fix, unless already in an issue or live', () => {
  const rows = [
    { id: 1, status: 'kept', type: '', submitted_at: '2026-09-09T10:00:00Z' },
    { id: 2, status: 'kept', type: 'event', subtype: 'Off-Campus' },
    { id: 3, status: 'kept', type: '', newsletter_issue: '2026-09-01' },
    { id: 4, status: 'kept', type: '', published_at: '2026-08-25' },
    { id: 5, status: 'new', type: '', submitted_at: '2026-09-10T10:00:00Z' },
  ];
  assert.deepEqual(keptUntyped(rows).map(r => r.id), [1]);
  assert.deepEqual(sortList(rows).live.map(r => r.id), [5, 1]);
});

test('sortList: a row still waiting for the reader never reaches the list', () => {
  const rows = [
    at('p1', 'new', '2026-09-10T10:00:00Z', { pending_read: 'yes' }),
    at('p2', 'circleback', '2026-09-10T10:01:00Z', { pending_read: 'yes' }),
    at('e9', 'new', '2026-09-10T09:00:00Z'),
  ];
  assert.deepEqual(sortList(rows).live.map(r => r.id), ['e9']);
});

test('oldestWait: whole days the oldest waiting row has sat, by the desk\'s UTC date; none when nothing waits', () => {
  const rows = [at('a', 'new', '2026-09-10T23:00:00Z'), at('b', 'new', '2026-09-15T01:00:00Z'), at('s', 'circleback', '2026-08-01T00:00:00Z')];
  assert.equal(oldestWait(rows, '2026-09-18'), 8);
  assert.equal(oldestWait([at('b', 'new', '2026-09-18T01:00:00Z')], '2026-09-18'), 0);
  assert.equal(oldestWait([], '2026-09-18'), null);
  assert.equal(oldestWait([at('x', 'new', '')], '2026-09-18'), null);
});

test('readerQueue lists the waiting rows Sort must have read, and only those', () => {
  const mix = [
    { id: 'w1', status: 'new', pending_read: 'yes' },
    { id: 'ok', status: 'new', pending_read: '' },
    { id: 'gone', status: 'trashed', pending_read: 'yes' },
    { id: 'w2', status: 'new', pending_read: 'yes' },
  ];
  assert.deepEqual(readerQueue(mix), ['w1', 'w2']);
});

test('a duplicate badge names the earlier item and what happened to it (F8)', () => {
  assert.equal(dupeBadgeText({ headline: 'Research Grants on Improving the Use of Research Evidence', status: 'trashed', submitted_at: '2026-09-03T14:00:00Z' }, '2026-09-15'),
    'Same link as "Research Grants on Improving the Use of Research Evidence", deleted Sep 3');
  assert.equal(dupeBadgeText({ headline: 'Research Grants on Improving the Use of Research Evidence — Letter of Inquiry', status: 'trashed', submitted_at: '2026-09-03T14:00:00Z' }, '2026-09-15'),
    'Same link as "Research Grants on Improving the Use of Research Evidence…", deleted Sep 3');
  assert.equal(dupeBadgeText({ headline: 'Short', status: 'kept', submitted_at: '2026-08-20T10:00:00Z' }, '2026-09-15'), 'Same link as "Short", kept Aug 20');
  // A duplicate from another year says so.
  assert.equal(dupeBadgeText({ headline: 'Old', status: 'kept', submitted_at: '2025-08-20T10:00:00Z' }, '2026-09-15'), 'Same link as "Old", kept Aug 20, 2025');
  assert.equal(dupeBadgeText({ headline: 'Parked one', status: 'circleback', submitted_at: '' }), 'Same link as "Parked one", parked');
  assert.equal(dupeBadgeText({ headline: 'Waiting', status: 'new', submitted_at: '2026-09-10T00:00:00Z' }, '2026-09-15'), 'Same link as "Waiting", in the queue Sep 10');
});

test('isNewToday marks what was submitted today, by the same UTC date the desk uses (F24)', () => {
  assert.equal(isNewToday({ submitted_at: '2026-09-10T23:59:00Z' }, '2026-09-10'), true);
  assert.equal(isNewToday({ submitted_at: '2026-09-09T23:59:00Z' }, '2026-09-10'), false);
  assert.equal(isNewToday({ submitted_at: '' }, '2026-09-10'), false);
  assert.equal(isNewToday({ submitted_at: '2026-09-10T01:00:00Z' }, ''), false);
});

// The checks stay on the card (Kate, Sep 18): no type, a link not opened, a
// possible duplicate. The list marks the row; the card says why.
const ok = { id: 'ok', status: 'new', type: 'research', subtype: 'Report', link: 'https://a.org/1', link_checked: 'ok', submitted_at: '2026-09-01T00:00:00Z' };

test('fixReasons names what locks Keep and next, and a possible duplicate', () => {
  assert.deepEqual(fixReasons(ok, { rows: [ok] }), []);
  assert.deepEqual(fixReasons({ ...ok, type: '' }, { rows: [] }), ['No type']);
  assert.deepEqual(fixReasons({ ...ok, subtype: 'Not a real one' }, { rows: [] }), ['No type']);
  assert.deepEqual(fixReasons({ ...ok, link_checked: 'failed' }, { rows: [] }), ['Link not opened']);
  assert.deepEqual(fixReasons({ ...ok, link_checked: 'mismatch' }, { rows: [] }), ['Link not opened']);
  assert.deepEqual(fixReasons({ ...ok, type: '', link_checked: 'failed' }, { rows: [] }), ['No type', 'Link not opened']);
});

test('a later row with the same link as an unpublished earlier one is a fix; a live earlier one is only a fact', () => {
  const earlier = { ...ok, id: 'first', headline: 'Earlier', submitted_at: '2026-08-26T00:00:00Z' };
  const later = { ...ok, id: 'second', submitted_at: '2026-08-27T00:00:00Z' };
  assert.deepEqual(fixReasons(later, { rows: [earlier, later], today: '2026-09-15' }), ['Same link as "Earlier", in the queue Aug 26']);
  assert.deepEqual(fixReasons(earlier, { rows: [earlier, later] }), []);
  const live = { ...earlier, status: 'kept', published_at: '2026-08-28' };
  assert.deepEqual(fixReasons(later, { rows: [live, later] }), []);
});

// Sort's card asks for the duplicate on its own, instead of sieving the other
// two reasons out of fixReasons by their words.
test('dupeReason is the duplicate half of fixReasons, and empty when there is none', () => {
  const earlier = { ...ok, id: 'first', headline: 'Earlier', submitted_at: '2026-08-26T00:00:00Z' };
  const later = { ...ok, id: 'second', submitted_at: '2026-08-27T00:00:00Z' };
  assert.equal(dupeReason(later, { rows: [earlier, later], today: '2026-09-15' }), 'Same link as "Earlier", in the queue Aug 26');
  assert.equal(dupeReason(earlier, { rows: [earlier, later] }), '');
  assert.equal(dupeReason(later, { rows: [{ ...earlier, status: 'kept', published_at: '2026-08-28' }, later] }), '');
  // The two blocking reasons are not its business, whichever of them the row has.
  assert.equal(dupeReason({ ...later, type: '', link_checked: 'failed' }, { rows: [later] }), '');
});

// ── The card ──

test('keepBlock says why Keep and next is locked: a type first, then the link; nothing when it can be kept', () => {
  assert.equal(keepBlock({ type: '', subtype: '', link: 'https://x.org', link_checked: 'ok' }), 'Set a type first');
  assert.equal(keepBlock({ type: 'headline', subtype: 'Texas', link: 'https://x.org', link_checked: 'failed' }), 'Check the link first');
  assert.equal(keepBlock({ type: 'headline', subtype: 'Texas', link: 'https://x.org', link_checked: 'ok' }), '');
  // One box, ERC Newsletter only: unticked goes to both, so nowhere is never a state (Kate, Sep 22).
  assert.equal(keepBlock({ type: 'headline', subtype: 'Texas', link: 'https://x.org', link_checked: 'ok', send_to: 'newsletter' }), '');
});

test('nextSelected keeps the chosen row while it is live, else takes the row now in its place', () => {
  assert.equal(nextSelected(['a', 'b', 'c'], 'b', 1), 'b');
  assert.equal(nextSelected(['a', 'c'], 'b', 1), 'c');
  assert.equal(nextSelected(['a'], 'c', 2), 'a');
  assert.equal(nextSelected([], 'a', 0), null);
  assert.equal(nextSelected(['a', 'b'], null, 0), 'a');
});

// Audit round two, e3: Undo last says what it undid, and a row's own Undo takes
// that row out of the stack so Undo last can never re-apply its decision.
test('undoWords: names what an undo restored', () => {
  const row = { headline: 'Teacher pay study' };
  assert.equal(undoWords({ kind: 'keep', rows: [row] }), 'Undid: kept Teacher pay study');
  assert.equal(undoWords({ kind: 'circleback', rows: [row] }), 'Undid: skipped Teacher pay study');
  assert.equal(undoWords({ kind: 'trash', rows: [row] }), 'Undid: deleted Teacher pay study');
  assert.equal(undoWords({ kind: 'keep-all', rows: [row, row, row] }), 'Undid: kept 3');
  assert.equal(undoWords({ kind: 'edit', rows: [row] }), 'Undid: the edit to Teacher pay study');
  assert.equal(undoWords({ kind: 'type', rows: [row] }), 'Undid: the type on Teacher pay study');
  assert.equal(undoWords({ kind: 'link', rows: [row] }), 'Undid: the link check on Teacher pay study');
  assert.equal(undoWords({ kind: 'keep', rows: [{ link: 'https://x.org' }] }), 'Undid: kept https://x.org');
});

test('withoutRow: drops one row from every entry and empties the entries it leaves', () => {
  const a = { id: 'a' }, b = { id: 'b' };
  const stack = [{ kind: 'keep', rows: [a] }, { kind: 'keep-all', rows: [a, b] }, { kind: 'edit', rows: [b] }];
  const out = withoutRow(stack, 'a');
  assert.deepEqual(out.map(e => [e.kind, e.rows.map(r => r.id)]), [['keep-all', ['b']], ['edit', ['b']]]);
  assert.equal(stack.length, 3, 'the stack passed in is not changed');
});

// Audit round two, e14: the tabs (Sort and Finalize since Sep 18) are one tab stop; Left and Right move between them.
test('adjacentTab: Left and Right wrap, Home and End jump, other keys do nothing', () => {
  const keys = ['sort', 'finalize', 'third'];
  assert.equal(adjacentTab(keys, 'finalize', 'ArrowRight'), 'third');
  assert.equal(adjacentTab(keys, 'third', 'ArrowRight'), 'sort');
  assert.equal(adjacentTab(keys, 'sort', 'ArrowLeft'), 'third');
  assert.equal(adjacentTab(keys, 'finalize', 'Home'), 'sort');
  assert.equal(adjacentTab(keys, 'sort', 'End'), 'third');
  assert.equal(adjacentTab(keys, 'sort', 'Enter'), null);
});
