/** Pure text helpers for the Home links panel. */
import { pendingRows, circlebackRows } from './workflow.js';

export function queueGlance(rows) {
  const pending = pendingRows(rows).length;
  const parked = circlebackRows(rows).length;
  return `${pending} in queue${parked ? `, ${parked} parked` : ''}`;
}

/**
 * Pending rows in table order: newest submission first. Rows with no
 * submitted_at sort last rather than first, so a missing timestamp never
 * jumps the queue.
 */
export function queueOrder(rows) {
  return pendingRows(rows).slice().sort((a, b) => {
    const left = String(a.submitted_at ?? '');
    const right = String(b.submitted_at ?? '');
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return right.localeCompare(left);
  });
}
