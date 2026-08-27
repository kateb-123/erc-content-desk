import test from 'node:test';
import assert from 'node:assert/strict';
import { queueGlance } from '../js/home-panel.js';

test('queueGlance counts new rows and mentions parked only when present', () => {
  const rows = [
    { status: 'new' }, { status: 'new' }, { status: 'kept' },
    { status: 'circleback' }, { status: 'trashed' },
  ];
  assert.equal(queueGlance(rows), '2 in queue, 1 parked');
});

test('queueGlance omits parked when zero', () => {
  assert.equal(queueGlance([{ status: 'new' }]), '1 in queue');
});

test('queueGlance handles an empty desk', () => {
  assert.equal(queueGlance([]), '0 in queue');
});
