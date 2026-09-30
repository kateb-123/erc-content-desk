import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TYPE_ORDER } from '../js/schema.js';
import { QUICK_LINKS } from '../js/team-ui.js';

// The team's how-to (Kate, Sep 30, 2026): a deck of slides on the desk's open
// side, one slide at a time, that shows the real Submit content form being
// filled in, names every type the way the screen does, and gives each
// tab a type with the newest example live on the Exchange. It is a static
// page, so its words are read from the file.
const page = readFileSync(new URL('../how-to/submit-content/index.html', import.meta.url), 'utf8');

test('the deck links the team page and the three public pages, and only those addresses', () => {
  assert.match(page, /https:\/\/erc-content-desk\.vercel\.app\/#team/);
  // The Links to share rows are drawn from QUICK_LINKS itself, so the three
  // public addresses are never retyped here.
  const words = page.replace('https://erc-policy-exchange.vercel.app/data/news.csv', '');
  for (const { href } of QUICK_LINKS) assert.ok(!words.includes(href), `${href} retyped on the page`);
  const addresses = new Set(page.match(/https?:\/\/[^\s"'<)]+/g));
  const allowed = new Set(['https://erc-content-desk.vercel.app/#team', ...QUICK_LINKS.map(l => l.href), 'https://erc-policy-exchange.vercel.app/data/news.csv', 'https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;600;700&display=swap', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css', 'http://www.w3.org/2000/svg', 'https://example.org/aggie/whoop-webinar', 'https://example.org/aggie/gig-em-grants', 'https://example.org/aggie/reveille-superintendent']);
  for (const a of addresses) assert.ok(allowed.has(a), `an address the deck should not carry: ${a}`);
  assert.match(page, /import \{ QUICK_LINKS \} from '\/js\/team-ui\.js'/, 'the Links to share rows are the team page’s own');
});

test('the templates can be downloaded from the page, and the spreadsheet is named best', () => {
  assert.match(page, /href="\/templates\/erc-upload-template\.xlsx" download/);
  assert.match(page, /href="\/templates\/erc-upload-template\.docx" download/);
  assert.match(page, /The spreadsheet is best/);
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
  for (const words of ['Item types', 'Use it for', 'Add one item', 'Bulk add items', 'Add to the queue', 'Add a doc or spreadsheet', 'Every item needs a link', 'Copy link', 'Quick links']) assert.ok(page.includes(words), words);
});
