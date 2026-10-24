// tests/sort-look.test.js: Content Sort, and Finalize where it shares Sort's
// list row and card, in Kate's pick A of the looks (Oct 23, 2026, step 3 of 3;
// design/mockups/a-sort.html). The words are pure functions in sort-view.js;
// the DOM is read from the files, the way sort-card.test.js reads it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixWords, rowLine, cardLines, fixContext } from '../js/sort-view.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const uncomment = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const sortUi = read('js/sort-ui.js');
const finalizeUi = read('js/finalize-ui.js');
const styles = uncomment(read('css/styles.css'));
/** Every declaration written for exactly this selector, one string. */
const declsOf = selector => [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(m => m[1].split(',').map(s => s.trim()).includes(selector))
  .map(m => m[2]).join(';');

const TODAY = '2026-10-23';
const item = (extra = {}) => ({ id: 'a', status: 'new', type: 'research', subtype: 'Working Paper', link: 'https://example.org/a', submitted_at: '2026-10-20T15:00:00Z', ...extra });

// ── The words: her line rules (Oct 23) ──

test('fixWords: a row that needs a fix names its problems in the words its card uses', () => {
  const ctx = fixContext([], TODAY);
  assert.deepEqual(fixWords(item(), ctx), []);
  assert.deepEqual(fixWords(item({ type: '', subtype: '' }), ctx), ['Needs a type']);
  assert.deepEqual(fixWords(item({ type: '', subtype: '', link_checked: 'failed' }), ctx), ['Needs a type', 'Check the link']);
  const prior = item({ id: 'p', status: 'kept', submitted_at: '2026-10-01T10:00:00Z' });
  const later = item({ id: 'b', submitted_at: '2026-10-21T10:00:00Z' });
  assert.deepEqual(fixWords(later, fixContext([prior, later], TODAY)), ['Possible duplicate']);
});

test('rowLine: the source leads in the darker words, the authors after it, as in the mockup', () => {
  const ctx = fixContext([], TODAY);
  assert.deepEqual(rowLine(item({ source: 'Annenberg EdWorkingPapers', authors: 'Chen, Rodriguez & Patel' }), ctx, TODAY),
    { lead: 'Annenberg EdWorkingPapers', rest: ['Chen, Rodriguez & Patel'], fix: false });
  assert.deepEqual(rowLine(item({ source: 'Texas Education Agency' }), ctx, TODAY), { lead: 'Texas Education Agency', rest: [], fix: false });
  // No source: the authors stand in once, never twice; the ERC's own source shows nothing.
  assert.deepEqual(rowLine(item({ authors: 'Nguyen & Osei' }), ctx, TODAY), { lead: 'Nguyen & Osei', rest: [], fix: false });
  assert.deepEqual(rowLine(item({ source: 'ERC' }), ctx, TODAY), { lead: '', rest: [], fix: false });
});

test("rowLine: an event leads with its day and an opportunity with its deadline; an outside submission says so", () => {
  const ctx = fixContext([], TODAY);
  assert.deepEqual(rowLine(item({ type: 'event', subtype: 'Off-Campus', date: '2026-10-02', source: 'UT Austin' }), ctx, TODAY),
    { lead: 'Oct 2', rest: ['UT Austin'], fix: false });
  assert.deepEqual(rowLine(item({ type: 'opportunity', subtype: 'Funding & Grants', deadline: '2026-11-01', source: 'IES' }), ctx, TODAY),
    { lead: 'Deadline Nov 1', rest: ['IES'], fix: false });
  assert.deepEqual(rowLine(item({ source: 'Texas Tribune', submitter_email: 'someone@example.org' }), ctx, TODAY),
    { lead: 'Texas Tribune', rest: ['from outside'], fix: false });
});

test('rowLine: a row that needs a fix leads with its problems, then its facts', () => {
  const ctx = fixContext([], TODAY);
  assert.deepEqual(rowLine(item({ type: '', subtype: '', submitter_email: 'x@example.org' }), ctx, TODAY),
    { lead: 'Needs a type', rest: ['from outside'], fix: true });
  assert.deepEqual(rowLine(item({ type: '', subtype: '', link_checked: 'failed' }), ctx, TODAY),
    { lead: 'Needs a type · Check the link', rest: [], fix: true });
  assert.deepEqual(rowLine(item({ link_checked: 'failed', source: 'Texas Tribune' }), ctx, TODAY),
    { lead: 'Check the link', rest: ['Texas Tribune'], fix: true });
});

test("cardLines: the type over the title, the byline, where it is from with its own day, and who added it at the foot", () => {
  assert.deepEqual(cardLines(item({ source: 'Annenberg EdWorkingPapers', authors: 'Chen, Rodriguez & Patel', date: '2026-10-14', submitter: 'MG' }), TODAY), {
    type: 'New research · Working Paper',
    byline: 'Chen, Rodriguez & Patel',
    where: 'Annenberg EdWorkingPapers · Oct 14, 2026',
    added: 'Added Oct 20 by MG',
  });
  // The byline carries the authors, so the line under it never repeats them; the ERC's own source shows nothing.
  assert.equal(cardLines(item({ authors: 'Nguyen & Osei' }), TODAY).where, '');
  assert.equal(cardLines(item({ source: 'ERC', date: '2026-09-01' }), TODAY).where, 'Sep 1, 2026');
  assert.equal(cardLines(item({ type: 'opportunity', subtype: 'Funding & Grants', deadline: '2026-11-01', source: 'IES' }), TODAY).where, 'IES · Deadline Nov 1, 2026');
  // No type yet: the kicker is empty (the Type box and the lock line say it).
  assert.equal(cardLines(item({ type: '', subtype: '' }), TODAY).type, '');
  assert.equal(cardLines(item({ type: 'erc_event', subtype: '' }), TODAY).type, 'ERC event');
  assert.equal(cardLines(item({ submitter: '' }), TODAY).added, 'Added Oct 20');
  assert.equal(cardLines(item({ submitted_at: '', submitter: 'KB' }), TODAY).added, 'Added by KB');
  assert.equal(cardLines(item({ submitted_at: '', submitter: '' }), TODAY).added, '');
});

// ── The page: a toolbar band, the list pane, the card and the decision column ──

test('Sort and Finalize draw their head as the toolbar band, the tabs a segmented control', () => {
  for (const [name, src] of [['sort-ui', sortUi], ['finalize-ui', finalizeUi]]) {
    assert.match(src, /const bar = sortPageHead\(\{[\s\S]*?\}\);\s*bar\.classList\.add\('sort-bar'\);/, `${name} marks its head as the band`);
  }
  const band = declsOf('.sort-bar');
  assert.match(band, /background:\s*var\(--gray-50\)/, "a toolbar's ground");
  assert.match(band, /border-bottom:\s*1px solid var\(--sidebar-line\)/);
  assert.match(band, /min-height:\s*56px/);
  assert.match(declsOf('.sort-bar .tabs'), /background:\s*var\(--gray-200\)/, 'the grey track');
  assert.match(declsOf('.sort-bar .tab.is-active'), /background:\s*var\(--layer-02\)/, 'the lit segment is white');
  // Newsletter and the queue keep their own tab row: every band rule is scoped.
  assert.doesNotMatch(styles, /^\.tabs\s*\{[^}]*background/m);
});

test('Sort and Finalize run edge to edge beside the sidebar, and the status line speaks inside the band', () => {
  for (const screen of ['sort', 'finalize']) {
    const sel = `.desk-main:has(> main > #screen-${screen}:not([hidden]))`;
    assert.ok(styles.includes(sel), `${screen} widens the column`);
  }
  const wide = styles.match(/\.desk-main:has\(> main > #screen-sort:not\(\[hidden\]\)\)[^{]*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(wide, /max-width:\s*none/);
  assert.match(wide, /padding:\s*0/);
  // The status keeps its one slot (a message never moves the page) and stays in view down a long list.
  const status = styles.match(/\.desk-main:has\(> main > #screen-sort:not\(\[hidden\]\)\) > #desk-status[^{]*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(status, /grid-row:\s*2/);
  assert.match(status, /position:\s*sticky/);
  assert.match(styles.match(/\.desk-main:has\(> main > #screen-sort:not\(\[hidden\]\)\) > main[^{]*\{([^}]*)\}/)?.[1] ?? '', /grid-row:\s*2/);
});

test('the list is a white pane with soft rows; the chosen row is the blue fill in white words', () => {
  const pane = declsOf('.sort-list');
  assert.match(pane, /background:\s*var\(--layer\)/);
  assert.match(pane, /border-right:\s*1px solid var\(--sidebar-line\)/);
  assert.match(declsOf('.sort-row'), /border-radius:\s*var\(--radius\)/);
  const chosen = declsOf('.sort-row.is-selected');
  assert.match(chosen, /background(-color)?:\s*var\(--accent\)/);
  assert.match(chosen, /color:\s*var\(--text-on-color\)/);
  // On the blue fill the inside ring would vanish: there it is a white line inside, as on a picked type.
  assert.match(declsOf('.sort-list .sort-row.is-selected:focus-visible'), /box-shadow:\s*inset 0 0 0 2px var\(--text-on-color\)/);
});

test('a list row: the title with the day it came in at its right, then one line led by its first fact, the tag at its end', () => {
  const fn = sortUi.match(/function listRow\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(fn, /rowLine\(row, ctx, props\.today\)/, "the line is sort-view's");
  assert.match(fn, /el\('span', 'sort-row-date', isoToShort\(row\.submitted_at, props\.today\)\)/);
  assert.match(fn, /`sort-row-lead\$\{line\.fix \? ' is-fix' : ''\}`/, 'a problem leads in the warning words');
  assert.match(fn, /el\('span', 'badge sort-row-tag', tag\)/);
  const order = ['sort-row-title', 'sort-row-date', 'sort-row-lead', 'sort-row-tag'].map(c => fn.indexOf(c));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'title, its day, the line, the tag');
  assert.ok(order.every(i => i > 0));
  // The triangle keeps its reasons as the tooltip; a row without one keeps its words in line with the rest.
  assert.match(fn, /mark\.title = reasons\.join\(' · '\)/);
  assert.match(fn, /item\.classList\.add\('has-mark'\)/);
  assert.match(declsOf('.sort-row-lead.is-fix'), /color:\s*var\(--warn\)/);
  assert.match(declsOf('.sort-row-line'), /white-space:\s*nowrap/, 'a line never wraps');
});

test("a group's head names it, its count in grey, and Dismiss all at its right", () => {
  assert.match(sortUi, /head\.append\(el\('span', 'sort-list-count', label\)\);\s*head\.lastChild\.append\(' ', el\('span', 'sort-group-count', String\(rows\.length\)\)\)/);
  assert.doesNotMatch(sortUi, /`\$\{label\} · \$\{rows\.length\}`/);
});

test("the card reads in the mockup's order: type and place, title, byline, where from, link, notes, words, tools, fields, foot", () => {
  const fn = sortUi.match(/function sortCard\([\s\S]*?\n\}/)?.[0] ?? '';
  const marks = ["'sc-kicker'", "'sort-card-pos'", "'headline', props, { grow: true }", "'sc-byline'", "'sc-where'", 'linkLine(row, props, rerender)', 'linkNote(row, props, rerender)', "'Possible duplicate'", 'descriptionBlock(row, props, rerender)', "'card-grid'", "'sc-foot'"];
  const at = marks.map(m => fn.indexOf(m));
  at.forEach((i, n) => assert.ok(i > 0, `the card builds ${marks[n]}`));
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in that order');
  assert.match(fn, /const lines = cardLines\(row, props\.today\)/);
  // The item is one white box; the decisions are a column of their own beside it.
  assert.match(fn, /const left = el\('article', 'sc-left'\)/);
  assert.match(fn, /const right = el\('aside', 'sc-right'\)/);
  assert.match(fn, /right\.setAttribute\('aria-label', 'Decision'\)/);
  const box = declsOf('.sc-left');
  assert.match(box, /background:\s*var\(--layer\)/);
  assert.match(box, /border-radius:\s*var\(--radius-card\)/);
  assert.match(box, /box-shadow:\s*var\(--shadow-card\)/);
});

test('the link shows as its domain on a quiet pill, Change beside it', () => {
  const fn = sortUi.match(/function linkLine\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(fn, /el\('a', 'sc-link-pill', domainOf\(href\)\)/);
  assert.match(fn, /button\('Change', 'linkish sc-change'/);
  assert.match(declsOf('.sc-link-pill'), /background:\s*var\(--layer-accent-01\)/);
});

test('the description reads as prose with no label over it, and Edit and Add media are small outline buttons', () => {
  const fn = sortUi.match(/function descriptionBlock\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(fn, /'card-field-label', 'Description'/);
  assert.match(fn, /ta\.setAttribute\('aria-label', 'Description'\)/, 'the field still has its name');
  assert.match(fn, /button\(' Edit', 'sc-tool', \{ focus: 'desc-edit', icon: 'pen'/);
  assert.match(declsOf('.sc-words .sc-tool'), /height:\s*32px/);
  assert.match(declsOf('.sc-words .media-add'), /border:\s*1px solid var\(--accent-line\)/);
});

test('the type box: one row a type, the picked one bold with a check, its subtypes as pills right under it', () => {
  const fn = sortUi.match(/function typeBlock\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(fn, /if \(picked\) b\.append\(lineIcon\('check', 'type-check'\)\)/);
  assert.match(fn, /if \(picked && !typeIsFlat\(t\)\) stack\.append\(subtypeChips\(row, t, props\)\)/, 'the chips sit under their type');
  assert.doesNotMatch(fn, /'Subtype'\)\);/, 'no label over the chips');
  assert.match(sortUi, /chips\.setAttribute\('role', 'group'\);\s*chips\.setAttribute\('aria-label', 'Subtype'\)/);
  assert.match(declsOf('.type-opt.is-picked'), /font-weight:\s*600/);
  assert.match(declsOf('.type-chip.is-picked'), /background:\s*var\(--button-primary\)/);
  // The box clips its rows' corners, so a row's ring is drawn inside.
  assert.match(declsOf('.sc-type-box .type-opt:focus-visible'), /box-shadow:\s*inset 0 0 0 2px var\(--focus\)/);
});

test('ERC Newsletter only is a switch in a box of its own, its line under it; the box still saves on change', () => {
  const fn = sortUi.match(/function sendToBlock\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(fn, /input\.type = 'checkbox';/);
  assert.match(fn, /input\.setAttribute\('role', 'switch'\)/);
  assert.match(fn, /input\.addEventListener\('change'/);
  assert.match(fn, /el\('legend', 'sr-only', 'Send it to'\)/);
  assert.match(declsOf('.card-send input[role="switch"]'), /appearance:\s*none/);
  assert.match(declsOf('.card-send input[role="switch"]:checked'), /background:\s*var\(--accent\)/);
});

test('Keep and next, Skip for now and Delete each show their key, hidden from assistive tech; the tooltips still name them', () => {
  assert.match(sortUi, /function keyChip\(key\) \{\s*const k = el\('kbd', 'sc-key', key\);\s*k\.setAttribute\('aria-hidden', 'true'\);/);
  for (const [word, key] of [['keep', 'K'], ['skip', 'S'], ['del', 'D']]) {
    assert.match(sortUi, new RegExp(`${word}\\.append\\(keyChip\\('${key}'\\)\\)`), `${word} shows ${key}`);
  }
  assert.match(sortUi, /keep\.title = blocked \|\| 'Keep and next \(K\)'/);
  assert.match(sortUi, /skip\.title = 'Skip for now \(S\)'/);
  assert.match(sortUi, /del\.title = 'Delete \(D\)'/);
  assert.match(declsOf('.sort-card .sc-skip'), /background:\s*var\(--gray-200\)/, 'Skip for now is the grey fill');
});

test("Finalize's list is Sort's pane and its card Sort's white box", () => {
  assert.match(declsOf('.f-list'), /background:\s*var\(--layer\)/);
  assert.match(declsOf('.f-list'), /border-right:\s*1px solid var\(--sidebar-line\)/);
  assert.match(declsOf('.f-card'), /border-radius:\s*var\(--radius-card\)/);
  assert.match(declsOf('.f-card'), /box-shadow:\s*var\(--shadow-card\)/);
  assert.match(declsOf('.f-list-row'), /border-radius:\s*var\(--radius\)/);
  assert.match(declsOf('.f-list-row.is-selected'), /background(-color)?:\s*var\(--accent\)/);
  // The list sits down the left, flush with the sidebar, the head and the card beside it.
  assert.match(styles, /#screen-finalize:has\(> \.f-split\)[^{]*\{[^}]*grid-template-columns:\s*var\(--sort-list-w\) minmax\(0, 1fr\)/);
});

test('every new Sort rule reads tokens and the spacing scale: no shadow but the whisper', () => {
  const block = read('css/styles.css').split('/* ── Content Sort in pick A')[1]?.split('/* ── end of Content Sort in pick A')[0] ?? '';
  assert.ok(block.length > 2000, 'the block is marked');
  const shadows = [...uncomment(block).matchAll(/box-shadow:\s*([^;]+);/g)].map(m => m[1].trim());
  for (const s of shadows) assert.match(s, /^(none|var\(--shadow-card\)|var\(--focus-ring\)|inset 0 0 0 2px var\(--[\w-]+\))$/, s);
});

// ── The review of step 3 (Oct 23): the status line inside the band, the
// chosen row's small words at 4.5:1, and both marks kept in forced colours ──

const tokensCss = uncomment(read('css/tokens.css'));
/** A custom property's final value, following var() chains through tokens.css and styles.css. */
function token(name) {
  const m = (tokensCss + styles).match(new RegExp(`(?<![\\w-])${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`no ${name}`);
  const ref = m[1].trim().match(/^var\((--[\w-]+)\)$/);
  return ref ? token(ref[1]) : m[1].trim();
}
const px = value => {
  const ref = value.trim().match(/^var\((--[\w-]+)\)$/);
  return parseFloat(ref ? token(ref[1]) : value);
};
function contrast(a, b) {
  const lum = h => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const FORCED = /@media \(forced-colors: active\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g;
const sortBlock = uncomment(read('css/styles.css').split('/* ── Content Sort in pick A')[1]?.split('/* ── end of Content Sort in pick A')[0] ?? '');
/** declsOf over some CSS of my choosing: the page as drawn (forced colours left out), or the forced-colours rules alone. */
const declsIn = (css, selector) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(m => m[1].split(',').map(s => s.trim()).includes(selector))
  .map(m => m[2]).join(';');
const drawn = styles.replace(FORCED, '');
const forced = [...sortBlock.matchAll(FORCED)].map(m => m[0].replace(/^@media[^{]*\{/, '').replace(/\}\s*$/, '')).join('\n');
const colorOf = body => body.match(/(?<![\w-])color:\s*var\((--[\w-]+)\)/)?.[1];

test('the status line fits its slot in the band: one line, 24px tall in the middle of the 56px, the words cut with an ellipsis', () => {
  for (const screen of ['sort', 'finalize']) {
    const sel = `.desk-main:has(> main > #screen-${screen}:not([hidden])) > #desk-status`;
    const s = declsIn(drawn, sel);
    assert.match(s, /white-space:\s*nowrap/, `${screen}: one line`);
    assert.match(s, /overflow:\s*hidden/);
    assert.match(s, /text-overflow:\s*ellipsis/, 'a long title ends in an ellipsis');
    assert.match(s, /justify-self:\s*start/, 'as wide as its words, so the action follows them');
    assert.match(s, /max-width:\s*calc\(100% - var\(--status-start\) - var\(--status-end\)\)/, 'and never past the wait at the right');
    const height = px(s.match(/(?<![\w-])height:\s*([^;]+);?/)[1]);
    const top = px(s.match(/margin(?:-top)?:\s*(var\(--[\w-]+\)|[\d.]+px)/)[1]);
    assert.equal(px(s.match(/line-height:\s*([^;]+);?/)[1]), height, 'the words sit in the middle of the line');
    assert.equal(top * 2 + height, px(declsOf('.sort-bar').match(/min-height:\s*([^;]+)/)[1]), 'as much band over it as under it');
  }
});

test("the status line's action keeps a slot of its own at the right, the band's height, so Undo or Try again is never cut", () => {
  for (const screen of ['sort', 'finalize']) {
    const sel = `.desk-main:has(> main > #screen-${screen}:not([hidden])) > #desk-status`;
    assert.match(declsIn(drawn, `${sel}:has(> button)`), /--status-act:\s*var\(--spacing-09\)/, 'Undo: 48px');
    assert.match(declsIn(drawn, `${sel}.status-error:has(> button)`), /--status-act:\s*calc\(var\(--spacing-10\) \+ var\(--spacing-05\)\)/, 'Try again and Retry now: 80px');
    assert.match(declsIn(drawn, sel), /padding-right:\s*var\(--status-act\)/, 'the words stop short of it');
    const act = declsIn(drawn, `${sel} > button`);
    assert.match(act, /position:\s*absolute/);
    assert.match(act, /right:\s*0/);
    assert.match(act, /min-width:\s*var\(--status-act\)/);
    assert.match(act, /height:\s*24px/, "the line's own height, not a second line");
    assert.match(act, /background:\s*var\(--gray-50\)/, "the band's ground, so a wider word covers the words' end");
    // The line clips anything drawn outside it, so the ring is drawn inside, as in the lists.
    assert.match(declsIn(drawn, `${sel} > button:focus-visible`), /box-shadow:\s*inset 0 0 0 2px var\(--focus\)/);
  }
});

test("the chosen row's day, its second line and its tag read at 4.5:1 or better on the blue fill", () => {
  const ground = declsIn(drawn, '.sort-row.is-selected').match(/background:\s*var\((--[\w-]+)\)/)?.[1];
  assert.equal(ground, '--accent');
  assert.equal(declsIn(drawn, '.f-list-row.is-selected').match(/background:\s*var\((--[\w-]+)\)/)?.[1], ground);
  for (const sel of ['.sort-row.is-selected .sort-row-date', '.sort-row.is-selected .sort-row-meta', '.sort-row.is-selected .sort-row-lead', '.f-list-row.is-selected .f-row-type']) {
    const ink = colorOf(declsIn(drawn, sel));
    assert.ok(ink, `${sel} names its colour`);
    const ratio = contrast(token(ink), token(ground));
    assert.ok(ratio >= 4.5, `${sel}: ${ink} on ${ground} is ${ratio.toFixed(2)}:1`);
  }
  const tag = declsIn(drawn, '.sort-row.is-selected .sort-row-tag');
  const tagGround = tag.match(/background:\s*var\((--[\w-]+)\)/)[1];
  assert.ok(contrast(token(colorOf(tag)), token(tagGround)) >= 4.5, 'the tag on the chosen row');
});

test('in forced colours the chosen row keeps a Highlight edge, every row the same edge in the page colour, the ring inside it', () => {
  assert.ok(forced.length > 200, 'the Sort block has a forced-colours block');
  for (const row of ['.sort-row', '.f-list-row']) {
    assert.match(declsIn(forced, row), /border:\s*2px solid Canvas/, `${row}: an edge that cannot be seen, so choosing one moves nothing`);
    assert.match(declsIn(forced, `${row}:hover:not(:disabled)`), /border:\s*2px solid Canvas/, 'the hover keeps it');
    assert.match(declsIn(forced, `${row}.is-selected`), /border-color:\s*Highlight/, `${row}: the chosen one`);
    assert.match(declsIn(forced, `${row}.is-selected:hover:not(:disabled)`), /border-color:\s*Highlight/);
  }
  // The focus line is the text colour, 2px inside the edge, so a chosen row that has focus shows both.
  for (const sel of ['.sort-list .sort-row:focus-visible', '.f-list .f-list-row:focus-visible']) {
    assert.match(declsIn(forced, sel), /outline-offset:\s*-6px/, `${sel}: inside the chosen edge, a gap between`);
    assert.match(declsIn(forced, sel), /outline-color:\s*CanvasText/);
  }
});

test('in forced colours the ERC Newsletter only switch keeps its track, its knob and which way it is set', () => {
  const sw = '.card-send input[role="switch"]';
  assert.match(declsIn(forced, sw), /border:\s*1px solid ButtonText/, 'the track');
  assert.match(declsIn(forced, sw), /background-color:\s*ButtonFace/);
  assert.match(declsIn(forced, `${sw}::before`), /background-color:\s*ButtonText/, 'the knob');
  assert.match(declsIn(forced, `${sw}:checked`), /background-color:\s*Highlight/, 'on: the track fills');
  assert.match(declsIn(forced, `${sw}:checked`), /border-color:\s*Highlight/);
  assert.match(declsIn(forced, `${sw}:checked::before`), /background-color:\s*HighlightText/);
  assert.match(declsIn(forced, `${sw}:focus-visible`), /outline-offset:\s*2px/, 'the focus line stands off the track');
  // The knob still fits inside the track's new edge, on both sides.
  const knob = declsIn(forced, `${sw}::before`);
  const size = px(knob.match(/(?<![\w-])width:\s*([^;]+)/)[1]);
  const inset = px(knob.match(/(?<![\w-])top:\s*([^;]+)/)[1]);
  const track = declsIn(styles.replace(FORCED, ''), sw);
  const inner = px(track.match(/(?<![\w-])height:\s*([^;]+)/)[1]) - 2;
  assert.equal(inset * 2 + size, inner, 'as much track over the knob as under it');
  const travel = px(declsIn(drawn, `${sw}:checked::before`).match(/translateX\(([^)]+)\)/)[1]);
  assert.equal(inset * 2 + size + travel, px(track.match(/(?<![\w-])width:\s*([^;]+)/)[1]) - 2, 'and on, as much at its right as at its left');
});

test('the forced-colours rules use system colours alone: a token or a hex would be forced away', () => {
  const bodies = [...forced.matchAll(/\{([^{}]*)\}/g)].map(m => m[1]).join(';');
  assert.doesNotMatch(bodies, /var\(--[\w-]*(color|accent|text|layer|gray|blue|line)/i);
  assert.doesNotMatch(bodies, /#[0-9a-f]{3,8}\b/i);
});

// Review of the review (Oct 23): a cut message keeps its full words on hover, and the
// band's right reserve holds only while a wait note is there to protect.
test('a status message carries its full words as a title, so an ellipsis hides nothing for good', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /statusEl\.title = message;/);
});

test('the status line reserves the right end only when the band has a wait note', () => {
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  assert.match(css, /#desk-status \{[^}]*--status-end: 0px;/, 'no reserve by default');
  assert.match(css, /\.desk-main:has\(> main > #screen-sort:not\(\[hidden\]\) \.page-tabs-note\) > #desk-status, \.desk-main:has\(> main > #screen-finalize:not\(\[hidden\]\) \.page-tabs-note\) > #desk-status \{ --status-end: 200px; \}/, 'the reserve only beside a note');
});
