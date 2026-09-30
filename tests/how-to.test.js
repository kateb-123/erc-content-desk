import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TYPES, TYPE_ORDER, TYPE_DISPLAY } from '../js/schema.js';
import { QUICK_LINKS } from '../js/team-ui.js';

// The team's how-to (Kate, Sep 30, 2026): a deck of slides on the desk's open
// side, one slide at a time, that shows the real Submit content form being
// filled in, names every type the way the screen does, and ends with a
// practice run on the real form module that saves nothing. It is a static
// page, so its words are read from the file.
const page = readFileSync(new URL('../how-to/submit-content/index.html', import.meta.url), 'utf8');

test('the deck links the team page and the three public pages, and only those addresses', () => {
  assert.match(page, /https:\/\/erc-content-desk\.vercel\.app\/#team/);
  for (const { href } of QUICK_LINKS) assert.ok(page.includes(`href="${href}"`), href);
  const addresses = new Set(page.match(/https?:\/\/[^\s"'<)]+/g));
  const allowed = new Set(['https://erc-content-desk.vercel.app/#team', ...QUICK_LINKS.map(l => l.href), 'https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;600;700&display=swap', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css', 'http://www.w3.org/2000/svg']);
  for (const a of addresses) assert.ok(allowed.has(a), `an address the deck should not carry: ${a}`);
});

test('the types are named as the screen names them, with every subtype', () => {
  for (const type of TYPE_ORDER) assert.ok(page.includes(TYPE_DISPLAY[type]), TYPE_DISPLAY[type]);
  for (const type of TYPE_ORDER) for (const sub of TYPES[type].subtypes) assert.ok(page.includes(sub.replace(/&/g, '&amp;')), sub);
  assert.doesNotMatch(page, /New Ed Policy Research/, 'the Sheet’s name, never shown on the form');
});

test('the practice run is the real form, and its post never leaves the page', () => {
  assert.match(page, /\/js\/submit-form\.js/);
  assert.match(page, /window\.fetch = /, 'the practice stub stands in for the desk');
  assert.match(page, /\/api\/submit/);
});

test('the words are the desk’s own and carry no dash', () => {
  assert.doesNotMatch(page, /[–—]/, 'no en or em dash');
  for (const words of ['Add to the queue', 'Add a doc or spreadsheet', 'Every item needs a link', 'Copy link', 'Quick links']) assert.ok(page.includes(words), words);
});
