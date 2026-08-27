import test from 'node:test';
import assert from 'node:assert/strict';
import { queueGlance, queueOrder } from '../js/home-panel.js';

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

test('queueOrder returns pending rows newest first', () => {
  const rows = [
    { id: 'a', status: 'new', submitted_at: '2026-08-20T10:00:00Z' },
    { id: 'b', status: 'new', submitted_at: '2026-08-26T09:00:00Z' },
    { id: 'c', status: 'new', submitted_at: '2026-08-24T14:00:00Z' },
  ];
  assert.deepEqual(queueOrder(rows).map(r => r.id), ['b', 'c', 'a']);
});

test('queueOrder puts rows with no submitted_at last', () => {
  const rows = [
    { id: 'a', status: 'new', submitted_at: '' },
    { id: 'b', status: 'new', submitted_at: '2026-08-26T09:00:00Z' },
  ];
  assert.deepEqual(queueOrder(rows).map(r => r.id), ['b', 'a']);
});

test('queueOrder skips rows that are not pending and never mutates its input', () => {
  const rows = [
    { id: 'a', status: 'new', submitted_at: '2026-08-20T09:00:00Z' },
    { id: 'b', status: 'kept', submitted_at: '2026-08-26T09:00:00Z' },
    { id: 'c', status: 'new', submitted_at: '2026-08-25T09:00:00Z' },
    { id: 'd', status: 'circleback', submitted_at: '2026-08-22T09:00:00Z' },
  ];
  const before = rows.map(r => r.id);
  assert.deepEqual(queueOrder(rows).map(r => r.id), ['c', 'a']);
  assert.deepEqual(rows.map(r => r.id), before);
});
