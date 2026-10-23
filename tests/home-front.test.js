import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The front page as Kate picked it (Oct 23, 2026, her pick E of six: "omg E is
// perfect"): the hubs as one list per step under a label, Bring it in, Send it
// out and Research, and Public links as a menu at the right, with the team's
// own submit page under it to open in a tab and pin. Since her pick A of the
// looks (the same evening) each list is a white grouped list on the grey page
// and each row keeps her line rules: one line per kind of fact, the first fact
// darker, no line wrapping.

// ── A small stand-in for the browser's document, enough for the page's helpers ──
class Text { constructor(text) { this.text = String(text); this.parentNode = null; } get textContent() { return this.text; } }
class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.childNodes = []; this.attrs = {}; this.dataset = {}; this.className = ''; this.listeners = {}; this.parentNode = null; }
  get children() { return this.childNodes.filter(n => n instanceof Node); }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(text) { this.childNodes = []; this.append(String(text)); }
  append(...nodes) {
    for (const n of nodes) {
      const node = typeof n === 'string' ? new Text(n) : n;
      if (node.parentNode) node.parentNode.childNodes = node.parentNode.childNodes.filter(c => c !== node);
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  prepend(...nodes) { const rest = this.childNodes; this.childNodes = []; this.append(...nodes); for (const n of rest) this.append(n); }
  replaceChildren(...nodes) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }   // an svg's class is an attribute
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  matches(sel) {
    const m = sel.match(/^([a-z0-9]*)((?:\.[\w-]+)*)$/);
    if (!m) throw new Error(`selector not supported here: ${sel}`);
    const classes = this.className.split(/\s+/);
    return (!m[1] || this.tagName === m[1].toUpperCase()) && m[2].split('.').filter(Boolean).every(c => classes.includes(c));
  }
  // A compound selector, or a descendant chain of them ('.a .b').
  matchesChain(parts, root) {
    if (!this.matches(parts.at(-1))) return false;
    let rest = parts.slice(0, -1);
    for (let up = this.parentNode; rest.length && up && up !== root; up = up.parentNode) if (up.matches(rest.at(-1))) rest = rest.slice(0, -1);
    return rest.length === 0;
  }
  querySelectorAll(sel) {
    const found = [];
    const parts = sel.trim().split(/\s+/);
    const walk = node => { for (const c of node.children) { if (c.matchesChain(parts, this)) found.push(c); walk(c); } };
    walk(this);
    return found;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}
globalThis.document = { createElement: tag => new Node(tag), createElementNS: (ns, tag) => new Node(tag) };

const { renderHome } = await import('../js/home-ui.js');
const { HOME_GROUPS, hubCards } = await import('../js/home-panel.js');
const { PUBLIC_LINKS, TEAM_SUBMIT } = await import('../js/public-links.js');
const { HUBS } = await import('../js/shell-view.js');

const rows = [
  { id: 'n1', status: 'new', submitted_at: '2026-10-20T10:00:00Z' },
  { id: 'n2', status: 'new', submitter_email: 'reveille@example.org', submitted_at: '2026-10-21T11:00:00Z' },
  { id: 'i1', status: 'kept', type: 'research', newsletter_issue: '2026-10-27' },
  { id: 'p1', status: 'kept', type: 'research', subtype: 'Report' },
];
const props = (extra = {}) => ({
  rows, schedule: ['2026-10-20', '2026-10-27'], today: '2026-10-23', loaded: true, loadFailed: false,
  preview: null, archive: [{ date: '2026-10-20' }], hubUpdated: '2026-10-23',
  signups: { live: true, sheet: true, waiting: 3, last: '2026-10-21' }, briefs: null,
  onGoTo: () => {}, onRefresh: () => {}, ...extra,
});
const draw = extra => { const container = new Node('div'); renderHome(container, props(extra)); return container; };
const texts = nodes => nodes.map(n => n.textContent.trim());

test('the hubs sit in three groups by step, in her order, and every hub but Public links is in one', () => {
  assert.deepEqual(HOME_GROUPS, [
    { label: 'Bring it in', keys: ['team', 'queue'] },
    { label: 'Send it out', keys: ['newsletter', 'listserv', 'exchange'] },
    { label: 'Research', keys: ['briefs'] },
  ]);
  const keys = hubCards({ rows: [], schedule: [], today: '2026-10-23', loaded: false }).map(c => c.key).filter(k => k !== 'links');
  assert.deepEqual(HOME_GROUPS.flatMap(g => g.keys).sort(), [...keys].sort());
});

test('the page draws one list per group under its label, a row a hub, and no card grid', () => {
  const page = draw();
  assert.equal(page.querySelector('.desk-cards'), null, 'the card grid of Oct 6 is gone');
  assert.deepEqual(texts(page.querySelectorAll('h3.hub-label')), ['Bring it in', 'Send it out', 'Research', 'Public links']);
  const lists = page.querySelectorAll('.home-groups .home-list');
  assert.deepEqual(lists.map(l => l.querySelectorAll('.home-row').map(r => r.dataset.key)), [['team', 'queue'], ['newsletter', 'listserv', 'exchange'], ['briefs']]);
  // The page title and its lede stay; How it all connects is the head's one button (All how-tos is in the sidebar).
  assert.equal(page.querySelector('.home-title').textContent, 'Content Desk');
  const guide = page.querySelector('a.home-guide');
  assert.deepEqual([guide.textContent, guide.href], ['How it all connects', '/how-to/pipeline/']);
  assert.equal(page.querySelectorAll('.howto-link').length, 0);
});

test('a row: its icon, the name as the link, a line per kind of fact with the first fact darker, the count, its own links', () => {
  const page = draw();
  const row = key => page.querySelectorAll('.home-row').find(r => r.dataset.key === key);
  for (const { key, label, href } of HUBS.filter(h => h.key !== 'links')) {
    const go = row(key).querySelector('a.home-name');
    assert.equal(go.textContent, label, key);
    assert.equal(go.href, href, key);
    assert.ok(row(key).querySelector('.home-tile svg'), `${key} has its icon`);
    assert.ok(row(key).querySelector('.home-chevron'), `${key} has its chevron`);
  }
  const count = key => row(key).querySelector('.home-count')?.textContent ?? null;
  assert.deepEqual(['team', 'queue', 'newsletter', 'listserv', 'exchange', 'briefs'].map(count), [null, '2', '1', '3', '1', '']);
  const lines = key => texts(row(key).querySelectorAll('.home-line'));
  assert.deepEqual(lines('team'), ["The team's form"]);
  assert.deepEqual(lines('queue'), ['waiting for Sort · 1 from outside', 'Sort, password protected']);
  assert.deepEqual(lines('newsletter'), ['in the Oct 27 issue · sends in 4 days', 'Last sent Oct 20']);
  assert.deepEqual(lines('listserv'), ['to be added', 'Live · last sign-up Oct 21']);
  assert.deepEqual(lines('exchange'), ['waiting to publish', 'Live · updated Oct 23']);
  assert.deepEqual(lines('briefs'), ['Password protected'], 'everyone sees it; the password is asked on entering');
  // The first fact is the darker one: what the count counts, never the team form's description.
  const lead = key => row(key).querySelector('.home-lead')?.textContent ?? null;
  assert.deepEqual(['team', 'queue', 'newsletter', 'listserv', 'exchange'].map(lead), [null, 'waiting for Sort', 'in the Oct 27 issue', 'to be added', 'waiting to publish']);
  // The lock where the password is; the green dot beside Live; a line never wraps, and says itself in full on hover.
  for (const key of ['queue', 'briefs']) assert.ok(row(key).querySelector('.home-line .line-icon-lock'), `${key} wears its lock`);
  for (const key of ['listserv', 'exchange']) assert.ok(row(key).querySelector('.home-line .home-dot'), `${key} is live`);
  assert.equal(row('queue').querySelectorAll('.home-line')[0].getAttribute('title'), 'waiting for Sort · 1 from outside');
  // The schedule warning is a note of its own under the row, with its triangle.
  const warn = page.querySelector('.home-warn');
  assert.equal(warn.textContent.trim(), "Send dates end Oct 27. Add the next ones on the Sheet's schedule tab.");
  assert.ok(warn.querySelector('.line-icon-warning'));
  const links = key => row(key).querySelector('.home-row-links')?.children ?? [];
  assert.deepEqual(texts(links('team')), ['How to submit content']);
  assert.deepEqual(texts(links('newsletter')), ['Read me (opens in a new tab)', 'Blank template (opens in a new tab)', 'Sample issue (opens in a new tab)']);
  assert.deepEqual(texts(links('listserv')), ['Sign-up sheet (opens in a new tab)']);
  for (const a of [...links('newsletter'), ...links('listserv')]) assert.deepEqual([a.target, a.rel], ['_blank', 'noopener']);
  assert.deepEqual([links('queue').length, links('exchange').length, links('briefs').length], [0, 0, 0]);
});

test('a count of nothing reads quiet, and a row not counted yet shows no number', () => {
  const quiet = draw({ rows: [] });
  const count = key => quiet.querySelectorAll('.home-row').find(r => r.dataset.key === key).querySelector('.home-count');
  assert.equal(count('queue').textContent, '0');
  assert.ok(count('queue').className.includes('is-zero'));
  const early = draw({ loaded: false, signups: null });
  assert.equal(early.querySelectorAll('.home-row').find(r => r.dataset.key === 'queue').querySelector('.home-count').textContent, '');
});

test('Public links is a menu at the right: the three public pages with their icons and Copy link, never an address', () => {
  const page = draw();
  const menu = page.querySelector('aside.home-links');
  assert.equal(menu.getAttribute('aria-label'), 'Public links');
  const menuRows = menu.querySelectorAll('.home-link-row');
  assert.equal(menuRows.length, PUBLIC_LINKS.length);
  // Pick A draws them in the sidebar's line icons: the Exchange's globe, the form's arrow in, the listserv's people.
  assert.deepEqual(PUBLIC_LINKS.map(l => l.line), ['exchange', 'submit', 'listserv']);
  PUBLIC_LINKS.forEach((link, i) => {
    const a = menuRows[i].querySelector('a.home-link-name');
    assert.deepEqual([a.href, a.target, a.rel], [link.href, '_blank', 'noopener'], link.key);
    assert.ok(menuRows[i].querySelector(`.home-tile .line-icon-${link.line}`), `${link.key} carries its icon`);
    assert.equal(a.textContent, `${link.label} (opens in a new tab)`);
    assert.equal(menuRows[i].querySelector('button.ql-copy').textContent, 'Copy link');
  });
  assert.doesNotMatch(page.textContent, /https?:|vercel\.app|\/team-submit\//, 'no address shows as words');
});

test('the team submit page sits apart under the public links, with its pin and how to pin it', () => {
  assert.deepEqual(TEAM_SUBMIT, { key: 'team-submit', label: 'Team submit page', href: '/team-submit/', icon: 'thumbtack', line: 'pin', note: 'Open it in its own tab, then right-click the tab and pick Pin.' });
  assert.equal(PUBLIC_LINKS.some(l => l.href === TEAM_SUBMIT.href || l.key === TEAM_SUBMIT.key), false, 'never one of the public links the team how-to shares');
  const pin = draw().querySelector('aside.home-links').querySelector('.home-pin');
  const a = pin.querySelector('a.home-pin-link');
  assert.deepEqual([a.href, a.target, a.rel], ['/team-submit/', '_blank', 'noopener']);
  assert.ok(pin.querySelector('.home-tile .line-icon-pin'));
  assert.equal(a.textContent, 'Team submit page (opens in a new tab)');
  assert.equal(pin.querySelector('.home-pin-note').textContent, 'Open it in its own tab, then right-click the tab and pick Pin.');
});

test('a redraw recounts the rows and keeps the menu, so a Copy link that said Copied keeps its word', () => {
  const container = new Node('div');
  renderHome(container, props({ loaded: false, signups: null }));
  const copy = container.querySelector('button.ql-copy');
  const queue = () => container.querySelectorAll('.home-row').find(r => r.dataset.key === 'queue');
  assert.equal(queue().querySelector('.home-count').textContent, '');
  renderHome(container, props());
  assert.equal(container.querySelector('button.ql-copy'), copy, 'the same button');
  assert.equal(queue().querySelector('.home-count').textContent, '2');
  assert.equal(container.querySelectorAll('.home-page').length, 1);
});

// ── The look, held in css/styles.css ──
const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
const rule = sel => css.match(new RegExp(`(?:^|\\n|\\})\\s*${sel.replace(/[.*()[\]:+>]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

test('the look: white grouped lists on the grey page beside a 304px menu, the old card grid gone', () => {
  assert.match(rule('.home-hubs'), /grid-template-columns:\s*minmax\(0, 1fr\) 304px/);
  const list = rule('.home-list');
  assert.match(list, /background:\s*var\(--layer\)/);
  assert.match(list, /border-radius:\s*var\(--radius-card\)/);
  assert.match(list, /box-shadow:\s*var\(--shadow-card\)/);
  assert.doesNotMatch(css, /\.desk-cards?\s*\{/, 'the grid of Oct 6 and the rows of Oct 23 are gone');
  // Her line rules: a line never wraps, the first fact is darker.
  assert.match(rule('.home-line'), /white-space:\s*nowrap/);
  assert.match(rule('.home-line'), /text-overflow:\s*ellipsis/);
  assert.match(rule('.home-lead'), /color:\s*var\(--ink\)/);
  assert.match(rule('.home-count.is-zero'), /color:\s*var\(--text-placeholder\)/);
});

test('the look: a row lifts on hover, its name stretches over it, and the ring is drawn inside the list', () => {
  assert.match(rule('.home-row:hover'), /background:\s*var\(--wash-hover\)/);
  assert.match(rule('a.home-name::after'), /inset:\s*0/);
  assert.match(rule('.home-row:has(.home-name:focus-visible)'), /box-shadow:\s*inset 0 0 0 2px var\(--focus\)/);
  assert.match(rule('a.home-name:focus-visible'), /box-shadow:\s*none/);
  assert.match(rule('.home-pin-link:focus-visible'), /box-shadow:\s*var\(--focus-ring\)/);
});

test('on a narrow page the menu drops under the lists, so a row keeps its width', () => {
  const narrow = css.match(/@media \(max-width: 1199px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(narrow, /\.home-hubs \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
});
