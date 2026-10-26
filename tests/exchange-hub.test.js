import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangeStatus } from '../js/exchange-view.js';

// The Policy Exchange hub (Kate's drawn map, Oct 6, 2026): its status, the
// live link with when the site last changed, how many wait to publish; the
// code, the handoff and where the logins are kept are forthcoming.

const rows = [
  { id: 'a', status: 'kept', type: 'research' },
  { id: 'b', status: 'kept', type: 'event', subtype: 'A&M' },   // a campus event: newsletter only
  { id: 'c', status: 'kept', type: 'headline', published_at: '2026-10-01T10:00:00Z' },
];

test('exchangeStatus: live with its last change, and what Publish would add', () => {
  assert.deepEqual(exchangeStatus({ rows, today: '2026-10-07', loaded: true, preview: { adding: [{ id: 'a' }, { id: 'x' }] }, hubUpdated: '2026-10-01' }), {
    site: 'Live', updated: 'Oct 1', waiting: 2,
  });
});

// Kate, Oct 23: one number everywhere, and nothing until the live check lands (it used to be the kept rows' guess).
test('exchangeStatus: before the check lands there is no count, never a guess', () => {
  assert.equal(exchangeStatus({ rows, today: '2026-10-07', loaded: true, preview: null, hubUpdated: '2026-10-01' }).waiting, null);
  assert.equal(exchangeStatus({ rows, today: '2026-10-07', loaded: false, preview: null, hubUpdated: null }).waiting, null);
});

test('exchangeStatus: while asked it says so; a site that did not answer is never called live', () => {
  assert.deepEqual(exchangeStatus({ rows: [], today: '2026-10-07', loaded: true, preview: null, hubUpdated: null }), { site: 'Checking', updated: '', waiting: null });
  assert.deepEqual(exchangeStatus({ rows: [], today: '2026-10-07', loaded: true, preview: null, hubUpdated: '' }), { site: "Didn't answer just now", updated: '', waiting: null });
});

test('the hub says where the code, the handoff and the logins are, its how-tos in the How-tos panel (Oct 24), and never the logins themselves', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/exchange-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /forthcoming\(/);
  assert.match(src, /github\.com\/kateb-123\/erc-policy-exchange-app/);
  assert.match(src, /READ ME FIRST/);
  // The handoff's how-to links (Oct 22) went to the How-tos panel at the page's top right (Kate, Oct 24, her pick D).
  assert.doesNotMatch(src, /howToLink|\/how-to\//);
  assert.doesNotMatch(src, /DESK_PASSWORD|password\s*[:=]/i, 'no login on the page');
  assert.match(src, /'\/#publish'/, 'Publish opens from the hub');
  assert.match(src, /'https:\/\/erc-policy-exchange\.vercel\.app\/'/, 'the live link');
});

// The Exchange's own edit door (Kate, Oct 23: "also on the hub"): the one place
// a live item is fixed, hidden or deleted. Its password is never on the page.
test('the hub links the Exchange edit door, and never its password', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/exchange-ui.js', import.meta.url), 'utf8');
  assert.match(src, /https:\/\/erc-policy-exchange\.vercel\.app\/2ujhtc8daz\//);
  assert.match(src, /Edit live items/);
  assert.doesNotMatch(src, /ADMIN_PASSWORD|password:/i);
  // One team password for the desk and the door since Oct 23 (Kate).
  assert.match(src, /It asks the team password\./);
  assert.doesNotMatch(src, /Exchange\\'s own password/);
});

// The team password's value is in the handoff doc alone: the desk, its
// how-tos and this repo are open to anyone (Kate, Oct 23).
test('no page or how-to names the Exchange edit door\'s password as its own, or writes the value', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../how-to/', import.meta.url);
  const files = ['../js/exchange-ui.js', ...readdirSync(dir, { recursive: true })
    .filter(f => /\.(html|json|txt)$/.test(f)).map(f => `../how-to/${f}`)];
  for (const f of files) {
    const text = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /Exchange's password|its own password|Exchange\\'s own password/, f);
    assert.doesNotMatch(text, /erc-123/, f);
  }
});

