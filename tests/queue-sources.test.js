// tests/queue-sources.test.js: the Add a source form in the Content queue's
// Scraper block (the owner's pick "feeds run on their own", Oct 24, 2026).
// An outline button beside Run the scraper opens a short form: the name, the
// address, what it posts, and what kind (a site or feed, or an email
// newsletter). The desk answers in plain words; a refusal keeps the form and
// what was typed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceAnswer, sourceFormProblem, SOURCE_KINDS, SOURCE_TYPES } from '../js/queue-view.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('sourceAnswer: the three plain answers, one per outcome', () => {
  assert.deepEqual(sourceAnswer('feed'), { tone: 'success', words: 'Added. The scraper reads its feed from next Monday.' });
  assert.deepEqual(sourceAnswer('no feed'), { tone: 'info', words: 'Saved, but it has no feed, so the scraper cannot read it yet.' });
  assert.deepEqual(sourceAnswer('email'), { tone: 'info', words: 'Saved as an email newsletter. The scraper cannot read email.' });
  assert.equal(sourceAnswer('something new'), null);
});

test('sourceFormProblem: the form says what is missing before it asks the desk', () => {
  assert.deepEqual(sourceFormProblem({ name: ' ', address: 'https://example.org', type: 'event' }), { field: 'name', problem: "Type the source's name." });
  assert.deepEqual(sourceFormProblem({ name: 'Howdy Gazette', address: '', type: 'event' }), { field: 'address', problem: 'Type its address.' });
  assert.deepEqual(sourceFormProblem({ name: 'Howdy Gazette', address: 'example.org', type: '' }), { field: 'type', problem: 'Pick what it posts.' });
  assert.equal(sourceFormProblem({ name: 'Howdy Gazette', address: 'example.org', type: 'event' }), null);
});

test('the kinds and types the form offers, in the words the owner picked', () => {
  assert.deepEqual(SOURCE_KINDS, [{ key: 'feed', label: 'Site or feed' }, { key: 'email', label: 'Email newsletter' }]);
  assert.deepEqual(SOURCE_TYPES, [{ key: 'event', label: 'Events' }, { key: 'research', label: 'Research' }, { key: 'headline', label: 'Headlines' }, { key: 'opportunity', label: 'Opportunities' }]);
});

test('the Scraper block draws Add a source beside Run the scraper, and the form survives a redraw', () => {
  const ui = read('../js/queue-ui.js');
  assert.match(ui, /button\('Add a source', 'btn-outline'/, 'an outline button, like Run the scraper');
  assert.match(ui, /'qh-scraper-actions'/, 'the two buttons share a row');
  assert.match(ui, /Pick Email newsletter for one that only arrives by email\./);
  assert.match(ui, /let sourcePanel = null;/, 'the open form is kept across redraws, so typing survives');
  assert.match(ui, /busyLine\(kind === 'email' \? 'Saving it' : 'Looking for its feed'\)/, 'the wait says what it is');
  assert.match(ui, /sourceAnswer\(reply\.outcome\)/);
  assert.match(ui, /if \(!source\.open\) actions\.append\(button\('Add a source'/, 'the button gives way to its form while it is open; Cancel brings it back');
  const app = read('../js/app.js');
  assert.match(app, /async function addSource\(/);
  assert.match(app, /action: 'source'/);
  assert.match(app, /onAddSource: addSource/);
});

test('the form\'s wait sits left, where its buttons were and its refusal goes, not centered like a list\'s loading line', () => {
  const css = read('../css/styles.css');
  const rule = css.match(/\n\.qh-source-status \.load-line \{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /text-align: left/, 'body words are left-aligned, never centered (DESIGN.md, Type)');
});
