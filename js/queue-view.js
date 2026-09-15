/**
 * Pure view helpers for the Home queue table: sorting and formatting dates.
 * View state only — callers keep the state; nothing here touches the Sheet.
 */
import { TYPE_LABELS } from './schema.js';
import { pendingRows, circlebackRows } from './workflow.js';

/**
 * What the Home queue table lists: everything still waiting, circle-backs last.
 * `justDeleted` is the set of ids deleted from the table since the page opened —
 * those rows STAY listed, wearing their Deleted state, so a mis-click on the
 * trash can is undoable on the spot. Rows trashed on an earlier visit stay gone.
 */
export function queueRows(rows, justDeleted = new Set()) {
  const listed = [...pendingRows(rows), ...circlebackRows(rows)];
  const seen = new Set(listed.map(r => r.id));
  return [...listed, ...rows.filter(r => justDeleted.has(r.id) && !seen.has(r.id))];
}

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


const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The one date format for the desk's tables and meta lines: '2026-08-26' ->
 * 'Aug 26' when that is this year, 'Aug 26, 2025' otherwise, so age is never
 * hidden. With no today the year is always said. A timestamp works; anything
 * unparseable -> ''.
 */
export function isoToShort(iso, todayIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  const name = SHORT_MONTHS[Number(m[2]) - 1];
  if (!name) return '';
  const day = `${name} ${Number(m[3])}`;
  return m[1] === String(todayIso ?? '').slice(0, 4) ? day : `${day}, ${m[1]}`;
}
