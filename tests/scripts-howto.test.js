// tests/scripts-howto.test.js: Bring back the Google scripts as the walkthrough
// of docs/scripts-walkthrough-brief.md (Oct 26, 2026), for a teammate who is
// not a developer and never opens GitHub. The deck keeps the how-tos' idiom
// (the parts as chips, one slide per group of steps, Back and Next) with the
// brief's parts in its order, and each script's whole code sits on the page
// at the step that pastes it: a box read from apps-script/ at build time,
// byte for byte, with a Copy button. The desk guide never carries the code;
// it says where the box is.
// Since the owner's verdict on the first version (Oct 26, 1 am: "that is all
// too wordy. she's not going to read all that. she needs to know what to
// open, a screenshot of it in google, what to click, what to type in"), every
// step of the two scripts is a real Google screen, the owner's own
// screenshots of a test copy, with numbered pins on the thing to click or
// type into and one short line per pin. Words stay only where no screen
// exists: before you start, Google's permission window, sending the
// addresses, the checks, the traps and Later.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { GUIDES, SCREEN_GUIDES, partHref } from '../js/howto-index.js';
import { BRING_BACK } from '../js/listserv-view.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const deck = JSON.parse(read('how-to/google-scripts/deck.json'));
const page = read('how-to/google-scripts/index.html');
const guide = read('how-to/desk-guide.txt');
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = t => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// A chapter runs to the next one's banner, or to the Styles section after the last (its steps are sections too).
const chapter = id => {
  const from = page.indexOf(`<section class="chapter" id="${id}"`);
  assert.ok(from >= 0, `the part ${id}`);
  const next = page.indexOf('<!-- =====', from + 1);
  return page.slice(from, next >= 0 ? next : page.indexOf('<section class="styles"', from));
};
const slidesOf = id => chapter(id).split(/<div class="slide[ "]/).slice(1);
const chapterOf = id => deck.chapters.find(c => c.id === id);
const boxes = [...page.matchAll(/<pre class="code-pre"([^>]*)><code>([\s\S]*?)<\/code><\/pre>/g)].map(m => ({
  attrs: Object.fromEntries([...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])),
  html: m[2],
}));
const outsideCode = page.replace(/<pre class="code-pre"[^>]*>[\s\S]*?<\/pre>/g, '');
const scriptsGuide = (() => {
  const from = guide.indexOf('\n# Bring back the Google scripts\n');
  return guide.slice(from, guide.indexOf('\n# ', from + 1));
})();
const shotsDir = new URL('../how-to/google-scripts/shots/', import.meta.url);
const shotMeta = name => JSON.parse(readFileSync(new URL(`${name}.json`, shotsDir), 'utf8'));
const pngSize = name => { const png = readFileSync(new URL(`${name}.png`, shotsDir)); return [png.readUInt32BE(16), png.readUInt32BE(20)]; };
// The page's visible words: no script, style or code box, no pin bubble (it says its row's words) and no label.
const visibleWords = html => unesc(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<pre class="code-pre"[\s\S]*?<\/pre>/g, ' ').replace(/<span class="tip"[^>]*>[^<]*<\/span>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

test('the parts are the brief\'s, in its order, and the panel names them', () => {
  assert.deepEqual(deck.chapters.map(c => [c.id, c.name]), [
    ['before', 'Before you start'],
    ['script-1', 'Script 1: the desk'],
    ['script-2', 'Script 2: the sign-up'],
    ['send', 'Send the two addresses'],
    ['check', 'Check it worked'],
    ['wrong', 'If something goes wrong'],
    ['later', 'Later: Add a source'],
  ]);
  assert.deepEqual(GUIDES.find(g => g.id === 'scripts').parts, deck.chapters.map(c => [c.name, c.id]));
  assert.deepEqual(deck.chapters.map(c => c.step), [null, 1, 2, 3, 4, null, null], 'the four steps the teammate does are numbered');
  assert.equal(deck.h1, 'Bring back the Google scripts');
  assert.doesNotMatch(page, /id="redeploy"|id="sheets"/, 'the old parts are gone');
});

test('the Listserv\'s Down link lands on Script 2, the sign-up script, and the panel opens Listserv at Check it worked', () => {
  assert.deepEqual(BRING_BACK, { label: 'How to bring it back', href: '/how-to/google-scripts/#script-2' });
  assert.equal(partHref('scripts', 'script-2'), '/how-to/google-scripts/#script-2');
  assert.match(page, /<section class="chapter" id="script-2"/);
  assert.deepEqual(SCREEN_GUIDES.listserv, ['scripts', 'check']);
  assert.equal(partHref('scripts', 'redeploy'), '', 'no part is called Redeploy any more');
});

// ── The screens (the owner's verdict, Oct 26) ──

// The owner's 30 screenshots were taken in her own Chrome on a throwaway Sheet
// and project (1280 by 663; the Sheet's menu at 1424 by 703; the small error
// log at 640 by 332), the deployment id and address already blurred. The
// Listserv still is the desk's own capture (2x).
const OWNERS_SIZES = ['1280x663', '1424x703', '640x332'];
const stillsOf = id => chapterOf(id).slides.filter(s => s.shot).map(s => s.shot);
const GOOGLE_STILLS = [...new Set(deck.chapters.flatMap(c => c.slides.filter(s => s.shot && s.shot !== 'listserv').map(s => s.shot)))];

test('every step of the two scripts is a real Google screen or a code box; words only for the permission window and the differences', () => {
  for (const [id, words] of [['script-1', ["Google's permission window opens in its own tab."]], ['script-2', ['The same screens as script 1, with these differences.']]]) {
    const slides = chapterOf(id).slides;
    assert.ok(slides.length >= 10, `${id}: a slide per screen (${slides.length})`);
    const wordy = slides.filter(s => s.steps);
    assert.deepEqual(wordy.map(s => s.cap), words, `${id}: the one slide of words`);
    for (const s of slides) assert.ok(s.shot || s.kind === 'code' || s.steps, `${id}: a slide that is neither a screen, a code box nor the one of words: ${s.cap}`);
    for (const s of slides.filter(x => x.shot)) assert.ok(!(s.notes ?? []).some(n => /^\d+$/.test(String(n.n ?? ''))), `${id}, ${s.shot}: the pins are the steps; no note repeats one`);
  }
  assert.equal(stillsOf('script-1').length, 16, 'script 1: sixteen screens');
  assert.equal(stillsOf('script-2').length, 10, 'script 2: ten screens');
  assert.ok(GOOGLE_STILLS.length >= 20, `the Google screens (${GOOGLE_STILLS.length})`);
});

test('every Google still is one of the owner\'s screenshots, drawn at its own size, its crop inside the picture, never blown up past its pixels', () => {
  for (const name of GOOGLE_STILLS) {
    const m = shotMeta(name);
    const [w, h] = pngSize(name);
    assert.ok(OWNERS_SIZES.includes(`${w}x${h}`), `${name}: ${w}x${h} is not one of the owner's screenshots`);
    assert.deepEqual([m.iw, m.ih], [w, h], `${name}: the pin file knows the picture's size`);
    assert.ok(m.cx >= 0 && m.cy >= 0 && m.cx + m.cw <= m.iw && m.cy + m.ch <= m.ih, `${name}: the crop stays inside the picture`);
    assert.ok(m.cw >= 558 || m.ch >= 470, `${name}: a crop of ${m.cw}x${m.ch} would be drawn larger than its pixels`);
    assert.ok(m.alt && m.alt.length >= 40, `${name}: words for a screen reader`);
    assert.ok(page.includes(`<img src="shots/${name}.png" width="${m.iw}" height="${m.ih}"`), `${name}: on the page at its own size`);
  }
});

test('every pin sits inside its still, on a control, and says one short line', () => {
  for (const name of GOOGLE_STILLS) {
    const m = shotMeta(name);
    assert.ok(m.pins.length >= 1 && m.pins.length <= 5, `${name}: ${m.pins.length} pins`);
    for (const p of m.pins) {
      assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, `${name}: "${p.label}" is off the picture (${p.x}, ${p.y})`);
      assert.ok(p.label.length <= 100, `${name}: a pin's line runs long (${p.label.length}): ${p.label}`);
      assert.doesNotMatch(p.label, /[–—]|\n/, `${name}: one line, no dash`);
    }
  }
});

