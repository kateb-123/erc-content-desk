// tests/email-pages.test.js: the newsletter's HTML on the front page (Kate,
// Oct 8: "the newsletter html is going to go onto the content desk main
// page", then "i don't think I want them as downloads... the builder has the
// most recent html template right now. that's what we should be using...
// they can all link in vercel"). Three links on the Newsletter card, each a
// page of its own: the blank template and the fictional sample, each drawn
// from the builder's own template whenever it is opened, so a change to the
// template reaches the builder and both pages at once; and a read me that
// says where a permanent change goes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hubCards } from '../js/home-panel.js';
import { EMAIL_PAGES } from '../js/email-pages.js';
import { SAMPLES } from '../builder/js/wizard.js';
import { SECTION_REGISTRY, countIssueItems } from '../builder/js/model.js';
import { renderNewsletter, calloutsOf } from '../builder/js/template.js';
import { placeholderItems } from '../builder/js/options.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const blank = JSON.parse(read('../builder/fixtures/blank-issue.json'));
const practice = JSON.parse(read('../builder/fixtures/practice-issue.json'));

test('the Newsletter card carries the three pages as links, in her order', () => {
  const card = hubCards({ rows: [], schedule: [], today: '2026-10-08', loaded: true, preview: null, archive: [], hubUpdated: null, signups: null })
    .find(c => c.key === 'newsletter');
  assert.deepEqual(card.links, EMAIL_PAGES.map(p => ({ label: p.label, href: p.href, blank: true })));
  // The read me leads (Kate, Oct 8: "lets just have the read me first").
  assert.deepEqual(EMAIL_PAGES.map(p => [p.key, p.href]), [
    ['readme', '/newsletter/read-me/'],
    ['blank', '/newsletter/template/'],
    ['sample', '/newsletter/sample/'],
  ]);
  assert.deepEqual(EMAIL_PAGES.map(p => p.label), ['Read me', 'Blank template', 'Sample issue']);
});

test('the blank template is the practice issue\'s shape with placeholder words, a stand-in picture only where a slot shows one', () => {
  assert.equal(blank.sample, 'blank', 'never saves to the archive');
  for (const reg of SECTION_REGISTRY) {
    assert.equal(blank.sections[reg.key]?.items.length, practice.sections[reg.key].items.length, `${reg.key} has every slot the sample has`);
  }
  assert.deepEqual(blank.sections.research.items.map(i => i.group), practice.sections.research.items.map(i => i.group));
  const fields = Object.values(blank.sections).flatMap(s => s.items.map(i => i.fields));
  assert.ok(fields.every(f => f.title === 'Item title'), 'every item is Item title');
  assert.ok(fields.every(f => !f.image || /sample-(chart|headshot)\.png$/.test(f.image)), 'only the sample\'s stand-in pictures, where a slot shows one');
  assert.ok(fields.every(f => !f.summary || f.summary === 'One or two sentences about the item.'));
  assert.deepEqual(calloutsOf(blank).map(c => c.kind).sort(), ['custom', 'share'], 'both callouts, the share one as it really reads');
  assert.doesNotMatch(JSON.stringify(blank), /Imaginary|Pretend|Reveille|Howdy|Made-Up/, 'nothing of the sample\'s jokes');
  assert.deepEqual(placeholderItems(blank), [], 'nothing waits on a photo');
});

test('each page draws its issue through the builder\'s own template, with Copy HTML', () => {
  const page = read('../newsletter/template/index.html');
  const sample = read('../newsletter/sample/index.html');
  for (const src of [page, sample]) {
    assert.match(src, /<script type="module" src="\/js\/email-page\.js\?v=\d+">/, 'one script for both');
    assert.match(src, /<iframe class="email-sheet"/);
    assert.match(src, /Copy HTML/);
    assert.doesNotMatch(src, /[–—]/, 'no dashes');
  }
  assert.match(page, /data-issue="\/builder\/fixtures\/blank-issue\.json"/);
  assert.match(sample, /data-issue="\/builder\/fixtures\/practice-issue\.json"/);
  assert.equal(SAMPLES.find(s => s.key === 'practice').file, 'fixtures/practice-issue.json', 'the same file the builder\'s Issue list opens');
  const script = read('../js/email-page.js');
  assert.match(script, /import \{ renderNewsletter \} from '\/builder\/js\/template\.js';/, 'the builder\'s template, not a copy');
  assert.match(script, /renderNewsletter\(await res\.json\(\)\)/);
});

test('the read me lists what the builder does, keeps Claude Code for big style changes, and names no one', () => {
  const readme = read('../newsletter/read-me/index.html');
  assert.match(readme, /builder\/js\/template\.js/, 'the one file a permanent change goes in');
  assert.match(readme, /Claude Code/);
  // Kate, Oct 8: "some of those things you can do in the builder ... big editing is only for like big style changes".
  for (const words of ['Move to…', 'Remove', 'Undo', 'Add an item', 'Add a callout', 'Contents strip', 'Reset layout', 'Use original', 'Title and details', 'With description', 'Stamp beside the text', 'Headshot beside it all', 'Date card', 'Add media', 'Research Brief', 'ERC Explains', 'Maroon block', 'Light gray box', 'Dotted rule', 'Save to the archive']) {
    assert.ok(readme.includes(words), `the builder's own words: ${words}`);
  }
  assert.match(readme, /big style change/i);
  assert.doesNotMatch(readme, /paste the code into Claude/, 'one email is never edited outside the builder');
  assert.match(readme, /Blank template/);
  assert.match(readme, /Sample issue/);
  assert.match(readme, /Copy HTML/);
  assert.doesNotMatch(readme, /Kate|Kathy/, 'no name on a team page');
  assert.doesNotMatch(readme, /[–—]/, 'no dashes');
  assert.doesNotMatch(readme, /download/i, 'links, not downloads (Kate, Oct 8)');
  for (const p of EMAIL_PAGES.filter(p => p.key !== 'readme')) assert.ok(readme.includes(`href="${p.href}"`), `links ${p.label}`);
});

test('the blank and the sample both render as a whole email', () => {
  for (const issue of [blank, practice]) {
    const html = renderNewsletter(issue);
    assert.ok(html.startsWith('<!DOCTYPE html'));
    assert.ok(countIssueItems(issue) >= 20);
    assert.doesNotMatch(html, /dashed/, 'no photo placeholder in the email');
  }
});
