import test from 'node:test';
import assert from 'node:assert/strict';
import { laneCounts, recentlyAdded, hubCards, quickLinkNotes } from '../js/home-panel.js';

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

// Kate's drawn map (Oct 6, 2026): six hub cards, each with its status, in the
// order she laid them out. Public links opens nothing: its Copy links work on
// the card. Documentation went, each how-to now in its own hub.
const hubRows = [
  { id: 'n1', status: 'new', submitted_at: '2026-10-05T10:00:00Z' },
  { id: 'n2', status: 'new', submitter_email: 'reveille@example.org', submitted_at: '2026-10-05T11:00:00Z' },   // from outside
  { id: 'n3', status: 'circleback', submitted_at: '2026-10-01T10:00:00Z' },
  { id: 'r1', status: 'new', pending_read: 'yes', submitter_email: 'gigem@example.org' },   // still being read: not counted yet, as on Sort
  { id: 'i1', status: 'kept', type: 'research', newsletter_issue: '2026-10-20' },
  { id: 'i2', status: 'kept', type: 'headline', subtype: 'Texas', newsletter_issue: '2026-10-20' },
  { id: 'i3', status: 'trashed', type: 'headline', newsletter_issue: '2026-10-20' },   // deleted: out of the issue
  { id: 'p1', status: 'kept', type: 'research', subtype: 'Report' },
  { id: 't1', status: 'trashed' },
];
const hubSchedule = ['2026-10-06', '2026-10-20', '2026-11-03'];
const hubArchive = [{ date: '2026-10-06', label: 'October 6, 2026' }, { date: '2026-09-22', label: 'September 22, 2026' }];

test('hubCards: the six hubs in her order, each with its status', () => {
  const cards = hubCards({
    rows: hubRows, schedule: hubSchedule, today: '2026-10-07', loaded: true,
    preview: { adding: [{ id: 'p1' }, { id: 'x' }] }, archive: hubArchive, hubUpdated: '2026-10-01',
    signups: { live: true, waiting: 4, last: '2026-10-04' },
  });
  assert.deepEqual(cards.map(c => [c.key, c.label, c.href, c.count, c.sub, c.foot]), [
    ['team', 'Submit content', '/#team', null, "The team's form", ''],
    ['queue', 'Content queue', '/#queue', 3, 'waiting for Sort · 1 from outside', 'Sort, password protected'],
    ['newsletter', 'Newsletter', '/#newsletter', 2, 'in the Oct 20 issue · sends in 13 days', 'Last sent Oct 6'],
    ['listserv', 'Listserv', '/#listserv', 4, 'to be added', 'Live · last sign-up Oct 4'],
    ['links', 'Public links', '', null, '', ''],
    ['exchange', 'Policy Exchange', '/#exchange', 2, 'waiting to publish', 'Live · updated Oct 1'],
  ]);
  assert.deepEqual(cards[0].links, [{ label: 'How to submit content', href: '/how-to/submit-content/' }]);
  assert.equal(cards[1].lock, true, 'Sort wears the lock on its line');
  assert.deepEqual(cards[4].copies.map(l => l.key), ['exchange', 'share', 'listserv'], 'her drawing\'s order');
  assert.equal(cards.find(c => c.key === 'docs'), undefined, 'Documentation went');
});

test('hubCards: before the rows are in, no counts; what is not known says nothing', () => {
  const cards = hubCards({ rows: [], schedule: hubSchedule, today: '2026-10-07', loaded: false, preview: null, archive: null, hubUpdated: null, signups: null });
  assert.deepEqual(cards.map(c => c.count), [null, null, null, null, null, null]);
  assert.equal(cards[1].sub, 'waiting for Sort');
  assert.equal(cards[2].foot, '', 'no archive yet, no last sent');
  assert.equal(cards[3].foot, '');
  assert.equal(cards[5].foot, '');
});

test('hubCards: the Exchange counts the kept rows it could publish until its check lands', () => {
  const cards = hubCards({ rows: hubRows, schedule: hubSchedule, today: '2026-10-07', loaded: true, preview: null, archive: [], hubUpdated: '', signups: null });
  assert.equal(cards[5].count, 1, 'p1: kept, not published, ticked for the Exchange');
  assert.equal(cards[5].foot, '', 'the site did not answer: nothing claimed');
});

