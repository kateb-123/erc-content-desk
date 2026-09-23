import test from 'node:test';
import assert from 'node:assert/strict';
import { laneCounts, recentlyAdded, deskCards, quickLinkNotes } from '../js/home-panel.js';

// ── The front page's lanes and its Recently added list (Kate's wireframes, Sep 17) ──

// Every lane counts the work waiting on its page (design critique, Sep 18):
// Sort the queue, Newsletter what waits to be added, Policy Exchange what
// Publish would add.
const laneRows = [
  { id: 'q1', status: 'new' }, { id: 'q2', status: 'circleback' },
  { id: 's1', status: 'kept', type: 'research', newsletter_issue: '2026-09-22' },
  { id: 'w1', status: 'kept', type: 'research', published_at: '2026-09-01T10:00:00Z' },
  { id: 'w2', status: 'kept', type: 'event', subtype: 'A&M', date: '2026-09-30' },   // a campus event: newsletter only, held off the Exchange
  { id: 'p1', status: 'kept', type: 'research' },
  { id: 'p2', status: 'kept', type: 'headline' },
  { id: 't1', status: 'trashed' },
];
const laneSchedule = ['2026-09-22', '2026-10-06'];

test('laneCounts: Sort counts the queue, Newsletter what waits to be added, Policy Exchange what Publish would add', () => {
  const preview = { adding: ['p1'], newsletterOnly: ['w2'], notReady: [], skipped: ['p2'] };
  // Newsletter: w1, w2, and p1, p2 (kept, ticked for both by default, waiting there before they are published).
  assert.deepEqual(laneCounts(laneRows, { schedule: laneSchedule, issue: '2026-09-22', today: '2026-09-18', preview }),
    { sort: 2, newsletter: 4, exchange: 1 });
});

test('laneCounts: before the Exchange check lands, Policy Exchange counts the kept rows it could publish', () => {
  assert.equal(laneCounts(laneRows, { schedule: laneSchedule, issue: '2026-09-22', today: '2026-09-18', preview: null }).exchange, 2);
  assert.deepEqual(laneCounts([], { schedule: [], issue: '', today: '2026-09-18', preview: null }), { sort: 0, newsletter: 0, exchange: 0 });
});

test('recentlyAdded: the newest rows first, deleted ones left out, capped at the count asked for', () => {
  const rows = [
    { id: 'a', status: 'new', submitted_at: '2026-09-12T10:00:00Z' },
    { id: 'b', status: 'kept', submitted_at: '2026-09-15T10:00:00Z' },
    { id: 'c', status: 'trashed', submitted_at: '2026-09-16T10:00:00Z' },
    { id: 'd', status: 'new', submitted_at: '2026-09-14T10:00:00Z' },
    { id: 'e', status: 'circleback', submitted_at: '' },
    { id: 'f', status: 'new', submitted_at: '2026-09-11T10:00:00Z' },
  ];
  assert.deepEqual(recentlyAdded(rows, 4).map(r => r.id), ['b', 'd', 'a', 'f']);
  assert.deepEqual(recentlyAdded(rows, 2).map(r => r.id), ['b', 'd']);
  assert.deepEqual(recentlyAdded([], 4), []);
});

// Kate's own page at the root (her answer, Sep 22): cards for the team's page,
// Content Sort, Newsletter and Policy Exchange with their counts, and a
// Documentation card that says forthcoming.
test('deskCards: five cards in order, the counts on the three pages that have work, the next issue under Newsletter', () => {
  const cards = deskCards({ counts: { sort: 13, newsletter: 8, exchange: 2 }, issue: '2026-09-22', today: '2026-09-18' });
  assert.deepEqual(cards.map(c => [c.key, c.label, c.href, c.count, c.sub]), [
    ['team', 'Submit content', '/#team', null, 'The share form, the queue and the quick links, for the team'],
    ['sort', 'Content Sort', '/#sort', 13, 'Waiting to be sorted'],
    ['newsletter', 'Newsletter', '/#newsletter', 8, 'Ready to add · next issue Sep 22'],
    ['exchange', 'Policy Exchange', '/#exchange', 2, 'Publish would add'],
    ['docs', 'Documentation', null, null, 'Forthcoming'],
  ]);
});

test('deskCards: before the rows are in, no counts; with no issue scheduled, Newsletter says so', () => {
  const cards = deskCards({ counts: null, issue: '', today: '2026-09-18' });
  assert.deepEqual(cards.map(c => c.count), [null, null, null, null, null]);
  assert.equal(cards[2].sub, 'Ready to add · no issue scheduled');
});

// ── The notes under the team page's Quick links (Kate, Sep 22) ──

test('quickLinkNotes: when the desk last wrote to the Exchange, the last issue and the next', () => {
  const rows = [
    { published_at: '2026-08-30T16:00:00Z' },
    { published_at: '2026-09-22T19:05:00Z', status: 'trashed' },   // scrapped later, still the last write
    { published_at: '' },
  ];
  assert.deepEqual(quickLinkNotes(rows, { schedule: ['2026-09-08', '2026-09-22', '2026-10-06'], today: '2026-09-23' }),
    { share: '', listserv: 'Last issue Sep 22 · Next Oct 6', exchange: 'Updated Sep 22', newsletter: 'Next issue Oct 6 · nothing ready to add' });
});

test('quickLinkNotes: on a send day the issue due today is next; with nothing known, nothing is said', () => {
  assert.deepEqual(quickLinkNotes([], { schedule: ['2026-09-08', '2026-09-22', '2026-10-06'], today: '2026-09-22' }),
    { share: '', listserv: 'Last issue Sep 8 · Next Sep 22', exchange: '', newsletter: 'Next issue Sep 22 · nothing ready to add' });
  assert.deepEqual(quickLinkNotes([], { schedule: ['2026-09-08'], today: '2026-09-22' }),
    { share: '', listserv: 'Last issue Sep 8', exchange: '', newsletter: 'nothing ready to add' });
  assert.deepEqual(quickLinkNotes([], { schedule: [], today: '2026-09-22' }), { share: '', listserv: '', exchange: '', newsletter: 'nothing ready to add' });
});

// ── Kate's pick C, Sep 23: the Newsletter joins the Quick links, so its line
// says when the next issue goes and how much is waiting for it. ──

test('quickLinkNotes: the newsletter line names the next issue and what waits for it', () => {
  const rows = [
    { id: 'w1', status: 'kept', type: 'research' },
    { id: 'w2', status: 'kept', type: 'headline' },
    { id: 'i1', status: 'kept', type: 'research', newsletter_issue: '2026-10-06' },   // already in the issue
    { id: 't1', status: 'trashed' },
  ];
  const notes = quickLinkNotes(rows, { schedule: ['2026-09-22', '2026-10-06'], today: '2026-09-23' });
  assert.equal(notes.newsletter, 'Next issue Oct 6 · 2 ready to add');
});

test('quickLinkNotes: one waiting item is counted in the singular', () => {
  const notes = quickLinkNotes([{ id: 'w1', status: 'kept', type: 'research' }],
    { schedule: ['2026-10-06'], today: '2026-09-23' });
  assert.equal(notes.newsletter, 'Next issue Oct 6 · 1 ready to add');
});
