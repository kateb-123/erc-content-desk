import test from 'node:test';
import assert from 'node:assert/strict';
import { recentlyAdded, hubCards } from '../js/home-panel.js';

// ── The newest items (kept from the front page of Sep 17) ──

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

test('hubCards: the seven hubs in her order, each with its status', () => {
  const cards = hubCards({
    rows: hubRows, schedule: hubSchedule, today: '2026-10-07', loaded: true,
    preview: { adding: [{ id: 'p1' }, { id: 'x' }] }, archive: hubArchive, hubUpdated: '2026-10-01',
    signups: { live: true, sheet: true, waiting: 4, last: '2026-10-04' },
    briefs: [{ id: 'a', stage: 'proof' }, { id: 'b', stage: 'author' }, { id: 'c', stage: 'live' }],
  });
  assert.deepEqual(cards.map(c => [c.key, c.label, c.href, c.count, c.sub, c.foot]), [
    ['team', 'Submit content', '/#team', null, "The team's form", ''],
    ['queue', 'Content queue', '/#queue', 3, 'waiting for Sort · 1 from outside', 'Sort, password protected'],
    ['newsletter', 'Newsletter', '/#newsletter', 2, 'in the Oct 20 issue · sends in 13 days', 'Last sent Oct 6'],
    ['listserv', 'Listserv', '/#listserv', 4, 'to be added', 'Live · last sign-up Oct 4'],
    ['links', 'Public links', '', null, '', ''],
    ['exchange', 'Policy Exchange', '/#exchange', 2, 'waiting to publish', 'Live · updated Oct 1'],
    // Research briefs (Kate, Oct 20): the seventh card, hers alone, counting what is not live yet.
    ['briefs', 'Research briefs', '/#briefs', 2, 'in progress · 1 with an author', 'Password protected'],
  ]);
  assert.equal(cards[6].lock, true, 'the lock on its line');
  assert.equal(cards[2].next, 'Oct 20', 'the next send date, short, for the sidebar (A, Oct 23)');
  // Pick A's rows (Oct 23): a hub that counts shows its number and leads with what it counts;
  // a live site or form wears the green dot beside its Live.
  assert.deepEqual(cards.map(c => c.counts), [false, true, true, true, false, true, true]);
  assert.deepEqual(cards.map(c => Boolean(c.live)), [false, false, false, true, false, true, false]);
  // Not signed in, the list is not known: the card says only that it is locked.
  const quiet = hubCards({ rows: hubRows, schedule: hubSchedule, today: '2026-10-07', loaded: true, preview: null, archive: [], hubUpdated: '', signups: null, briefs: null });
  assert.deepEqual([quiet[6].count, quiet[6].sub, quiet[6].foot], [null, '', 'Password protected']);
  assert.deepEqual(cards[0].links, [{ label: 'How to submit content', href: '/how-to/submit-content/' }]);
  assert.equal(cards[1].lock, true, 'Sort wears the lock on its line');
  assert.deepEqual(cards[4].copies.map(l => l.key), ['exchange', 'share', 'listserv'], 'her drawing\'s order');
  assert.equal(cards.find(c => c.key === 'docs'), undefined, 'Documentation went');
});

test('hubCards: before the rows are in, no counts; what is not known says nothing', () => {
  const cards = hubCards({ rows: [], schedule: hubSchedule, today: '2026-10-07', loaded: false, preview: null, archive: null, hubUpdated: null, signups: null });
  assert.deepEqual(cards.map(c => c.count), [null, null, null, null, null, null, null]);
  assert.equal(cards[1].sub, 'waiting for Sort');
  assert.equal(cards[2].foot, '', 'no archive yet, no last sent');
  assert.equal(cards[3].foot, '');
  assert.equal(cards[5].foot, '');
});

// Kate, Oct 23: one number everywhere; until the live check lands the Exchange has no count, never the kept rows' guess.
test('hubCards: the Exchange has no count until its check lands', () => {
  const cards = hubCards({ rows: hubRows, schedule: hubSchedule, today: '2026-10-07', loaded: true, preview: null, archive: [], hubUpdated: '', signups: null });
  assert.equal(cards[5].count, null, 'no guess before the check');
  assert.equal(cards[5].foot, '', 'the site did not answer: nothing claimed');
});

test('hubCards: the newsletter with no send date ahead says so; last sent is the newest issue not after today', () => {
  const cards = hubCards({ rows: hubRows, schedule: ['2026-09-22'], today: '2026-10-07', loaded: true, preview: null,
    archive: [{ date: '2026-10-20' }, { date: '2026-09-22' }], hubUpdated: null, signups: null });
  assert.equal(cards[2].count, null);
  assert.equal(cards[2].sub, 'No issue scheduled');
  assert.equal(cards[2].next, '', 'no send date ahead: the sidebar shows none');
  assert.equal(cards[2].foot, 'Last sent Sep 22', 'an issue saved ahead of its day has not gone out');
  const today = hubCards({ rows: [], schedule: ['2026-10-20'], today: '2026-10-20', loaded: true, preview: null, archive: null, hubUpdated: null, signups: null });
  assert.equal(today[2].sub, 'in the Oct 20 issue · sends today');
});

test('hubCards: a listserv not set up says so, and one with no sign-ups yet says it is live', () => {
  const off = hubCards({ rows: [], schedule: [], today: '2026-10-07', loaded: true, preview: null, archive: null, hubUpdated: null, signups: { live: false, waiting: null, last: '' } });
  assert.equal(off[3].foot, 'Not set up');
  assert.equal(Boolean(off[3].live), false, 'no green dot on a form that is not set up');
  assert.equal(off[3].count, null);
  const quiet = hubCards({ rows: [], schedule: [], today: '2026-10-07', loaded: true, preview: null, archive: null, hubUpdated: null, signups: { live: true, sheet: true, waiting: 0, last: '' } });
  assert.equal(quiet[3].foot, 'Live');
  assert.equal(quiet[3].count, 0);
});

test('the Newsletter card warns a week before the last send date (Kate, Oct 22)', () => {
  const schedule = ['2026-10-20', '2026-11-03'];
  const far = hubCards({ rows: [], schedule, today: '2026-10-21', loaded: true }).find(c => c.key === 'newsletter');
  assert.equal(far.warn, '');
  const near = hubCards({ rows: [], schedule, today: '2026-10-28', loaded: true }).find(c => c.key === 'newsletter');
  assert.equal(near.warn, 'Send dates end Nov 3. Add the next ones on the Sheet\'s schedule tab.');
});
