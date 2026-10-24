import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listservStatus } from '../js/listserv-view.js';

// The Listserv hub (Kate's drawn map, Oct 6, 2026): whether the sign-up form
// is live, the last sign-up, how many wait to be added. Counts and dates
// only: the page is open (her pick, Sort alone is locked).

// Since Oct 8 (Kate: "does it keep a live count from the sheet?", her pick)
// the count is Sheet 1's own row count, asked of the sign-up sheet's script
// as the page opens; the desk's copy still gives the last sign-up.
test('listservStatus: live, the last sign-up, and Sheet 1\'s rows right now', () => {
  assert.deepEqual(listservStatus({ live: true, kept: true, sheet: true, waiting: 4, last: '2026-10-04', since: '2026-10-01' }, '2026-10-07'), {
    form: 'Live, taking sign-ups', last: 'Oct 4', waiting: 4, note: 'Rows on Sheet 1, counted as this page opened.', retry: false, updated: '',
  });
  // Her note, Oct 8: the day Sheet 1 was seen cleared is the day the listserv was last updated.
  assert.equal(listservStatus({ live: true, kept: true, sheet: true, waiting: 0, last: '2026-10-06', since: '', updated: '2026-10-08' }, '2026-10-08').updated, 'Oct 8');
});

test('listservStatus: a form not set up, a copy not set up, a sheet that could not be counted, still asking', () => {
  assert.deepEqual(listservStatus({ live: true, kept: true, sheet: true, waiting: 0, last: '', since: '' }, '2026-10-07'),
    { form: 'Live, taking sign-ups', last: 'None yet', waiting: 0, note: 'Rows on Sheet 1, counted as this page opened.', retry: false, updated: '' });
  assert.equal(listservStatus({ live: false, kept: true, sheet: false, waiting: null, last: '', since: '' }, '2026-10-07').form, 'Not set up');
  assert.deepEqual(listservStatus({ live: true, kept: false, sheet: true, waiting: 2, last: '', since: '' }, '2026-10-07'),
    { form: 'Live, taking sign-ups', last: 'Not known', waiting: 2, note: 'Rows on Sheet 1, counted as this page opened.', retry: false, updated: '' }, 'the count needs no desk table');
  assert.deepEqual(listservStatus({ live: true, kept: true, sheet: false, waiting: null, last: '2026-10-06', since: '' }, '2026-10-07'),
    { form: 'Live, taking sign-ups', last: 'Oct 6', waiting: null, note: "Sheet 1 couldn't be counted just now.", retry: true, updated: '' });
  assert.deepEqual(listservStatus(null, '2026-10-07'), { form: 'Checking', last: '', waiting: null, note: '', retry: false, updated: '' });
});

test('the page draws the count\'s note and its Try again from the status', () => {
  const src = readFileSync(new URL('../js/listserv-ui.js', import.meta.url), 'utf8');
  assert.match(src, /s\.note/);
  assert.match(src, /s\.retry/);
  assert.match(src, /Last updated \$\{s\.updated\}/, 'the day the listserv was last updated');
  assert.doesNotMatch(src, /s\.since/, 'the old since line is gone');
});

