import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { revealOffset } from '../js/ui-aids.js';

// Kate, Sep 23: on Sort "two scrollbars fighting": the card was pinned and
// scrolled inside itself, so the wheel moved the card one moment and the page
// the next. Her pick: one scrollbar, the page. The card no longer pins or
// scrolls on its own (Sort's and Finalize's, which share the rule), and a card
// that changes while it sits out of view is brought back into view.
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test("the card has no scroll of its own and isn't pinned", () => {
  const rule = read('css/styles.css').match(/\.sort-card, \.f-card \{([^}]*)\}/)[1];
  assert.doesNotMatch(rule, /position:\s*sticky/);
  assert.doesNotMatch(rule, /overflow-y:\s*auto/);
  assert.doesNotMatch(rule, /max-height/);
  assert.doesNotMatch(read('css/styles.css'), /\.f-card\.is-more/, 'the fade for a scrolled card goes with the scroll');
});

test('a card already in view is left where it is', () => {
  assert.equal(revealOffset(120, 900), 0);
  assert.equal(revealOffset(0, 900), 0);
});

test('a card whose top is above the window is scrolled back to, with a little room', () => {
  assert.equal(revealOffset(-640, 900), -656);
});

test('a card starting near the bottom of the window is brought up', () => {
  assert.equal(revealOffset(860, 900), 844);
});

test('Sort and Finalize bring a changed card into view, and nothing marks a card that no longer scrolls', () => {
  for (const f of ['js/sort-ui.js', 'js/finalize-ui.js']) {
    const src = read(f);
    assert.match(src, /revealTop\(card\)/, `${f} brings its card into view`);
    assert.doesNotMatch(src, /markOverflow/, `${f} no longer marks the card`);
  }
});
