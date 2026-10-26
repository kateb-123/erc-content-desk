// tests/page-corner.test.js: the top right of every page with the sidebar
// (Kate, Oct 24, 2026). Her pick E: today's date as a small gray line in the
// status line's row, College Station's, staying put while the page scrolls.
// Her pick D: a How-tos button just right of it, opening a panel from the
// right over the page, a proper dialog. The panel replaces every how-to link
// that was scattered across the pages; the sidebar's All how-tos and I need
// help! stay, and so do the links inside the how-tos between guides.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const corner = read('js/page-corner.js');
const shellUi = read('js/shell-ui.js');
const shellCss = read('css/shell.css');
const styles = read('css/styles.css');

test('the sidebar brings the corner: every page that draws the sidebar gets the date and the How-tos button', () => {
  assert.match(shellUi, /import \{ renderCorner \} from '\.\/page-corner\.js';/);
  assert.match(shellUi, /renderCorner\(\{ screen \}\)/, 'renderSidebar draws it, told the page it is on');
  // Every page that carries the sidebar draws it through renderSidebar: the desk, the builder, the email's pages, the how-tos.
  const pages = ['index.html', 'builder/index.html', 'newsletter/template/index.html', 'newsletter/sample/index.html', 'newsletter/read-me/index.html',
    ...readdirSync(new URL('../how-to/', import.meta.url), { recursive: true }).filter(f => /(^|\/)index\.html$/.test(f)).map(f => `how-to/${f}`)];
  const drawers = /\/js\/app\.js|js\/app\.js|\/js\/email-page\.js|\/js\/howto-sidebar\.js|renderSidebar\(/;
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<nav class="sidebar" aria-label="Desk"><\/nav>/, `${page} carries the sidebar`);
    assert.match(html, drawers, `${page} draws it`);
  }
  for (const src of ['js/app.js', 'builder/js/app.js', 'js/email-page.js', 'js/howto-sidebar.js']) assert.match(read(src), /renderSidebar/, `${src} draws the sidebar`);
});

