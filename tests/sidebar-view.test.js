import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV, currentKey, opensNewWindow, foldOpen, menuLayout } from '../js/sidebar-view.js';

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
  assert.equal(currentKey('nowhere'), '');
});

test('from the front door the pipeline opens in a new window; inside that window it switches in place', () => {
  assert.equal(opensNewWindow({ screen: 'sort' }, false), true);
  assert.equal(opensNewWindow({ screen: 'sort' }, true), false);
  assert.equal(opensNewWindow({ screen: 'home' }, false), false);
  assert.equal(opensNewWindow({ href: 'https://example.org/' }, false), true);
});

test('on a Desk work screen the sidebar tucks behind the thin strip until opened (Kate, Sep 16: B expanded, C\'s strip)', () => {
  for (const screen of ['sort', 'finalize', 'publish', 'build']) {
    assert.deepEqual(menuLayout(screen, false), { strip: true, sidebar: false, close: false }, screen);
    assert.deepEqual(menuLayout(screen, true), { strip: false, sidebar: true, close: true }, screen);
  }
});

test('the front door keeps its sidebar, with no strip and no close button, whatever the open flag says', () => {
  for (const screen of ['home', 'issue']) {
    for (const open of [false, true]) {
      assert.deepEqual(menuLayout(screen, open), { strip: false, sidebar: true, close: false }, `${screen} ${open}`);
    }
  }
});
