// editing.test.js: pure helpers behind the Preview & Edit column.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrowKeyTarget, normalizeLinkUrl } from '../js/editing.js';

test('ArrowUp and ArrowDown move a reorder row one slot within its group (b27)', () => {
  assert.equal(arrowKeyTarget('ArrowUp', 2, 5), 1);
  assert.equal(arrowKeyTarget('ArrowDown', 2, 5), 3);
  assert.equal(arrowKeyTarget('ArrowUp', 0, 5), null, 'the first row cannot go up');
  assert.equal(arrowKeyTarget('ArrowDown', 4, 5), null, 'the last row cannot go down');
  assert.equal(arrowKeyTarget('ArrowDown', 0, 1), null, 'a group of one has nowhere to go');
  assert.equal(arrowKeyTarget('Enter', 2, 5), null, 'other keys do nothing');
});

test('a pasted link gets https:// when it names no scheme (c10)', () => {
  assert.equal(normalizeLinkUrl('example.org/page'), 'https://example.org/page');
  assert.equal(normalizeLinkUrl('  www.tamu.edu  '), 'https://www.tamu.edu');
  assert.equal(normalizeLinkUrl('http://example.org'), 'http://example.org');
  assert.equal(normalizeLinkUrl('https://example.org'), 'https://example.org');
  assert.equal(normalizeLinkUrl('mailto:erc@tamu.edu'), 'mailto:erc@tamu.edu');
  assert.equal(normalizeLinkUrl(''), '');
  assert.equal(normalizeLinkUrl('   '), '');
  assert.equal(normalizeLinkUrl('https://'), '', 'a bare scheme is no link');
});
