// tests/review-fixes-oct23.test.js: the desk's fixes from Kate's design review of Oct 23, 2026
// (impeccable's pass; each one her go, the questions answered one at a time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keepBlock } from '../js/sort-view.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Keep names the subtype when only the subtype is missing (IMP-12)', () => {
  assert.equal(keepBlock({ id: 1, type: '', subtype: '', link: 'https://example.org/a' }), 'Set a type first');
  assert.equal(keepBlock({ id: 1, type: 'event', subtype: '', link: 'https://example.org/a' }), 'Pick a subtype first');
  // A type picked on screen waits there until its subtype is picked.
  assert.equal(keepBlock({ id: 1, type: '', subtype: '', link: 'https://example.org/a' }, 'event'), 'Pick a subtype first');
  assert.match(read('js/sort-ui.js'), /keepBlock\(row, pendingType\?\.id === row\.id \? pendingType\.type : row\.type\)/);
});

test('a long title wraps on the Sort card instead of being cut off (IMP-14)', () => {
  assert.match(read('js/sort-ui.js'), /savingField\(row, 'headline', props, \{ grow: true \}\)/);
  assert.match(read('css/styles.css'), /\.sort-card textarea\.card-title \{[^}]*resize: none/);
});

test('the submit form says which fields are optional (IMP-8, Kate: "(optional)" on the two)', () => {
  const form = read('js/submit-form.js');
  assert.match(form, /<label for="sf-title">Title \(optional\)<\/label>/);
  assert.match(form, /<label for="sf-blurb">Description \(optional\)<\/label>/);
});

test('Quick add\'s button names the issue it adds to (IMP-11)', () => {
  assert.match(read('js/issue-ui.js'), /\.submit-btn'\)\.textContent = `Add to the \$\{isoToShort\(quickIssue, today\)\} issue`/);
});

test('the bulk fold opens from a chevron pointing right, like every fold (IMP-9)', () => {
  assert.match(read('js/submit-form.js'), /<summary><i class="fa-solid fa-chevron-right"/);
  assert.match(read('css/styles.css'), /\.bulk-door\[open\] summary \.fa-chevron-right \{ transform: rotate\(90deg\); \}/);
});

test('the sign-in says the password is in the handoff doc (Kate, Oct 23: the doc holding it is fine)', () => {
  const ui = read('js/auth-ui.js');
  // Oct 26: the doc is READ ME FIRST - ERC Content Desk, and its name is a link to it.
  assert.match(ui, /'The password is in '/);
  assert.match(ui, /'READ ME FIRST - ERC Content Desk'/);
  assert.match(ui, /doc\.href = HANDOFF_DOC; doc\.target = '_blank'; doc\.rel = 'noopener';/);
  assert.match(ui, /', on the team drive\.'/);
  assert.doesNotMatch(ui, /Who has the password/);
});

test('a link with no class of its own is teal, never the browser\'s blue (IMP-3)', () => {
  assert.match(read('css/styles.css'), /\na \{ color: var\(--link-primary\); \}/);
});

test('the desk stops downloading Crimson Text, which it never draws (IMP-6)', () => {
  assert.doesNotMatch(read('index.html'), /Crimson/);
});

test('Highlight: a pick\'s tools go on their own line under its title (IMP-16, Kate\'s pick B)', () => {
  const tools = read('css/styles.css').match(/\.hl-tools \{[^}]*\}/)?.[0] ?? '';
  assert.match(tools, /flex-basis: 100%/);
});
