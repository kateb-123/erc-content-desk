import test from 'node:test';
import assert from 'node:assert/strict';
import { pickType, TYPE_ORDER, TYPE_LABELS } from '../js/submit-form.js';
import { TYPES } from '../js/schema.js';

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

test('TYPE_ORDER covers every schema type exactly once, research first', () => {
  assert.deepEqual([...TYPE_ORDER].sort(), Object.keys(TYPES).sort());
  assert.equal(TYPE_ORDER[0], 'research');
  for (const type of TYPE_ORDER) assert.ok(TYPE_LABELS[type]);
});
