import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('every quick link carries an icon', () => {
  for (const key of ['share', 'listserv', 'exchange']) {
    assert.match(entry(key), /icon: '[a-z-]+'/, `${key} has an icon`);
  }
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

test("the desk's own pages are filled buttons, and the Desk work box is gone", () => {
  const doors = src.match(/export const DESK_DOORS = \[([\s\S]*?)\];/)[1];
  assert.match(doors, /key: 'sort'/);
  assert.match(doors, /key: 'newsletter'[^\n]*newWindow: true/, 'the newsletter opens in its own window');
  assert.match(src, /el\('a', 'sort-door'\)/);
  assert.doesNotMatch(src, /'Desk work'/);
  assert.doesNotMatch(src, /door-rows/);
});

test('a door with nothing waiting shows no badge at all', () => {
  assert.match(src, /textContent = n \? String\(n\) : ''/);
});

test('the Queue folds from a chevron, open to start with', () => {
  assert.match(src, /let queueOpen = true/);
  assert.match(src, /faIcon\(queueOpen \? 'chevron-down' : 'chevron-right'\)/);
  assert.match(src, /aria-expanded/);
});
