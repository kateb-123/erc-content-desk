import test from 'node:test';
import assert from 'node:assert/strict';
import { keptUntyped, readerQueue, sortCounts, sectionOf, allSections, sectionRows, fixReasons, dupeReason, dupeBadgeText, isNewToday, landingSection, keepBlock, nextSelected, nextSectionWithRows, undoWords, withoutRow, adjacentTab } from '../js/sort-view.js';

// Shuffled on purpose: statuses mixed in, groups interleaved, dates unordered.
// Every typed row carries a real subtype: without one it would sit under Needs a fix.
const rows = [
  { id: 'h1', status: 'new', type: 'headline', subtype: 'Texas', submitted_at: '2026-08-20T10:00:00Z' },
  { id: 'r2', status: 'new', type: 'research', subtype: 'Report', submitted_at: '2026-08-26T09:00:00Z' },
  { id: 'kept', status: 'kept', type: 'event', subtype: 'Off-Campus', submitted_at: '2026-08-19T09:00:00Z' },
  { id: 'u1', status: 'new', type: '', submitted_at: '2026-08-25T12:00:00Z' },
  { id: 'e1', status: 'new', type: 'event', subtype: 'Off-Campus', submitted_at: '2026-08-24T08:00:00Z' },
  { id: 'r1', status: 'new', type: 'research', subtype: 'Report', submitted_at: '2026-08-22T08:00:00Z' },
  { id: 'o1', status: 'new', type: 'opportunity', subtype: 'Other', submitted_at: '2026-08-23T08:00:00Z' },
  { id: 'weird', status: 'new', type: 'legacy-type', submitted_at: '2026-08-21T08:00:00Z' },
  { id: 'r3', status: 'new', type: 'research', subtype: 'Report', submitted_at: '' },
  { id: 'erc1', status: 'new', type: 'event', subtype: 'A&M', spotlight_request: true, submitted_at: '2026-08-24T09:00:00Z' },
  { id: 'erc2', status: 'new', type: 'research', subtype: 'ERC Research', submitted_at: '2026-08-23T09:00:00Z' },
];

test('sortCounts totals pending rows per bucket, each row in one bucket only', () => {
  // erc1 (a spotlight event) and erc2 (ERC Research) count under ERC and not
  // again under Events/Research; 'weird' (a legacy type) counts under Needs a
  // type, where it is listed. Before Sep 15 the first two double-counted and
  // the third counted nowhere.
  assert.deepEqual(sortCounts(rows), {
    erc: 2, fix: 2, erc_event: 0, research: 3, event: 1, opportunity: 1, headline: 1, skipped: 0,
  });
});

test('allSections over the whole queue loses nothing and repeats nothing', () => {
  const listed = allSections(rows).flatMap(g => g.live.map(r => r.id));
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual([...listed].sort(),
    ['e1', 'erc1', 'erc2', 'h1', 'o1', 'r1', 'r2', 'r3', 'u1', 'weird'].sort());
});

test('allSections orders a section oldest first, the way the card stream did', () => {
  const research = allSections(rows).find(g => g.section === 'research');
  assert.deepEqual(research.live.map(r => r.id), ['r1', 'r2', 'r3']);
});

test('kept rows without a type come back to Sort, unless already in an issue or live', () => {
  const rows = [
    { id: 1, status: 'kept', type: '' },
    { id: 2, status: 'kept', type: 'event', subtype: 'Off-Campus' },
    { id: 3, status: 'kept', type: '', newsletter_issue: '2026-09-01' },
    { id: 4, status: 'kept', type: '', published_at: '2026-08-25' },
    { id: 5, status: 'new', type: '' },
  ];
  assert.deepEqual(keptUntyped(rows).map(r => r.id), [1]);
  // Needs a type lists the pending untyped first, then the kept fix-ups.
  assert.deepEqual(allSections(rows)[0].live.map(r => r.id), [5, 1]);
});

