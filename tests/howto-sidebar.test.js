import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { navBadges } from '../js/shell-view.js';
import { hubCards } from '../js/home-panel.js';

// The owner, Oct 23 (night): a how-to page's sidebar showed the names alone,
// while the front page's shows what waits at each item. A how-to now shows the
// same counts, counted by the code the desk counts with (home-panel.js's
// hubCards, shell-view.js's navBadges), read as the page opens: the names draw
// at once, each count lands when its read does, and a read that fails leaves
// its item a name, as before. Policy Exchange keeps the desk's rule: nothing
// until the live check lands, never a guess.

const today = '2026-10-23';
const rows = [
  { id: 'a', status: 'new', type: 'research', link: 'https://example.org/howdy-brief', submitted_at: '2026-10-20T10:00:00Z' },
  { id: 'b', status: 'new', type: 'headline', link: 'https://example.org/gig-em-headline', submitted_at: '2026-10-21T10:00:00Z' },
  { id: 'c', status: 'kept', type: 'research', link: 'https://example.org/reveille-report', newsletter_issue: '2026-10-27' },
];
const schedule = ['2026-10-13', '2026-10-27', '2026-11-10'];
const signups = { ok: true, live: true, kept: true, sheet: true, waiting: 3, last: '2026-10-21', since: '2026-10-14', updated: '2026-10-18' };
const check = { ok: true, adding: [{ id: 'c' }], skipped: [], notReady: [], newsletterOnly: [], liveLinks: [] };
const replies = { '/api/sheet': { ok: true, rows, schedule }, '/api/listserv': signups, '/api/publish': check };
const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

const { mountHowtoSidebar } = await import('../js/howto-sidebar.js');

/** Mounts the sidebar with every draw kept; `answer` stands in for the server. */
async function mount(answer) {
  globalThis.fetch = async (url) => answer(String(url));
  const draws = [];
  const done = mountHowtoSidebar('the nav', { draw: (nav, opts) => draws.push({ nav, ...opts }), today });
  const first = draws.slice();
  await done;
  return { first, draws, last: draws.at(-1) };
}

test('the names draw at once, as a how-to, before any count is read', async () => {
  let open;
  const gate = new Promise((r) => { open = r; });
  const pending = mount(async (url) => { await gate; return reply(replies[url]); });
  await Promise.resolve();
  open();
  const { first } = await pending;
  assert.equal(first.length, 1, 'one draw before any read answers');
  assert.equal(first[0].nav, 'the nav');
  assert.equal(first[0].screen, 'howto', 'All how-tos lit at the foot');
  assert.deepEqual(Object.values(first[0].badges).filter(Boolean), [], 'names alone until the counts land');
});

test('once the reads land, every count is the desk\'s own, from the same code', async () => {
  const { draws, last } = await mount(async (url) => reply(replies[url]));
  assert.ok(draws.length >= 2, 'a draw as the counts land');
  assert.deepEqual(last.badges, navBadges(hubCards({ rows, schedule, today, loaded: true, preview: check, signups })), 'what the front page\'s sidebar shows');
  assert.equal(last.badges.sort, '2', 'Content Sort: what waits for Sort');
  assert.equal(last.badges.newsletter, 'Oct 27', 'Newsletter: the next send date');
  assert.equal(last.badges.listserv, '3', 'Listserv: to be added');
  assert.equal(last.badges.exchange, '1', 'Policy Exchange: what Publish would add, from the live check');
  assert.equal(last.badges.briefs, '', 'Research briefs: only once her sign-in has read the list, which a how-to never does');
  assert.equal(last.screen, 'howto');
});

test('Policy Exchange stays blank until its live check lands, never a guess', async () => {
  const { last } = await mount(async (url) => (url === '/api/publish' ? reply({ ok: false, error: 'The Exchange did not answer.' }, 502) : reply(replies[url])));
  assert.equal(last.badges.exchange, '', 'no check, no number');
  assert.equal(last.badges.sort, '2', 'the other counts still land');
  assert.equal(last.badges.listserv, '3');
});

test('a read that fails leaves its item a name, quietly', async () => {
  const offline = await mount(async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual(Object.values(offline.last.badges).filter(Boolean), [], 'names alone when nothing answers');
  const refused = await mount(async (url) => (url === '/api/sheet' ? reply({ ok: false, error: 'nope' }, 500) : reply(replies[url])));
  assert.equal(refused.last.badges.sort, '', 'no rows, no Sort count');
  assert.equal(refused.last.badges.exchange, '', 'nor an Exchange count, which counts from the rows too');
  assert.equal(refused.last.badges.listserv, '3', 'the sign-ups still land');
});

test('the counts are read from the desk\'s own addresses, each once, all at the start', async () => {
  const asked = [];
  await mount(async (url) => { asked.push(url); return reply(replies[url]); });
  assert.deepEqual([...asked].sort(), ['/api/listserv', '/api/publish', '/api/sheet']);
});

// Every how-to loads it the same way, one line, at one version, in place of the
// bare sidebar call; the two makers write that line into what they build.
test('every how-to page and both makers load the counted sidebar the same way, at one version', () => {
  const howToDir = new URL('../how-to/', import.meta.url);
  const files = readdirSync(howToDir, { recursive: true }).filter((f) => /(^|\/)index\.html$|^make-(deck|page)\.mjs$/.test(f));
  assert.ok(files.length >= 13, `pages and makers (${files.length})`);
  const versions = new Set();
  for (const f of files) {
    const html = readFileSync(new URL(f, howToDir), 'utf8');
    const tags = html.match(/<script type="module" src="\/js\/howto-sidebar\.js\?v=\d+"><\/script>/g) ?? [];
    assert.equal(tags.length, 1, `${f} loads the counted sidebar once`);
    versions.add(tags[0].match(/v=(\d+)/)[1]);
    assert.doesNotMatch(html, /renderSidebar\(/, `${f} no longer draws the sidebar with its names alone`);
  }
  assert.equal(versions.size, 1, `one version everywhere (${[...versions].join(', ')})`);
});

test('the file mounts itself into the page\'s sidebar, and only where there is one', () => {
  const src = readFileSync(new URL('../js/howto-sidebar.js', import.meta.url), 'utf8');
  assert.match(src, /querySelector\('nav\.sidebar'\)/);
  assert.match(src, /import \{ navBadges \} from '\.\/shell-view\.js';/, 'the desk\'s own badge rule');
  assert.match(src, /import \{ hubCards \} from '\.\/home-panel\.js';/, 'the desk\'s own counts');
  assert.match(src, /import \{ fetchDesk, readReply \} from '\.\/sheet-client\.js';/, 'the desk\'s own reads');
});
