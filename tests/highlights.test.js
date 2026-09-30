import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, CSV_COLUMNS } from '../js/schema.js';
import {
  MAX_HIGHLIGHTS, FEATURED_PATH, PIN_DAYS, addDays, hubRows, parseFeatured, nowPicks, nowCards, featuredText, defaultUntil, cleanPicks, describePicks, pickable, photoUpdates,
} from '../api/_lib/highlights.js';

// Kate, Sep 23: the Exchange's home page highlights a few items in a big
// card, each with a photo. She picks them by hand at Publish, up to six, new
// or already live, in her order. Since Sep 24 the Exchange keeps its picks in
// data/featured.json, its admin door's file; the desk writes the pins there
// (Sep 30), with the card's words for an event or an opportunity, and leaves
// the other lists alone. news.csv stays append-only.

const HEADER = CSV_COLUMNS.join(',');
const CSV = `${HEADER}
2026-09-01,NAEP 2026: Texas Results in Context,https://x.org/naep,research,Report,NAGB,,A blurb,,,,,,https://img/naep.jpg
2026-10-30,Rural Schools Symposium,https://x.org/rural,event,A&M,TAMU,,,,,,10:00 AM,Rudder,
2026-08-20,Old Symposium,https://x.org/old,event,Off-Campus,UT,,,,,,,,
,SDP Fellowship,https://x.org/sdp,opportunity,Fellowships & Programs,Harvard,,,2026-11-01,,,,,
,Closed Call,https://x.org/closed,opportunity,Call for Proposals,UCEA,,,2026-09-01,,,,,
2026-08-15,Title I Rules,https://x.org/title,headline,National,K-12 Dive,,,,news,,,,https://img/title.png
`;

test('hubRows reads the live CSV into rows keyed by its header', () => {
  const rows = hubRows(CSV);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], {
    date: '2026-09-01', headline: 'NAEP 2026: Texas Results in Context', link: 'https://x.org/naep', type: 'research', subtype: 'Report',
    source: 'NAGB', topic: '', blurb: 'A blurb', deadline: '', medium: '', authors: '', time: '', location: '', infographic: 'https://img/naep.jpg',
  });
  assert.deepEqual(hubRows(''), []);
  assert.deepEqual(hubRows(HEADER), []);
});

const FEATURED = JSON.stringify({
  pins: [
    { key: 'https://x.org/naep', until: '2026-10-08', image: 'https://img/a.jpg' },
    { key: 'https://x.org/naep', until: '2026-12-01' },                  // a repeat: the first stands
    { key: 'https://x.org/old', until: '2026-09-01' },                   // its day has gone
    { until: '2026-10-08' },                                            // no key: dropped
    'https://x.org/plain',                                              // not an object: dropped
    { key: ' https://x.org/rural ', until: '2026-10-30', image: 7, title: 'Rural Schools Symposium', summary: 'Rural superintendents meet in Rudder Tower.' },
  ],
  cards: [{ id: 'c1', headline: 'Howdy Policy Trivia Night', label: 'ERC', until: '2026-10-08' }, { id: 'c2', headline: 'Gone', until: '2026-09-01' }],
  hidden: ['https://x.org/hidden'],
  heroes: [{ key: 'https://x.org/naep', hero: 'plainr' }],
});

test('parseFeatured is lenient: a missing or broken file is no pins, junk entries fall out, and the other lists ride along', () => {
  for (const text of ['', 'not json', '[1,2]', '{"pins": 3}']) assert.deepEqual(parseFeatured(text), { pins: [], cards: [], hidden: [], heroes: [] });
  const f = parseFeatured(FEATURED);
  assert.deepEqual(f.pins, [
    { link: 'https://x.org/naep', image: 'https://img/a.jpg', until: '2026-10-08', title: '', summary: '' },
    { link: 'https://x.org/old', image: '', until: '2026-09-01', title: '', summary: '' },
    { link: 'https://x.org/rural', image: '', until: '2026-10-30', title: 'Rural Schools Symposium', summary: 'Rural superintendents meet in Rudder Tower.' },
  ]);
  assert.equal(f.cards.length, 2);
  assert.deepEqual(f.hidden, ['https://x.org/hidden']);
  assert.deepEqual(f.heroes, [{ key: 'https://x.org/naep', hero: 'plainr' }]);
  assert.equal(FEATURED_PATH, 'data/featured.json');
});