test('the page draws counts and dates only, and nothing is forthcoming on it (the download was dropped, Kate, Oct 8)', () => {
  const src = readFileSync(new URL('../js/listserv-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\.email\b|\.name\b/, 'never a name or an email');
  assert.doesNotMatch(src, /forthcoming\(|Download the sign-ups/, 'Sheet 1 is the list to add from; no download');
  assert.match(src, /copyLinkButton\(/, 'the form\'s Copy link');
});

// The sign-up sheet (Kate, Oct 8: "we need a button or something that links
// to the google sheet ... they should add people from sheet 1. once they do,
// move the items from sheet 1 to sheet 2 and then clear off sheet 1"). The
// address lives in the code (her pick); the sheet's own sharing guards it.
import { SIGNUP_SHEET, SHEET_STEPS } from '../js/listserv-view.js';
import { hubCards } from '../js/home-panel.js';

test('the sign-up sheet: her address, and the three steps in her order', () => {
  assert.deepEqual(SIGNUP_SHEET, { label: 'Sign-up sheet', href: 'https://docs.google.com/spreadsheets/d/1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E/edit?gid=0#gid=0' });
  assert.deepEqual(SHEET_STEPS, [
    'Add the people on Sheet 1 to the listserv.',
    'Move their rows from Sheet 1 to Sheet 2.',
    'Clear Sheet 1.',
  ]);
  for (const s of SHEET_STEPS) assert.doesNotMatch(s, /[–—]/);
});

test('the Listserv hub has a door to the sheet, opening in a new tab, with the steps under it', () => {
  const src = readFileSync(new URL('../js/listserv-ui.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ listservStatus, SIGNUP_SHEET, SHEET_STEPS \} from '\.\/listserv-view\.js';/);
  assert.match(src, /el\('a', 'sort-door hub-door'\)/, 'the hub\'s filled door');
  assert.match(src, /door\.href = SIGNUP_SHEET\.href; door\.target = '_blank'; door\.rel = 'noopener';/);
  assert.match(src, /'Open the sign-up sheet'/);
  assert.match(src, /SHEET_STEPS\.map\(words => el\('li', '', words\)\)/, 'an ordered list of the steps');
  // Since Oct 23 the door and the steps sit under To be added, right under
  // the count (Kate: a page leads with what its sidebar row counts); the
  // Adding people label of Oct 8 went with the merge.
  assert.match(src, /countBox\.append\(door, steps\)/, 'the door and the steps under the count');
  assert.doesNotMatch(src, /'Adding people'/, 'no section of their own');
});

test('the Listserv card carries the sheet as a link, opening in a new tab', () => {
  const card = hubCards({ rows: [], schedule: [], today: '2026-10-08', loaded: true, signups: { live: true, kept: true, sheet: true, waiting: 0, last: '', since: '' } }).find(c => c.key === 'listserv');
  assert.deepEqual(card.links, [{ label: 'Sign-up sheet', href: SIGNUP_SHEET.href, blank: true }]);
  assert.equal(card.count, 0);
  const uncounted = hubCards({ rows: [], schedule: [], today: '2026-10-08', loaded: true, signups: { live: true, kept: true, sheet: false, waiting: null, last: '', since: '' } }).find(c => c.key === 'listserv');
  assert.equal(uncounted.count, null, 'a sheet that could not be counted leaves the card blank');
});

test('the desk keeps the whole listserv answer, sheet and updated included, so the page can draw them', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /state\.signups = \{ live: data\.live, kept: data\.kept, sheet: data\.sheet, waiting: data\.waiting, last: data\.last, since: data\.since, updated: data\.updated \};/);
});

// The page leads with what its sidebar row counts (Kate, Oct 23: someone who
// clicks Listserv wants the new ones to add first). To be added comes first:
// the count and its lines, then the sheet's door and her three steps right
// under it; the sign-up form follows. The side note and the how-to keep
// their places.
class FakeText { constructor(text) { this.text = String(text); this.parentNode = null; } get textContent() { return this.text; } }
class FakeNode {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.childNodes = []; this.attrs = {}; this.dataset = {}; this.className = ''; this.parentNode = null; }
  get children() { return this.childNodes.filter(n => n instanceof FakeNode); }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(text) { this.childNodes = []; this.append(String(text)); }
  append(...nodes) {
    for (const n of nodes) {
      const node = typeof n === 'string' ? new FakeText(n) : n;
      if (node.parentNode) node.parentNode.childNodes = node.parentNode.childNodes.filter(c => c !== node);
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  prepend(...nodes) { const rest = this.childNodes; this.childNodes = []; this.append(...nodes, ...rest); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener() {}
  hasClass(c) { return this.className.split(/\s+/).includes(c); }
  querySelectorAll(sel) {
    const want = sel.replace(/^\./, '');
    const found = [];
    const walk = node => { for (const c of node.children) { if (c.hasClass(want)) found.push(c); walk(c); } };
    walk(this);
    return found;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}

test('the Listserv page leads with To be added: the count, its lines, the sheet\'s door and the steps, then the sign-up form', async () => {
  globalThis.document ??= { createElement: tag => new FakeNode(tag), createElementNS: (ns, tag) => new FakeNode(tag) };
  const { renderListserv } = await import('../js/listserv-ui.js');
  const container = new FakeNode('div');
  renderListserv(container, { signups: { live: true, kept: true, sheet: true, waiting: 3, last: '2026-10-21', since: '', updated: '2026-10-17' }, today: '2026-10-23', onRetry: () => {} });
  const page = container.querySelector('.hub-page');
  const split = page.querySelector('.qh-split');
  const [main, side] = split.children;
  assert.deepEqual(main.children.map(n => `${n.tagName} ${n.className}`), [
    'H3 section-label hub-label', 'DIV hub-box hub-count',
    'H3 section-label hub-label', 'DIV hub-box',
  ], 'two sections, each a label over its box');
  assert.deepEqual(main.children.filter(n => n.tagName === 'H3').map(n => n.textContent), ['To be added', 'Sign-up form']);
  assert.doesNotMatch(main.textContent, /Adding people/, 'the door and the steps sit under To be added now');

  const added = main.children[1];
  assert.deepEqual(added.children.map(n => n.className), ['hub-numeral', 'hub-count-note', 'hub-count-note', 'sort-door hub-door', 'hub-steps'],
    'the count, its two lines, then the door and the steps right under it');
  assert.equal(added.children[0].textContent, '3');
  assert.equal(added.children[1].textContent, 'Rows on Sheet 1, counted as this page opened.');
  assert.equal(added.children[2].textContent, 'Last updated Oct 17.');
  assert.match(added.children[3].textContent, /Open the sign-up sheet/);
  assert.equal(added.children[3].href, SIGNUP_SHEET.href);
  assert.equal(added.children[3].target, '_blank');
  assert.deepEqual(added.children[4].children.map(li => li.textContent), SHEET_STEPS);

  const form = main.children[3];
  assert.deepEqual(form.children.map(row => row.children[0].textContent), ['Status', 'Last sign-up', 'The form']);
  assert.match(form.children[2].textContent, /Open it .*Copy link/);

  assert.equal(side.textContent, 'Names and addresses are in the sign-up sheet.', 'the side note keeps its place beside the sections');
  assert.equal(page.children.at(-1).className, 'howto-link', 'the how-to stays last');
});

// On a narrow window the side note drops under the boxes (Kate, Oct 23): at
// 1024 wide the 360px column squeezed the boxes to about 310px, so "Live,
// taking sign-ups" ran to three lines and the door's label to two. The fold
// is the Newsletter's, 1232px (1000 plus the sidebar's 232), and it is the
// Listserv's alone: the Content queue's split is left as it is.
test('under 1232px wide the Listserv\'s side note drops under the boxes', () => {
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  const folds = [...css.matchAll(/@media \(max-width: 1232px\) \{([^{}]*\{[^{}]*\})+\s*\}/g)].map(m => m[0]);
  const fold = folds.find(m => m.includes('#screen-listserv .qh-split'));
  assert.ok(fold, 'a 1232px fold for the Listserv\'s split');
  assert.match(fold, /#screen-listserv \.qh-split \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, 'one column');
  assert.doesNotMatch(css, /@media \(max-width: 1232px\) \{\s*(?:[^{}]*,\s*)?\.qh-split \{/, 'the queue\'s split keeps its two columns');
});
