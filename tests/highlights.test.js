import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, CSV_COLUMNS } from '../js/schema.js';
import {
  MAX_HIGHLIGHTS, HIGHLIGHTS_PATH, hubRows, parseHighlights, highlightsText, cleanPicks, describePicks, pickable, photoUpdates,
} from '../api/_lib/highlights.js';

// Kate, Sep 23: the Exchange's home page highlights a few items in a big
// card, each with a photo. She picks them by hand at Publish, up to six, new
// or already live, in her order. The picks live in data/highlights.json on
// the Exchange; news.csv stays append-only.

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

test('parseHighlights is lenient: a missing or broken file is no picks, and junk entries fall out', () => {
  assert.deepEqual(parseHighlights(''), { items: [], updated: '' });
  assert.deepEqual(parseHighlights('not json'), { items: [], updated: '' });
  assert.deepEqual(parseHighlights('[1,2]'), { items: [], updated: '' });
  const text = JSON.stringify({ updated: '2026-09-23T20:00:00.000Z', items: [
    { link: 'https://x.org/naep', image: 'https://img/a.jpg' },
    { link: 'https://x.org/naep' },          // a repeat: the first stands
    { image: 'https://img/b.jpg' },          // no link: dropped
    'https://x.org/plain',                   // not an object: dropped
    { link: ' https://x.org/rural ', image: 7 },
  ] });
  assert.deepEqual(parseHighlights(text), { updated: '2026-09-23T20:00:00.000Z', items: [
    { link: 'https://x.org/naep', image: 'https://img/a.jpg' },
    { link: 'https://x.org/rural', image: '' },
  ] });
});

test('parseHighlights keeps at most six', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ link: `https://x.org/${i}` }));
  assert.equal(parseHighlights(JSON.stringify({ items: many })).items.length, MAX_HIGHLIGHTS);
  assert.equal(MAX_HIGHLIGHTS, 6);
  assert.equal(HIGHLIGHTS_PATH, 'data/highlights.json');
});

test('highlightsText writes the file the Exchange reads: the time, then the picks in order', () => {
  const text = highlightsText([{ link: 'https://x.org/naep', image: 'https://img/a.jpg' }, { link: 'https://x.org/rural', image: '' }], '2026-09-23T20:00:00.000Z');
  assert.ok(text.endsWith('\n'));
  assert.deepEqual(JSON.parse(text), { updated: '2026-09-23T20:00:00.000Z', items: [
    { link: 'https://x.org/naep', image: 'https://img/a.jpg' },
    { link: 'https://x.org/rural', image: '' },
  ] });
  assert.ok(text.includes('\n  "items": [\n'), 'pretty printed, so a diff on the Exchange reads');
});

test('cleanPicks keeps only what the Exchange can show: rows going out now or already live, once each, six at most', () => {
  const adding = [blankRow({ id: 'a', link: 'https://x.org/new', infographic: '' })];
  const hub = hubRows(CSV);
  const { items, dropped } = cleanPicks([
    { link: 'https://x.org/new', image: 'https://img/new.jpg' },
    { link: 'https://x.org/naep' },
    { link: 'https://x.org/naep', image: 'https://img/again.jpg' },   // a repeat
    { link: 'https://x.org/nowhere' },                                // nothing the Exchange holds
    { link: 'https://x.org/rural', image: 'javascript:alert(1)' },   // not a picture address
    { link: '' },
    null,
  ], { adding, hub });
  assert.deepEqual(items, [
    { link: 'https://x.org/new', image: 'https://img/new.jpg' },
    { link: 'https://x.org/naep', image: '' },
    { link: 'https://x.org/rural', image: '' },
  ]);
  assert.deepEqual(dropped, ['https://x.org/nowhere']);
  const seven = Array.from({ length: 7 }, (_, i) => ({ link: `https://x.org/${i}` }));
  const wide = { adding: seven.map((p, i) => blankRow({ id: String(i), link: p.link })), hub: [] };
  assert.equal(cleanPicks(seven, wide).items.length, 6);
  assert.deepEqual(cleanPicks(undefined, wide).items, []);
});

test('describePicks says what each pick is, where it comes from, and which photo it will show', () => {
  const adding = [blankRow({ id: 'a', link: 'https://x.org/new', headline: 'Brand new', type: 'erc_event', subtype: '', date: '2026-09-30', source: 'ERC', infographic: '' })];
  const hub = hubRows(CSV);
  const out = describePicks([
    { link: 'https://x.org/new', image: '' },
    { link: 'https://x.org/naep', image: '' },
    { link: 'https://x.org/title', image: 'https://img/mine.jpg' },
    { link: 'https://x.org/gone', image: '' },
  ], { adding, hub });
  assert.deepEqual(out, [
    { link: 'https://x.org/new', image: '', photo: '', from: 'adding', headline: 'Brand new', type: 'event', subtype: 'ERC Events', date: '2026-09-30', deadline: '', source: 'ERC' },
    { link: 'https://x.org/naep', image: '', photo: 'https://img/naep.jpg', from: 'live', headline: 'NAEP 2026: Texas Results in Context', type: 'research', subtype: 'Report', date: '2026-09-01', deadline: '', source: 'NAGB' },
    { link: 'https://x.org/title', image: 'https://img/mine.jpg', photo: 'https://img/mine.jpg', from: 'live', headline: 'Title I Rules', type: 'headline', subtype: 'National', date: '2026-08-15', deadline: '', source: 'K-12 Dive' },
    { link: 'https://x.org/gone', image: '', photo: '', from: 'missing', headline: '', type: '', subtype: '', date: '', deadline: '', source: '' },
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
