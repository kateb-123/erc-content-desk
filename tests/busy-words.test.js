import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { busyText } from '../js/icons.js';

// Kate, Sep 23: "those loading dots. i hate those so much now." Her pick from
// nine: shimmering words. Every wait says what it is in words, and a soft
// light sweeps across them; the sliding dots are gone from both apps.
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const jsFiles = dir => readdirSync(new URL(`../${dir}/`, import.meta.url)).filter(f => f.endsWith('.js')).map(f => `${dir}/${f}`);

test('busy words end in one ellipsis, never two', () => {
  assert.equal(busyText('Saving'), 'Saving…');
  assert.equal(busyText('Saving…'), 'Saving…');
  assert.equal(busyText('Saving...'), 'Saving…');
  assert.equal(busyText('  Reading 2 new items  '), 'Reading 2 new items…');
});

test('no page draws the sliding dots any more', () => {
  for (const f of [...jsFiles('js'), ...jsFiles('builder/js')]) {
    assert.doesNotMatch(read(f), /dotsLoader|loadingLabel/, `${f} still draws the dots`);
  }
  for (const f of ['css/shell.css', 'css/styles.css', 'builder/css/styles.css']) {
    assert.doesNotMatch(read(f), /dots-loader|dots-mini|dots-text/, `${f} still styles the dots`);
  }
});

test('the busy words shimmer, and hold still for reduced motion and forced colours', () => {
  const css = read('css/shell.css');
  const rule = css.match(/\.busy-words \{([^}]*)\}/)[1];
  assert.match(rule, /animation:\s*busy-sheen/);
  assert.match(rule, /background-clip:\s*text/);
  assert.match(css, /@keyframes busy-sheen/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^}]*\{[^}]*\.busy-words[^}]*\{[^}]*animation:\s*none/s);
  assert.match(css, /forced-colors: active\)[^}]*\{[^}]*\.busy-words/s);
});

test('a row action in flight shows its word, not a hidden one', () => {
  const src = read('js/ui-aids.js');
  assert.match(src, /busyWords\(word\)/);
  assert.doesNotMatch(src, /el\('span', 'sr-only', word\)/);
});
