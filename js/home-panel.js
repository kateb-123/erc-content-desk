/** Pure text helpers for the Home links panel. */
import { pendingRows, circlebackRows } from './workflow.js';

export function queueGlance(rows) {
  const pending = pendingRows(rows).length;
  const parked = circlebackRows(rows).length;
  return `${pending} in queue${parked ? `, ${parked} parked` : ''}`;
}
