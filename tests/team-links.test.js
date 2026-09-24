import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANES, openedScreen } from '../js/shell-view.js';

// The team page's Quick links (Kate, Sep 22, then her pick C of Sep 23 and her
// split that evening): the three PUBLIC pages, the standalone share page and
// listserv sign-up at their own address and the Exchange itself, with the
// desk's own pages, Content Sort and the Newsletter, as filled buttons under
// them. team-ui.js touches the DOM, so the links are read from the file.
const src = readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8');
const entry = key => src.match(new RegExp(`\\{ key: '${key}'[^\\n]*`))?.[0] ?? '';
const href = key => entry(key).match(/href: '([^']+)'/)?.[1];

test('Quick links are the three public pages, and only those', () => {
  assert.equal(href('share'), 'https://erc-share.vercel.app/submit/');
  assert.equal(href('listserv'), 'https://erc-share.vercel.app/listserv/');
  assert.equal(href('exchange'), 'https://erc-policy-exchange.vercel.app/');
  const links = src.match(/export const QUICK_LINKS = \[([\s\S]*?)\];/)[1];
  assert.equal(links.match(/key: '/g).length, 3, 'three rows, nothing of the desk among them');
  assert.doesNotMatch(links, /newsletter/, 'the newsletter is a button, not a quick link');
});

// Kate's set D of Sep 23, with the screen for the Exchange: each icon is the
// thing itself, and no two rows repeat a metaphor.
test('every row and door carries the icon Kate picked', () => {
  const icons = { share: 'square-plus', listserv: 'address-book', exchange: 'display' };
  for (const [key, icon] of Object.entries(icons)) assert.match(entry(key), new RegExp(`icon: '${icon}'`), key);
  const doors = src.match(/export const DESK_DOORS = \[([\s\S]*?)\];/)[1];
  assert.match(doors, /key: 'newsletter'[^\n]*icon: 'newspaper'/);
  assert.match(doors, /key: 'sort'[^\n]*icon: 'layer-group'/);
  assert.match(doors, /key: 'exchange'[^\n]*icon: 'paper-plane'/);   // the door to Publish (Kate, Sep 23: off the bar, onto the buttons)
});

test('no row shows its address (Kate, Sep 23)', () => {
  assert.doesNotMatch(src, /ql-url/, 'the address line is gone');
  assert.doesNotMatch(src, /shownUrl/, 'and so is the helper that wrote it');
});

test('Copy link belongs to the public rows: every quick link has one', () => {
  // The desk's own pages are buttons, so no Copy link can hand out the desk's
  // address by mistake.
  assert.match(src, /el\('button', 'linkish ql-copy', 'Copy link'\)/);
  assert.doesNotMatch(src, /inHouse/, 'nothing in the box needs holding back any more');
});

test("the desk's own pages are filled buttons, the newsletter first", () => {
  const doors = src.match(/export const DESK_DOORS = \[([\s\S]*?)\];/)[1];
  const order = [...doors.matchAll(/key: '(\w+)'/g)].map(m => m[1]);
  assert.deepEqual(order, ['newsletter', 'sort', 'exchange'], 'the newsletter sits above Content Sort, then the Exchange (Kate, Sep 23)');
  // Kate changed this on Sep 23: the newsletter no longer opens in its own
  // window; it switches in place, the way Content Sort does.
  assert.doesNotMatch(doors, /newWindow/, 'no door opens its own window');
  assert.match(src, /el\('a', 'sort-door'\)/);
  assert.doesNotMatch(src, /'Desk work'/);
  assert.doesNotMatch(src, /door-rows/);
});

// Kate, Sep 23: both doors switch screens in place. The newsletter's lane key
// is not its screen's name ('issue'), so a door goes where its own address
// goes, the way the front page's cards do.
test('both doors switch in place and land on their own screens', () => {
  const door = src.match(/function deskDoor\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(door, /_blank/, 'no door opens a new window');
  assert.match(door, /onGoTo\(openedScreen\(new URL\(a\.href, location\.href\)\.hash\)\)/);
  const doors = src.match(/export const DESK_DOORS = \[([\s\S]*?)\];/)[1];
  const lands = [...doors.matchAll(/key: '(\w+)'/g)]
    .map(m => openedScreen(new URL(LANES.find(l => l.key === m[1]).href, 'https://desk.example/').hash));
  assert.deepEqual(lands, ['issue', 'sort', 'publish']);
});

test('only Content Sort wears a badge, and none of it at zero', () => {
  const doors = src.match(/export const DESK_DOORS = \[([\s\S]*?)\];/)[1];
  assert.match(doors, /key: 'sort'[^\n]*badge: true/);
  assert.doesNotMatch(doors, /key: 'newsletter'[^\n]*badge/, 'the newsletter has no alert (Kate, Sep 23)');
  assert.doesNotMatch(doors, /key: 'exchange'[^\n]*badge/, 'nor does the Exchange: its count needs the sign-in the team page does not have');
  assert.match(src, /if \(door\.badge\) a\.append/);
  assert.match(src, /textContent = n \? String\(n\) : ''/);
});

test('the Queue folds from a chevron, open to start with', () => {
  assert.match(src, /let queueOpen = true/);
  assert.match(src, /faIcon\(queueOpen \? 'chevron-down' : 'chevron-right'\)/);
  assert.match(src, /aria-expanded/);
});

// Kate, Sep 23: every row in the box says it is public facing, and the live
// line (the Exchange's last update) sits under that, not in its place.
test('every quick link says it is a public facing link', () => {
  for (const key of ['share', 'listserv', 'exchange']) {
    assert.match(entry(key), /sub: 'Public facing link'/, key);
  }
});

test("a row's own line and its live line are two lines, not one slot", () => {
  assert.match(src, /el\('div', 'ql-sub', item\.sub \?\? ''\)/);
  assert.doesNotMatch(src, /dataset\.sub/, 'the live line no longer falls back to the row\'s own');
});

// Kate, Sep 23: everyone uses the desk on a computer, so the team page is
// always two columns, never the side column dropped under the form.
test('the team page keeps its two columns at any laptop width', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  const cols = css.match(/\.team-cols \{([^}]*)\}/)[1];
  assert.match(cols, /flex-wrap:\s*nowrap/);
  assert.doesNotMatch(cols, /flex-wrap:\s*wrap\b/);
});
