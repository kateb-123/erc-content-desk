/**
 * Pure ordering, counting, and filtering for the Sort stream. View logic
 * only — nothing here writes anywhere.
 */
import { TYPE_ORDER } from './schema.js';
import { pendingRows } from './workflow.js';

const GROUP_ORDER = ['', ...TYPE_ORDER];

function oldestFirst(a, b) {
  const left = String(a.submitted_at ?? '');
  const right = String(b.submitted_at ?? '');
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

/** Untyped first, then the newsletter's type order, oldest first in a group. */
export function sortStream(rows) {
  const pending = pendingRows(rows);
  const known = new Set(GROUP_ORDER);
  const grouped = GROUP_ORDER.flatMap(type =>
    pending.filter(r => (r.type || '') === type).sort(oldestFirst));
  const stragglers = pending.filter(r => !known.has(r.type || '')).sort(oldestFirst);
  return [...grouped, ...stragglers];
}

/** Per-bucket totals of the pending rows, for the filter labels. */
export function sortCounts(rows) {
  const pending = pendingRows(rows);
  const counts = { all: pending.length, untyped: 0, research: 0, event: 0, opportunity: 0, headline: 0 };
  for (const r of pending) {
    if (!r.type) counts.untyped++;
    else if (counts[r.type] !== undefined) counts[r.type]++;
  }
  return counts;
}

/** '' = everything; 'untyped' = rows with no type; else exact type match. */
export function filterStream(stream, key) {
  if (!key) return stream.slice();
  if (key === 'untyped') return stream.filter(r => !r.type);
  return stream.filter(r => r.type === key);
}
