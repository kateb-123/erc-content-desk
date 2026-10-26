// tests/howto-index.test.js: every how-to in one place (Kate, Oct 24, 2026,
// her pick D of five). A How-tos button at the top right of every page opens a
// panel from the right: this page's guide first, the part for this page tagged
// This page, then every other guide under the sidebar's own headings. One data
// module drives it, js/howto-index.js, and it lists only guides and parts that
// exist today: each part is a part the guide's own page names, at an anchor
// that lands on an id of that page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { NAV } from '../js/shell-view.js';
import { GROUPS, GUIDES, SCREEN_GUIDES, BUILDER_PARTS, panelPlace, panelModel } from '../js/howto-index.js';

const root = new URL('../', import.meta.url);
const pageOf = href => readFileSync(new URL(`${href.replace(/^\//, '')}index.html`, root), 'utf8');
const unesc = t => t.replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"');
const words = html => unesc(html.replace(/<span class="(?:step|sr-only)"[^>]*>[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const ids = html => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const guide = id => GUIDES.find(g => g.id === id);

/** The parts a guide's page names itself: its part chips or its jump row; the read me, its headings. */
function ownParts(html) {
  const nav = html.match(/<nav class="(?:chips|jump)"[^>]*>([\s\S]*?)<\/nav>/);
  if (nav) return [...nav[1].matchAll(/<a href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => [words(m[2]), m[1]]);
  return [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map(m => [words(m[2]), m[1]]);
}

test('the groups are the sidebar\'s own headings, then Behind the scenes for the guides no hub owns', () => {
  assert.deepEqual(GROUPS, [...NAV.map(g => g.label).filter(Boolean), 'Behind the scenes']);
  assert.deepEqual(GROUPS, ['Bring it in', 'Send it out', 'Research', 'Behind the scenes']);
  for (const g of GUIDES) assert.ok(GROUPS.includes(g.group), `${g.id} sits under a heading`);
  assert.equal(new Set(GUIDES.map(g => g.id)).size, GUIDES.length, 'each guide once');
});

test('every guide is a page that exists today, and every how-to page is a guide', () => {
  for (const g of GUIDES) assert.ok(existsSync(new URL(`${g.href.replace(/^\//, '')}index.html`, root)), `${g.href} is a page`);
  const howTos = readdirSync(new URL('how-to/', root), { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(new URL(`how-to/${d.name}/index.html`, root)))
    .map(d => `/how-to/${d.name}/`);
  assert.deepEqual(howTos.filter(h => !GUIDES.some(g => g.href === h)), [], 'no how-to left out of the panel');
});

test('a how-to guide is listed by its page\'s own title', () => {
  for (const g of GUIDES.filter(x => x.href.startsWith('/how-to/'))) {
    const h1 = pageOf(g.href).match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
    assert.equal(g.title, words(h1 ?? ''), `${g.href}`);
  }
  assert.equal(guide('email').title, 'The email: read me', 'the read me, by the name Next issue gave it');
});

test('a guide\'s parts are the parts its page names, in its order, each landing on an id of that page', () => {
  for (const g of GUIDES) {
    const html = pageOf(g.href);
    assert.deepEqual(g.parts, ownParts(html), `${g.href}: the parts its page names`);
    for (const [, anchor] of g.parts) assert.ok(ids(html).has(anchor), `${g.href}#${anchor} lands on an id`);
  }
  assert.deepEqual(guide('pipeline').parts, [], 'How it all connects is one page with no parts');
  // The trim (Oct 24): the read me's list of what the builder does went to the builder's guide.
  assert.deepEqual(guide('email').parts.map(p => p[1]), ['pages', 'template']);
  // Change the desk keeps only what is its own; its hub chapters live in the hubs' guides.
  assert.deepEqual(guide('change').parts, [['Who to ask', 'ask'], ['The Exchange\'s look', 'look']]);
  assert.deepEqual(guide('sort').parts.map(p => p[1]), ['scraper', 'keep', 'sources', 'card', 'finalize', 'fix']);
  assert.deepEqual(guide('newsletter').parts.map(p => p[1]), ['dates', 'outline', 'tweak', 'export', 'send', 'options']);
  assert.deepEqual(guide('submit').parts.map(p => p[1]), ['add', 'types'], 'Links to share went to the front page\'s Public links');
  assert.deepEqual(guide('exchange').parts.map(p => p[1]), ['publish', 'highlight', 'fix'], 'the Exchange\'s look went to Change the desk');
});

test('every page with the sidebar opens on a guide that exists, at a part it has', () => {
  const screens = ['home', 'team', 'queue', 'sort', 'finalize', 'issue', 'schedule', 'past', 'listserv', 'exchange', 'publish', 'highlight', 'briefs', 'brief', 'builder', 'emailpage'];
  assert.deepEqual(Object.keys(SCREEN_GUIDES).sort(), [...screens].sort());
  for (const [screen, [id, part]] of Object.entries(SCREEN_GUIDES)) {
    assert.ok(guide(id), `${screen}: ${id} is a guide`);
    assert.ok(part === '' || guide(id).parts.some(p => p[1] === part), `${screen}: ${id}#${part} is one of its parts`);
  }
  for (const part of Object.values(BUILDER_PARTS)) assert.ok(guide('newsletter').parts.some(p => p[1] === part), `the builder's step ${part}`);
  // The pages the old links stood on keep their guide: Sort, Finalize, Publish, the Highlight, the briefs.
  assert.deepEqual(SCREEN_GUIDES.sort, ['sort', 'keep']);
  assert.deepEqual(SCREEN_GUIDES.finalize, ['sort', 'finalize']);
  assert.deepEqual(SCREEN_GUIDES.publish, ['exchange', 'publish']);
  assert.deepEqual(SCREEN_GUIDES.highlight, ['exchange', 'highlight']);
  assert.deepEqual(SCREEN_GUIDES.home, ['pipeline', '']);
  // The trim (Oct 24): each page's topic now has a part of its own in its hub's guide.
  assert.deepEqual(SCREEN_GUIDES.queue, ['sort', 'scraper'], 'the Content queue: its Scraper block');
  assert.deepEqual(SCREEN_GUIDES.schedule, ['newsletter', 'dates'], 'Schedule: the send dates, moved from Change the desk');
  assert.deepEqual(SCREEN_GUIDES.listserv, ['scripts', 'check'], 'Listserv: the count is the sign-up script\'s check');
});

test('on a desk page: its guide first, the part for this page tagged, links into the guide', () => {
  const model = panelModel(panelPlace({ screen: 'sort', path: '/' }));
  assert.equal(model.first.label, 'For this page');
  assert.equal(model.first.guide.id, 'sort');
  assert.deepEqual(model.first.parts.map(p => [p.name, p.href, p.here]), [
    ['The scraper', '/how-to/sort/#scraper', false],
    ['Keep or delete', '/how-to/sort/#keep', true],
    ['Sources', '/how-to/sort/#sources', false],
    ['Card and list', '/how-to/sort/#card', false],
    ['Finalize', '/how-to/sort/#finalize', false],
    ['Fix an item later', '/how-to/sort/#fix', false],
  ]);
  assert.ok(model.first.parts.every(p => !p.current), 'nothing is on screen: the guide is another page');
  assert.equal(model.restLabel, 'Every other guide');
  assert.deepEqual(model.groups.map(g => g.label), GROUPS, 'every heading still has a guide under it');
  assert.ok(!model.groups.some(g => g.guides.includes(model.first.guide)), 'the guide is not listed twice');
  assert.deepEqual(model.groups.flatMap(g => g.guides).length, GUIDES.length - 1);
});

test('a page with no part of its own opens its guide with nothing tagged', () => {
  // The Content queue was one until the trim (Oct 24) gave Sort the queue its Scraper part; the Policy Exchange page still is.
  const exchange = panelModel(panelPlace({ screen: 'exchange', path: '/' }));
  assert.equal(exchange.first.guide.id, 'exchange');
  assert.ok(exchange.first.parts.every(p => !p.here));
  const home = panelModel(panelPlace({ screen: 'home', path: '/' }));
  assert.equal(home.first.guide.title, 'How it all connects');
  assert.deepEqual(home.first.parts, []);
});

test('the builder\'s step picks the part', () => {
  const tagged = step => panelModel(panelPlace({ screen: 'builder', path: '/builder/', step })).first.parts.find(p => p.here)?.name;
  assert.equal(tagged('triage'), 'Outline');
  assert.equal(tagged('edit'), 'Preview & Tweak');
  assert.equal(tagged('export'), 'Save & Export');
  assert.equal(tagged(''), 'Outline', 'before a step shows, Outline');
});

test('on a how-to page: that guide first, its parts as places on the page, the one on screen marked', () => {
  const model = panelModel(panelPlace({ screen: 'howto', path: '/how-to/sort/', part: 'card' }));
  assert.equal(model.first.label, 'This guide');
  assert.equal(model.first.guide.id, 'sort');
  assert.deepEqual(model.first.parts.map(p => [p.href, p.current]), [['#scraper', false], ['#keep', false], ['#sources', false], ['#card', true], ['#finalize', false], ['#fix', false]]);
  assert.ok(model.first.parts.every(p => !p.here), 'no This page tag on the guide itself');
  assert.equal(panelPlace({ screen: 'howto', path: '/how-to/sort/index.html' }).guide, 'sort', 'the page by its file name too');
  assert.equal(panelPlace({ screen: 'howto', path: '/how-to/sort/', part: 'nowhere' }).part, '', 'a hash that is no part marks nothing');
});

test('on All how-tos: every guide, under its heading', () => {
  const model = panelModel(panelPlace({ screen: 'howto', path: '/how-to/' }));
  assert.equal(model.first, null);
  assert.equal(model.restLabel, 'Every guide');
  assert.deepEqual(model.groups.flatMap(g => g.guides.map(x => x.id)), GROUPS.flatMap(label => GUIDES.filter(g => g.group === label).map(g => g.id)));
});

test('the email\'s pages open the read me: the two pages tagged on each, the read me reads as its own guide', () => {
  const sample = panelModel(panelPlace({ screen: 'emailpage', path: '/newsletter/sample/' }));
  assert.equal(sample.first.guide.id, 'email');
  assert.equal(sample.first.parts.find(p => p.here)?.href, '/newsletter/read-me/#pages');
  const readMe = panelModel(panelPlace({ screen: 'emailpage', path: '/newsletter/read-me/' }));
  assert.equal(readMe.first.label, 'This guide');
  assert.equal(readMe.first.parts[0].href, '#pages');
});
