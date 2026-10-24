import test from 'node:test';
import assert from 'node:assert/strict';

// Newsletter's Next issue in the order Kate approved (Oct 23, 2026: "if
// someone clicks listserv, they probably want to see the new ones to add
// first"). A page leads with what its sidebar row counts, and Newsletter's row
// is the next send date, so the tab opens on a head line: the issue's date,
// how far off it is and the builder door at its right, the later issues under
// it. Then the lists as before (In this issue with Quick add, Ready to add,
// Past items), then the how-tos, the builder note and the last issue in a slim
// column. Only the order moved: every word, link and count is the same.

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
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  click() { for (const fn of this.listeners.click ?? []) fn({ preventDefault() {} }); }
  matches(sel) {
    const m = sel.match(/^([a-z0-9]*)((?:\.[\w-]+)*)$/);
    if (!m) throw new Error(`selector not supported here: ${sel}`);
    const classes = this.className.split(/\s+/);
    return (!m[1] || this.tagName === m[1].toUpperCase()) && m[2].split('.').filter(Boolean).every(c => classes.includes(c));
  }
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

const { renderIssue, resetIssueEntry } = await import('../js/issue-ui.js');

const kept = (id, extra) => ({ id, status: 'kept', send_to: 'both', submitted_at: '2026-10-21T15:00:00Z', ...extra });
const rows = [
  kept('in', { type: 'research', subtype: 'Report', headline: 'Howdy Policy Trivia Night recap', newsletter_issue: '2026-10-27' }),
  kept('ready', { type: 'research', subtype: 'Report', headline: 'Reveille naps through the budget hearing' }),
  kept('gone', { type: 'event', subtype: 'A&M', headline: 'Midnight Yell for school finance', date: '2026-10-21' }),
];
const props = (extra = {}) => ({
  rows, schedule: ['2026-10-20', '2026-10-27', '2026-11-10'], today: '2026-10-23', loaded: true, loadFailed: false,
  busy: false, archive: [{ date: '2026-10-20', file: '2026-10-20.html' }], knownLinks: new Set(),
  onGoTo: () => {}, onAdd: () => {}, onRemove: () => {}, onRestore: () => {}, onTrash: () => {}, onRestoreTrashed: () => {},
  onQuickAdd: () => {}, onRefresh: () => {}, onEditRow: () => {}, ...extra,
});
const draw = extra => { resetIssueEntry(); const container = new Node('div'); renderIssue(container, props(extra)); return container; };

/** Every text, in document order, so "this comes before that" reads straight off the page. */
function reading(node) {
  const out = [];
  const walk = n => { for (const c of n.childNodes) { if (c instanceof Text) out.push(c.text); else walk(c); } };
  walk(node);
  return out.join('');
}
const at = (page, words) => { const i = reading(page).indexOf(words); assert.ok(i >= 0, `the page says "${words}"`); return i; };

test('Next issue leads with its head line: the date, how far off, the builder door at its right, before any list', () => {
  const page = draw().querySelector('.nl-page');
  assert.deepEqual(page.children.map(c => c.className), ['nl-head', 'nl-main', 'nl-side'], 'the head line, then the lists, then the slim column');
  const head = page.querySelector('.nl-head');
  assert.equal(head.tagName, 'SECTION');
  assert.equal(head.querySelector('.nl-date').textContent, 'Oct 27 issue', 'the date names the issue');
  assert.equal(head.querySelector('.nl-sends').textContent, 'Sends in 4 days');
  const door = head.querySelector('.nl-door');
  assert.ok(door, 'the builder door is on the head line');
  assert.equal(door.textContent, 'Open the builder');
  assert.equal(door.href, '/builder/?issue=2026-10-27', 'it still opens the builder on this issue');
  assert.equal(head.children.at(-1), door, 'the door sits at the line\'s right end');
  assert.equal(head.querySelector('.block-label'), null, '"This issue" went into the date: "Oct 27 issue"');
});

test('the later issues stay on the head line as quiet words, and pressing one opens it', () => {
  const container = draw();
  const others = container.querySelector('.nl-head .nl-others');
  assert.ok(others, 'Later: sits under the date');
  assert.equal(others.textContent, 'Later: Nov 10');
  others.querySelector('.linkish').click();
  assert.equal(container.querySelector('.nl-head .nl-date').textContent, 'Nov 10 issue');
  assert.equal(container.querySelector('.nl-head .nl-others').textContent, 'Also: Oct 27');
  assert.equal(container.querySelector('.nl-door').href, '/builder/?issue=2026-11-10');
});

test('then the lists in their order, then the how-tos, the builder note and the last issue', () => {
  const page = draw().querySelector('.nl-page');
  const order = ['Oct 27 issue', 'Sends in 4 days', 'Later: Nov 10', 'Open the builder', 'In this issue', 'Quick add',
    'Howdy Policy Trivia Night recap', 'Ready to add', 'Reveille naps through the budget hearing', 'Past items (1)',
    'How to build an issue', 'The email: read me', 'The builder takes in Adds and Removes each time it opens. Make edits there.', 'Last issue', 'Oct 20'];
  const places = order.map(words => at(page, words));
  assert.deepEqual([...places].sort((a, b) => a - b), places, 'the page reads in this order');
  const side = page.querySelector('.nl-side');
  assert.deepEqual(side.children.map(c => c.className), ['nl-howto', 'nl-howto', 'nl-meta nl-builder-note', 'nl-last']);
  assert.equal(side.querySelector('.nl-howto').href, '/how-to/newsletter/');
  assert.equal(side.querySelectorAll('.nl-howto')[1].href, '/newsletter/read-me/');
  assert.equal(page.querySelector('.nl-main').querySelector('.nl-door'), null, 'no second door down the page');
});

test('the counts stay where they were, on the lists\' own heads', () => {
  const heads = draw().querySelectorAll('.nl-block-head').map(h => [h.querySelector('.block-label').textContent, h.querySelector('.nl-block-count').textContent]);
  assert.deepEqual(heads, [['In this issue', '1'], ['Ready to add', '1']]);
});
