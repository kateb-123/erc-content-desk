import test from 'node:test';
import assert from 'node:assert/strict';
import { HUBS, openedScreen, openedId, briefHash, screenHash, pageTitle } from '../js/shell-view.js';

// Kate's drawn map (Oct 6, 2026): the desk is its hubs, each a row on the
// front page and a page of its own; Sort sits under the Content queue and the
// builder and Publish under their hubs. Since her pick A of the looks (Oct 23)
// the shell is a sidebar, not a top bar with a breadcrumb.

test('the seven hubs, in the order the front page lays them out (Research briefs seventh, Kate, Oct 20)', () => {
  assert.deepEqual(HUBS.map(h => [h.key, h.label, h.href]), [
    ['team', 'Submit content', '/#team'],
    ['queue', 'Content queue', '/#queue'],
    ['newsletter', 'Newsletter', '/#newsletter'],
    ['listserv', 'Listserv', '/#listserv'],
    ['links', 'Public links', ''],   // no page of its own: Copy link works on the card
    ['exchange', 'Policy Exchange', '/#exchange'],
    ['briefs', 'Research briefs', '/#briefs'],
  ]);
});

// A brief's own page (Kate's pick D, Oct 20): /#briefs/<id> opens the brief
// screen, the id read from the address; the page carries its title.
test('a brief\'s address opens the brief screen and keeps its id', () => {
  assert.equal(openedScreen('#briefs'), 'briefs');
  assert.equal(openedScreen('#briefs/reveille-2026-yell'), 'brief');
  assert.equal(openedId('#briefs/reveille-2026-yell'), 'reveille-2026-yell');
  assert.equal(openedId('#briefs'), '');
  assert.equal(briefHash('reveille-2026-yell'), '#briefs/reveille-2026-yell');
  assert.equal(pageTitle('briefs'), 'Research briefs · ERC Content Desk');
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

// Her pick A of the looks (Oct 23): Sign out sits in the sidebar's foot while a sign-in holds; no breadcrumb.
test('the sidebar carries Sign out and no breadcrumb', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/shell-ui.js', import.meta.url), 'utf8');
  assert.match(src, /'Sign out'/);
  assert.doesNotMatch(src, /crumbs|topbar/);
});

// The Highlight's own page (Kate, Oct 23): under Policy Exchange, beside Publish.
test('the Highlight opens at /#highlight, a page under Policy Exchange', () => {
  assert.equal(openedScreen('#highlight'), 'highlight');
  assert.equal(screenHash('highlight'), '#highlight');
  assert.equal(pageTitle('highlight'), 'Highlight · ERC Content Desk');
});

// Kate's pick A (Oct 23): the desk as a Mac app. The navy top bar goes for a
// sidebar: Home, then the hubs by step under the front page's own group names,
// Content Sort under Bring it in, each with what waits there at its right.
test('the sidebar: Home, then the hubs by step, Content Sort under Bring it in', async () => {
  const { NAV } = await import('../js/shell-view.js');
  assert.deepEqual(NAV.map(g => [g.label, g.items.map(i => i.key)]), [
    ['', ['home']],
    ['Bring it in', ['team', 'queue', 'sort']],
    ['Send it out', ['newsletter', 'listserv', 'exchange']],
    ['Research', ['briefs']],
  ]);
  const items = NAV.flatMap(g => g.items);
  assert.deepEqual(items.map(i => [i.key, i.label, i.href]), [
    ['home', 'Home', '/'],
    ['team', 'Submit content', '/#team'],
    ['queue', 'Content queue', '/#queue'],
    ['sort', 'Content Sort', '/#sort'],
    ['newsletter', 'Newsletter', '/#newsletter'],
    ['listserv', 'Listserv', '/#listserv'],
    ['exchange', 'Policy Exchange', '/#exchange'],
    ['briefs', 'Research briefs', '/#briefs'],
  ]);
  // The two password pages carry the lock, as the front page says.
  assert.deepEqual(items.filter(i => i.lock).map(i => i.key), ['sort', 'briefs']);
  for (const item of items) assert.ok(item.icon, `${item.key} has its icon`);
});

test('the sidebar marks where you are: a page under a hub marks its hub, Sort and Finalize mark Content Sort', async () => {
  const { navCurrent } = await import('../js/shell-view.js');
  const cases = {
    home: 'home', team: 'team', queue: 'queue', sort: 'sort', finalize: 'sort',
    issue: 'newsletter', schedule: 'newsletter', past: 'newsletter', builder: 'newsletter', emailpage: 'newsletter',
    listserv: 'listserv', exchange: 'exchange', publish: 'exchange', highlight: 'exchange',
    briefs: 'briefs', brief: 'briefs',
  };
  for (const [screen, key] of Object.entries(cases)) assert.equal(navCurrent(screen), key, screen);
  assert.equal(navCurrent('nowhere'), null);
});

test('each item shows what waits there, from the front page\'s rows; nothing while it is not known', async () => {
  const { navBadges } = await import('../js/shell-view.js');
  const cards = [
    { key: 'queue', count: 13 }, { key: 'newsletter', count: 0, next: 'Oct 27' },
    { key: 'listserv', count: 3 }, { key: 'exchange', count: 2 }, { key: 'briefs', count: 3 },
  ];
  assert.deepEqual(navBadges(cards), { sort: '13', newsletter: 'Oct 27', listserv: '3', exchange: '2', briefs: '3' });
  assert.deepEqual(navBadges([{ key: 'queue', count: null }, { key: 'newsletter', next: '' }]), { sort: '', newsletter: '', listserv: '', exchange: '', briefs: '' });
  assert.deepEqual(navBadges(), { sort: '', newsletter: '', listserv: '', exchange: '', briefs: '' });
});

test('a sidebar item tells a screen reader its lock and what waits there', async () => {
  const { NAV, navLabel } = await import('../js/shell-view.js');
  const item = key => NAV.flatMap(g => g.items).find(i => i.key === key);
  assert.equal(navLabel(item('sort'), '13'), 'Content Sort, password protected, 13 waiting');
  assert.equal(navLabel(item('newsletter'), 'Oct 27'), 'Newsletter, next issue Oct 27');
  assert.equal(navLabel(item('listserv'), '3'), 'Listserv, 3 to be added');
  assert.equal(navLabel(item('exchange'), '2'), 'Policy Exchange, 2 waiting to publish');
  assert.equal(navLabel(item('briefs'), ''), 'Research briefs, password protected');
  assert.equal(navLabel(item('home')), 'Home');
});
