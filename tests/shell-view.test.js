import test from 'node:test';
import assert from 'node:assert/strict';
import { LANES, crumbs, laneLinks, openedScreen, screenHash, pageTitle } from '../js/shell-view.js';

// Kate's wireframes, Sep 17: a top bar with a breadcrumb in place of the
// sidebar, and the two other lanes as links on its right.

test('the three lanes, in the order the front page lists them', () => {
  assert.deepEqual(LANES.map(l => [l.key, l.label, l.href]), [
    ['sort', 'Sort content', '/#sort'],
    ['newsletter', 'Newsletter', '/#newsletter'],
    ['exchange', 'Policy Exchange', '/#exchange'],
  ]);
});

test('the breadcrumb: the desk alone on the front page, the desk then the page elsewhere, the builder under Newsletter', () => {
  assert.deepEqual(crumbs('home'), [{ label: 'ERC Content Desk', href: '/' }]);
  assert.deepEqual(crumbs('sort'), [{ label: 'ERC Content Desk', href: '/' }, { label: 'Sort content' }]);
  assert.deepEqual(crumbs('exchange'), [{ label: 'ERC Content Desk', href: '/' }, { label: 'Policy Exchange' }]);
  assert.deepEqual(crumbs('builder'), [{ label: 'ERC Content Desk', href: '/' }, { label: 'Newsletter', href: '/#newsletter' }, { label: 'Builder' }]);
  assert.deepEqual(crumbs('past'), [{ label: 'ERC Content Desk', href: '/' }, { label: 'Newsletter', href: '/#newsletter' }, { label: 'Past issues' }]);
});

test('until their screens fold into the lanes, the old screens crumb under the lane they belong to', () => {
  assert.deepEqual(crumbs('finalize').map(c => c.label), ['ERC Content Desk', 'Sort content']);   // a tab of Sort content since Sep 18
  assert.deepEqual(crumbs('publish').map(c => c.label), ['ERC Content Desk', 'Policy Exchange']);
  assert.deepEqual(crumbs('issue').map(c => c.label), ['ERC Content Desk', 'Newsletter']);
  assert.deepEqual(crumbs('build').map(c => c.label), ['ERC Content Desk', 'Newsletter', 'Send to Newsletter']);
});

test('the bar links to the two lanes the page is not in; the front page links to none', () => {
  assert.deepEqual(laneLinks('home'), []);
  assert.deepEqual(laneLinks('sort').map(l => l.key), ['newsletter', 'exchange']);
  assert.deepEqual(laneLinks('finalize').map(l => l.key), ['newsletter', 'exchange']);
  assert.deepEqual(laneLinks('newsletter').map(l => l.key), ['sort', 'exchange']);
  assert.deepEqual(laneLinks('issue').map(l => l.key), ['sort', 'exchange']);
  assert.deepEqual(laneLinks('build').map(l => l.key), ['sort', 'exchange']);
  assert.deepEqual(laneLinks('exchange').map(l => l.key), ['sort', 'newsletter']);
  assert.deepEqual(laneLinks('publish').map(l => l.key), ['sort', 'newsletter']);
  assert.deepEqual(laneLinks('builder').map(l => l.key), ['sort', 'exchange']);
});

test('an address opens its screen, old addresses still land, anything else is the front page', () => {
  assert.equal(openedScreen('#sort'), 'sort');
  assert.equal(openedScreen('#newsletter'), 'issue');
  assert.equal(openedScreen('#exchange'), 'publish');
  assert.equal(openedScreen('#finalize'), 'finalize');
  assert.equal(openedScreen('#build'), 'build');
  assert.equal(openedScreen('#issue'), 'issue');
  assert.equal(openedScreen('#publish'), 'publish');
  assert.equal(openedScreen(''), 'home');
  assert.equal(openedScreen('#nowhere'), 'home');
  assert.equal(openedScreen(null), 'home');
});

test('every screen but the front page keeps an address, in the lanes\' names', () => {
  assert.equal(screenHash('home'), '');
  assert.equal(screenHash('sort'), '#sort');
  assert.equal(screenHash('finalize'), '#finalize');
  assert.equal(screenHash('issue'), '#newsletter');
  assert.equal(screenHash('build'), '#build');
  assert.equal(screenHash('publish'), '#exchange');
});

test('the window title names the page, the desk after it', () => {
  assert.equal(pageTitle('home'), 'ERC Content Desk');
  assert.equal(pageTitle('sort'), 'Sort content · ERC Content Desk');
  assert.equal(pageTitle('finalize'), 'Finalize · ERC Content Desk');
  assert.equal(pageTitle('publish'), 'Policy Exchange · ERC Content Desk');
  assert.equal(pageTitle('builder'), 'Newsletter builder · ERC Content Desk');
});
