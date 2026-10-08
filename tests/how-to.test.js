import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// ── The newsletter builder's how-to (Kate, Sep 30, 2026, evening; one page
// since Oct 7): where items come from, the three steps, the send from
// erc@tamu.edu, and every option, read top to bottom with a contents strip.
// Each part is the steps beside a recording of the real desk where one
// exists. No Claude note: the builder never calls it. Linked from Next issue
// and the front page.
const nl = readFileSync(new URL('../how-to/newsletter/index.html', import.meta.url), 'utf8');
const builderPage = readFileSync(new URL('../builder/index.html', import.meta.url), 'utf8');
const builderApp = readFileSync(new URL('../builder/js/app.js', import.meta.url), 'utf8');
const builderOptions = readFileSync(new URL('../builder/js/options.js', import.meta.url), 'utf8');
const builderModel = readFileSync(new URL('../builder/js/model.js', import.meta.url), 'utf8');
const builderWizard = readFileSync(new URL('../builder/js/wizard.js', import.meta.url), 'utf8');
const builderWords = builderPage + builderApp + builderOptions + builderModel + builderWizard;
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
  assert.doesNotMatch(nl, /fetch\(|window\.fetch/, 'nothing on the page reads or writes the desk');
});

test('the newsletter how-to is one page in the order the work happens, with a contents strip to each part', () => {
  const parts = ['items', 'outline', 'tweak', 'export', 'send', 'options'];
  for (const id of parts) {
    assert.match(nl, new RegExp(`<section class="part" id="${id}">`), `${id} is a part`);
    assert.ok(nl.includes(`href="#${id}"`), `${id} is in the contents strip`);
  }
  const order = parts.map((id) => nl.indexOf(`id="${id}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the parts run in the order the work happens');
  for (const words of ['Where items come from', 'Send from erc@tamu.edu', 'The options']) assert.ok(nl.includes(words), words);
  // Each builder step is a part, named as the builder names it.
  for (const step of ['Outline', 'Preview &amp; Tweak', 'Save &amp; Export']) {
    assert.match(nl, new RegExp(`<h2>\\d ${step.replace(/[&;]/g, (c) => `\\${c}`)}</h2>`), `${step} is a numbered part`);
    assert.ok(builderPage.includes(step), `${step} is the builder's own name for the step`);
  }
  assert.ok(!nl.includes('data-tab='), 'no tabs inside tabs');
  assert.doesNotMatch(nl, /[–—]/, 'no en or em dash');
  assert.doesNotMatch(nl, /Kate|Kathy/, 'no name on a team page');
  assert.doesNotMatch(nl, /Claude/, 'the builder never calls Claude, so no note');
});

test('the newsletter how-to says what it should in the desk\'s own words', () => {
  for (const words of ['Ready to add', 'Quick add', 'Open the builder', 'Pull from the desk', 'Samples', 'Copy HTML', 'Save to the archive', 'Past issues', 'never in Outlook', 'Submit content', 'Sort', 'Finalize', 'Publish']) assert.ok(nl.includes(words), words);
});

test('the recordings: one for Next issue and one per builder step, each with its pause', () => {
  const videos = nl.match(/<source src="[a-z-]+\.webm" type="video\/webm" \/>/g) ?? [];
  assert.equal(videos.length, 4, 'four recordings');
  assert.equal((nl.match(/class="linkish rec-toggle"/g) ?? []).length, 4, 'a Pause on each');
  for (const name of ['next-issue', 'outline', 'edit', 'export']) assert.ok(nl.includes(`src="${name}.webm"`), name);
});

test('the send part teaches the add-in route from the personal mailbox to erc@tamu.edu, both ways, with the two warnings', () => {
  const send = nl.slice(nl.indexOf('id="send"'), nl.indexOf('id="options"'));
  for (const words of ['Insert HTML by Designmodo', 'designmodo.png', 'personal TAMU account', 'Apps', 'Get Add-ins', 'Paste HTML', 'Insert HTML', 'Forward:', 'Copy:', 'select all', 'erc@tamu.edu', 'never paste the HTML into a message as text', 'never copy the .html from a browser window']) {
    assert.ok(send.toLowerCase().includes(words.toLowerCase()), words);
  }
  assert.ok(send.includes('appsource.microsoft.com') && send.includes('support.microsoft.com'), 'the add-in and Microsoft\'s page on add-ins are linked');
});

test('every option the how-to lists is a control the builder names, in the builder\'s own words', () => {
  const options = nl.slice(nl.indexOf('id="options"'));
  const names = [
    'Pull from the desk', 'Move to…', 'Remove', 'Undo', 'Recently discarded', 'Restore',
    'Done', 'Use original', 'Undo changes', 'How it is laid out', 'Title and details', 'With description', 'Stamp beside the text', 'Headshot beside it all', 'Date card',
    'Picture size, px', 'Zoom available', 'Flyer link', 'Kind', 'Research Brief', 'Research Report', 'Journal Article', 'ERC Explains',
    'Its words', 'Its style', 'Maroon block', 'Light gray box', 'Dotted rule', 'Add an item', 'Add a callout', 'Contents strip', 'Reset layout',
    'Copy HTML', 'Save to the archive', 'Download .html', 'Start the next issue', 'Sample issue (fictional)', 'October 6, 2026, as sent',
  ];
  for (const name of names) {
    assert.ok(options.includes(name), `the how-to lists ${name}`);
    assert.ok(builderWords.includes(name), `the builder names ${name}`);
  }
});

test('Next issue links the newsletter how-to beside Open the builder', () => {
  assert.match(issueUi, /'\/how-to\/newsletter\/'/);
});
