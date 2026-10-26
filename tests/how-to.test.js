import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { TYPE_ORDER } from '../js/schema.js';
import { PUBLIC_LINKS } from '../js/public-links.js';

// The team's how-to (Kate, Sep 30, 2026): a deck of slides on the desk's open
// side, one slide at a time, that shows the real Submit content form being
// filled in, names every type the way the screen does, and gives each
// tab a type with the newest example live on the Exchange. It is a static
// page, so its words are read from the file.
const page = readFileSync(new URL('../how-to/submit-content/index.html', import.meta.url), 'utf8');

// Oct 24 (the trim, the owner: "some of the how-tos are SOOOOO redundant"):
// Links to share repeated the front page's Public links, which has Copy link
// on each row, so the page keeps one line of it and lists no public page.
test('the page links the team page, lists no public page, and keeps the one line about the desk\'s address', () => {
  assert.match(page, /https:\/\/erc-content-desk\.vercel\.app\/#team/);
  const words = page.replace('https://erc-policy-exchange.vercel.app/data/news.csv', '');
  for (const { href } of PUBLIC_LINKS) assert.ok(!words.includes(href), `${href} on the page`);
  assert.doesNotMatch(page, /PUBLIC_LINKS|id="links"|Links to share/, 'no Links to share: the front page\'s Public links has them');
  assert.ok(page.includes("Never send the desk's address. Public links, on the front page, has Copy link for each public page."), 'the one line');
  const addresses = new Set(page.match(/https?:\/\/[^\s"'<)]+/g));
  const allowed = new Set(['https://erc-content-desk.vercel.app/#team', 'https://erc-policy-exchange.vercel.app/data/news.csv', 'https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;600;700&display=swap', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css', 'http://www.w3.org/2000/svg', 'https://example.org/aggie/whoop-webinar', 'https://example.org/aggie/gig-em-grants', 'https://example.org/aggie/reveille-superintendent']);
  for (const a of addresses) assert.ok(allowed.has(a), `an address the deck should not carry: ${a}`);
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
    'https://docs.google.com/spreadsheets/d/1dvXdBhMgp1-XmijS0M8wtxARWjy3ejCCFcy-YGKjP4I/edit#gid=287660130',   // the schedule tab, on the Send dates slide (Oct 25)
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
  // Oct 24 (the trim): the send dates moved here from Change the desk, first,
  // since they are set before any issue; Where items come from went, the
  // pipeline's alone (How it all connects).
  assert.deepEqual(parts, ['dates', 'outline', 'tweak', 'export', 'send', 'options'], 'the chips, Send dates first and Styles last');
  for (const id of ['dates', 'outline', 'tweak', 'export', 'send']) assert.match(nl, new RegExp(`<section class="chapter" id="${id}"`), `${id} is a chapter`);
  assert.match(nl, /<section class="styles" id="options"/, 'Styles keeps the #options address the practice note links');
  assert.doesNotMatch(nl, /id="items"|Where items come from/, 'where items come from is How it all connects\' alone');
  const order = parts.map((id) => nl.indexOf(`id="${id}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the parts run in the order the work happens');
  // Each builder step is a chapter, numbered and named as the builder names it.
  for (const [n, step] of [['1', 'Outline'], ['2', 'Preview &amp; Tweak'], ['3', 'Save &amp; Export']]) {
    assert.match(nl, new RegExp(`<h2 class="pane-title" id="h-[a-z]+"><span class="step" aria-hidden="true">${n}</span><span class="sr-only">Step ${n}: </span>${step.replace(/[&;]/g, (c) => `\\${c}`)}</h2>`), `${step} is chapter ${n}`);
    assert.ok(builderPage.includes(step), `${step} is the builder's own name for the step`);
  }
  for (const words of ['Send dates', 'Send from erc@tamu.edu', 'Styles']) assert.ok(nl.includes(words), words);
  assert.doesNotMatch(nl, /<video|\.webm/, 'stills, not recordings');
  assert.doesNotMatch(nl, /[–—]/, 'no en or em dash');
  assert.doesNotMatch(nl, /Kate|Kathy/, 'no name on a team page');
  assert.doesNotMatch(nl, /Claude/, 'the builder never calls Claude, so no note');
  assert.doesNotMatch(nl, /featured/i, 'Featured is hidden in the builder (Oct 7), so the how-to never mentions it');
  assert.doesNotMatch(nl, /Pull from the desk/, 'no Pull button since Oct 7: picking the issue pulls');
});

// Submit content, Sort, Finalize, Publish and Quick add were Where items come
// from's words; since the trim (Oct 24) they are How it all connects' alone.
test('the newsletter how-to says what it should in the desk\'s own words', () => {
  for (const words of ['Ready to add', 'Open the builder', 'Samples', 'Copy HTML', 'Save to the archive', 'Start the next issue', 'Past issues', 'never in Outlook', 'Schedule', 'Next issue']) assert.ok(nl.includes(words), words);
  assert.ok(nl.includes('Aim for 3 to 5 research items or reports from outside and 3 to 5 headlines, all policy relevant.'), 'the aim, once, where the issue is filled');
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
    'Samples', 'Sample issue (fictional)', 'Move to…', 'Remove', 'Undo',
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

// Oct 24 (her pick D): Next issue's link went to the How-tos panel, which opens the newsletter how-to first there.
test('Next issue opens the newsletter how-to first in the How-tos panel', async () => {
  const { SCREEN_GUIDES } = await import('../js/howto-index.js');
  assert.deepEqual(SCREEN_GUIDES.issue, ['newsletter', 'outline']);
  assert.doesNotMatch(issueUi, /'\/how-to\/newsletter\/'/, 'no link of its own on the page');
});

// ── The guides made by how-to/make-deck.mjs (Kate, Oct 23: steps 1 and 2
// showed only with the mouse on the picture): a still's pins show at rest,
// and the words beside it list every pin's step under its number, so the
// picture adds to the words and never hides a step.
const howToDir = new URL('../how-to/', import.meta.url);
const decks = readdirSync(howToDir).filter((d) => existsSync(new URL(`${d}/deck.json`, howToDir)));
const deckPage = (d) => readFileSync(new URL(`${d}/index.html`, howToDir), 'utf8');
const unesc = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('every guide made by make-deck.mjs shows its pins at rest', () => {
  assert.ok(decks.length >= 7, `the guides (${decks.join(', ')})`);
  for (const d of decks) {
    const html = deckPage(d);
    assert.match(html, /Built by how-to\/make-deck\.mjs/, `${d} is made by make-deck.mjs`);
    assert.doesNotMatch(html, /\.pin \{ opacity: 0/, `${d}: no pin waits for the mouse`);
  }
});

test('every pin on a guide\'s still has its step in the words beside it, under its number', () => {
  for (const d of decks) {
    const deck = JSON.parse(readFileSync(new URL(`${d}/deck.json`, howToDir), 'utf8'));
    // A slide of a kind (Sort's flashcards and source bands, Oct 25) is drawn
    // from its data and has no still, like a slide of steps.
    const stills = deck.chapters.flatMap((c) => c.slides.filter((s) => !s.steps && !s.kind));
    // Every slide is split off, then the stills kept: a code slide's numbered
    // notes would otherwise ride with the still before it (the Google scripts, Oct 26).
    const slides = deckPage(d).split(/<div class="slide[ "]/).slice(1).filter((s) => s.includes('<div class="shot" '));
    assert.equal(slides.length, stills.length, `${d}: a slide for every still`);
    slides.forEach((slide, k) => {
      const where = `${d}, ${stills[k].shot}`;
      const pins = [...slide.matchAll(/class="pin(?: up)?" style="[^"]*" aria-label="([^"]*)"><span class="num" aria-hidden="true">\d+<\/span>/g)].map((m) => unesc(m[1]));
      const rows = [...slide.matchAll(/<p class="note"><span class="n">(\d+)<\/span><span>([\s\S]*?)<\/span><\/p>/g)];
      assert.deepEqual(rows.map((r) => +r[1]), pins.map((_, i) => i + 1), `${where}: a row for every pin, in order`);
      // A slide whose notes cover every pin already lists its steps; elsewhere
      // each row names its pin, then adds the pin's note when it has one.
      const noted = new Set((stills[k].notes ?? []).map((n) => String(n.n)));
      if (pins.every((_, i) => noted.has(String(i + 1)))) return;
      rows.forEach(([, n, words], i) => assert.ok(unesc(words).includes(pins[i]), `${where}: row ${n} names its pin, "${pins[i]}"`));
    });
  }
});

// The newsletter how-to does the same (Oct 23, night): its pins show at rest
// and each is listed under its number in the words beside its still, in the
// markup the guides use, from the capture files. The guides copy its styles
// as they are, so all eight look alike.
test('the newsletter how-to shows its pins at rest, in the styles the guides copy', () => {
  assert.doesNotMatch(nl, /\.pin \{ opacity: 0/, 'no pin waits for the mouse');
  const style = html => html.match(/<style>[\s\S]*?<\/style>/)[0];
  for (const d of decks) assert.equal(style(deckPage(d)), style(nl), `${d} wears the newsletter how-to's styles unchanged`);
});

test('every pin on a newsletter still is its capture\'s, with its step in the words beside it, under its number', () => {
  const slides = nl.split('<div class="slide" role="group"').slice(1).filter((s) => s.includes('<div class="shot" '));
  assert.ok(slides.length >= 6, `slides with a still (${slides.length})`);
  for (const slide of slides) {
    const name = slide.match(/<img src="shots\/([a-z0-9-]+)\.png"/)[1];
    const m = JSON.parse(readFileSync(new URL(`shots/${name}.json`, nlDir), 'utf8'));
    assert.ok(slide.includes(`<div class="shot" style="--iw:${m.iw};--ih:${m.ih};--cx:${m.cx};--cy:${m.cy};--cw:${m.cw};--ch:${m.ch}">`), `${name}: the capture's crop`);
    assert.equal(unesc(slide.match(/<img src="shots\/[^"]+" [^>]*alt="([^"]*)"/)[1]), m.alt, `${name}: the capture's alt`);
    const pins = [...slide.matchAll(/class="(pin(?: up)?)" style="--x:([\d.]+);--y:([\d.]+)" aria-label="([^"]*)"><span class="num" aria-hidden="true">\d+<\/span>/g)];
    assert.deepEqual(pins.map((p) => [unesc(p[4]), +p[2], +p[3]]), m.pins.map((p) => [p.label, p.x, p.y]), `${name}: the capture's pins`);
    pins.forEach((p, i) => assert.equal(p[1], m.pins[i].y > 70 ? 'pin up' : 'pin', `${name}: pin ${i + 1} opens its bubble as the guides do`));
    const rows = [...slide.matchAll(/<p class="note"><span class="n">(\d+)<\/span><span>([\s\S]*?)<\/span><\/p>/g)];
    assert.deepEqual(rows.map((r) => +r[1]), pins.map((_, i) => i + 1), `${name}: a row for every pin, in order`);
    rows.forEach(([, n, words], i) => assert.ok(unesc(words).includes(m.pins[i].label), `${name}: row ${n} names its pin`));
  }
});

// ── The Google files (the owner, Oct 25): a how-to told the reader to open a
// Google file and gave no link and no word on where it is on the team drive.
// Every file the desk uses, by the names the how-tos use, each with its
// address (verified on the team drive's own stubs, Oct 25); a slide, or a
// page's foot, that names one carries its link, so a reader is never sent to
// find it. A name inside <code> is a path in Finder, a value or what a log
// prints, not a place to go. Two other things carry the desk's Sheet's name,
// the Vercel project and the script's address, and the sign-up script's
// address carries its Sheet's: those are named after the Sheets, not the Sheets.
const SHEET = 'https://docs.google.com/spreadsheets/d/1dvXdBhMgp1-XmijS0M8wtxARWjy3ejCCFcy-YGKjP4I/edit';
const SIGNUP = 'https://docs.google.com/spreadsheets/d/1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E/edit';
const GOOGLE_FILES = [
  ['erc-content-desk', /erc-content-desk/, SHEET],                                   // the desk's Sheet (Content queue); the schedule tab is on it
  ["the Sheet's first or schedule tab", /the Sheet's (?:first|schedule) tab/, SHEET],
  ['subscribe to listserve', /subscribe to listserve/, SIGNUP],                       // the sign-up Sheet (Listserv)
  ['the sign-up sheet', /sign-up [Ss]heet/, SIGNUP],
  ['Newsletter scrapes', /Newsletter scrapes/, 'https://docs.google.com/spreadsheets/d/1BtElrce0rR4W8QgtiAZRP_OO4H74n99S2UKmwbJDtko/edit'],
  ['the scrapes folder', /(?<!Newsletter )\bscrapes\b/, 'https://drive.google.com/drive/folders/1P7KCtPTN8QEosahGoth-qp04PZJ3JqwN'],
  ['Scraper sources', /Scraper sources/, 'https://docs.google.com/spreadsheets/d/19gAAU4OTxGrfYqitBS3Nx9KjfIbE4qW_7C51Lq_pZhw/edit'],
  ['ERC Research Briefs', /ERC Research Briefs/, 'https://drive.google.com/drive/folders/13Q8dz0Ar1g9iHQxW72KioKM04THCM-sr'],
  ['Sent issues', /Sent issues/, 'https://drive.google.com/drive/folders/16OTN8Ey6EALnR9fZ6RKTbAhkWPSUXi_L'],
  ['the Policy Exchange folder', /ERC Content Desk > Policy Exchange/, 'https://drive.google.com/drive/folders/1eSRrsHYDMnQZLoH-rOMilx40V7c8nsd_'],   // where each publish files its copy (api/publish.js)
  ['READ ME FIRST - ERC Content Desk', /READ ME FIRST/, 'https://docs.google.com/document/d/1DHzMJCA_Alep8suiZi7iICzLGSKtexvm6Z1yqVEoUFg/edit'],   // the team's handoff doc (Oct 26)
];
const NAMED_AFTER = [/project erc-content-desk/g, /the erc-content-desk address/g, /the subscribe to listserve address/g, /erc-content-desk script/g, /subscribe to listserve script/g];
// The Google scripts guide keeps the folders' and the sources Sheet's ids off its
// page (tests/scripts-howto.test.js: the teammate reads an id off the file's own
// address), so there those files are named with where they sit instead.
const OFF_PAGE = { 'how-to/google-scripts/index.html': ['the scrapes folder', 'ERC Research Briefs', 'Scraper sources'] };
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const outLink = (href, words) => `<a href="${href}" target="_blank" rel="noopener">${words}<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`;
// A unit's words: no script, style or code, no tag, no address of the desk's
// own site or repository (which carry the Sheet's name), nothing named after a Sheet.
const wordsOf = (html) => {
  let words = unesc(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<code>[\s\S]*?<\/code>/g, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/&#39;|&#x27;|&rsquo;/g, "'")
    .replace(/\S*(?:erc-content-desk\.vercel\.app|github\.com\/\S*erc-content-desk)\S*/g, ' ')
    .replace(/\s+/g, ' ');
  for (const re of NAMED_AFTER) words = words.replace(re, ' ');
  return words;
};
// A page's units: each slide with what follows it to the next (the last one
// carries the page's foot), or the whole page where it has no slides.
const unitsOf = (html) => (html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html).split(/(?=<div class="slide[ "])/);
const howToPages = [
  ...readdirSync(howToDir, { recursive: true }).filter((f) => /(^|\/)index\.html$/.test(f)).map((f) => [`how-to/${f}`, new URL(f, howToDir)]),
  ['newsletter/read-me/index.html', new URL('../newsletter/read-me/index.html', import.meta.url)],
];

test('every Google file a how-to names is a link on the slide that names it', () => {
  let seen = 0;
  for (const [name, file] of howToPages) {
    unitsOf(readFileSync(file, 'utf8')).forEach((unit, k) => {
      const words = wordsOf(unit);
      for (const [what, re, link] of GOOGLE_FILES) {
        const at = words.search(re);
        if (at < 0) continue;
        seen += 1;
        if (OFF_PAGE[name]?.includes(what)) {
          assert.ok(/ERC Content Desk > /.test(words), `${name}, unit ${k}: names ${what} with neither its link nor where it sits`);
          continue;
        }
        assert.ok(unit.includes(`href="${link}`), `${name}, unit ${k}: names ${what} without its link: "${words.slice(Math.max(0, at - 70), at + 90).trim()}"`);
      }
    });
  }
  assert.ok(seen >= 14, `slides that name a Google file (${seen})`);
});

test('the desk guide carries every Google file\'s address it names, and the links are the decks\' outside-link idiom', () => {
  const guide = readFileSync(new URL('desk-guide.txt', howToDir), 'utf8');
  const words = guide.replace(/\S*(?:erc-content-desk\.vercel\.app|github\.com\/\S*erc-content-desk)\S*/g, ' ');
  for (const [what, re, link] of GOOGLE_FILES) if (re.test(words)) assert.ok(guide.includes(link), `the desk guide names ${what} without its address`);
  for (const [name, file] of howToPages) {
    const html = readFileSync(file, 'utf8');
    for (const [what, , link] of GOOGLE_FILES) {
      for (const [tag] of html.matchAll(new RegExp(`<a [^>]*href="${reEsc(link)}[^"]*"[^>]*>`, 'g'))) {
        assert.ok(/target="_blank"/.test(tag) && /rel="noopener"/.test(tag), `${name}: the link to ${what} opens in a new tab: ${tag}`);
      }
    }
  }
});

// The handoff doc (Oct 26): one name, READ ME FIRST - ERC Content Desk, one
// address. The older handoff doc is trashed, so its name and its id appear
// nowhere the desk or its docs are read from. Both are built from halves here,
// so this file is not a hit either.
const OLD_DOC_NAME = ['READ ME FIRST', 'ERC handoff'].join(' - ');
const OLD_DOC_ID = ['1z5oB', 'DDbAEXyw-IZ7biZoE1-VUJgwxi9qaUlBP5hH-mo'].join('');   // split so a grep for the id's first eight characters finds nothing here either
test('the old handoff doc\'s name and id appear nowhere in js/, how-to/ or docs/', () => {
  const root = new URL('../', import.meta.url);
  const files = ['js', 'how-to', 'docs'].flatMap((d) => readdirSync(new URL(`${d}/`, root), { recursive: true }).filter((f) => /\.(js|mjs|json|html|md|txt|css|gs)$/.test(f)).map((f) => `${d}/${f}`));
  assert.ok(files.length > 60, `files read (${files.length})`);
  for (const f of files) {
    const text = readFileSync(new URL(f, root), 'utf8');
    assert.ok(!text.includes(OLD_DOC_NAME), `${f} names the old handoff doc`);
    assert.ok(!text.includes(OLD_DOC_ID), `${f} carries the old handoff doc's id`);
  }
  assert.ok(deckPage('change-the-desk').includes(outLink(GOOGLE_FILES.find((f) => f[0] === 'READ ME FIRST - ERC Content Desk')[2], 'READ ME FIRST - ERC Content Desk')), 'Who to ask links the doc by its name');
});

// Where the password is (Kate, Oct 23): in READ ME FIRST - ERC Content Desk (its name since Oct 26, linked), and
// the how-tos say so plainly. The value itself is never written anywhere.
// Oct 24 (the trim): one password, one name, the handoff's: the team
// password. Where it is kept is said once, in Change the desk's Who to ask,
// and every guide that asks for it links there.
test('the how-tos call it the team password, and say once where it is kept', () => {
  const files = readdirSync(howToDir, { recursive: true }).filter((f) => /\.(html|json|txt)$/.test(f));
  for (const f of files) {
    const text = readFileSync(new URL(f, howToDir), 'utf8');
    assert.doesNotMatch(text, /who has the password|says who has it/i, f);
    assert.doesNotMatch(text, /desk password|desk's password|Either password/i, `${f}: one password, one name`);
  }
  const ask = deckPage('change-the-desk');
  assert.ok(ask.includes('The team password is the one password.'), 'Who to ask names it');
  assert.ok(ask.includes(`It is in ${outLink(GOOGLE_FILES.find(f => f[0] === 'READ ME FIRST - ERC Content Desk')[2], 'READ ME FIRST - ERC Content Desk')} (on the team drive: Education Research Center &gt; ERC Content Desk), with the owner's name.`), 'and says where it is kept, with the doc linked');
  for (const d of ['exchange', 'research-briefs']) assert.ok(deckPage(d).includes('<a href="/how-to/change-the-desk/#ask">team password</a>'), `${d} links the team password to where it is kept`);
});

// The help button's script changes with the desk's (Oct 23: I need help! in
// the top bar), so every how-to loads it at the version the desk loads.
test('every how-to loads the help button at the desk\'s own version', () => {
  const desk = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/\/js\/problem-mount\.js\?v=(\d+)/)[1];
  const files = readdirSync(howToDir, { recursive: true }).filter((f) => /(^|\/)index\.html$|^make-(deck|page)\.mjs$/.test(f));
  assert.ok(files.length >= 13, `pages and makers (${files.length})`);
  for (const f of files) {
    const v = readFileSync(new URL(f, howToDir), 'utf8').match(/\/js\/problem-mount\.js\?v=(\d+)/);
    assert.ok(v, `${f} loads the help button`);
    assert.equal(v[1], desk, `${f} loads it at the desk's v=${desk}`);
  }
});

// Every link into a how-to's part lands on it (Kate, Oct 23): the Exchange
// hub's "How to publish to the Exchange" opened How to sort, which has no
// #exchange. A link's anchor must be an id on that page.
test('every link to a part of a how-to lands on an id on that page', () => {
  const root = new URL('../', import.meta.url);
  const files = [
    ...readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...readdirSync(new URL('builder/js/', root)).filter((f) => f.endsWith('.js')).map((f) => `builder/js/${f}`),
    ...readdirSync(howToDir, { recursive: true }).filter((f) => /\.(html|json)$/.test(f)).map((f) => `how-to/${f}`),
  ];
  const ids = new Map();
  const idsOf = (slug) => {
    if (!ids.has(slug)) {
      const file = new URL(`${slug}/index.html`, howToDir);
      ids.set(slug, existsSync(file) ? new Set([...readFileSync(file, 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])) : null);
    }
    return ids.get(slug);
  };
  let seen = 0;
  for (const f of files) {
    for (const [, slug, anchor] of readFileSync(new URL(f, root), 'utf8').matchAll(/\/how-to\/([a-z0-9-]+)\/#([A-Za-z0-9_-]+)/g)) {
      seen += 1;
      const on = idsOf(slug);
      assert.ok(on, `${f}: /how-to/${slug}/ has no page`);
      assert.ok(on.has(anchor), `${f}: /how-to/${slug}/#${anchor} lands on no id`);
    }
  }
  assert.ok(seen >= 5, `links to a part of a how-to (${seen})`);
});

// Since the trim (Oct 24) a link to a guide says the guide's own title.
test('the research brief how-to sends Publish readers to the Exchange guide\'s Publish part', () => {
  const page = deckPage('research-briefs');
  assert.ok(page.includes('<a href="/how-to/exchange/#publish">Publish and the Exchange: Publish</a>'), 'the Publish link');
  assert.ok(page.includes('<a href="/how-to/sort/#finalize">Sort the queue: Finalize</a>'), 'the Finalize link');
  assert.doesNotMatch(page, /How to sort|How to publish/, 'link words are the guides\' titles');
});

// I need help! (Kate, Oct 23): a quiet word that sends a note to the desk's
// owner through a form, in the sidebar's foot since the look of Oct 23. Ask
// Claude says so, in the button's words.
test('Ask Claude names the help button as the screen does, where it sits and where it sends', async () => {
  const { HELP_LABEL } = await import('../js/report-problem.js');
  const page = deckPage('ask-claude');
  assert.ok(page.includes(`Press <b>${HELP_LABEL}</b> in the sidebar. It sends a note to the desk's owner.`), 'the help line: in the sidebar\'s foot since the look of Oct 23');
  assert.doesNotMatch(page, /top bar/, 'the desk has no top bar');
  assert.doesNotMatch(page, /Report a problem|bottom right corner/, 'the corner button is gone');
});

// The brief folders (Kate, Oct 23): each path written in full once, and the
// prompts name the reader's own folder, never a real brief's.
test('the research brief how-to writes each folder in full once and names no real brief in its prompts', () => {
  const deck = readFileSync(new URL('research-briefs/deck.json', howToDir), 'utf8');
  const page = deckPage('research-briefs');
  for (const words of [deck, page]) {
    assert.doesNotMatch(words, /holzman/i, 'no real brief in a prompt');
    for (const path of ['ERC Content Desk / ERC Research Briefs / your brief\'s folder', 'ERC Content Desk / ERC Research Briefs / erc-research-briefs']) {
      assert.equal(words.split(path).length - 1, 1, `${path}, once`);
    }
  }
  for (const prompt of ['Put my text below into &lt;your brief\'s folder&gt;/brief-draft.md word for word.', 'on &lt;your brief\'s folder&gt;.</code>', '<code>&lt;your brief\'s folder&gt;-author-review.docx</code>', '<code>&lt;your brief\'s folder&gt;-author-edits.docx</code>', 'Build &lt;your brief\'s folder&gt;/brief.html']) {
    assert.ok(page.includes(prompt), prompt);
  }
});

// The newsletter draft lives in one browser (Kate, Oct 23: "say so plainly").
// The newsletter how-to says it on the first Outline slide, where an issue starts.
test('the newsletter how-to says the draft is saved in one browser, on the first Outline slide', () => {
  const line = 'The draft is saved only in the browser you build it in. Finish the issue there.';
  const outline = nl.slice(nl.indexOf('<section class="chapter" id="outline"'), nl.indexOf('<section class="chapter" id="tweak"'));
  const first = outline.split('<div class="slide" role="group"')[1];
  assert.ok(first.includes(line), 'on the first Outline slide');
  assert.ok(readFileSync(new URL('desk-guide.txt', howToDir), 'utf8').includes(line), 'and in the desk guide');
});

// Kate, Oct 23: How it all connects is a drawn diagram in place of the three
// boxes and "Beside the pipeline"; "The two weeks" stays. Oct 24, her pick of
// three redrawn versions: A, Tidied (her three bands and every box, the six
// pages in one row under the sidebar's groups, three filters on the picture
// and the rest listed under it), drawn for the 1200px column.
test('How it all connects shows version A of the diagram, keeps The two weeks, and drops the old drawings', () => {
  const page = readFileSync(new URL('../how-to/pipeline/index.html', import.meta.url), 'utf8');
  assert.match(page, /<figure class="pa-fig">\s*<svg class="pa-svg" viewBox="0 0 934 820" role="img" aria-label="How an item moves through the desk\./, 'version A, a picture with its words for a screen reader');
  assert.match(page, /<ul class="pa-more" aria-label="The other filters">/, 'the filters not on the picture, listed under it');
  assert.match(page, /<figcaption>Read the middle row left to right\./);
  assert.match(page, /\.ht-page\{max-width:1200px\}/, 'the column A is drawn for');
  assert.match(page, /<h2>The two weeks<\/h2>/);
  assert.match(page, /Who sends an item, what the desk does with it, and where it ends up\./, 'the lede says what the diagram shows (Kate, Oct 23)');
  assert.doesNotMatch(page, /Open a box for the whole step/);
  assert.match(page, /Any day: publish to the Exchange\./);
  assert.doesNotMatch(page, /class="pl-row"/);
  assert.doesNotMatch(page, /pl-diagram|viewBox="0 0 1150 760"/, 'the drawing of Oct 23 is gone');
  assert.doesNotMatch(page, /<h2>Beside the pipeline<\/h2>/);
  assert.equal(page.split('<figure').length - 1, 1, 'one figure');
  assert.ok(page.indexOf('<figure class="pa-fig">') < page.indexOf('<h2>The two weeks</h2>'), 'the diagram comes before The two weeks');
});

// The desk guide reads the drawn diagram as words (review, Oct 23): what it
// shows, as a screen reader hears it, then each of its labels on a line of its
// own, never run together.
test('the desk guide reads the pipeline diagram as words, a label to a line', () => {
  const page = readFileSync(new URL('../how-to/pipeline/index.html', import.meta.url), 'utf8');
  const guide = readFileSync(new URL('desk-guide.txt', howToDir), 'utf8');
  const from = guide.indexOf('\n# How it all connects\n');
  assert.ok(from >= 0, 'the diagram\'s guide is in the desk guide');
  const next = guide.indexOf('\n# ', from + 1);
  const part = guide.slice(from, next < 0 ? undefined : next);
  const said = page.match(/<svg class="pa-svg" viewBox="0 0 934 820"[^>]*aria-label="([^"]+)"/)[1];
  assert.ok(part.includes(said), 'what the diagram shows, in its own words');
  const lines = part.split('\n');
  const labels = [...page.slice(page.indexOf('<figure class="pa-fig">'), page.indexOf('</figure>')).matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)].map((m) => unesc(m[1].replace(/&#x27;/g, "'")));
  assert.ok(labels.length >= 60, `the diagram's labels (${labels.length})`);
  for (const label of labels) assert.ok(lines.includes(label), `"${label}" on a line of its own`);
  assert.doesNotMatch(part, /Out in the worldOn the desk|&#x27;/, 'nothing run together or left as code');
  assert.ok(part.includes('Read the middle row left to right.'), 'and its caption');
  assert.ok(part.includes('Coming in You review a split doc or sheet.'), 'the listed filters, each name apart from its words');
});

// ── The trim (Oct 24, 2026; the owner: "some of the how-tos are SOOOOO
// redundant"). One copy of each repeated topic, in the guide the How-tos panel
// opens for its page. Change the desk keeps only what is its own, who to ask
// and what needs code: its four hub chapters went to the hubs' guides (An item
// and the scraper to Sort the queue, the send dates to Build the newsletter)
// or were cut where the screen says it (the Exchange, the listserv), and the
// Exchange's look came in from the Exchange guide.
test('Change the desk is who to ask and what needs code, and nothing a hub\'s guide says', () => {
  const deck = JSON.parse(readFileSync(new URL('change-the-desk/deck.json', howToDir), 'utf8'));
  assert.deepEqual(deck.chapters.map((c) => [c.id, c.name]), [['ask', 'Who to ask'], ['look', 'The Exchange\'s look']]);
  const page = deckPage('change-the-desk');
  assert.match(page, /<h2 [^>]*id="h-code">Needs code<\/h2>/, 'the table of what needs code');
  assert.doesNotMatch(page, /<img /, 'no screen pictured: each lives in its hub\'s guide');
  assert.ok(!existsSync(new URL('change-the-desk/shots/', howToDir)), 'no stills left behind');
  for (const gone of ['Where it is now', 'Issues and send dates', 'Edit live items', 'To see Sheet 1', 'Newsletter scrapes']) assert.ok(!page.includes(gone), `${gone} is a hub guide's`);
  const exchange = JSON.parse(readFileSync(new URL('exchange/deck.json', howToDir), 'utf8'));
  assert.deepEqual(exchange.chapters.map((c) => c.id), ['publish', 'highlight', 'fix'], 'the look moved out of the Exchange guide');
  assert.equal(exchange.h1, 'Publish and the Exchange', 'named for what it holds now');
});

test('the hub chapters of Change the desk live in their hubs\' guides, their stills with them', () => {
  const sort = JSON.parse(readFileSync(new URL('sort/deck.json', howToDir), 'utf8'));
  assert.deepEqual(sort.chapters.map((c) => [c.id, c.name]), [['scraper', 'The scraper'], ['keep', 'Keep or delete'], ['sources', 'Sources'], ['card', 'Card and list'], ['finalize', 'Finalize'], ['fix', 'Fix an item later']]);
  const shots = JSON.parse(readFileSync(new URL('sort/shots.json', howToDir), 'utf8')).map((s) => s.name);
  for (const shot of ['scraper', 'issue-edit']) {
    assert.ok(existsSync(new URL(`sort/shots/${shot}.png`, howToDir)), `${shot} moved with its chapter`);
    assert.ok(shots.includes(shot), `${shot} is captured with Sort's stills`);
  }
  assert.ok(deckPage('sort').includes('Never fix an item in the Sheet\'s first tab.'));
  assert.ok(existsSync(new URL('newsletter/shots/schedule.png', howToDir)), 'the Schedule still moved with Send dates');
  assert.ok(JSON.parse(readFileSync(new URL('newsletter/shots.json', howToDir), 'utf8')).some((s) => s.name === 'schedule'));
  assert.ok(nl.includes('A date shown as 11/10/2026 is skipped.'));
  assert.ok(nl.includes('To fix an archived issue'), 'fixing an archived issue sits with Save to the archive');
});

// Add a source (Oct 24, the owner's pick "feeds run on their own"): the
// Content queue's form puts a site's feed on the Scraper sources Sheet and
// each run reads the Sheet's switched-on feeds, so no guide may still say the
// scraper never reads that Sheet, and the scraper's slide shows the button.
test('the guides say what Add a source does: the scraper reads the Sheet\'s feeds', () => {
  const sort = JSON.parse(readFileSync(new URL('sort/deck.json', howToDir), 'utf8'));
  const slide = JSON.stringify(sort.chapters.find((c) => c.id === 'scraper'));
  const pins = JSON.parse(readFileSync(new URL('sort/shots/scraper.json', howToDir), 'utf8')).pins.map((p) => p.label);
  assert.ok(pins.some((l) => l.startsWith('Add a source')), 'the still pins Add a source');
  assert.match(slide, /Scraper sources Sheet/, 'the slide says where a source it adds goes');
  for (const d of readdirSync(howToDir).filter((x) => existsSync(new URL(`${x}/index.html`, howToDir)))) {
    assert.doesNotMatch(deckPage(d), /does not read the Scraper sources Sheet/, `${d} says the scraper ignores the Sheet`);
  }
  assert.doesNotMatch(readFileSync(new URL('desk-guide.txt', howToDir), 'utf8'), /does not read the Scraper sources Sheet/);
  assert.doesNotMatch(deckPage('change-the-desk'), /<td>The scraper's sources or its Monday time<\/td>/, 'Add a source is no code');
});

test('each repeated topic is told once, in its guide', () => {
  const visible = (html) => unesc(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<span class="tip"[^>]*>[^<]*<\/span>/g, '').replace(/ aria-label="[^"]*"/g, '').replace(/<[^>]+>/g, ' ')).replace(/&#39;|&rsquo;/g, '\'').replace(/\s+/g, ' ');
  const pages = Object.fromEntries(readdirSync(howToDir).filter((d) => existsSync(new URL(`${d}/index.html`, howToDir))).map((d) => [d, visible(deckPage(d))]));
  pages['read-me'] = visible(readFileSync(new URL('../newsletter/read-me/index.html', import.meta.url), 'utf8'));
  const on = (phrase) => Object.keys(pages).filter((k) => pages[k].toLowerCase().includes(phrase.toLowerCase())).sort();
  const topics = [
    ['READ ME FIRST', ['change-the-desk', 'google-scripts']],   // who to ask, and where the team password is kept; the Google scripts' Send names it for the owner's address (the owner, Oct 26)
    ['3 to 5 research', ['newsletter']],                  // the issue's aim
    ['ERC Newsletter only', ['sort']],                    // what reaches the Exchange
    ['Use original', ['sort']],                           // Finalize
    ['Publish N to the Exchange', ['exchange']],          // Publish
    ['Drive picture', ['exchange']],                      // the highlight's photo rule
    ['Hide from the site', ['exchange']],                 // fixing what is live
    ['Exchange\'s GitHub repo', ['change-the-desk']],     // the Exchange's look, in code
    ['Contents strip', ['newsletter']],                   // what the builder can do
  ];
  for (const [phrase, home] of topics) assert.deepEqual(on(phrase), home, `"${phrase}"`);
  for (const [k, text] of Object.entries(pages)) assert.doesNotMatch(text, /on a phone|in the top bar/i, `${k}: the desk is computer-only and has a sidebar`);
});

// All how-tos (Oct 24): the panel's guides, under the panel's headings, by
// their own titles, each with its line, so the list and the panel never drift.
test('All how-tos lists every guide under the panel\'s headings, by title, with its line', async () => {
  const { GROUPS, GUIDES } = await import('../js/howto-index.js');
  const index = readFileSync(new URL('index.html', howToDir), 'utf8');
  assert.deepEqual([...index.matchAll(/<h2 class="ht-group"[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]), GROUPS);
  const rows = [...index.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><br>([^<]+)<\/li>/g)].map((m) => [m[1], unesc(m[2]), unesc(m[3])]);
  assert.deepEqual(rows, GROUPS.flatMap((g) => GUIDES.filter((x) => x.group === g).map((x) => [x.href, x.title, x.line])));
  assert.doesNotMatch(index, /How to /, 'the guides\' own titles');
});

// Verification of the trim (Oct 24): each slide that has the reader type the
// team password links to where it is kept, so a reader who opens a guide at
// that part (the How-tos panel on Publish or Highlight lands there) is never
// left without it. Change the desk's Who to ask is that place.
test('every slide that asks for the team password links to where it is kept', () => {
  let seen = 0;
  for (const d of decks.filter((x) => x !== 'change-the-desk')) {
    for (const slide of deckPage(d).split(/<div class="slide[ "]/).slice(1)) {
      const words = slide.split('<div class="frame">')[0];
      if (!/team password/i.test(words)) continue;
      seen += 1;
      assert.ok(slide.includes('href="/how-to/change-the-desk/#ask"'), `${d}: a slide names the team password and does not link to Who to ask: ${words.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}`);
    }
  }
  assert.ok(seen >= 3, `slides that ask for it (${seen})`);
});

// The how-tos load the desk's own stylesheet at the desk's version, bumped
// together (make-page.mjs: "at index.html's versions: bump them together").
test('every how-to loads the desk\'s stylesheets at the desk\'s own versions', () => {
  const desk = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const files = [
    ...readdirSync(howToDir, { recursive: true }).filter((f) => /(^|\/)index\.html$|^make-(deck|page)\.mjs$/.test(f)).map((f) => new URL(f, howToDir)),
    new URL('../newsletter/read-me/index.html', import.meta.url),
  ];
  for (const sheet of ['styles', 'shell', 'tokens']) {
    const want = desk.match(new RegExp(`/css/${sheet}\\.css\\?v=(\\d+)`))[1];
    for (const f of files) {
      const v = readFileSync(f, 'utf8').match(new RegExp(`/css/${sheet}\\.css\\?v=(\\d+)`));
      if (v) assert.equal(v[1], want, `${f.pathname.split('/').slice(-2).join('/')} loads ${sheet}.css at the desk's v=${want}`);
    }
  }
});

// An id names one place on a page: a link to #types landed on the section
// only because it came first; the types table carried the same id.
test('no how-to page gives two elements the same id', () => {
  const files = readdirSync(howToDir, { recursive: true }).filter((f) => /(^|\/)index\.html$/.test(f));
  for (const f of files) {
    const ids = [...readFileSync(new URL(f, howToDir), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(twice, [], `${f}: ids used twice`);
  }
});
