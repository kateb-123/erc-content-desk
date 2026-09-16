import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV, currentKey, opensNewWindow } from '../js/sidebar-view.js';

test('the sidebar is four groups in the order Kate set, with the desk itself first', () => {
  assert.deepEqual(NAV.map(g => g.label), ['', 'Pipeline', 'Newsletter', 'Policy Exchange']);
  assert.deepEqual(NAV.map(g => g.items.map(i => i.label)), [
    ['ERC Content Desk'],
    ['Sort', 'Finalize', 'Publish to Exchange', 'Send to Newsletter'],
    ['Next newsletter', 'Newsletter builder', 'Past newsletters'],
    ['Policy Exchange', 'Share an item', 'Listserv sign-up'],
  ]);
});

test('the three hand-out links carry a copy line; nothing else does', () => {
  const withCopy = NAV.flatMap(g => g.items).filter(i => i.copy).map(i => i.label);
  assert.deepEqual(withCopy, ['Policy Exchange', 'Share an item', 'Listserv sign-up']);
  const share = NAV[3].items[1];
  assert.ok(share.copy.endsWith(share.href));
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
