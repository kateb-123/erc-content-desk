/**
 * Pure view helpers for the Home queue table: sorting and formatting dates.
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


/** '2026-08-26' -> '8/26' (no leading zeros, no year); unparseable -> ''. */
export function isoToSlash(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  const month = Number(m[2]);
  if (month < 1 || month > 12) return '';
  return `${month}/${Number(m[3])}`;
}
