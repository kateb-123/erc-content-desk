import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_WIDTH, fitWidth, keepOriginal } from '../js/item-image.js';

// New uploads go up as a JPG at most MAX_WIDTH wide (Kate, Sep 17: shrink
// new uploads; old pictures stay where sent emails link them).
test('a picture wider than MAX_WIDTH shrinks to it, keeping its shape', () => {
  assert.equal(MAX_WIDTH, 1200);
  assert.deepEqual(fitWidth(1350, 1688), { width: 1200, height: 1500 });
});

test('a picture no wider than MAX_WIDTH keeps its size, never grows', () => {
  assert.deepEqual(fitWidth(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitWidth(1200, 900), { width: 1200, height: 900 });
});

test('a JPG or PNG that needed no shrinking stays as it is when its JPG comes out bigger', () => {
  assert.equal(keepOriginal({ type: 'image/png', width: 1000, size: 150_000 }, 200_000), true);
  assert.equal(keepOriginal({ type: 'image/jpeg', width: 640, size: 120_000 }, 130_000), true);
});

test('the JPG wins when it is smaller, or when the picture had to shrink', () => {
  assert.equal(keepOriginal({ type: 'image/png', width: 1000, size: 700_000 }, 200_000), false);
  assert.equal(keepOriginal({ type: 'image/png', width: 1350, size: 150_000 }, 200_000), false);
});

test('a WebP always goes as a JPG: not every inbox shows WebP', () => {
  assert.equal(keepOriginal({ type: 'image/webp', width: 800, size: 50_000 }, 90_000), false);
});