test('script 2 reuses script 1\'s screens, and the two it words differently are the same pictures', () => {
  const one = new Set(stillsOf('script-1'));
  const shared = stillsOf('script-2').filter(s => one.has(s));
  assert.deepEqual(shared, ['extensions', 'code-saved', 'run', 'authorize', 'deploy-menu', 'deploy-type', 'deploy-access', 'deploy-done'], 'the screens that differ in nothing but the words');
  for (const [copy, of] of [['s2-editor', 'editor'], ['s2-function-menu', 'function-menu']]) {
    assert.ok(readFileSync(new URL(`${copy}.png`, shotsDir)).equals(readFileSync(new URL(`${of}.png`, shotsDir))), `${copy} is ${of}, pinned with script 2's words`);
    assert.ok(stillsOf('script-2').includes(copy));
  }
  assert.ok(shotMeta('s2-function-menu').pins.some(p => /waitingCount/.test(p.label)), 'the function menu names waitingCount');
  assert.ok(shotMeta('s2-editor').pins.some(p => /Listserv sign-up/.test(p.label)), 'a new project is named');
});

test('the first slide says once that the pictures show a test copy, and no placeholder or Unconfirmed paragraph is left', () => {
  const line = 'Your Sheet is called erc-content-desk and its project ends with Sheet API; the pictures show a test copy.';
  assert.ok(slidesOf('before')[0].includes(line), 'on the first slide');
  assert.equal(page.split(line).length - 1, 1, 'once');
  assert.doesNotMatch(visibleWords(page).join(' '), /Your screenshot|Unconfirmed/, 'real screens, no hedges');
  assert.doesNotMatch(page, /<div class="frame">\s*<\/div>|class="placeholder"/, 'no empty box');
});

