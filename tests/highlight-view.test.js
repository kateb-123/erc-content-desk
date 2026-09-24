import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PICKS, bandAfter, addPick, removePick, movePick, setPhoto, withoutPhoto, candidates, whenLine, samePicks, sectionFilters, filterCandidates } from '../js/highlight-view.js';

// The highlight step on Publish (Kate, Sep 23): her picks for the Exchange's
// home page, up to six, in her order, each needing a photo. Pure, so
// node --test can hold it; the screen only draws what these return.

const adding = [
  { id: 'a', link: 'https://x.org/new', headline: 'Brand new', type: 'research', subtype: 'Report', source: 'RAND', date: '', deadline: '', infographic: '' },
  { id: 'b', link: 'https://x.org/erc', headline: 'ERC workshop', type: 'erc_event', subtype: '', source: 'ERC', date: '2026-09-30', deadline: '', infographic: 'https://img/erc.jpg' },
];
const hub = [
  { link: 'https://x.org/naep', headline: 'NAEP 2026', type: 'research', subtype: 'Report', source: 'NAGB', date: '2026-09-01', deadline: '', infographic: 'https://img/naep.jpg' },
  { link: 'https://x.org/sdp', headline: 'SDP Fellowship', type: 'opportunity', subtype: 'Fellowships & Programs', source: 'Harvard', date: '', deadline: '2026-11-01', infographic: '' },
];

test('bandAfter resolves the picks against the rows going out and the live ones, in pick order', () => {
  const band = bandAfter([{ link: 'https://x.org/naep', image: '' }, { link: 'https://x.org/new', image: 'https://img/mine.jpg' }, { link: 'https://x.org/gone', image: '' }], { adding, hub });
  assert.deepEqual(band.map(b => [b.link, b.from, b.headline, b.photo]), [
    ['https://x.org/naep', 'live', 'NAEP 2026', 'https://img/naep.jpg'],
    ['https://x.org/new', 'adding', 'Brand new', 'https://img/mine.jpg'],
    ['https://x.org/gone', 'missing', '', ''],
  ]);
  assert.equal(band[0].type, 'research');
  assert.equal(band[1].photoIsOwn, true);   // her upload, not the row's own
});

test('adding a pick appends it once, and the seventh is refused', () => {
  let picks = [];
  picks = addPick(picks, 'https://x.org/naep');
  picks = addPick(picks, 'https://x.org/naep');
  assert.deepEqual(picks, [{ link: 'https://x.org/naep', image: '' }]);
  for (let i = 0; i < 6; i += 1) picks = addPick(picks, `https://x.org/${i}`);
  assert.equal(picks.length, MAX_PICKS);
  assert.equal(MAX_PICKS, 6);
  assert.equal(picks.at(-1).link, 'https://x.org/4');
});

test('removing and moving keep the rest in order; the ends do not move past the ends', () => {
  const picks = ['a', 'b', 'c'].map(k => ({ link: `https://x.org/${k}`, image: '' }));
  assert.deepEqual(removePick(picks, 'https://x.org/b').map(p => p.link), ['https://x.org/a', 'https://x.org/c']);
  assert.deepEqual(movePick(picks, 'https://x.org/c', -1).map(p => p.link), ['https://x.org/a', 'https://x.org/c', 'https://x.org/b']);
  assert.deepEqual(movePick(picks, 'https://x.org/a', -1).map(p => p.link), ['https://x.org/a', 'https://x.org/b', 'https://x.org/c']);
  assert.deepEqual(movePick(picks, 'https://x.org/c', 1).map(p => p.link), ['https://x.org/a', 'https://x.org/b', 'https://x.org/c']);
  assert.deepEqual(movePick(picks, 'https://x.org/zzz', 1), picks);
});

test('a photo goes on the pick; withoutPhoto names the picks that still have none', () => {
  const picks = [{ link: 'https://x.org/new', image: '' }, { link: 'https://x.org/naep', image: '' }, { link: 'https://x.org/sdp', image: '' }];
  const set = setPhoto(picks, 'https://x.org/new', 'https://img/mine.jpg');
  assert.equal(set[0].image, 'https://img/mine.jpg');
  assert.deepEqual(withoutPhoto(set, { adding, hub }).map(b => b.headline), ['SDP Fellowship']);   // NAEP has its own; new has hers
  assert.deepEqual(withoutPhoto([], { adding, hub }), []);
});

test('candidates lists the rows going out first, then what is live, each with its photo state', () => {
  const list = candidates({ adding, hub });
  assert.deepEqual(list.map(c => [c.link, c.from, Boolean(c.photo)]), [
    ['https://x.org/new', 'adding', false],
    ['https://x.org/erc', 'adding', true],
    ['https://x.org/naep', 'live', true],
    ['https://x.org/sdp', 'live', false],
  ]);
  assert.equal(list[1].type, 'event');   // an ERC event publishes as an event
  assert.equal(list[1].subtype, 'ERC Events');
});

test('whenLine is the date, or the deadline for an opportunity, in short form', () => {
  assert.equal(whenLine({ type: 'event', date: '2026-09-30', deadline: '' }), 'Sep 30');
  assert.equal(whenLine({ type: 'opportunity', date: '', deadline: '2026-11-01' }), 'closes Nov 1');
  assert.equal(whenLine({ type: 'research', date: '', deadline: '' }), '');
});

test('samePicks: the same links in the same order with the same photos, nothing else', () => {
  const a = [{ link: 'https://x.org/a', image: '' }, { link: 'https://x.org/b', image: 'https://img/b.jpg' }];
  assert.equal(samePicks(a, a.map(p => ({ ...p }))), true);
  assert.equal(samePicks(a, [a[1], a[0]]), false);
  assert.equal(samePicks(a, [a[0]]), false);
  assert.equal(samePicks(a, [a[0], { ...a[1], image: '' }]), false);
  assert.equal(samePicks([], []), true);
});

test('the Pick from table filters by section, so an event is quick to find (Kate, Sep 23)', () => {
  const list = candidates({ adding, hub });
  assert.deepEqual(sectionFilters(list), [
    { key: 'all', label: 'All', count: 4 },
    { key: 'research', label: 'Research', count: 2 },
    { key: 'event', label: 'Events', count: 1 },
    { key: 'opportunity', label: 'Opportunities', count: 1 },
    { key: 'headline', label: 'Headlines', count: 0 },
  ]);
  assert.deepEqual(filterCandidates(list, 'event').map(c => c.headline), ['ERC workshop']);   // an ERC event counts as an event
  assert.deepEqual(filterCandidates(list, 'research').map(c => c.headline), ['Brand new', 'NAEP 2026']);
  assert.equal(filterCandidates(list, 'all').length, 4);
  assert.equal(filterCandidates(list, 'headline').length, 0);
});
