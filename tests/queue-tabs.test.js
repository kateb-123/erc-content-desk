// tests/queue-tabs.test.js: the Content queue's two tabs (Kate, Oct 8, her
// pick of a second tab on the queue): "Since the last issue" opens first,
// "Everything" holds every submission; each counts, the search filters the
// open one, and the row's right end names the last issue. The tabs are the
// desk's own tab row, the one Sort and Newsletter draw.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../js/queue-ui.js', import.meta.url), 'utf8');
const head = readFileSync(new URL('../js/page-head.js', import.meta.url), 'utf8');

test('the queue draws the desk\'s tab row with its two tabs, Since the last issue first', () => {
  assert.match(head, /export function tabBar\(/, 'one tab row for every page');
  assert.match(head, /export function pageHead\([\s\S]*?tabBar\(/, 'Sort and Newsletter draw it too');
  assert.match(ui, /import \{ tabBar \} from '\.\/page-head\.js';/);
  assert.match(ui, /\{ key: 'since', label: 'Since the last issue', count: [^}]+\}, \{ key: 'all', label: 'Everything', count: [^}]+\}/);
  assert.match(ui, /let tab = 'since';/, 'it opens on Since the last issue');
});

test('the tab row says which issue, the empty tab says so, and the search stays put', () => {
  assert.match(ui, /`Last issue: \$\{isoToShort\(since, today\)\}`/);
  assert.match(ui, /`Nothing new since the \$\{isoToShort\(since, today\)\} issue\.`/);
  assert.match(ui, /lastIssueSent\(schedule, today\)/);
  assert.match(ui, /contentQueue\(rows, \{ today, since: shownSince, term \}\)/, 'the search filters the open tab');
});