// The verdict in numbers: the page of Oct 26 morning carried 3,362 visible
// words (code boxes aside); the screens with pins carry well under 2,400.
test('the page is pictures, not paragraphs: its visible words stay under the cap, and no line beside a screen runs long', () => {
  const words = visibleWords(page);
  assert.ok(words.length <= 2400, `visible words (${words.length})`);
  for (const [, row] of page.matchAll(/<p class="note"><span class="n">\d+<\/span><span>([\s\S]*?)<\/span><\/p>/g)) {
    const plain = unesc(row.replace(/<[^>]+>/g, ''));
    assert.ok(plain.length <= 130, `a line beside a screen runs long (${plain.length}): ${plain}`);
  }
});

test('a part of more than eight slides counts its slides instead of a dot for each', () => {
  assert.ok(chapterOf('script-1').slides.length > 8);
  assert.match(page, /<div class="deck"[^>]*data-dots="count"/, 'the deck counts');
  assert.match(page, /<style data-count>[\s\S]*\.deck\[data-dots="count"\] \.dots::after \{ content: 'of ' counter\(dot\); \}/, 'the count by CSS counters');
  for (const d of ['sort', 'newsletter', 'exchange']) assert.doesNotMatch(read(`how-to/${d}/index.html`), /data-dots="count"|<style data-count>/, `${d} keeps its dots`);
});

// ── The code boxes, unchanged ──

