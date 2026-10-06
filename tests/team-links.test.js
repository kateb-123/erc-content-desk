import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_LINKS } from '../js/public-links.js';

// The public links (Kate, Sep 22, then her pick C of Sep 23): the three PUBLIC
// pages, the standalone share page and listserv sign-up at their own address
// and the Exchange itself. Since her drawn map (Oct 6) they are a hub of
// their own on the front page, in her drawing's order, and the team's how-to
// draws its Links to share from the same list.
const links = readFileSync(new URL('../js/public-links.js', import.meta.url), 'utf8');
const team = readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../js/home-ui.js', import.meta.url), 'utf8');

test('the public links are the three public pages, and only those, in her order', () => {
  assert.deepEqual(PUBLIC_LINKS.map(l => [l.key, l.href]), [
    ['exchange', 'https://erc-policy-exchange.vercel.app/'],
    ['share', 'https://erc-share.vercel.app/submit/'],
    ['listserv', 'https://erc-share.vercel.app/listserv/'],
  ]);
  for (const l of PUBLIC_LINKS) assert.doesNotMatch(l.href, /erc-content-desk/, 'nothing of the desk among them');
});

// Kate's set D of Sep 23, with the screen for the Exchange: each icon is the
// thing itself, and no two rows repeat a metaphor (the how-to draws them).
test('every public link carries the icon Kate picked, and says it is public facing', () => {
  const icons = { share: 'square-plus', listserv: 'address-book', exchange: 'display' };
  for (const l of PUBLIC_LINKS) {
    assert.equal(l.icon, icons[l.key], l.key);
    assert.equal(l.sub, 'Public facing link', l.key);
  }
});

test('no row shows its address (Kate, Sep 23)', () => {
  for (const src of [links, home]) {
    assert.doesNotMatch(src, /ql-url/, 'the address line is gone');
    assert.doesNotMatch(src, /shownUrl/, 'and so is the helper that wrote it');
  }
});

test('every public link has Copy link, and the front page card draws it', () => {
  assert.match(links, /el\('button', 'linkish ql-copy', 'Copy link'\)/);
  assert.match(links, /copy\.textContent = 'Copied'/);
  assert.match(home, /copyLinkButton\(link\)/);
});

// Kate, Oct 6: the Submit content page holds the form and its how-to; the
// queue and the quick links left it for their own hubs.
test('the Submit content page is the form and its how-to, nothing else', () => {
  assert.match(team, /renderSubmitForm\(/);
  assert.match(team, /'\/how-to\/submit-content\/'/);
  for (const gone of [/QUICK_LINKS/, /DESK_DOORS/, /queueOpen/, /sort-door/, /team-side/]) assert.doesNotMatch(team, gone);
});
