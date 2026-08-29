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

/**
 * ERC first: a spotlight request of any type, or ERC Research. Broader than
 * workflow.js's newsletterOnly (which is spotlight events only, minus
 * webinars) — don't conflate the two.
 */
export function isErc(row) {
  return Boolean(row.spotlight_request) || row.subtype === 'ERC Research';
}

/** ERC leads, then untyped, then the newsletter's type order, oldest first in a group. */
export function sortStream(rows) {
  const pending = pendingRows(rows);
  const erc = pending.filter(isErc).sort(oldestFirst);
  const rest = pending.filter(r => !isErc(r));
  const known = new Set(GROUP_ORDER);
  const grouped = GROUP_ORDER.flatMap(type =>
    rest.filter(r => (r.type || '') === type).sort(oldestFirst));
  const stragglers = rest.filter(r => !known.has(r.type || '')).sort(oldestFirst);
  return [...erc, ...grouped, ...stragglers];
}

/** Per-bucket totals of the pending rows, for the filter labels. */
export function sortCounts(rows) {
  const pending = pendingRows(rows);
  const counts = { all: pending.length, erc: 0, untyped: 0, research: 0, event: 0, opportunity: 0, headline: 0 };
  for (const r of pending) {
    if (isErc(r)) counts.erc++;
    if (!r.type) counts.untyped++;
    else if (counts[r.type] !== undefined) counts[r.type]++;
  }
  return counts;
}

/** '' = everything; 'erc' = spotlight/ERC Research; 'untyped' = rows with no type; else exact type match. */
export function filterStream(stream, key) {
  if (!key) return stream.slice();
  if (key === 'erc') return stream.filter(isErc);
  if (key === 'untyped') return stream.filter(r => !r.type);
  return stream.filter(r => r.type === key);
}
