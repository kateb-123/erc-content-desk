import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Kate, Oct 6: "it still has like a 3 second pause as it's being added to the
// newsletter." Next issue's Add, Remove and their Undo change the row in
// place at once and queue the write behind it, the way Sort's decisions do,
// instead of waiting on the save. app.js builds the DOM, so it is read.
const src = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const fn = name => src.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))?.[0] ?? '';

test('Add stamps the rows in place and queues the write: no wait, no busy page', () => {
  const add = fn('sendToNewsletter');
  assert.match(add, /noteChange\(/);
  assert.doesNotMatch(add, /await persist|state\.busy = true|whenSaved/);
  assert.match(add, /label: 'Undo'/, 'with its Undo on the status line');
});

test('Remove and every Undo on Next issue move at once too', () => {
  assert.match(fn('unsendFromNewsletter'), /noteChange\(/);
  assert.doesNotMatch(fn('unsendFromNewsletter'), /await persist/);
  const issue = src.match(/renderIssue\(screens\.issue, \{[\s\S]*?\n {4}\}\);/)?.[0] ?? '';
  for (const prop of ['onRestore', 'onTrash', 'onRestoreTrashed']) {
    assert.match(issue, new RegExp(`${prop}: row => noteChange\\(`), prop);
  }
});
