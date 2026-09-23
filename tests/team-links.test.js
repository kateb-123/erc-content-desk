import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The team page's Quick links (Kate, Sep 22, then her pick C of Sep 23): the
// standalone share page and listserv sign-up at their own address, the
// Exchange itself, and the Newsletter, with Content Sort as its own button
// under them. team-ui.js touches the DOM, so the links are read from the file.
const src = readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8');
const entry = key => src.match(new RegExp(`\\{ key: '${key}'[^\\n]*`))?.[0] ?? '';
const href = key => entry(key).match(/href: '([^']+)'/)?.[1];

test('Quick links point at the standalone pages, the Exchange and the newsletter', () => {
  assert.equal(href('share'), 'https://erc-share.vercel.app/submit/');
  assert.equal(href('listserv'), 'https://erc-share.vercel.app/listserv/');
  assert.equal(href('exchange'), 'https://erc-policy-exchange.vercel.app/');
  assert.equal(href('newsletter'), '/#newsletter');
});

test('every quick link carries an icon', () => {
  for (const key of ['share', 'listserv', 'exchange', 'newsletter']) {
    assert.match(entry(key), /icon: '[a-z-]+'/, `${key} has an icon`);
  }
});

test('no row shows its address (Kate, Sep 23)', () => {
  assert.doesNotMatch(src, /ql-url/, 'the address line is gone');
  assert.doesNotMatch(src, /shownUrl/, 'and so is the helper that wrote it');
});

test("Copy link is offered for the public pages and withheld for the desk's own", () => {
  // Copying the newsletter's address would hand out the desk's address, and
  // the desk is not for handing out.
  assert.match(entry('newsletter'), /inHouse: true/);
  for (const key of ['share', 'listserv', 'exchange']) {
    assert.doesNotMatch(entry(key), /inHouse/, `${key} keeps its Copy link`);
  }
  assert.match(src, /if \(!item\.inHouse\)/);
});

test('Content Sort is its own button, and the Desk work box is gone', () => {
  assert.match(src, /el\('a', 'sort-door'\)/);
  assert.doesNotMatch(src, /'Desk work'/);
  assert.doesNotMatch(src, /door-rows/);
});

test('the Queue folds from a chevron, open to start with', () => {
  assert.match(src, /let queueOpen = true/);
  assert.match(src, /faIcon\(queueOpen \? 'chevron-down' : 'chevron-right'\)/);
  assert.match(src, /aria-expanded/);
});
