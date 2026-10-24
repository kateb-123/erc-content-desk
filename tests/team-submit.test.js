// tests/team-submit.test.js: the team's own submit page, /team-submit/ (Kate,
// Oct 23, her pick E: "omg E is perfect"). Submit content alone, for the team
// to pin as a browser tab: the desk's own form in its white box under the
// title and the how-to link, with no top bar, no breadcrumb and no other desk
// links. It is the desk's page drawn by the desk's code, never a copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { mountTeamSubmit } from '../js/team-submit.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('team-submit/index.html');
const desk = read('index.html');

/** A <link> or <script> line of a page, by what its address starts with. */
const tag = (html, start) => html.match(new RegExp(`<(?:link|script)[^>]+(?:href|src)="${start.replace(/[.?/]/g, '\\$&')}[^"]*"[^>]*>`))?.[0];
const href = (html, start) => tag(html, start)?.match(/(?:href|src)="([^"]+)"/)?.[1];

test('the page is a folder page Vercel serves, never ignored', () => {
  assert.ok(existsSync(new URL('../team-submit/index.html', import.meta.url)));
  const ignored = read('.vercelignore').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  for (const rule of ignored) {
    assert.ok(!/^\/?team-submit\b/.test(rule) && rule !== '*', `.vercelignore leaves team-submit/ in: ${rule}`);
  }
});

test('its tab reads Submit content, with the desk\'s own icon', () => {
  assert.match(page, /<title>Submit content<\/title>/);
  const icon = html => html.match(/<link rel="icon" href="([^"]+)"/)?.[1];
  assert.ok(icon(desk), 'the desk has its icon');
  assert.equal(icon(page), icon(desk), 'the same icon as the desk');
});

test('it wears the desk\'s look: the same sheets at the same versions, the system font (A, Oct 23)', () => {
  for (const sheet of ['/css/tokens.css', '/css/styles.css', '/css/shell.css']) {
    assert.ok(href(page, sheet), `loads ${sheet}`);
    assert.equal(href(page, sheet), href(desk, sheet), `${sheet} at index.html's version: bump both together`);
  }
  // The look of Oct 23 (Kate's pick A) draws in the computer's own face, so neither page fetches a web font.
  for (const html of [page, desk]) assert.doesNotMatch(html, /fonts\.googleapis\.com/, 'no web font');
  assert.doesNotMatch(page, /Mulish|Crimson|Archivo|Lora/, 'no named face');
  assert.equal(tag(page, 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/'), tag(desk, 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/'), 'Font Awesome as the desk loads it');
  assert.doesNotMatch(page, /<style/, 'no styles of its own: a color lives in css/tokens.css');
  assert.doesNotMatch(page, /#[0-9a-f]{3,8}\b/i, 'no color literal in the page');
});

test('no top bar, no breadcrumb, no desk links: the form alone, plus I need help!', () => {
  assert.doesNotMatch(page, /class="topbar"|<header/, 'no top bar, so no breadcrumb');
  assert.doesNotMatch(page, /<a\s/, 'nothing links into the desk from the page itself');
  assert.doesNotMatch(page, /app\.js|shell-ui\.js/, 'not the desk\'s app');
  assert.match(page, /<script type="module" src="\/js\/team-submit\.js\?v=\d+"><\/script>/);
  assert.match(page, /<script type="module" src="\/js\/problem-mount\.js\?v=4"><\/script>/, 'I need help!, in its corner since there is no bar');
  assert.match(page, /<main id="main"/);
  assert.doesNotMatch(page, /[–—]/, 'no dashes');
  assert.doesNotMatch(page, /https?:\/\/(?!fonts\.|cdnjs\.|www\.w3\.org\/2000\/svg)/, 'no address shown or linked');
});

test('the page is the desk\'s own Submit content, drawn by its code, not a copy', () => {
  const src = read('js/team-submit.js');
  assert.match(src, /import \{ renderTeam \} from '\.\/team-ui\.js';/, 'the same page /#team draws');
  assert.match(src, /import \{ fetchDesk \} from '\.\/sheet-client\.js';/, 'the desk\'s own read of its rows');
  assert.doesNotMatch(src, /renderSubmitForm|\/api\/submit|innerHTML/, 'the form and its calls stay in js/submit-form.js');
});

test('the rows for the duplicate ask: none until the read lands, then the desk\'s', async () => {
  const rows = [{ id: 'a', link: 'https://example.org/aggie/howdy' }];
  let drawn = null;
  const box = {};
  const ready = mountTeamSubmit(box, {
    load: async () => ({ rows, schedule: [] }),
    render: (container, opts) => { drawn = { container, ...opts }; },
  });
  assert.equal(drawn.container, box, 'drawn into the page\'s box');
  assert.deepEqual(drawn.knownLinks(), [], 'nothing to match while the read is out');
  await ready;
  assert.deepEqual(drawn.knownLinks(), rows, 'then the desk\'s rows, as /#team has them');
});

test('each landing reads the rows again, so a second paste of the same link is asked about', async () => {
  let reads = 0;
  const batches = [[], [{ id: 'new', link: 'https://example.org/aggie/trivia' }]];
  let drawn = null;
  await mountTeamSubmit({}, {
    load: async () => ({ rows: batches[Math.min(reads++, 1)], schedule: [] }),
    render: (_, opts) => { drawn = opts; },
  });
  assert.equal(reads, 1, 'one read on open');
  assert.deepEqual(drawn.knownLinks(), []);
  await drawn.onSubmitted({ id: 'new' });
  assert.equal(reads, 2, 'one more after an item lands, as /#team reloads');
  assert.deepEqual(drawn.knownLinks().map(r => r.id), ['new']);
});

test('a read that fails keeps what it had and never stops a submit', async () => {
  let fail = false;
  let drawn = null;
  await mountTeamSubmit({}, {
    load: async () => { if (fail) throw new TypeError('offline'); return { rows: [{ id: 'kept' }], schedule: [] }; },
    render: (_, opts) => { drawn = opts; },
  });
  fail = true;
  await assert.doesNotReject(drawn.onSubmitted({ id: 'x' }), 'the item already landed; the ask just waits');
  assert.deepEqual(drawn.knownLinks().map(r => r.id), ['kept']);
});
