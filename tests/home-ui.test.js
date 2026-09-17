import test from 'node:test';
import assert from 'node:assert/strict';
import { statWords } from '../js/home-ui.js';

// A stat tile's value (audit round two, d5): only a real value is loud; waiting,
// a failed load and an empty fact are quiet words at label size.

test('statWords shows a real value loud and everything else quiet', () => {
  assert.deepEqual(statWords({ waiting: false, failed: false, value: 'Sep 22', empty: 'Not set' }), { text: 'Sep 22', quiet: false });
  assert.deepEqual(statWords({ waiting: false, failed: false, value: '', empty: 'Not set' }), { text: 'Not set', quiet: true });
  assert.deepEqual(statWords({ waiting: true, failed: false, value: '', empty: 'Not set' }), { text: '…', quiet: true });
});

test("statWords says Couldn't load when the read failed, and never shows a stale dash", () => {
  assert.deepEqual(statWords({ waiting: false, failed: true, value: '', empty: 'Not set' }), { text: "Couldn't load", quiet: true });
  // A failure after a value was shown keeps the value: the tile is not the place for the error.
  assert.deepEqual(statWords({ waiting: false, failed: false, value: '4', empty: 'None' }), { text: '4', quiet: false });
});