test('nowPicks is what the card holds today: the pins within their day, six at most; nowCards the one-off cards beside them', () => {
  const f = parseFeatured(FEATURED);
  assert.deepEqual(nowPicks(f, '2026-09-23').map(p => p.link), ['https://x.org/naep', 'https://x.org/rural']);
  assert.deepEqual(nowPicks(f, '2026-10-09').map(p => p.link), ['https://x.org/rural']);
  const many = parseFeatured(JSON.stringify({ pins: Array.from({ length: 9 }, (_, i) => ({ key: `https://x.org/${i}`, until: '2027-01-01' })) }));
  assert.equal(nowPicks(many, '2026-09-23').length, MAX_HIGHLIGHTS);
  assert.equal(MAX_HIGHLIGHTS, 6);
  assert.deepEqual(nowCards(f, '2026-09-23'), [{ headline: 'Howdy Policy Trivia Night', label: 'ERC', until: '2026-10-08' }]);
});

test('featuredText writes the pins in her order and keeps the Exchange\'s own lists', () => {
  const f = parseFeatured(FEATURED);
  const text = featuredText(f, [
    { link: 'https://x.org/rural', image: '', until: '2026-10-30', title: 'Rural Schools Symposium', summary: 'Rural superintendents meet in Rudder Tower.' },
    { link: 'https://x.org/naep', image: 'https://img/a.jpg', until: '2026-10-08', title: '', summary: '' },
  ]);
  assert.ok(text.endsWith('\n'));
  const out = JSON.parse(text);
  assert.deepEqual(out.pins, [
    { key: 'https://x.org/rural', until: '2026-10-30', title: 'Rural Schools Symposium', summary: 'Rural superintendents meet in Rudder Tower.' },
    { key: 'https://x.org/naep', until: '2026-10-08', image: 'https://img/a.jpg' },
  ]);
  assert.deepEqual(Object.keys(out), ['pins', 'cards', 'hidden', 'heroes']);
  assert.equal(out.cards.length, 2);
  assert.deepEqual(out.hidden, ['https://x.org/hidden']);
  assert.ok(text.includes('\n  "pins": [\n'), 'pretty printed, so a diff on the Exchange reads');
});

test('a pin with no day of its own shows to an event\'s date, an opportunity\'s deadline, else two weeks', () => {
  assert.equal(PIN_DAYS, 14);
  assert.equal(addDays('2026-09-23', 14), '2026-10-07');
  assert.equal(addDays('2026-12-25', 14), '2027-01-08');
  assert.equal(defaultUntil({ type: 'event', date: '2026-10-30' }, '2026-09-23'), '2026-10-30');
  assert.equal(defaultUntil({ type: 'event', date: '2026-08-20' }, '2026-09-23'), '2026-10-07');   // a day gone: two weeks
  assert.equal(defaultUntil({ type: 'opportunity', deadline: '2026-11-01' }, '2026-09-23'), '2026-11-01');
  assert.equal(defaultUntil({ type: 'research', date: '2026-09-01' }, '2026-09-23'), '2026-10-07');
});

test('cleanPicks keeps only what the Exchange can show: rows going out now or already live, once each, six at most', () => {
  const adding = [blankRow({ id: 'a', link: 'https://x.org/new', infographic: '' })];
  const hub = hubRows(CSV);
  const { items, dropped } = cleanPicks([
    { link: 'https://x.org/new', image: 'https://img/new.jpg', title: 'Not for research', summary: 'Nor this.' },
    { link: 'https://x.org/naep', until: '2026-10-08' },
    { link: 'https://x.org/naep', image: 'https://img/again.jpg' },   // a repeat
    { link: 'https://x.org/nowhere' },                                // nothing the Exchange holds
    { link: 'https://x.org/rural', image: 'javascript:alert(1)', until: 'soon', title: ' Rural Schools Symposium ', summary: 'Rural superintendents meet in Rudder Tower. ' },   // not a picture address, not a day
    { link: 'https://x.org/sdp', summary: 'B'.repeat(200) },
    { link: '' },
    null,
  ], { adding, hub, today: '2026-09-23' });
  assert.deepEqual(items.slice(0, 3), [
    { link: 'https://x.org/new', image: 'https://img/new.jpg', until: '2026-10-07', title: '', summary: '' },   // research: no card words, two weeks
    { link: 'https://x.org/naep', image: '', until: '2026-10-08', title: '', summary: '' },                    // her day stands
    { link: 'https://x.org/rural', image: '', until: '2026-10-30', title: 'Rural Schools Symposium', summary: 'Rural superintendents meet in Rudder Tower.' },   // the event's date
  ]);
  assert.equal(items[3].until, '2026-11-01');   // the deadline
  assert.equal(items[3].summary.length, 180);   // fitted
  assert.deepEqual(dropped, ['https://x.org/nowhere']);
  const seven = Array.from({ length: 7 }, (_, i) => ({ link: `https://x.org/${i}` }));
  const wide = { adding: seven.map((p, i) => blankRow({ id: String(i), link: p.link })), hub: [], today: '2026-09-23' };
  assert.equal(cleanPicks(seven, wide).items.length, 6);
  assert.deepEqual(cleanPicks(undefined, wide).items, []);
});

