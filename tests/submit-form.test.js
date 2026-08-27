import test from 'node:test';
import assert from 'node:assert/strict';
import { pickType } from '../js/submit-form.js';

test('pickType clears the subtype when the type changes', () => {
  assert.deepEqual(
    pickType({ type: 'research', subtype: 'Report' }, 'event'),
    { type: 'event', subtype: '' },
  );
});

test('pickType keeps the subtype when re-picking the same type', () => {
  const selection = { type: 'research', subtype: 'Report' };
  assert.deepEqual(pickType(selection, 'research'), selection);
});

test('pickType starts a fresh selection from blank', () => {
  assert.deepEqual(
    pickType({ type: '', subtype: '' }, 'headline'),
    { type: 'headline', subtype: '' },
  );
});