test('the date is College Station\'s, in words, and turns over past midnight without a reload', () => {
  assert.match(corner, /import \{ todayCentral, todayWords \} from '\.\/today\.js';/);
  assert.match(corner, /el\('time', 'today-line'\)/, 'a time element');
  assert.match(corner, /setAttribute\('datetime', todayCentral\(/, 'with the date a machine reads');
  assert.match(corner, /setInterval\(paintDate, [\d_]+\)/, 'a clock that keeps it right past midnight');
  assert.match(corner, /visibilitychange/, 'and again when the tab comes back');
});

test('the How-tos button opens a proper dialog: labelled, modal, focus in and back, Escape anywhere', () => {
  assert.match(corner, /el\('button', 'howto-open'\)/);
  assert.match(corner, /'How-tos'/);
  assert.match(corner, /setAttribute\('aria-haspopup', 'dialog'\)/);
  assert.match(corner, /setAttribute\('aria-expanded', /);
  assert.match(corner, /setAttribute\('aria-controls', PANEL_ID\)/);
  assert.match(corner, /el\('dialog', 'howto-panel'\)/, 'the browser\'s own dialog');
  assert.match(corner, /setAttribute\('aria-labelledby', TITLE_ID\)/, 'named by its heading');
  assert.match(corner, /\.showModal\(\)/, 'modal: the page behind is out of reach while it is open, and focus moves in');
  assert.match(corner, /setAttribute\('aria-label', 'Close'\)/, 'X closes it');
  assert.match(corner, /addEventListener\('close', /, 'however it closes');
  assert.match(corner, /opener\.focus\(\)/, 'focus returns to the button');
  assert.match(corner, /addEventListener\('keydown', [\s\S]*?'Escape'/, 'Escape closes it wherever focus is');
});

test('the panel is drawn from the one data module, for the page it is opened on', () => {
  assert.match(corner, /import \{ panelPlace, panelModel \} from '\.\/howto-index\.js';/);
  assert.match(corner, /fill\(body, panelModel\(placeNow\(\)\)\)/, 'drawn as it opens');
  assert.match(corner, /return panelPlace\(\{ screen: screenNow, path: location\.pathname, part, step \}\)/, 'for the page it is on');
  assert.match(corner, /'This page'/, 'the part for this page is tagged');
  assert.match(corner, /\.wizard-step:not\(\[hidden\]\)/, 'the builder\'s step picks its part');
  assert.match(corner, /\.chips a\[aria-current\], \.jump a\[aria-current\]/, 'a how-to\'s part on screen is marked');
});

test('the corner\'s look lives in the stylesheet every page loads; the status line keeps clear of it', () => {
  for (const rule of ['.page-corner', '.today-line', 'button.howto-open', '.howto-panel', '.howto-part', '.howto-here']) {
    assert.ok(shellCss.includes(rule), `css/shell.css styles ${rule}`);
  }
  assert.match(shellCss, /\.page-corner \{[^}]*position: sticky; top: 0;/, 'it stays put while the page scrolls');
  assert.match(shellCss, /prefers-reduced-motion[\s\S]*\.howto-panel/, 'the slide stops under reduced motion');
  // The status line's words and their action end before the corner starts (--corner-w is measured by the corner).
  assert.match(corner, /setProperty\('--corner-w'/);
  assert.match(styles, /\.desk-main > #desk-status \{ padding-right: calc\(var\(--corner-w, \d+px\) \+ var\(--spacing-05\)\); \}/);
  assert.match(styles, /--status-end: calc\(var\(--corner-w, \d+px\) \+ var\(--sort-pad\) \+ var\(--spacing-05\)\)/, 'on Content Sort too, inside the band');
  assert.match(styles, /\.sort-bar \{ padding-right: calc\(var\(--sort-pad\) \+ var\(--corner-w, \d+px\) \+ var\(--spacing-05\)\); \}/, 'and the wait note moves over for it');
});

test('the scattered how-to links are gone from the pages; the panel is the one place', () => {
  const offenders = [];
  for (const f of readdirSync(new URL('../js/', import.meta.url)).filter(n => n.endsWith('.js'))) {
    const src = read(`js/${f}`);
    if (/howToLink/.test(src)) offenders.push(`${f}: howToLink`);
    if (/'How it all connects'/.test(src) && f !== 'howto-index.js') offenders.push(`${f}: How it all connects`);
    // The sidebar's All how-tos and the data module are the two places a how-to's address is written;
    // the team's own submit page, which has no sidebar, keeps its one link.
    if (/['"`]\/how-to\//.test(src) && !['shell-ui.js', 'howto-index.js', 'team-ui.js'].includes(f)) offenders.push(`${f}: a how-to address`);
  }
  assert.deepEqual(offenders, []);
  for (const f of ['index.html', 'builder/index.html', 'team-submit/index.html']) assert.doesNotMatch(read(f), /\/how-to\//, `${f} links no how-to`);
  assert.doesNotMatch(read('js/issue-ui.js'), /nl-howto|\/newsletter\/read-me\//, 'Next issue\'s side column lost its two how-to links');
  assert.doesNotMatch(read('js/hub-head.js'), /howToLink/, 'the helper went with its links');
  assert.match(shellUi, /'All how-tos'/, 'the sidebar keeps All how-tos');
});

test('the team\'s own submit page, which has no sidebar and so no panel, keeps its how-to link; the desk\'s Submit content does not', () => {
  const team = read('js/team-ui.js');
  assert.match(team, /export function renderTeam\(container, \{ onSubmitted, knownLinks, howTo = false \}\)/);
  assert.match(team, /if \(howTo\) \{/);
  assert.match(read('js/team-submit.js'), /render\(container, \{ onSubmitted: refresh, knownLinks: \(\) => rows, howTo: true \}\)/);
  assert.match(read('js/app.js'), /renderTeam\([^)]*\{(?![^}]*howTo)[^}]*\}\)/, 'the desk\'s /#team draws no link: the panel holds it');
});

// The verify pass (Oct 24): the corner's reserve left the status line about 450px at 1024 wide, so an
// ordinary "Added: <title>" with Undo wrapped to a second line and moved the page 26px. A message now
// keeps one line, as on Content Sort: the words end in an ellipsis (the whole message is the line's
// title), and the action keeps its place after them. An empty line stays empty, so :empty still holds.
test('a status message keeps one line beside the corner: the words cut with an ellipsis, the action after them', () => {
  const app = read('js/app.js');
  assert.match(app, /const words = document\.createElement\('span'\);\s*words\.className = 'status-words';/, 'the words in a span of their own');
  assert.match(app, /if \(message\) statusEl\.replaceChildren\(words\);\s*else statusEl\.replaceChildren\(\);/, 'an empty line has no children');
  assert.match(styles, /\.desk-main > #desk-status:not\(:empty\) \{[^}]*display: flex;[^}]*align-items: center;/, 'the words and the action in a row');
  const words = styles.match(/\.desk-main > #desk-status > \.status-words \{([^}]*)\}/)?.[1] ?? '';
  for (const d of [/min-width: 0/, /white-space: nowrap/, /overflow: hidden/, /text-overflow: ellipsis/]) assert.match(words, d, `the words: ${d.source}`);
  assert.match(styles, /\.desk-main > #desk-status > button \{[^}]*flex: none;/, 'the action is never squeezed');
  // Content Sort's band keeps its own one line, a block with the action in a slot of its own.
  assert.match(styles, /\.desk-main:has\(> main > #screen-sort:not\(\[hidden\]\)\) > #desk-status, \.desk-main:has\(> main > #screen-finalize:not\(\[hidden\]\)\) > #desk-status \{[^}]*display: block;/);
});

// The verify pass (Oct 24): a brief's title is the paper's, often long, and its first line ran under
// the date and the How-tos button with 4px to spare.
test('a brief\'s title keeps clear of the corner', () => {
  assert.match(styles, /\.brief-page \.page-title \{ margin-right: calc\(var\(--corner-w, \d+px\) \+ var\(--spacing-05\)\); \}/);
});

// The verify pass (Oct 24): Content Sort's sign-in has no band, so the corner there is every other
// page's: the date shows, 26px down and 40px in. Only the band seats the button alone.
test('the corner sits in Content Sort\'s band only while the band is there, not on its sign-in', () => {
  for (const screen of ['sort', 'finalize']) {
    assert.match(styles, new RegExp(`body:has\\(> \\.desk-main > main > #screen-${screen}:not\\(\\[hidden\\]\\) \\.sort-bar\\) > \\.page-corner[ ,{]`), `${screen}: the button's seat`);
    assert.match(styles, new RegExp(`body:has\\(> \\.desk-main > main > #screen-${screen}:not\\(\\[hidden\\]\\) \\.sort-bar\\) > \\.page-corner \\.today-line`), `${screen}: no date in the band`);
    assert.doesNotMatch(styles, new RegExp(`body:has\\(> \\.desk-main > main > #screen-${screen}:not\\(\\[hidden\\]\\)\\) > \\.page-corner`), `${screen}: no rule for the corner without the band`);
  }
});
