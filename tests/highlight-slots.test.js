// tests/highlight-slots.test.js: the Highlight page slot by slot (Kate, Oct 23, her pick C).
// The site's pins and her picks share one box, a row a place on the card, so
// a change reads across the row; a slot that Update the highlight would change
// wears a Changed tag. Plus the two fixes that came with it: the Pick from
// search keeps its width, and Until reads as plain words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slotRows, samePick, samePicks, pickOf } from '../js/highlight-view.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const rule = (css, selector) => css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{[^}]*\\}`))?.[0] ?? '';

const naep = { link: 'https://x.org/naep', image: '', until: '2026-11-02', title: '', summary: '', headline: 'NAEP 2026' };
const rural = { link: 'https://x.org/rural', image: '', until: '2026-11-22', title: 'Rural Schools Symposium', summary: 'Come along.', headline: 'Rural Schools Symposium' };
const sdp = { link: 'https://x.org/sdp', image: '', until: '', title: '', summary: '', headline: 'SDP Fellowship' };

test('slotRows pairs the site\'s pin and her pick at each place on the card', () => {
  const rows = slotRows([naep, rural], [naep, rural, sdp]);
  assert.deepEqual(rows.map(r => [r.n, r.site?.link ?? null, r.pick?.link ?? null]), [
    [1, 'https://x.org/naep', 'https://x.org/naep'],
    [2, 'https://x.org/rural', 'https://x.org/rural'],
    [3, null, 'https://x.org/sdp'],
  ]);
  // As many rows as the longer side: a pick taken off leaves its slot empty.
  assert.deepEqual(slotRows([naep, rural], [naep]).map(r => [r.n, r.site?.link ?? null, r.pick?.link ?? null]), [
    [1, 'https://x.org/naep', 'https://x.org/naep'],
    [2, 'https://x.org/rural', null],
  ]);
  assert.deepEqual(slotRows([], []), []);
});

test('a slot is Changed when Update the highlight would change it, and only then', () => {
  const changed = (site, picks) => slotRows(site, picks).map(r => r.changed);
  // Untouched: nothing is tagged.
  assert.deepEqual(changed([naep, rural], [naep, rural].map(pickOf)), [false, false]);
  // A new pick at the end, a pick taken off, two swapped.
  assert.deepEqual(changed([naep, rural], [naep, rural, sdp]), [false, false, true]);
  assert.deepEqual(changed([naep, rural], [naep]), [false, true]);
  assert.deepEqual(changed([naep, rural], [rural, naep]), [true, true]);
  // The same item with a new day, a new photo or new card words is a change too.
  assert.deepEqual(changed([naep], [{ ...naep, until: '2026-11-09' }]), [true]);
  assert.deepEqual(changed([naep], [{ ...naep, image: 'https://img/mine.jpg' }]), [true]);
  assert.deepEqual(changed([rural], [{ ...rural, summary: 'Bring your questions.' }]), [true]);
  // What the site's check describes (its headline, its photo) is not part of the pick.
  assert.deepEqual(changed([{ ...naep, photo: 'https://img/naep.jpg', from: 'live' }], [pickOf(naep)]), [false]);
});

test('samePick is samePicks for one slot, and samePicks still reads as before', () => {
  assert.equal(samePick(pickOf(naep), pickOf(naep)), true);
  assert.equal(samePick(pickOf(naep), pickOf({ ...naep, until: '' })), false);
  assert.equal(samePicks([naep, rural].map(pickOf), [naep, rural].map(pickOf)), true);
  assert.equal(samePicks([naep, rural].map(pickOf), [rural, naep].map(pickOf)), false);
  assert.equal(samePicks([naep].map(pickOf), [naep, rural].map(pickOf)), false);
});

test('the page draws one box of slots, the site on the left and her pick on the right (her pick C)', () => {
  const ui = read('js/highlight-ui.js');
  assert.match(ui, /slotRows\(now, after\)/);
  assert.match(ui, /'hl-slot-head'/);
  assert.match(ui, /'hl-slot-save'/);
  assert.match(ui, /'Empty'/);
  // One box; the how-to's shots still find it by its old name.
  assert.match(ui, /el\('div', 'hl-box hl-cols'\)/);
  assert.doesNotMatch(ui, /el\('ol', 'hl-list'\)/);
  // The order arrows and Remove travel as one group at the line's right end.
  assert.match(ui, /'hl-tools-end'/);
  // The Save is a row of the box, under the picks; the page puts it there too.
  assert.match(ui, /export function placeSaveBar\(/);
  const page = read('js/highlight-page.js');
  assert.match(page, /placeSaveBar\(container, /);
  assert.doesNotMatch(page, /querySelector\('\.hl-cols'\)\?\.after/);
});

test('the slots and their Changed tag are drawn from the tokens', () => {
  const css = read('css/styles.css');
  assert.match(rule(css, '.hl-slot'), /grid-template-columns: 24px minmax\(0, 5fr\) minmax\(0, 7fr\)/);
  assert.match(rule(css, '.hl-pick'), /border-left: 1px solid var\(--line-in\)/);
  // Changed is the desk's own blue tag (badge-new), sized to sit in a title's line.
  assert.match(read('js/highlight-ui.js'), /'badge badge-new hl-changed', 'Changed'/);
  assert.match(rule(css, '.badge-new'), /background: var\(--tag-background-blue\); color: var\(--tag-color-blue\)/);
  assert.match(rule(css, '.hl-changed'), /height: 20px/);
  // Words that say Empty are read, so they keep the helper gray's contrast.
  assert.match(rule(css, '.hl-slot-empty'), /color: var\(--text-helper\)/);
});

test('the Pick from search keeps its width: its rule outranks the general field rule', () => {
  const css = read('css/styles.css');
  // input[type="search"] is one class and one element; two classes win.
  assert.match(rule(css, '.hl-from-head .hl-search'), /width: 320px/);
  assert.equal(rule(css, '.hl-search'), '');
});

test('Until reads as plain words beside its field, not the uppercase micro-label', () => {
  const until = rule(read('css/styles.css'), '.hl-until');
  assert.match(until, /margin: 0/);
  assert.match(until, /text-transform: none/);
  assert.match(until, /letter-spacing: 0/);
});
