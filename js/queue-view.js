/**
 * Pure view helpers for the Home queue table: sorting, filtering, counts.
 * View state only — callers keep the state; nothing here touches the Sheet.
 */
import { TYPE_LABELS } from './schema.js';

const KEYS = {
  title: r => r.headline || r.link || '',
  type: r => (r.type ? (TYPE_LABELS[r.type] ?? r.type) : ''),
  submitter: r => r.submitter || '',
  submitted: r => String(r.submitted_at ?? ''),
};

/** Non-mutating sort; empty keys sink to the end in either direction. */
export function sortRows(rows, column, direction) {
  const key = KEYS[column];
  const flip = direction === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const left = key(a).toLowerCase();
    const right = key(b).toLowerCase();
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return flip * left.localeCompare(right);
  });
}

/** `selected` is a Set of type keys plus 'untyped'; empty means All. */
export function filterRows(rows, selected) {
  if (!selected || selected.size === 0) return rows.slice();
  return rows.filter(r => selected.has(r.type ? r.type : 'untyped'));
}

/** Unfiltered per-type totals for the filter labels. */
export function typeCounts(rows) {
  const counts = { all: rows.length, research: 0, event: 0, opportunity: 0, headline: 0, untyped: 0 };
  for (const r of rows) {
    if (!r.type) counts.untyped++;
    else if (counts[r.type] !== undefined) counts[r.type]++;
  }
  return counts;
}

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

/** '2026-08-26' -> 'Aug. 26'; anything unparseable -> ''. */
export function isoToShort(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '';
  return `${month} ${Number(m[3])}`;
}