test("a card decided this session stays in its section, greyed at the bottom, so a mistake is in reach", () => {
  const decided = rows.map(r => (r.id === 'r1' ? { ...r, status: 'kept' } : r));
  const research = d => allSections(decided, d).find(g => g.section === 'research');
  // Without the session set the decided row is gone from the list, as before.
  assert.deepEqual(research(new Set()).live.map(r => r.id), ['r2', 'r3']);
  assert.deepEqual(research(new Set()).done.map(r => r.id), []);
  // With it, r1 is still listed, out of the live rows and into done.
  assert.deepEqual(research(new Set(['r1'])).live.map(r => r.id), ['r2', 'r3']);
  assert.deepEqual(research(new Set(['r1'])).done.map(r => r.id), ['r1']);
});

test('trashed and skipped session rows stay listed too — any decision is reversible', () => {
  const decided = rows.map(r => {
    if (r.id === 'e1') return { ...r, status: 'trashed' };
    if (r.id === 'o1') return { ...r, status: 'circleback' };
    return r;
  });
  const groups = allSections(decided, new Set(['e1', 'o1']));
  assert.deepEqual(groups.find(g => g.section === 'event').done.map(r => r.id), ['e1']);
  assert.deepEqual(groups.find(g => g.section === 'opportunity').done.map(r => r.id), ['o1']);
});

