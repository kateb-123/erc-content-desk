// tests/scripts-howto.test.js: Bring back the Google scripts as the walkthrough
// of docs/scripts-walkthrough-brief.md (Oct 26, 2026), for a teammate who is
// not a developer and never opens GitHub. The deck keeps the how-tos' idiom
// (the parts as chips, one slide per group of steps, Back and Next) with the
// brief's parts in its order, and each script's whole code sits on the page
// at the step that pastes it: a box read from apps-script/ at build time,
// byte for byte, with a Copy button. The desk guide never carries the code;
// it says where the box is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const notes = deck.chapters.flatMap(c => c.slides.flatMap(s => s.notes ?? []));
const boxes = [...page.matchAll(/<pre class="code-pre"([^>]*)><code>([\s\S]*?)<\/code><\/pre>/g)].map(m => ({
  attrs: Object.fromEntries([...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])),
  html: m[2],
}));
const outsideCode = page.replace(/<pre class="code-pre"[^>]*>[\s\S]*?<\/pre>/g, '');
const scriptsGuide = (() => {
  const from = guide.indexOf('\n# Bring back the Google scripts\n');
  return guide.slice(from, guide.indexOf('\n# ', from + 1));
})();

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
  }
  // The box's text is the file's, never a hand copy: deck.json names the file alone.
  assert.doesNotMatch(read('how-to/google-scripts/deck.json'), /function doPost|TOKEN_PROPERTY_NAME|waitingCount\(\) \{/);
  const codeSlides = deck.chapters.flatMap(c => c.slides.filter(s => s.kind === 'code'));
  assert.deepEqual(codeSlides.map(s => s.code.file ?? 'inline'), ['apps-script/Code.gs', 'inline', 'apps-script/listserv-count.gs'], 'the desk script, the checkAccess helper, the sign-up script');
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

test('the desk guide says where the code is instead of carrying it', () => {
  assert.doesNotMatch(scriptsGuide, /function doPost|TOKEN_PROPERTY_NAME|handleAction|function waitingCount/);
  assert.ok(scriptsGuide.includes('The whole script, apps-script/Code.gs (518 lines), is in a box on the page with a Copy button: https://erc-content-desk.vercel.app/how-to/google-scripts/#script-1'));
  assert.ok(scriptsGuide.includes('The whole script, apps-script/listserv-count.gs (50 lines), is in a box on the page with a Copy button: https://erc-content-desk.vercel.app/how-to/google-scripts/#script-2'));
  assert.ok(scriptsGuide.includes('function checkAccess() {'), 'the small helper, which is nowhere else, stays in the guide');
  assert.ok(scriptsGuide.split('\n').length < 400, `the guide's part is words, not the 568 lines (${scriptsGuide.split('\n').length} lines)`);
});

test('never a password, a token value, a script address, a Drive id or the name of the person who left', () => {
  assert.doesNotMatch(page, /script\.google\.com\/macros\/s\/|AKfycb/, 'no /exec address');
  assert.doesNotMatch(page, /erc-123/, 'no password');
  assert.doesNotMatch(outsideCode, /Kate|Barnes/, 'the person who left is "the desk\'s owner"');
  for (const id of ['1P7KCtPTN8QEosahGoth-qp04PZJ3JqwN', '13Q8dz0Ar1g9iHQxW72KioKM04THCM-sr', '19gAAU4OTxGrfYqitBS3Nx9KjfIbE4qW_7C51Lq_pZhw']) {
    assert.ok(!page.includes(id), `the page is public: no folder or sources Sheet id (${id})`);
  }
  assert.ok(page.includes("A folder's id is the last part of its address when the folder is open in Drive."), 'how to find an id instead');
  assert.doesNotMatch(outsideCode, /READ ME FIRST/, 'the owner is reached through Who to ask, where READ ME FIRST is named once');
  assert.ok(outsideCode.includes('href="/how-to/change-the-desk/#ask"'), 'Who to ask');
  assert.doesNotMatch(outsideCode, /[\u2013\u2014]/, 'no dashes');
  assert.doesNotMatch(outsideCode, /\bcolour|\bgrey\b|organise|behaviour/, 'American spelling');
});

test('the brief\'s Unconfirmed marks are quiet notes, and a frame the brief leaves is a quiet labeled line', () => {
  const unsure = notes.filter(n => /^Unconfirmed/.test(n.html.replace(/<[^>]+>/g, '')));
  assert.ok(unsure.length >= 5, `the Unconfirmed marks (${unsure.length})`);
  for (const n of unsure) assert.equal(n.quiet, true, n.html);
  assert.ok((page.match(/<p class="note quiet"><i class="fa-solid fa-circle-question" aria-hidden="true"><\/i><span>Unconfirmed/g) ?? []).length >= 5);
  for (const frame of ['Your screenshot: the permissions screen.', 'Your screenshot: the New deployment box.']) {
    assert.match(page, new RegExp(`<p class="note quiet"><i class="fa-solid fa-camera" aria-hidden="true"></i><span>${frame.replace(/[.]/g, '\\.')}</span></p>`), frame);
  }
  assert.doesNotMatch(page, /<div class="frame">\s*<\/div>|class="placeholder"/, 'no empty box');
});

test('one action per step, Google\'s names in bold, the numbering running on across Script 1\'s slides', () => {
  for (const name of ['Extensions', 'Apps Script', 'Project Settings', 'Script Properties', 'Review permissions', 'Who has access', 'Execute as', 'New deployment', 'Web app URL', 'Manage deployments', 'Execution log', 'Run', 'Deploy']) {
    assert.ok(page.includes(`<b>${name}</b>`), `${name} in bold`);
  }
  assert.ok(page.includes('<b>Extensions</b> &gt; <b>Apps Script</b>'));
  const s1 = slidesOf('script-1');
  assert.equal(s1.length, 7, 'Script 1 in seven slides');
  const starts = [...chapter('script-1').matchAll(/<ol start="(\d+)" style="counter-reset: step (\d+)">/g)].map(m => [+m[1], +m[2]]);
  assert.ok(starts.length >= 4, 'the later slides carry on the numbering');
  for (const [start, reset] of starts) assert.equal(reset, start - 1);
  // The code slides number their steps in the words beside the box, in the same run.
  const codeNumbers = [...chapter('script-1').matchAll(/<p class="note"><span class="n">(\d+)<\/span>/g)].map(m => +m[1]);
  assert.deepEqual(codeNumbers, [7, 8, 9, 10, 11], 'steps 7 to 11 sit beside the two boxes; 12 to 14, allowing the permissions, follow as a slide of steps');
  assert.ok(chapter('script-1').includes('<ol start="12" style="counter-reset: step 11">'), 'step 12 follows step 11');
  assert.deepEqual(slidesOf('script-2').length, 2);
  const plain = h => h.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, 'x');
  for (const c of deck.chapters) for (const s of c.slides) for (const g of s.steps ?? []) for (const item of g.items) {
    assert.ok(plain(item).trim().length <= 400, `${c.id}: a step stays short (${plain(item).length}): ${plain(item).slice(0, 60)}`);
  }
  assert.ok(page.includes('<b>No Anyone under Who has access.</b>') && !/<b>[^<]*<b>/.test(page), 'no bold inside bold');
});