test('each script\'s whole code is on the page at the step that pastes it, byte for byte, HTML-escaped, no coloring, no line numbers', () => {
  const files = { 'apps-script/Code.gs': 'script-1', 'apps-script/listserv-count.gs': 'script-2' };
  const fromFiles = boxes.filter(b => b.attrs['data-file']);
  assert.deepEqual(fromFiles.map(b => b.attrs['data-file']), Object.keys(files), 'the desk script, then the sign-up script');
  for (const box of fromFiles) {
    const file = box.attrs['data-file'];
    const code = read(file);
    assert.ok(!/\r/.test(code), `${file} has no carriage returns`);
    assert.equal(box.html, esc(code), `${file}: the box is the file, escaped`);
    assert.equal(unesc(box.html), code, `${file}: what the browser shows is the file`);
    assert.doesNotMatch(box.html, /<|class="ln"/, `${file}: plain text, no coloring, no line numbers`);
    const lines = code.split('\n').length - 1;
    assert.equal(box.attrs['data-lines'], String(lines));
    assert.equal(box.attrs['data-part'], files[file], `${file}: in the part that pastes it`);
    assert.ok(chapter(files[file]).includes(`data-file="${file}"`), `${file}: inside its part`);
    const first = code.split('\n')[0];
    const last = code.trimEnd().split('\n').at(-1);
    const slide = slidesOf(files[file]).find(s => s.includes(`data-file="${file}"`));
    assert.ok(slide.includes(`It starts with <code>${esc(first)}</code> and ends with <code>${esc(last)}</code>.`), `${file}: the first and last line named under the box`);
    assert.ok(slide.includes(`${lines} lines`), `${file}: the line count`);
    assert.match(slide, /This code is a copy from the desk's repository on [A-Z][a-z]{2} \d{1,2}, \d{4}\./, `${file}: the copy's date`);
    assert.match(slide, /<button type="button" class="code-copy"[^>]*>[\s\S]*?Copy<\/button>/, `${file}: a Copy button`);
    assert.match(slide, /<p class="note"><span class="n">1<\/span><span><b>Copy<\/b>/, `${file}: Copy is the box's first step`);
  }
  // The box's text is the file's, never a hand copy: deck.json names the file alone.
  assert.doesNotMatch(read('how-to/google-scripts/deck.json'), /function doPost|TOKEN_PROPERTY_NAME|waitingCount\(\) \{/);
  const codeSlides = deck.chapters.flatMap(c => c.slides.filter(s => s.kind === 'code'));
  assert.deepEqual(codeSlides.map(s => s.code.file ?? 'inline'), ['apps-script/Code.gs', 'inline', 'apps-script/listserv-count.gs'], 'the desk script, the checkAccess helper, the sign-up script');
  // The screen that follows each box shows the paste saved.
  const s1 = chapterOf('script-1').slides, s2 = chapterOf('script-2').slides;
  assert.equal(s1[s1.findIndex(s => s.code?.file) + 1].shot, 'code-saved');
  assert.equal(s1[s1.findIndex(s => s.code?.text) + 1].shot, 'helper-pasted');
  assert.equal(s2[s2.findIndex(s => s.code?.file) + 1].shot, 'code-saved');
});

test('the checkAccess helper is its own box, the brief\'s lines, and is not in the repository\'s file', () => {
  const helper = boxes.find(b => !b.attrs['data-file']);
  assert.ok(helper, 'a box for the helper');
  const code = unesc(helper.html);
  assert.ok(code.startsWith('function checkAccess() {'), 'the helper');
  for (const line of ["var props = PropertiesService.getScriptProperties();", "Logger.log(SpreadsheetApp.getActiveSpreadsheet().getName());", "Logger.log(DriveApp.getFolderById(props.getProperty('SCRAPE_FOLDER_ID')).getName());", "Logger.log(DriveApp.getFolderById(props.getProperty('BRIEFS_FOLDER_ID')).getName());"]) {
    assert.ok(code.includes(line), line);
  }
  assert.ok(!read('apps-script/Code.gs').includes('function checkAccess'), 'not in Code.gs, so the paste removes it');
  assert.ok(chapter('script-1').includes(helper.html), 'on a Script 1 slide');
});

test('Copy writes the clipboard, falls back to selecting the text, says Copied for a moment, and is a button', () => {
  const script = page.slice(page.indexOf('// ---- Copy a code box'), page.indexOf('</script>', page.indexOf('// ---- Copy a code box')));
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(script, /selectNodeContents|execCommand\('copy'\)/, 'the fallback selects the text');
  assert.match(script, /'Copied'/);
  assert.match(script, /setTimeout\(/, 'for a moment');
  assert.match(script, /aria-live|data-code-said/, 'said for a screen reader too');
  assert.match(page, /<pre class="code-pre" tabindex="0" aria-label="[^"]+"/, 'the box itself can take focus, so the keyboard can scroll it');
  assert.match(page, /\.code-pre \{[^}]*max-height:[^}]*overflow: auto/, 'the box scrolls inside itself');
  assert.match(page, /html:not\(\.js\) \.code-copy \{ display: none; \}/, 'without script the button goes and the text stays');
  assert.match(page, /\.code-pre \{[^}]*ui-monospace/, 'plain monospace');
  assert.doesNotMatch(page, /hljs|prism|class="token/, 'no syntax coloring');
});

test('the desk guide says where the code is instead of carrying it, and carries every pin\'s line as words', () => {
  assert.doesNotMatch(scriptsGuide, /function doPost|TOKEN_PROPERTY_NAME|handleAction|function waitingCount/);
  assert.ok(scriptsGuide.includes('The whole script, apps-script/Code.gs (518 lines), is in a box on the page with a Copy button: https://erc-content-desk.vercel.app/how-to/google-scripts/#script-1'));
  assert.ok(scriptsGuide.includes('The whole script, apps-script/listserv-count.gs (50 lines), is in a box on the page with a Copy button: https://erc-content-desk.vercel.app/how-to/google-scripts/#script-2'));
  assert.ok(scriptsGuide.includes('function checkAccess() {'), 'the small helper, which is nowhere else, stays in the guide');
  // A line per pin since the screens (Oct 26), so the part grew from 322 lines to about 420; the cap keeps it short of the 568 lines of code.
  assert.ok(scriptsGuide.split('\n').length < 500, `the guide's part is words, not the 568 lines (${scriptsGuide.split('\n').length} lines)`);
  for (const name of GOOGLE_STILLS) for (const p of shotMeta(name).pins) assert.ok(scriptsGuide.includes(p.label), `the guide carries "${p.label}"`);
});

// ── What the page never carries ──

test('never a password, a token value, a script address, a Drive id or the name of the person who left', () => {
  assert.doesNotMatch(page, /script\.google\.com\/macros\/s\/|AKfycb/, 'no /exec address');
  assert.doesNotMatch(page, /erc-123/, 'no password');
  assert.doesNotMatch(outsideCode, /Kate|Barnes/, 'the person who left is "the desk\'s owner"');
  for (const id of ['1P7KCtPTN8QEosahGoth-qp04PZJ3JqwN', '13Q8dz0Ar1g9iHQxW72KioKM04THCM-sr', '19gAAU4OTxGrfYqitBS3Nx9KjfIbE4qW_7C51Lq_pZhw']) {
    assert.ok(!page.includes(id), `the page is public: no folder or sources Sheet id (${id})`);
  }
  assert.ok(page.includes("A folder's id is the last part of its address when the folder is open in Drive."), 'how to find an id instead');
  assert.ok(outsideCode.includes('href="/how-to/change-the-desk/#ask"'), 'Who to ask');
  assert.doesNotMatch(outsideCode, /[–—]/, 'no dashes');
  assert.doesNotMatch(outsideCode, /\bcolour|\bgrey\b|organise|behaviour/, 'American spelling');
});

// The owner's word (Oct 26): the addresses go "to the desk's owner at the
// address in READ ME FIRST - ERC Content Desk", so Send names the doc, once,
// with its link. Everywhere else the owner is reached through Who to ask.
test('Send names READ ME FIRST once, linked, and nowhere else does', () => {
  const link = 'https://docs.google.com/document/d/1DHzMJCA_Alep8suiZi7iICzLGSKtexvm6Z1yqVEoUFg/edit';
  assert.equal(outsideCode.split('READ ME FIRST').length - 1, 1, 'once');
  assert.ok(chapter('send').includes(`<a href="${link}" target="_blank" rel="noopener">READ ME FIRST - ERC Content Desk<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`), 'on the Send slide, linked');
});

test('Google\'s names are the page\'s, one action per line', () => {
  for (const name of ['Extensions', 'Apps Script', 'Project Settings', 'Script Properties', 'Review permissions', 'Who has access', 'Execute as', 'New deployment', 'Web app URL', 'Manage deployments', 'Execution log', 'Run', 'Deploy', 'Save script properties', 'Add script property', 'Select all', 'Continue']) {
    assert.ok(outsideCode.includes(name), `${name} is named`);
  }
  const plain = h => h.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, 'x');
  for (const c of deck.chapters) for (const s of c.slides) for (const g of s.steps ?? []) for (const item of g.items) {
    assert.ok(plain(item).trim().length <= 300, `${c.id}: a step stays short (${plain(item).length}): ${plain(item).slice(0, 60)}`);
  }
  assert.ok(!/<b>[^<]*<b>/.test(page), 'no bold inside bold');
});

test('Check it worked keeps the Listserv still, the two tests and the rest; the team password links to where it is kept', () => {
  assert.deepEqual(stillsOf('check'), ['listserv']);
  assert.ok(chapter('check').includes('<img src="shots/listserv.png"'));
  assert.ok(chapter('check').includes('Test, delete me'), 'the test sign-up');
  assert.ok(chapter('check').includes('Test item, delete me'), 'the test item');
  assert.ok(chapter('check').includes('href="/how-to/change-the-desk/#ask"'));
  assert.ok(chapter('check').includes('https://erc-share.vercel.app/listserv/'), 'the public sign-up page');
  assert.ok(chapter('check').includes('<b>Run the scraper</b>'));
});

test('Send says the owner changes two Vercel settings once, that Listserv then turns Live by itself, and that a new version later changes nothing there', () => {
  const send = chapter('send');
  for (const w of ['<code>SHEET_API_URL</code>', '<code>LISTSERV_URL</code>', '<b>Environment Variables</b>', '<b>Redeploy</b>', 'TAMU-ERC', 'Email only', 'turns from Down to Live by itself', 'Say which is which']) assert.ok(send.includes(w), w);
  assert.match(send, /new version[^.]*address stays/i);
  assert.ok(send.includes('<code>SHEET_API_TOKEN</code>'), 'the token stays');
  assert.ok(send.includes('ERC Content Desk sheet API is running.') && send.includes('The sign-up script is running.'), 'each address tried in a private window first');
});

test('If something goes wrong: a heading per symptom, one line each, the brief\'s twelve traps, the checks that fail, and two screens', () => {
  const wrong = chapter('wrong');
  for (const trap of ['Permission is asked only when a function that needs it runs', 'granular consent', 'account number', 'Saving changes nothing live', 'A new deployment gets a new address', 'Several deployments', 'The wrong project', 'Two old helpers', 'The test address', 'Several accounts in one browser', 'The scripts now run as you', 'No Anyone under Who has access', 'restoreMorningScrape']) {
    assert.ok(wrong.includes(trap), trap);
  }
  for (const msg of ['Unauthorized: missing or incorrect token.', 'Sheet API returned HTTP 403', '<b>Executions</b>', 'Invalid argument: id']) assert.ok(wrong.includes(msg), msg);
  const headings = [...wrong.matchAll(/<h3 id="h-wrong-[^"]+">([^<]+)<\/h3>/g)].map(m => unesc(m[1]));
  assert.ok(headings.length >= 10, `a heading per symptom (${headings.length})`);
  for (const [, item] of wrong.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const plain = unesc(item.replace(/<[^>]+>/g, ''));
    assert.ok(plain.length <= 240, `a trap runs past one line (${plain.length}): ${plain.slice(0, 60)}`);
  }
  assert.deepEqual(stillsOf('wrong'), ['new-version', 'id-error'], 'a new version, and the error a missing folder id gives');
  assert.ok(shotMeta('id-error').pins[0].label.startsWith('Invalid argument: id: a folder id property is missing'));
});

test('Later says Add a source is already in the code, what it still needs, and how any later change to the code goes', () => {
  const later = chapter('later');
  assert.ok(later.includes('<code>SOURCES_SHEET_ID</code>'));
  assert.ok(later.includes('The sources sheet is not connected yet.'));
  assert.doesNotMatch(later, /Not in the code yet/, 'the brief\'s section 7 is older than its own Appendix A');
  assert.match(later, /<b>Version<\/b>: <b>New version<\/b>/);
  assert.match(later, /Vercel needs nothing/);
  assert.match(later, /checkAccess/, 'the helper is pasted again after a new paste');
  assert.equal(chapterOf('later').slides.length, 1, 'one slide of words');
  // The sign-up script's copy of the guide's Sheet id is the one the code carries; the sources Sheet's id stays off the page.
  assert.doesNotMatch(later, /\/d\/19g/);
});