test('a session-decided row that is also a kept fix-up appears once, not twice', () => {
  const rows = [{ id: 1, status: 'kept', type: '' }, { id: 2, status: 'new', type: 'event', subtype: 'Off-Campus' }];
  const untyped = allSections(rows, new Set([1])).find(g => g.section === 'fix');
  const ids = [...untyped.live, ...untyped.done].map(r => r.id);
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

test('ERC Events lead, ahead of research', () => {
  const rows = [
    { id: 'r', status: 'new', type: 'research', subtype: 'Report', submitted_at: '2026-09-01T00:00:00Z' },
    { id: 'e', status: 'new', type: 'erc_event', subtype: '', submitted_at: '2026-09-02T00:00:00Z' },
  ];
  assert.deepEqual(allSections(rows).map(g => g.section), ['erc_event', 'research']);
});

test('a row still waiting for the reader never reaches a list or a count', () => {
  const waiting = [
    { id: 'p1', status: 'new', type: 'event', subtype: 'Off-Campus', pending_read: 'yes', submitted_at: '2026-09-10T10:00:00Z' },
    { id: 'p2', status: 'new', type: '', pending_read: 'yes', submitted_at: '2026-09-10T10:01:00Z' },
    { id: 'e9', status: 'new', type: 'event', subtype: 'Off-Campus', pending_read: '', submitted_at: '2026-09-10T09:00:00Z' },
  ];
  assert.deepEqual(allSections(waiting).flatMap(g => g.live.map(r => r.id)), ['e9']);
  const counts = sortCounts(waiting);
  assert.equal(counts.fix, 0);
  assert.equal(counts.event, 1);
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

test('sectionRows: a section\'s pending rows oldest first, this session\'s decided ones at the bottom, nothing else', () => {
  const rs = [
    { id: 'h2', status: 'new', type: 'headline', subtype: 'Texas', submitted_at: '2026-09-10T10:00:00Z' },
    { id: 'gone', status: 'trashed', type: 'headline', subtype: 'Texas', submitted_at: '2026-09-09T10:00:00Z' },
    { id: 'h1', status: 'new', type: 'headline', subtype: 'Texas', submitted_at: '2026-09-08T10:00:00Z' },
    { id: 'old', status: 'trashed', type: 'headline', subtype: 'Texas', submitted_at: '2026-09-01T10:00:00Z' },
    { id: 'kept', status: 'kept', type: 'headline', subtype: 'Texas', submitted_at: '2026-09-07T10:00:00Z' },
    { id: 'parked', status: 'circleback', type: 'headline', subtype: 'Texas', submitted_at: '2026-09-06T10:00:00Z' },
    { id: 'reading', status: 'new', type: 'headline', subtype: 'Texas', pending_read: 'yes', submitted_at: '2026-09-11T10:00:00Z' },
    { id: 'erc', status: 'new', type: 'headline', subtype: 'Texas', spotlight_request: true, submitted_at: '2026-09-05T10:00:00Z' },
    { id: 'ev', status: 'new', type: 'event', subtype: 'Off-Campus', submitted_at: '2026-09-05T10:00:00Z' },
  ];
  const { live, done } = sectionRows(rs, 'headline', new Set(['gone', 'kept', 'parked']));
  assert.deepEqual(live.map(r => r.id), ['h1', 'h2']);
  assert.deepEqual(done.map(r => r.id), ['parked', 'kept', 'gone']);
  assert.deepEqual(sectionRows(rs, 'erc').live.map(r => r.id), ['erc']);
  assert.deepEqual(sectionRows(rs, 'event').live.map(r => r.id), ['ev']);
});

test('sectionRows for Needs a type also lists kept rows that lost their type, since typing is their fix', () => {
  const rs = [
    { id: 'u1', status: 'new', type: '', submitted_at: '2026-09-10T10:00:00Z' },
    { id: 'k1', status: 'kept', type: 'legacy-type', submitted_at: '2026-09-09T10:00:00Z' },
    { id: 'ok', status: 'new', type: 'event', subtype: 'Off-Campus', submitted_at: '2026-09-08T10:00:00Z' },
  ];
  assert.deepEqual(sectionRows(rs, 'fix').live.map(r => r.id), ['k1', 'u1']);
});

test('allSections: every non-empty section in pill order, each row in exactly one of them', () => {
  const rs = [
    { id: 'h1', status: 'new', type: 'headline', subtype: 'Texas', submitted_at: '2026-08-20T10:00:00Z' },
    { id: 'u1', status: 'new', type: '', submitted_at: '2026-08-25T12:00:00Z' },
    { id: 'e1', status: 'new', type: 'event', subtype: 'Off-Campus', submitted_at: '2026-08-24T08:00:00Z' },
    { id: 'erc1', status: 'new', type: 'event', subtype: 'Off-Campus', spotlight_request: true, submitted_at: '2026-08-24T09:00:00Z' },
    { id: 'old', status: 'kept', type: 'research', subtype: 'Report', submitted_at: '2026-08-01T08:00:00Z' },
  ];
  const groups = allSections(rs);
  assert.deepEqual(groups.map(g => g.section), ['fix', 'erc', 'event', 'headline']);
  assert.deepEqual(groups.map(g => g.live.map(r => r.id)), [['u1'], ['erc1'], ['e1'], ['h1']]);
  const ids = groups.flatMap(g => g.live.map(r => r.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('allSections keeps a section that only holds rows decided this session', () => {
  const rs = [{ id: 'gone', status: 'trashed', type: 'headline', subtype: 'Texas', submitted_at: '2026-08-20T10:00:00Z' }];
  assert.deepEqual(allSections(rs, new Set(['gone'])).map(g => g.section), ['headline']);
  assert.deepEqual(allSections(rs).map(g => g.section), []);
});

test('an ERC row counts once, under ERC, not again under its own type', () => {
  const rs = [{ id: 'e', status: 'new', type: 'event', subtype: 'Off-Campus', spotlight_request: true, submitted_at: '2026-09-01T00:00:00Z' }];
  assert.deepEqual(sortCounts(rs), { erc: 1, fix: 0, erc_event: 0, research: 0, event: 0, opportunity: 0, headline: 0, skipped: 0 });
});

test('a row with a legacy type counts under Needs a type, where it is listed', () => {
  const rs = [{ id: 'w', status: 'new', type: 'legacy-type', submitted_at: '2026-09-01T00:00:00Z' }];
  assert.equal(sortCounts(rs).fix, 1);
  assert.equal(allSections(rs)[0].section, 'fix');
});

// Needs a fix (Kate, Sep 15): one section gathers every row that cannot be
// kept yet, plus possible duplicates, instead of amber marks on rows.
const ok = { id: 'ok', status: 'new', type: 'research', subtype: 'Report', link: 'https://a.org/1', link_checked: 'ok', submitted_at: '2026-09-01T00:00:00Z' };

test('fixReasons names what keeps a row out of Keep the rest, and a possible duplicate', () => {
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

test('sectionOf sends any row with a fix to the fix section, ahead of ERC and its type', () => {
  const rs = [{ ...ok, id: 'l', link_checked: 'failed' }, { ...ok, id: 'e', spotlight_request: true, link_checked: 'failed' }];
  assert.equal(sectionOf(rs[0], { rows: rs }), 'fix');
  assert.equal(sectionOf(rs[1], { rows: rs }), 'fix');
  assert.equal(sectionOf(ok, { rows: [ok] }), 'research');
});

test('a row with an unchecked link lists under Needs a fix only, never also under its type', () => {
  const rs = [ok, { ...ok, id: 'bad', link_checked: 'failed', submitted_at: '2026-09-02T00:00:00Z' }];
  const groups = allSections(rs);
  assert.deepEqual(groups.map(g => [g.section, g.live.map(r => r.id)]), [['fix', ['bad']], ['research', ['ok']]]);
  assert.equal(sortCounts(rs).fix, 1);
  assert.equal(sortCounts(rs).research, 1);
});

// One table at a time (Kate, Sep 15): no All pill. Sort lands on the first
// section that holds something, Needs a fix first.
test('landingSection is the first pill with anything in it, Needs a fix first, else Needs a fix', () => {
  assert.equal(landingSection({ fix: 2, erc: 1, erc_event: 0, research: 3, event: 0, opportunity: 0, headline: 0 }), 'fix');
  assert.equal(landingSection({ fix: 0, erc: 0, erc_event: 0, research: 3, event: 0, opportunity: 0, headline: 1 }), 'research');
  assert.equal(landingSection({ fix: 0, erc: 0, erc_event: 0, research: 0, event: 0, opportunity: 0, headline: 0 }), 'fix');
});

// Skipped (Kate, Sep 15, option B): a parked row waits under its own pill, any
// type, with Keep and Delete, so a Skip is never the end of the road. Before
// this only Home listed circle-backs, and only with a trash can.
test('a skipped row lives under Skipped, whatever its type, and in no other section', () => {
  const rs = [
    { id: 'p1', status: 'circleback', type: 'research', subtype: 'Report', submitted_at: '2026-09-02T00:00:00Z' },
    { id: 'p2', status: 'circleback', type: '', submitted_at: '2026-09-01T00:00:00Z' },
    { id: 'n1', status: 'new', type: 'research', subtype: 'Report', submitted_at: '2026-09-03T00:00:00Z' },
    { id: 'reading', status: 'circleback', type: 'event', subtype: 'A&M', pending_read: 'yes', submitted_at: '2026-09-04T00:00:00Z' },
  ];
  const groups = allSections(rs);
  assert.deepEqual(groups.map(g => [g.section, g.live.map(r => r.id)]), [['research', ['n1']], ['skipped', ['p2', 'p1']]]);
  assert.equal(sortCounts(rs).skipped, 2);
  assert.equal(sortCounts(rs).fix, 0);   // an untyped parked row waits under Skipped, not Needs a fix
});

test('Skipped is the last pill; Sort lands there only when nothing else is waiting', () => {
  assert.equal(landingSection({ fix: 0, erc: 0, erc_event: 0, research: 0, event: 0, opportunity: 0, headline: 0, skipped: 2 }), 'skipped');
  assert.equal(landingSection({ fix: 0, erc: 0, erc_event: 0, research: 1, event: 0, opportunity: 0, headline: 0, skipped: 2 }), 'research');
});

test('a row skipped this session greys in its own section and is already live under Skipped', () => {
  const rs = [
    { id: 'r1', status: 'circleback', type: 'research', subtype: 'Report', submitted_at: '2026-09-02T00:00:00Z' },
    { id: 'r2', status: 'new', type: 'research', subtype: 'Report', submitted_at: '2026-09-03T00:00:00Z' },
  ];
  const decided = new Set(['r1']);
  const from = new Map([['r1', 'new']]);
  assert.deepEqual(sectionRows(rs, 'research', decided, undefined, from).done.map(r => r.id), ['r1']);
  assert.deepEqual(sectionRows(rs, 'skipped', decided, undefined, from).live.map(r => r.id), ['r1']);
});

test('a row kept or deleted from Skipped greys under Skipped, not in its type section', () => {
  const rs = [
    { id: 'k', status: 'kept', type: 'research', subtype: 'Report', submitted_at: '2026-09-02T00:00:00Z' },
    { id: 'd', status: 'trashed', type: 'event', subtype: 'A&M', submitted_at: '2026-09-01T00:00:00Z' },
    { id: 'p', status: 'circleback', type: 'headline', subtype: 'Texas', submitted_at: '2026-09-03T00:00:00Z' },
  ];
  const decided = new Set(['k', 'd']);
  const from = new Map([['k', 'circleback'], ['d', 'circleback']]);
  const groups = allSections(rs, decided, from);
  assert.deepEqual(groups.map(g => g.section), ['skipped']);
  assert.deepEqual(groups[0].live.map(r => r.id), ['p']);
  assert.deepEqual(groups[0].done.map(r => r.id), ['d', 'k']);
});

// ── Sort as a list and a card (Claude Design round two, Kate's pick C, Sep 16) ──

test('keepBlock says why Keep is locked: a type first, then the link; nothing when it can be kept', () => {
  assert.equal(keepBlock({ type: '', subtype: '', link: 'https://x.org', link_checked: 'ok' }), 'Set a type first');
  assert.equal(keepBlock({ type: 'headline', subtype: 'Texas', link: 'https://x.org', link_checked: 'failed' }), 'Check the link first');
  assert.equal(keepBlock({ type: 'headline', subtype: 'Texas', link: 'https://x.org', link_checked: 'ok' }), '');
});

test('nextSelected keeps the chosen row while it is live, else takes the row now in its place', () => {
  assert.equal(nextSelected(['a', 'b', 'c'], 'b', 1), 'b');
  assert.equal(nextSelected(['a', 'c'], 'b', 1), 'c');
  assert.equal(nextSelected(['a'], 'c', 2), 'a');
  assert.equal(nextSelected([], 'a', 0), null);
  assert.equal(nextSelected(['a', 'b'], null, 0), 'a');
});

test('nextSectionWithRows finds the next section that holds anything, wrapping round, else none', () => {
  const counts = { fix: 0, erc: 0, erc_event: 0, research: 2, event: 0, opportunity: 1, headline: 0, skipped: 0 };
  assert.equal(nextSectionWithRows(counts, 'research'), 'opportunity');
  assert.equal(nextSectionWithRows(counts, 'opportunity'), 'research');
  assert.equal(nextSectionWithRows({ ...counts, research: 0, opportunity: 0 }, 'fix'), null);
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

// Audit round two, e14: the section tabs are one tab stop; Left and Right move between them.
test('adjacentTab: Left and Right wrap, Home and End jump, other keys do nothing', () => {
  const keys = ['fix', 'erc', 'research'];
  assert.equal(adjacentTab(keys, 'erc', 'ArrowRight'), 'research');
  assert.equal(adjacentTab(keys, 'research', 'ArrowRight'), 'fix');
  assert.equal(adjacentTab(keys, 'fix', 'ArrowLeft'), 'research');
  assert.equal(adjacentTab(keys, 'erc', 'Home'), 'fix');
  assert.equal(adjacentTab(keys, 'fix', 'End'), 'research');
  assert.equal(adjacentTab(keys, 'fix', 'Enter'), null);
});