test('Check it worked keeps the Listserv still and adds no other picture; the team password links to where it is kept', () => {
  assert.equal((page.match(/<img /g) ?? []).length, 1, 'one still');
  assert.ok(chapter('check').includes('<img src="shots/listserv.png"'));
  assert.ok(chapter('check').includes('Test, delete me'), 'the test sign-up');
  assert.ok(chapter('check').includes('Test item, delete me'), 'the test item');
  assert.ok(chapter('check').includes('href="/how-to/change-the-desk/#ask"'));
  assert.ok(chapter('check').includes('https://erc-share.vercel.app/listserv/'), 'the public sign-up page');
});

test('Send says the owner changes two Vercel settings once, and that a new version later changes nothing there', () => {
  const send = chapter('send');
  for (const w of ['<code>SHEET_API_URL</code>', '<code>LISTSERV_URL</code>', '<b>Environment Variables</b>', '<b>Redeploy</b>', 'TAMU-ERC', 'Email only']) assert.ok(send.includes(w), w);
  assert.match(send, /new version[^.]*address stays/i);
  assert.ok(send.includes('<code>SHEET_API_TOKEN</code>'), 'the token stays');
});

test('If something goes wrong carries the brief\'s twelve traps and the checks that fail', () => {
  const wrong = chapter('wrong');
  for (const trap of ['Permission is asked only when a function that needs it runs', 'granular consent', 'account number', 'Saving changes nothing live', 'A new deployment gets a new address', 'Several deployments', 'The wrong project', 'Two old helpers', 'The test address', 'Several accounts in one browser', 'The scripts now run as you']) {
    assert.ok(wrong.includes(trap), trap);
  }
  assert.ok(wrong.includes('No <b>Anyone</b> under Who has access') || wrong.includes('No Anyone under'), 'trap 10');
  assert.ok(wrong.includes('restoreMorningScrape'));
  for (const msg of ['Unauthorized: missing or incorrect token.', 'Sheet API returned HTTP 403', '<b>Executions</b>']) assert.ok(wrong.includes(msg), msg);
});

test('Later says Add a source is already in the code, what it still needs, and how any later change to the code goes', () => {
  const later = chapter('later');
  assert.ok(later.includes('<code>SOURCES_SHEET_ID</code>'));
  assert.ok(later.includes('The sources sheet is not connected yet.'));
  assert.doesNotMatch(later, /Not in the code yet/, 'the brief\'s section 7 is older than its own Appendix A');
  assert.match(later, /<b>Version<\/b>: <b>New version<\/b>/);
  assert.match(later, /Vercel needs nothing/);
  assert.match(later, /checkAccess/, 'the helper is pasted again after a new paste');
  // The sign-up script's copy of the guide's Sheet id is the one the code carries; the sources Sheet's id stays off the page.
  assert.doesNotMatch(later, /\/d\/19g/);
});
