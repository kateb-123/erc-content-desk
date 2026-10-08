import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { TYPE_ORDER } from '../js/schema.js';
import { PUBLIC_LINKS } from '../js/public-links.js';

// The team's how-to (Kate, Sep 30, 2026): a deck of slides on the desk's open
// side, one slide at a time, that shows the real Submit content form being
// filled in, names every type the way the screen does, and gives each
// tab a type with the newest example live on the Exchange. It is a static
// page, so its words are read from the file.
const page = readFileSync(new URL('../how-to/submit-content/index.html', import.meta.url), 'utf8');

test('the deck links the team page and the three public pages, and only those addresses', () => {
  assert.match(page, /https:\/\/erc-content-desk\.vercel\.app\/#team/);
  // The Links to share rows are drawn from PUBLIC_LINKS itself, so the three
  // public addresses are never retyped here.
  const words = page.replace('https://erc-policy-exchange.vercel.app/data/news.csv', '');
  for (const { href } of PUBLIC_LINKS) assert.ok(!words.includes(href), `${href} retyped on the page`);
  const addresses = new Set(page.match(/https?:\/\/[^\s"'<)]+/g));
  const allowed = new Set(['https://erc-content-desk.vercel.app/#team', ...PUBLIC_LINKS.map(l => l.href), 'https://erc-policy-exchange.vercel.app/data/news.csv', 'https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;600;700&display=swap', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css', 'http://www.w3.org/2000/svg', 'https://example.org/aggie/whoop-webinar', 'https://example.org/aggie/gig-em-grants', 'https://example.org/aggie/reveille-superintendent']);
  for (const a of addresses) assert.ok(allowed.has(a), `an address the deck should not carry: ${a}`);
  assert.match(page, /import \{ PUBLIC_LINKS \} from '\/js\/public-links\.js'/, 'the Links to share rows are the desk’s own public links');
});

test('the templates can be downloaded from the page, and the spreadsheet is the one to use', () => {
  assert.match(page, /href="\/templates\/erc-upload-template\.xlsx" download/);
  assert.match(page, /href="\/templates\/erc-upload-template\.docx" download/);
  assert.match(page, /Use the spreadsheet/);
});

test('every type has its line, and the names are drawn from the schema, never retyped', () => {
  for (const type of TYPE_ORDER) assert.match(page, new RegExp(`^\\s+${type}: '`, 'm'), `${type} in ABOUT`);
  assert.doesNotMatch(page, /New Ed Policy Research/, 'the Sheet’s name, never shown on the form');
});

test('the types come from the schema, a row each with its subtypes, and the examples from the live Exchange', () => {
  assert.match(page, /import \{ TYPES, TYPE_ORDER, typeDisplay \} from '\/js\/schema\.js'/);
  assert.match(page, /for \(const type of TYPE_ORDER\)/);
  assert.match(page, /TYPES\[type\]\.subtypes/, 'every subtype row is drawn from the schema');
  assert.match(page, /erc-policy-exchange\.vercel\.app\/data\/news\.csv/);
  assert.doesNotMatch(page, /submit-form\.js|window\.fetch = /, 'no practice form: nothing on the page posts anywhere');
});

test('the words are the desk’s own and carry no dash', () => {
  assert.doesNotMatch(page, /[–—]/, 'no en or em dash');
  for (const words of ['Item types', 'Use it for', 'Add one item', 'Bulk add items', 'Add to the queue', 'Add a doc or spreadsheet', 'Every item needs a link', 'Copy link']) assert.ok(page.includes(words), words);
});

// ── The newsletter builder's how-to (Kate, Sep 30, 2026; remade Oct 7 as a
// deck): the three builder steps and Send as chapters of slides, each slide a
// still of the real builder with numbered pins that name the controls, and
// Styles, the email's looks rendered by the builder's own template, one at a
// time behind a menu of groups. Where items come from sits on the first
// Outline slide. Stills, not recordings. No Claude note: the builder never
// calls it. Linked from Next issue and the front page. Read on a desktop.
const nlDir = new URL('../how-to/newsletter/', import.meta.url);
const nl = readFileSync(new URL('index.html', nlDir), 'utf8');
const builderPage = readFileSync(new URL('../builder/index.html', import.meta.url), 'utf8');
const builderApp = readFileSync(new URL('../builder/js/app.js', import.meta.url), 'utf8');
const builderOptions = readFileSync(new URL('../builder/js/options.js', import.meta.url), 'utf8');
const builderModel = readFileSync(new URL('../builder/js/model.js', import.meta.url), 'utf8');
const builderWizard = readFileSync(new URL('../builder/js/wizard.js', import.meta.url), 'utf8');
const itemImage = readFileSync(new URL('../js/item-image.js', import.meta.url), 'utf8');   // the Media control the builder's card borrows from the desk
const builderWords = builderPage + builderApp + builderOptions + builderModel + builderWizard + itemImage;
const issueUi = readFileSync(new URL('../js/issue-ui.js', import.meta.url), 'utf8');

test('the newsletter how-to opens the Newsletter page and carries only the addresses it needs', () => {
  assert.match(nl, /https:\/\/erc-content-desk\.vercel\.app\/#newsletter/);
  const addresses = new Set(nl.match(/https?:\/\/[^\s"'<)]+/g));
  const allowed = new Set([
    'https://erc-content-desk.vercel.app/#newsletter',
    'https://appsource.microsoft.com/en-us/product/office/wa200002918',
    'https://support.microsoft.com/en-us/outlook/getstarted/use-add-ins-in-outlook',
    'https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css',
    'http://www.w3.org/2000/svg',
  ]);
  for (const a of addresses) assert.ok(allowed.has(a), `an address the how-to should not carry: ${a}`);
  assert.doesNotMatch(nl, /localhost/, 'the stylesheets and pictures are the desk’s own, by path');
  assert.match(nl, /href="\/css\/tokens\.css/, 'the desk’s own tokens');
  assert.doesNotMatch(nl, /fetch\(|window\.fetch/, 'nothing on the page reads or writes the desk');
});

test('the deck: the three steps and Send as chapters of slides, then Styles, in the order the work happens', () => {
  const chips = nl.match(/<nav class="chips"[\s\S]*?<\/nav>/)[0];
  const parts = [...chips.matchAll(/href="#([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(parts, ['outline', 'tweak', 'export', 'send', 'options'], 'the chips, Styles last');
  for (const id of ['outline', 'tweak', 'export', 'send']) assert.match(nl, new RegExp(`<section class="chapter" id="${id}"`), `${id} is a chapter`);
  assert.match(nl, /<section class="styles" id="options"/, 'Styles keeps the #options address the practice note links');
  assert.match(nl, /<section class="from" id="items"/, 'Where items come from sits on the first Outline slide');
  const order = parts.map((id) => nl.indexOf(`id="${id}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the parts run in the order the work happens');
  // Each builder step is a chapter, numbered and named as the builder names it.
  for (const [n, step] of [['1', 'Outline'], ['2', 'Preview &amp; Tweak'], ['3', 'Save &amp; Export']]) {
    assert.match(nl, new RegExp(`<h2 class="pane-title" id="h-[a-z]+"><span class="step" aria-hidden="true">${n}</span><span class="sr-only">Step ${n}: </span>${step.replace(/[&;]/g, (c) => `\\${c}`)}</h2>`), `${step} is chapter ${n}`);
    assert.ok(builderPage.includes(step), `${step} is the builder's own name for the step`);
  }
  for (const words of ['Where items come from', 'Send from erc@tamu.edu', 'Styles']) assert.ok(nl.includes(words), words);
  assert.doesNotMatch(nl, /<video|\.webm/, 'stills, not recordings');
  assert.doesNotMatch(nl, /[–—]/, 'no en or em dash');
  assert.doesNotMatch(nl, /Kate|Kathy/, 'no name on a team page');
  assert.doesNotMatch(nl, /Claude/, 'the builder never calls Claude, so no note');
  assert.doesNotMatch(nl, /featured/i, 'Featured is hidden in the builder (Oct 7), so the how-to never mentions it');
});

test('the newsletter how-to says what it should in the desk\'s own words', () => {
  for (const words of ['Ready to add', 'Quick add', 'Open the builder', 'Pull from the desk', 'Samples', 'Copy HTML', 'Save to the archive', 'Past issues', 'never in Outlook', 'Submit content', 'Sort', 'Finalize', 'Publish']) assert.ok(nl.includes(words), words);
});

test('every still and every look is a file beside the page, drawn at its own shape, with words for a screen reader', () => {
  const imgs = nl.match(/<img\b[^>]*>/g) ?? [];
  assert.ok(imgs.length >= 40, `the page is pictures (${imgs.length})`);
  for (const tag of imgs) {
    const src = tag.match(/src="([^"]+)"/)[1];
    assert.match(src, /^(?:shots|gallery)\/[a-z0-9-]+\.png$|^designmodo\.png$/, `${src} is a file beside the page`);
    const file = new URL(src, nlDir);
    assert.ok(existsSync(file), `${src} exists`);
    assert.match(tag, /\balt="/, `${src} has alt words`);
    const w = +tag.match(/width="(\d+)"/)[1], h = +tag.match(/height="(\d+)"/)[1];
    const png = readFileSync(file);
    const fw = png.readUInt32BE(16), fh = png.readUInt32BE(20);
    assert.ok(Math.abs(w / h - fw / fh) < 0.01, `${src} is drawn at its own shape: ${w}x${h} for a ${fw}x${fh} file`);
  }
});

test('every pin sits inside its still and says the same words to a pointer and to a screen reader', () => {
  const shots = nl.split('<div class="shot" ').slice(1).map((x) => x.split('\n          </div>')[0]);
  assert.equal(shots.length, (nl.match(/<div class="frame">/g) ?? []).length, 'every picture frame holds a still');
  assert.ok(shots.length >= 6, `stills with pins (${shots.length})`);
  for (const shot of shots) {
    const [, iw, ih, cx, cy, cw, ch] = shot.match(/^style="--iw:(\d+);--ih:(\d+);--cx:(\d+);--cy:(\d+);--cw:(\d+);--ch:(\d+)"/).map(Number);
    const [, w, h] = shot.match(/width="(\d+)" height="(\d+)"/).map(Number);
    assert.equal(`${iw}x${ih}`, `${w}x${h}`, 'the window knows the picture’s size');
    assert.ok(cx + cw <= iw && cy + ch <= ih, 'the window stays inside the picture');
    const pins = [...shot.matchAll(/class="pin(?: up)?" style="--x:([\d.]+);--y:([\d.]+)" aria-label="([^"]+)"><span class="num" aria-hidden="true">(\d+)<\/span><span class="tip" aria-hidden="true">([^<]+)<\/span>/g)];
    assert.ok(pins.length >= 1, 'a pin on every still');
    pins.forEach(([, x, y, label, num, tip], i) => {
      assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100, `pin ${num} is on the picture`);
      assert.equal(+num, i + 1, 'the pins count up');
      assert.equal(label, tip, 'the label and the bubble say the same');
      assert.doesNotMatch(label, /[–—]/);
    });
  }
});

test('the send part teaches the add-in route from the personal mailbox to erc@tamu.edu, both ways, with the two warnings', () => {
  const send = nl.slice(nl.indexOf('id="send"'), nl.indexOf('id="options"'));
  for (const words of ['Insert HTML by Designmodo', 'designmodo.png', 'personal TAMU account', 'Apps', 'Get Add-ins', 'Paste HTML', 'Insert HTML', 'Forward', 'Or copy', 'select all', 'erc@tamu.edu', 'Never paste the HTML into the message as text', 'Never open the .html in a browser']) {
    assert.ok(send.includes(words), words);
  }
  assert.ok(send.includes('appsource.microsoft.com') && send.includes('support.microsoft.com'), 'the add-in and Microsoft\'s page on add-ins are linked');
  assert.doesNotMatch(send, /<img(?![^>]*designmodo\.png)/, 'words only, no drawing');
});

test('Styles: a menu of every group in the page\'s order, and a look for each of the email\'s shapes', () => {
  const menu = nl.match(/<nav class="sg-menu"[\s\S]*?<\/nav>/)[0];
  const listed = [...menu.matchAll(/href="#(sg-g-[a-z]+)"/g)].map((m) => m[1]);
  const groups = [...nl.matchAll(/<section class="sg-group" id="(sg-g-[a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(listed, groups, 'the menu is the groups');
  assert.deepEqual(groups, ['sg-g-looks', 'sg-g-research', 'sg-g-callouts', 'sg-g-text', 'sg-g-photos', 'sg-g-lists', 'sg-g-top']);
  assert.ok((nl.match(/class="sg-look/g) ?? []).length >= 20, 'twenty looks and notes');
});

test('every control the how-to names is a control the builder names, in the builder\'s own words', () => {
  const names = [
    'Pull from the desk', 'Samples', 'Sample issue (fictional)', 'Move to…', 'Remove', 'Undo',
    'Add an item', 'Add a callout', 'Contents strip', 'Reset layout', 'Done', 'Undo changes',
    'How it is laid out', 'Its words', 'Title and details', 'With description', 'Stamp beside the text', 'Headshot beside it all', 'Date card',
    'Picture size, px', 'Zoom available', 'Flyer link', 'Add media', 'Description',
    'Kind', 'Research Brief', 'Research Report', 'Journal Article', 'ERC Explains',
    'Its style', 'Maroon block', 'Light gray box', 'Dotted rule',
    'Copy HTML', 'Save to the archive', 'Download .html', 'Start the next issue',
  ];
  for (const name of names) {
    assert.ok(nl.includes(name), `the how-to names ${name}`);
    assert.ok(builderWords.includes(name), `the builder names ${name}`);
  }
});

test('Next issue links the newsletter how-to beside Open the builder', () => {
  assert.match(issueUi, /'\/how-to\/newsletter\/'/);
});