test('describePicks says what each pick is, where it comes from, and which photo it will show', () => {
  const adding = [blankRow({ id: 'a', link: 'https://x.org/new', headline: 'Brand new', type: 'erc_event', subtype: '', date: '2026-09-30', source: 'ERC', infographic: '' })];
  const hub = hubRows(CSV);
  const out = describePicks([
    { link: 'https://x.org/new', image: '', until: '2026-09-30', title: 'Brand new', summary: 'Come to the workshop.' },
    { link: 'https://x.org/naep', image: '' },
    { link: 'https://x.org/title', image: 'https://img/mine.jpg' },
    { link: 'https://x.org/gone', image: '' },
  ], { adding, hub });
  const bare = { until: '', title: '', summary: '' };
  assert.deepEqual(out, [
    { link: 'https://x.org/new', image: '', until: '2026-09-30', title: 'Brand new', summary: 'Come to the workshop.', photo: '', from: 'adding', headline: 'Brand new', type: 'event', subtype: 'ERC Events', date: '2026-09-30', deadline: '', source: 'ERC' },
    { link: 'https://x.org/naep', image: '', ...bare, photo: 'https://img/naep.jpg', from: 'live', headline: 'NAEP 2026: Texas Results in Context', type: 'research', subtype: 'Report', date: '2026-09-01', deadline: '', source: 'NAGB' },
    { link: 'https://x.org/title', image: 'https://img/mine.jpg', ...bare, photo: 'https://img/mine.jpg', from: 'live', headline: 'Title I Rules', type: 'headline', subtype: 'National', date: '2026-08-15', deadline: '', source: 'K-12 Dive' },
    { link: 'https://x.org/gone', image: '', ...bare, photo: '', from: 'missing', headline: '', type: '', subtype: '', date: '', deadline: '', source: '' },
  ]);
});

test('pickable is what the Exchange still shows: no past events or closed deadlines, newest first, dated rows before undated', () => {
  const rows = pickable(hubRows(CSV), '2026-09-23');
  assert.deepEqual(rows.map(r => r.link), [
    'https://x.org/rural',   // Oct 30
    'https://x.org/naep',    // Sep 1
    'https://x.org/title',   // Aug 15
    'https://x.org/sdp',     // undated, closes Nov 1
  ]);
  assert.deepEqual(rows[0], {
    link: 'https://x.org/rural', headline: 'Rural Schools Symposium', type: 'event', subtype: 'A&M', source: 'TAMU',
    date: '2026-10-30', deadline: '', infographic: '',
  });
});

test('photoUpdates puts a pick\'s photo on the desk\'s own row when the row has none', () => {
  const rows = [
    blankRow({ id: 'a', link: 'https://x.org/new', infographic: '' }),
    blankRow({ id: 'b', link: 'https://x.org/has', infographic: 'https://img/has.jpg' }),
    blankRow({ id: 'c', link: 'https://x.org/other', infographic: '' }),
  ];
  const updates = photoUpdates([
    { link: 'https://x.org/new', image: 'https://img/new.jpg' },
    { link: 'https://x.org/has', image: 'https://img/replace.jpg' },   // the row keeps its own
    { link: 'https://x.org/other', image: '' },                       // nothing to give
    { link: 'https://x.org/nowhere', image: 'https://img/x.jpg' },    // no desk row
  ], rows);
  assert.deepEqual(updates.map(r => [r.id, r.infographic]), [['a', 'https://img/new.jpg']]);
});
