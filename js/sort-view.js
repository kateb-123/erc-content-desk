/**
 * Pure ordering, counting, and filtering for the Sort stream. View logic
 * only — nothing here writes anywhere.
 */
import { TYPE_ORDER } from './schema.js';
import { pendingRows } from './workflow.js';

// Untyped ("To review") sinks to the end — typed groups sort first.
const GROUP_ORDER = [...TYPE_ORDER, ''];

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

/** ERC leads, then the newsletter's type order, then to-review (untyped), oldest first in a group. */
/** Kept rows that still lack a real type — they come BACK to Sort's To
 *  review (Kate: fixing a type belongs here, not at the bottom of Publish).
 *  Setting the type releases them; rows already in an issue stay gone. */
export function keptUntyped(rows) {
  return rows.filter(r => r.status === 'kept'
    && !TYPE_ORDER.includes(r.type || '')
    && !String(r.published_at ?? '').trim()
    && !String(r.newsletter_issue ?? '').trim()).sort(oldestFirst);
}

export function sortStream(rows) {
  const pending = pendingRows(rows);
  const erc = pending.filter(isErc).sort(oldestFirst);
  const rest = pending.filter(r => !isErc(r));
  const known = new Set(GROUP_ORDER);
  const grouped = GROUP_ORDER.flatMap(type =>
    rest.filter(r => (r.type || '') === type).sort(oldestFirst));
  const stragglers = rest.filter(r => !known.has(r.type || '')).sort(oldestFirst);
  return [...erc, ...grouped, ...stragglers, ...keptUntyped(rows)];
}

/** Per-bucket totals of the pending rows, for the filter labels. */
export function sortCounts(rows) {
  const pending = pendingRows(rows);
  const fixups = keptUntyped(rows).length;
  const counts = { all: pending.length + fixups, erc: 0, untyped: fixups, research: 0, event: 0, opportunity: 0, headline: 0 };
  for (const r of pending) {
    if (isErc(r)) counts.erc++;
    if (!r.type) counts.untyped++;
    else if (counts[r.type] !== undefined) counts[r.type]++;
  }
  return counts;
}

/** Which section a row belongs to: 'erc', a TYPE_ORDER type, or 'untyped'. */
export function sectionOf(row) {
  if (isErc(row)) return 'erc';
  return TYPE_ORDER.includes(row.type) ? row.type : 'untyped';
}

const SECTION_ORDER = ['erc', ...TYPE_ORDER, 'untyped'];

/**
 * Sections are jump points, not walls: '' keeps the canonical stream; a key
 * starts the stream at that section and continues through the rest, wrapping
 * around, so sorting never stops until everything is decided. Anchoring on an
 * empty section starts at the next section after it.
 */
export function streamFrom(stream, key) {
  const at = SECTION_ORDER.indexOf(key);
  if (at < 0) return stream.slice();
  const rank = new Map(SECTION_ORDER.map((s, i) =>
    [s, (i - at + SECTION_ORDER.length) % SECTION_ORDER.length]));
  return stream.map((row, i) => ({ row, i }))
    .sort((a, b) => (rank.get(sectionOf(a.row)) - rank.get(sectionOf(b.row))) || (a.i - b.i))
    .map(x => x.row);
}
