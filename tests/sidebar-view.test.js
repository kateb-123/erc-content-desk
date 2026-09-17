import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV, EXCHANGE_URL, currentKey, foldOpen, menuLayout, itemLink, openedScreen, screenHash } from '../js/sidebar-view.js';

test('the sidebar puts the team\'s links first and the pipeline last as Desk work (Claude Design round two, Kate\'s pick Sep 16)', () => {
  assert.deepEqual(NAV.map(g => g.label), ['', 'Policy Exchange', 'Newsletter', 'Desk work']);
  assert.deepEqual(NAV.map(g => g.items.map(i => i.label)), [
    ['ERC Content Desk'],
    ['Policy Exchange', 'Share an item', 'Listserv sign-up'],
    ['Next newsletter', 'Newsletter builder', 'Past newsletters'],
    ['Sort', 'Finalize', 'Publish to Exchange', 'Send to Newsletter'],
  ]);
});

test('icons sit on the group headings; the items under them carry none, the brand keeps its house', () => {
  assert.deepEqual(NAV.map(g => g.icon ?? ''), ['', 'globe', 'envelope-open-text', 'layer-group']);
  const items = NAV.flatMap(g => g.items);
  assert.deepEqual(items.filter(i => i.icon).map(i => i.key), ['home']);
});

test('only Desk work folds, and only Sort carries a count', () => {
  assert.deepEqual(NAV.filter(g => g.fold).map(g => g.label), ['Desk work']);
  assert.deepEqual(NAV.flatMap(g => g.items).filter(i => i.count).map(i => i.key), ['sort']);
});

test('the three hand-out links carry a copy line; nothing else does', () => {
  const withCopy = NAV.flatMap(g => g.items).filter(i => i.copy).map(i => i.label);
  assert.deepEqual(withCopy, ['Policy Exchange', 'Share an item', 'Listserv sign-up']);
  const share = NAV[1].items[1];
  assert.ok(share.copy.endsWith(share.href));
});

test('Desk work stays open unless it was shut, and always opens on a pipeline screen', () => {
  assert.equal(foldOpen(null, 'home'), true);
  assert.equal(foldOpen('open', 'home'), true);
  assert.equal(foldOpen('closed', 'home'), false);
  assert.equal(foldOpen('closed', 'issue'), false);
  assert.equal(foldOpen('closed', 'sort'), true);
  assert.equal(foldOpen('closed', 'build'), true);
});

test('currentKey maps the screen to the lit item', () => {
  assert.equal(currentKey('home'), 'home');
  assert.equal(currentKey('issue'), 'issue');
  assert.equal(currentKey('sort'), 'sort');
  assert.equal(currentKey('build'), 'build');
  assert.equal(currentKey('builder'), 'builder');
  assert.equal(currentKey('past'), 'past');
  assert.equal(currentKey('nowhere'), '');
});

test('screens that tuck the menu behind the thin strip until opened: sort, finalize, publish, build, builder (Kate, Sep 16: B expanded, C\'s strip)', () => {
  for (const screen of ['sort', 'finalize', 'publish', 'build', 'builder']) {
    assert.deepEqual(menuLayout(screen, false), { strip: true, sidebar: false, close: false }, screen);
    assert.deepEqual(menuLayout(screen, true), { strip: false, sidebar: true, close: true }, screen);
  }
});

test('screens that keep the sidebar whatever the open flag says, with no strip and no close button: home, issue, past', () => {
  for (const screen of ['home', 'issue', 'past']) {
    for (const open of [false, true]) {
      assert.deepEqual(menuLayout(screen, open), { strip: false, sidebar: true, close: false }, `${screen} ${open}`);
    }
  }
});

const item = key => NAV.flatMap(g => g.items).find(i => i.key === key);

test('inside the desk, items keep their links: screens switch in place, the pipeline opens its window from the front door, outside pages open a new tab', () => {
  assert.deepEqual(itemLink(item('home'), 'home', false), { href: '/', newTab: false, inPlace: true });
  assert.deepEqual(itemLink(item('issue'), 'home', false), { href: '/#issue', newTab: false, inPlace: true });   // the page has an address (design audit b21)
  assert.deepEqual(itemLink(item('sort'), 'home', false), { href: '/#sort', newTab: true, inPlace: false });
  assert.deepEqual(itemLink(item('sort'), 'finalize', true), { href: '/#sort', newTab: false, inPlace: true });
  assert.deepEqual(itemLink(item('builder'), 'home', false), { href: '/builder/', newTab: true, inPlace: false });
  assert.deepEqual(itemLink(item('exchange'), 'sort', true), { href: EXCHANGE_URL, newTab: true, inPlace: false });
});

test('on the builder\'s pages every desk page is a plain link: the pipeline opens its window, the desk and the builder\'s own pages open in place', () => {
  for (const screen of ['builder', 'past']) {
    assert.deepEqual(itemLink(item('home'), screen, false), { href: '/', newTab: false, inPlace: false }, screen);
    assert.deepEqual(itemLink(item('issue'), screen, false), { href: '/#issue', newTab: false, inPlace: false }, screen);
    assert.deepEqual(itemLink(item('sort'), screen, false), { href: '/#sort', newTab: true, inPlace: false }, screen);
    assert.deepEqual(itemLink(item('build'), screen, false), { href: '/#build', newTab: true, inPlace: false }, screen);
    assert.deepEqual(itemLink(item('builder'), screen, false), { href: '/builder/', newTab: false, inPlace: false }, screen);
    assert.deepEqual(itemLink(item('past'), screen, false), { href: '/builder/archive.html', newTab: false, inPlace: false }, screen);
    assert.deepEqual(itemLink(item('exchange'), screen, false), { href: EXCHANGE_URL, newTab: true, inPlace: false }, screen);
  }
});

test('a link to /#issue lands on Next newsletter without becoming the pipeline\'s window; a pipeline hash still does', () => {
  assert.deepEqual(openedScreen('#issue'), { screen: 'issue', isSectionWindow: false });
  assert.deepEqual(openedScreen('#sort'), { screen: 'sort', isSectionWindow: true });
  assert.deepEqual(openedScreen('#build'), { screen: 'build', isSectionWindow: true });
  assert.deepEqual(openedScreen(''), { screen: null, isSectionWindow: false });
  assert.deepEqual(openedScreen('#nowhere'), { screen: null, isSectionWindow: false });
});

test('screenHash: the pipeline screens and Next newsletter carry a hash, the front door none (design audit b21)', () => {
  assert.equal(screenHash('sort'), '#sort');
  assert.equal(screenHash('build'), '#build');
  assert.equal(screenHash('issue'), '#issue');
  assert.equal(screenHash('home'), '');
  assert.equal(screenHash(null), '');
});
