import test from 'node:test';
import assert from 'node:assert/strict';
import { progressPercent } from '../js/busy-overlay.js';

test('percent tracks done over total', () => {
  assert.equal(progressPercent(0, 30), 0);
  assert.equal(progressPercent(15, 30), 50);
  assert.equal(progressPercent(30, 30), 100);
});

test('a zero total reads as done, not as a divide by zero', () => {
  assert.equal(progressPercent(0, 0), 100);
});

test('percent never leaves 0 to 100', () => {
  assert.equal(progressPercent(-4, 10), 0);
  assert.equal(progressPercent(99, 10), 100);
});
