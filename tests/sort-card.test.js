import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Content Sort's card and list rows build the DOM, so their wiring is read
// from the file, the way team-links.test.js reads the team page. The words
// themselves are keepBlock's and shownSource's, held in sort-view.test.js.
const src = readFileSync(new URL('../js/sort-ui.js', import.meta.url), 'utf8');

// Audit, Sep 23: a locked Keep and next said why only in its tooltip.
test('a locked Keep and next says why in a line right under it, and the line describes the button', () => {
  assert.match(src, /keep\.title = blocked \|\| 'Keep and next \(K\)'/, 'the tooltip stays');
  const locked = src.match(/if \(blocked\) \{([^}]*)\}/)?.[1] ?? '';
  assert.match(locked, /keep\.disabled = true/);
  assert.match(locked, /el\('p', 'sc-keep-why', blocked\)/, "keepBlock's words, as they are");
  assert.match(locked, /why\.id = '[\w-]+'/);
  assert.match(locked, /keep\.setAttribute\('aria-describedby', why\.id\)/);
  assert.equal(src.split('sc-keep-why').length, locked.split('sc-keep-why').length, 'the line is built only while Keep is locked');
  // Right under the button: it follows Keep into the stack, before Skip for now.
  const keepAt = src.indexOf('stack.append(keep)');
  const whyAt = src.indexOf('stack.append(why)');
  const skipAt = src.indexOf("'Skip for now'");
  assert.ok(keepAt > 0 && keepAt < whyAt && whyAt < skipAt, 'Keep, then its line, then Skip for now');
});

// Kate, Sep 23: "we really only need source if it's external". The initials stay.
test("the card's label and the list row's line take the source from shownSource, with no placeholder", () => {
  assert.match(src, /import \{[^}]*\bshownSource\b[^}]*\} from '\.\/sort-view\.js'/);
  assert.match(src, /function rowMeta\(row, today\) \{\s*return \[shownSource\(row\), row\.submitter && `added by \$\{row\.submitter\}`/);
  assert.match(src, /const source = shownSource\(row\);\s*if \(source\) facts\.append\(el\('span', 'sc-source', source\)\)/);
  assert.doesNotMatch(src, /'No source'/, 'with nothing to show, the tags sit there alone');
  assert.doesNotMatch(src, /row\.source \|\| row\.authors/, 'one copy of the rule, in sort-view.js');
});