test('hubCards: the newsletter with no send date ahead says so; last sent is the newest issue not after today', () => {
  const cards = hubCards({ rows: hubRows, schedule: ['2026-09-22'], today: '2026-10-07', loaded: true, preview: null,
    archive: [{ date: '2026-10-20' }, { date: '2026-09-22' }], hubUpdated: null, signups: null });
  assert.equal(cards[2].count, null);
  assert.equal(cards[2].sub, 'No issue scheduled');
  assert.equal(cards[2].foot, 'Last sent Sep 22', 'an issue saved ahead of its day has not gone out');
  const today = hubCards({ rows: [], schedule: ['2026-10-20'], today: '2026-10-20', loaded: true, preview: null, archive: null, hubUpdated: null, signups: null });
  assert.equal(today[2].sub, 'in the Oct 20 issue · sends today');
});

test('hubCards: a listserv not set up says so, and one with no sign-ups yet says it is live', () => {
  const off = hubCards({ rows: [], schedule: [], today: '2026-10-07', loaded: true, preview: null, archive: null, hubUpdated: null, signups: { live: false, waiting: null, last: '' } });
  assert.equal(off[3].foot, 'Not set up');
  assert.equal(off[3].count, null);
  const quiet = hubCards({ rows: [], schedule: [], today: '2026-10-07', loaded: true, preview: null, archive: null, hubUpdated: null, signups: { live: true, waiting: 0, last: '' } });
  assert.equal(quiet[3].foot, 'Live');
  assert.equal(quiet[3].count, 0);
});

// ── The notes under the team page's Quick links (Kate, Sep 22) ──

// The send dates say themselves under Newsletter, so the listserv row does not
// repeat them (Kate, Sep 23: "this doesn't need to go under listserv").
test('quickLinkNotes: when the desk last wrote to the Exchange, and the newsletter dates', () => {
  const rows = [
    { published_at: '2026-08-30T16:00:00Z' },
    { published_at: '2026-09-22T19:05:00Z', status: 'trashed' },   // scrapped later, still the last write
    { published_at: '' },
  ];
  assert.deepEqual(quickLinkNotes(rows, { schedule: ['2026-09-08', '2026-09-22', '2026-10-06'], today: '2026-09-23' }),
    { share: '', listserv: '', exchange: 'Updated Sep 22', newsletter: 'Next issue Oct 6' });
});

test('quickLinkNotes: on a send day the issue due today is next; with nothing known, nothing is said', () => {
  assert.deepEqual(quickLinkNotes([], { schedule: ['2026-09-08', '2026-09-22', '2026-10-06'], today: '2026-09-22' }),
    { share: '', listserv: '', exchange: '', newsletter: 'Next issue Sep 22' });
  assert.deepEqual(quickLinkNotes([], { schedule: ['2026-09-08'], today: '2026-09-22' }),
    { share: '', listserv: '', exchange: '', newsletter: '' });
  assert.deepEqual(quickLinkNotes([], { schedule: [], today: '2026-09-22' }), { share: '', listserv: '', exchange: '', newsletter: '' });
});

// ── Kate, Sep 23: the Newsletter is a button of its own, like Content Sort,
// so its line names the next issue and its count rides the button's badge. ──

test('quickLinkNotes: the newsletter line names the next issue, and leaves the count to the badge', () => {
  const rows = [
    { id: 'w1', status: 'kept', type: 'research' },
    { id: 'i1', status: 'kept', type: 'research', newsletter_issue: '2026-10-06' },
  ];
  const notes = quickLinkNotes(rows, { schedule: ['2026-09-22', '2026-10-06'], today: '2026-09-23' });
  assert.equal(notes.newsletter, 'Next issue Oct 6');
});

test('quickLinkNotes: with no send date known, the newsletter line says nothing', () => {
  assert.equal(quickLinkNotes([], { schedule: [], today: '2026-09-23' }).newsletter, '');
});
