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

// ── The newsletter builder's how-to (Kate, Sep 30, 2026, evening): the same
// pattern for whoever builds an issue, three tabs under the band (Where items
// come from, Build the issue, Send and archive), the middle one with a tab per
// builder step, one slide each with a recording of the real desk. No Claude
// note: the builder never calls it. Linked from Next issue and the front page.
const nl = readFileSync(new URL('../how-to/newsletter/index.html', import.meta.url), 'utf8');
const builderPage = readFileSync(new URL('../builder/index.html', import.meta.url), 'utf8');
const issueUi = readFileSync(new URL('../js/issue-ui.js', import.meta.url), 'utf8');

test('the newsletter how-to opens the Newsletter page and carries no other address', () => {
  assert.match(nl, /https:\/\/erc-content-desk\.vercel\.app\/#newsletter/);
  const addresses = new Set(nl.match(/https?:\/\/[^\s"'<)]+/g));
  const allowed = new Set(['https://erc-content-desk.vercel.app/#newsletter', 'https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;600;700&display=swap', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css', 'http://www.w3.org/2000/svg']);
  for (const a of addresses) assert.ok(allowed.has(a), `an address the how-to should not carry: ${a}`);
  assert.doesNotMatch(nl, /fetch\(|window\.fetch/, 'nothing on the page reads or writes the desk');
});

test('the newsletter how-to has the three tabs, a tab per builder step named as the builder names it, and the desk’s own words', () => {
  for (const words of ['Where items come from', 'Build the issue', 'Send and archive', 'Ready to add', 'Quick add', 'Open the builder', 'Pull from the desk', 'Copy HTML', 'Save to the archive', 'Past issues', 'never in Outlook']) assert.ok(nl.includes(words), words);
  // Three steps since Oct 7, 2026: the Review step's Issue and Pull sit at the head of Outline.
  for (const step of ['Outline', 'Preview &amp; Tweak', 'Save &amp; Export']) {
    assert.ok(nl.includes(`data-tab="${step}"`), `${step} is a tab`);
    assert.ok(builderPage.includes(step), `${step} is the builder’s own name for the step`);
  }
  assert.doesNotMatch(nl, /[–—]/, 'no en or em dash');
  assert.doesNotMatch(nl, /Kate|Kathy/, 'no name on a team page');
  assert.doesNotMatch(nl, /Claude/, 'the builder never calls Claude, so no note');
});

test('every slide of the newsletter how-to carries a recording of the real desk', () => {
  const slides = nl.match(/<div class="slide[^"]*" data-tab="[^"]+">/g) ?? [];
  assert.equal(slides.length, 4, 'four slides: Next issue, then the three builder steps');
  const videos = nl.match(/<source src="[a-z-]+\.webm" type="video\/webm" \/>/g) ?? [];
  assert.equal(videos.length, 4, 'a recording on each');
  assert.ok(!nl.includes('data-tab="Review"'), 'the Review step is gone (Oct 7, 2026)');
});

test('Next issue links the newsletter how-to beside Open the builder', () => {
  assert.match(issueUi, /'\/how-to\/newsletter\/'/);
});