// Publish no longer carries the highlight (Kate, Oct 23): the picks have their
// own page and their own Save, so a publish never rewrites the card.
test('Publish sends no highlight picks and points to the Highlight page; the hub has a Highlight door', async () => {
  const { readFileSync } = await import('node:fs');
  const publish = readFileSync(new URL('../js/publish-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(publish, /highlights:\s*picks/);
  assert.doesNotMatch(publish, /renderHighlights/);
  assert.match(publish, /onGoTo\('highlight'\)/);
  const hub = readFileSync(new URL('../js/exchange-ui.js', import.meta.url), 'utf8');
  assert.match(hub, /'\/#highlight'/);
});

// ── The page's order (Kate, Oct 23): a page leads with what its sidebar row
// counts, because that is why someone clicked it. The Exchange's row counts
// what waits to publish, so the doors lead (Publish with its count, then
// Highlight), then Status, then Edit live items with its line, and at the foot
// the how-tos and where the code and the logins are. Waiting to publish stays
// in Status.

// A small stand-in for the browser's document, enough for the page's helpers.
class FakeText { constructor(text) { this.text = String(text); } get textContent() { return this.text; } }
class FakeNode {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.childNodes = []; this.attrs = {}; this.dataset = {}; this.className = ''; this.listeners = {}; this.parentNode = null; }
  get children() { return this.childNodes.filter(n => n instanceof FakeNode); }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(text) { this.childNodes = []; this.append(String(text)); }
  append(...nodes) { for (const n of nodes) { const node = typeof n === 'string' ? new FakeText(n) : n; node.parentNode = this; this.childNodes.push(node); } }
  prepend(...nodes) { const rest = this.childNodes; this.childNodes = []; this.append(...nodes, ...rest); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  has(cls) { return this.className.split(/\s+/).includes(cls); }
  /** Every element under this one, in document order. */
  all() { return this.children.flatMap(c => [c, ...c.all()]); }
  querySelector(sel) { const cls = sel.replace(/^\./, ''); return this.all().find(n => n.has(cls)) ?? null; }
}

async function drawExchange(extra = {}) {
  globalThis.document ??= { createElement: tag => new FakeNode(tag), createElementNS: (ns, tag) => new FakeNode(tag) };
  const { renderExchange } = await import('../js/exchange-ui.js');
  const container = new FakeNode('div');
  renderExchange(container, {
    rows, today: '2026-10-07', loaded: true, hubUpdated: '2026-10-01',
    preview: { adding: [{ id: 'a' }, { id: 'x' }], highlights: { items: [{ id: 'a' }, { id: 'c' }] } },
    onGoTo: () => {}, ...extra,
  });
  return container;
}
const words = node => node.textContent.replace(/\s+/g, ' ').trim();

test('the Exchange page draws its groups in her order: the doors, Status, Edit live items, then the foot', async () => {
  const page = (await drawExchange()).querySelector('.hub-page');
  assert.deepEqual(page.children.map(c => c.className), ['page-head hub-head', 'ex-doors', 'ex-status', 'ex-edit', 'ex-foot']);
});

test('the Exchange page leads with the Publish door and its count, and keeps every line in order under it', async () => {
  const page = (await drawExchange()).querySelector('.hub-page');
  const marks = page.all().flatMap(n => {
    if (n.has('page-title')) return [`title: ${words(n)}`];
    if (n.has('sort-door')) return [`door: ${words(n.querySelector('.door-name'))} · ${words(n.querySelector('.door-note'))}`];
    if (n.has('hub-label')) return [`label: ${words(n)}`];
    if (n.has('hub-stat-k')) return [`stat: ${words(n)}`];
    if (n.has('qh-edit')) return [`link: ${words(n)}`];
    if (n.has('qh-side-note')) return [`note: ${words(n)}`];
    return [];
  });
  assert.deepEqual(marks, [
    'title: Policy Exchange',
    'door: Publish · 2 waiting',
    'door: Highlight · 2 on the home page',
    'label: Status',
    'stat: The site',
    'stat: Last updated',
    'stat: Waiting to publish',
    'link: Edit live items (opens in a new tab)',
    'note: Fix, hide or delete what is already live. It asks the team password.',
    'note: Code: github.com/kateb-123/erc-policy-exchange-app. Who holds the logins: READ ME FIRST, in the shared drive.',
  ]);
});

test('the Exchange page keeps its doors, links and status values as they were', async () => {
  const gone = [];
  const page = (await drawExchange({ onGoTo: key => gone.push(key) })).querySelector('.hub-page');
  const doors = page.all().filter(n => n.has('sort-door'));
  assert.deepEqual(doors.map(d => [d.href, d.dataset.focus, d.className]), [
    ['/#publish', 'publish', 'sort-door qh-door'],
    ['/#highlight', 'highlight', 'sort-door qh-door qh-door-second'],
  ]);
  for (const d of doors) d.listeners.click[0]({ preventDefault() {} });
  assert.deepEqual(gone, ['publish', 'highlight']);
  const values = page.all().filter(n => n.has('hub-stat-v')).map(words);
  assert.deepEqual(values, ['Live · Open the Exchange (opens in a new tab)', 'Oct 1', '2']);
  const edit = page.querySelector('.qh-edit');
  assert.deepEqual([edit.href, edit.target, edit.rel], ['https://erc-policy-exchange.vercel.app/2ujhtc8daz/', '_blank', 'noopener']);
  assert.deepEqual(page.all().filter(n => n.has('howto-link')), [], 'its how-tos are in the How-tos panel (Oct 24)');
});
