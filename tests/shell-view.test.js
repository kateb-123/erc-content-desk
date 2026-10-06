import test from 'node:test';
import assert from 'node:assert/strict';
import { HUBS, crumbs, openedScreen, screenHash, pageTitle } from '../js/shell-view.js';

// Kate's drawn map (Oct 6, 2026): the desk is six hubs, each a card on the
// front page and a page of its own; Sort sits under the Content queue and the
// builder and Publish under their hubs. The top bar carries the breadcrumb
// alone (her pick A): Content Desk, the hub, the page.

test('the six hubs, in the order the front page lays them out', () => {
  assert.deepEqual(HUBS.map(h => [h.key, h.label, h.href]), [
    ['team', 'Submit content', '/#team'],
    ['queue', 'Content queue', '/#queue'],
    ['newsletter', 'Newsletter', '/#newsletter'],
    ['listserv', 'Listserv', '/#listserv'],
    ['links', 'Public links', ''],   // no page of its own: Copy link works on the card
    ['exchange', 'Policy Exchange', '/#exchange'],
  ]);
});

test('the breadcrumb: the desk alone on the front page, then the hub, then the page under it', () => {
  const desk = { label: 'ERC Content Desk', href: '/' };
  assert.deepEqual(crumbs('home'), [desk]);
  assert.deepEqual(crumbs('team'), [desk, { label: 'Submit content' }]);
  assert.deepEqual(crumbs('queue'), [desk, { label: 'Content queue' }]);
  assert.deepEqual(crumbs('sort'), [desk, { label: 'Content queue', href: '/#queue' }, { label: 'Content Sort' }]);
  assert.deepEqual(crumbs('finalize'), [desk, { label: 'Content queue', href: '/#queue' }, { label: 'Content Sort' }]);   // a tab of Content Sort
  assert.deepEqual(crumbs('issue'), [desk, { label: 'Newsletter' }]);
  assert.deepEqual(crumbs('schedule'), [desk, { label: 'Newsletter' }]);   // a tab of Newsletter
  assert.deepEqual(crumbs('past'), [desk, { label: 'Newsletter' }]);
  assert.deepEqual(crumbs('builder'), [desk, { label: 'Newsletter', href: '/#newsletter' }, { label: 'Builder' }]);
  assert.deepEqual(crumbs('listserv'), [desk, { label: 'Listserv' }]);
  assert.deepEqual(crumbs('exchange'), [desk, { label: 'Policy Exchange' }]);
  assert.deepEqual(crumbs('publish'), [desk, { label: 'Policy Exchange', href: '/#exchange' }, { label: 'Publish' }]);
});

test('an address opens its screen, old addresses still land, anything else is the front page', () => {
  assert.equal(openedScreen('#team'), 'team');
  assert.equal(openedScreen('#queue'), 'queue');
  assert.equal(openedScreen('#sort'), 'sort');
  assert.equal(openedScreen('#finalize'), 'finalize');
  assert.equal(openedScreen('#newsletter'), 'issue');
  assert.equal(openedScreen('#schedule'), 'schedule');
  assert.equal(openedScreen('#past'), 'past');
  assert.equal(openedScreen('#listserv'), 'listserv');
  assert.equal(openedScreen('#exchange'), 'exchange');   // the Policy Exchange hub since Oct 6; Publish opens from it
  assert.equal(openedScreen('#publish'), 'publish');
  assert.equal(openedScreen('#build'), 'issue');   // Send to Newsletter folded into Next issue
  assert.equal(openedScreen('#issue'), 'issue');
  assert.equal(openedScreen(''), 'home');
  assert.equal(openedScreen('#nowhere'), 'home');
  assert.equal(openedScreen(null), 'home');
});

test('every screen but the front page keeps an address', () => {
  assert.equal(screenHash('home'), '');
  assert.equal(screenHash('team'), '#team');
  assert.equal(screenHash('queue'), '#queue');
  assert.equal(screenHash('sort'), '#sort');
  assert.equal(screenHash('finalize'), '#finalize');
  assert.equal(screenHash('issue'), '#newsletter');
  assert.equal(screenHash('past'), '#past');
  assert.equal(screenHash('schedule'), '#schedule');
  assert.equal(screenHash('listserv'), '#listserv');
  assert.equal(screenHash('exchange'), '#exchange');
  assert.equal(screenHash('publish'), '#publish');
});

test('the window title names the page, the desk after it', () => {
  assert.equal(pageTitle('home'), 'ERC Content Desk');
  assert.equal(pageTitle('team'), 'Submit content · ERC Content Desk');
  assert.equal(pageTitle('queue'), 'Content queue · ERC Content Desk');
  assert.equal(pageTitle('sort'), 'Content Sort · ERC Content Desk');
  assert.equal(pageTitle('finalize'), 'Finalize · ERC Content Desk');
  assert.equal(pageTitle('schedule'), 'Schedule · ERC Content Desk');
  assert.equal(pageTitle('listserv'), 'Listserv · ERC Content Desk');
  assert.equal(pageTitle('exchange'), 'Policy Exchange · ERC Content Desk');
  assert.equal(pageTitle('publish'), 'Publish · ERC Content Desk');
  assert.equal(pageTitle('builder'), 'Newsletter builder · ERC Content Desk');
});

// Her pick A: nothing on the bar's right but Sign out, while a sign-in holds.
test('the bar draws the breadcrumb and no hub links', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/shell-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /laneLinks/);
  assert.match(src, /'topbar-signout', 'Sign out'/);
});
