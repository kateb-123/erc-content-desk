// editing.test.js: pure helpers behind the Preview & Edit column.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrowKeyTarget, normalizeLinkUrl, reorderRowName, movedAnnouncement } from '../js/editing.js';

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

test('a reorder row is named with its place, and a move is announced (e34)', () => {
  assert.equal(reorderRowName('Fall Kickoff Mixer', 1, 5), 'Fall Kickoff Mixer, 2 of 5');
  assert.equal(reorderRowName('', 0, 1), '(untitled), 1 of 1');
  assert.equal(movedAnnouncement('Fall Kickoff Mixer', 2, 5), 'Moved Fall Kickoff Mixer to 3 of 5');
  assert.equal(movedAnnouncement('', 0, 2), 'Moved (untitled) to 1 of 2');
});

// An old bug (noted Sep 23, fixed Oct 23): a link typed without https:// in
// Add an item went into the email as typed and broke. The form now stores it
// the way every other link field does.
test('Add an item stores its link with a scheme', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /fields\.url = linkInput\.value\.trim\(\)/);
  assert.match(src, /fields\.url = normalizeLinkUrl\(linkInput\.value\)/);
});

// An old bug (noted Sep 23, fixed Oct 23): on the Outline the arrows moved an
// item only inside its group, so at a group's edge they did nothing. Now an
// edge press carries it into the next group: down lands at the top of the
// group below, up at the bottom of the group above.
test('itemArrowMove: inside a group past the neighbour; at an edge into the next group', async () => {
  const { itemArrowMove } = await import('../js/editing.js');
  const a = { id: 'a', group: 'g1' }, b = { id: 'b', group: 'g1' }, c = { id: 'c', group: 'g2' }, d = { id: 'd', group: 'g2' };
  const listed = [a, b, c, d];
  const group = it => it.group;
  assert.deepEqual(itemArrowMove(listed, group, a, 'ArrowDown'), { other: b, before: false });
  assert.deepEqual(itemArrowMove(listed, group, b, 'ArrowDown'), { other: c, before: true }, 'the edge: to the top of the next group');
  assert.deepEqual(itemArrowMove(listed, group, c, 'ArrowUp'), { other: b, before: false }, 'the edge: to the bottom of the group above');
  assert.deepEqual(itemArrowMove(listed, group, d, 'ArrowUp'), { other: c, before: true });
  assert.equal(itemArrowMove(listed, group, a, 'ArrowUp'), null);
  assert.equal(itemArrowMove(listed, group, d, 'ArrowDown'), null);
});

test('itemArrowMove: a neighbour in the unheaded bucket is a plain step, so every press visibly moves (review of the fixes, Oct 23)', async () => {
  const { itemArrowMove } = await import('../js/editing.js');
  const a = { id: 'a', group: 'g1' }, x = { id: 'x', group: '' }, y = { id: 'y', group: '' };
  const listed = [a, x, y];
  const bucket = new Map([[a, 0], [x, 1], [y, 1]]);
  const plain = it => bucket.get(it) === 1;
  assert.deepEqual(itemArrowMove(listed, it => bucket.get(it), a, 'ArrowDown', plain), { other: x, before: false });
});

// Kate, Oct 23: no shadows anywhere. The edit card keeps floating where it
// is (her Oct 5 pick) and wears the 1px hairline every box has instead.
test('the edit card floats with the hairline every box has, and no shadow', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  const rule = css.match(/\.edit-drawer \{([^}]*)\}/)[1];
  assert.doesNotMatch(rule, /box-shadow/);
  assert.match(rule, /border: 1px solid var\(--border-subtle-01\)/);
  assert.match(rule, /position: absolute; z-index: 30;/, 'still floating where it was');
});
