/**
 * Pure ordering, counting, and filtering for the Sort stream. View logic
 * only — nothing here writes anywhere.
 */
import { isoToSlash } from './queue-view.js';
import { TYPE_ORDER } from './schema.js';
import { pendingRows } from './workflow.js';

// To review (untyped or unknown-typed) LEADS the stream — fix types first.

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

/** To review leads (fix types first — Kate, Sep 1), then ERC, then the newsletter's type order; oldest first in a group. */
/** Kept rows that still lack a real type — they come BACK to Sort's To
 *  review (Kate: fixing a type belongs here, not at the bottom of Publish).
 *  Setting the type releases them; rows already in an issue stay gone. */
export function keptUntyped(rows) {
  return rows.filter(r => r.status === 'kept'
    && !TYPE_ORDER.includes(r.type || '')
    && !String(r.published_at ?? '').trim()
    && !String(r.newsletter_issue ?? '').trim()).sort(oldestFirst);
}

/** Submitted but not yet filed by the reader (pending_read, Sep 10). Kate wants
 *  every card read before she sees it, so these wait off the stream. */
export function awaitingReader(row) {
  return row.pending_read === 'yes';
}

/** Ids of the waiting rows still headed for Sort, for the catch-up read. */
export function readerQueue(rows) {
  return rows.filter(r => r.status === 'new' && awaitingReader(r)).map(r => r.id);
}

/**
 * The stream. `sessionDecided` is the set of ids decided since the page opened:
 * those rows HOLD their slot instead of vanishing, so ‹ scrolls back to what you
 * just did and lets you change it (Kate, Sep 9). A decision touches neither type
 * nor date, so they sort exactly where they sat while pending.
 */
export function sortStream(rows, sessionDecided = new Set()) {
  const inPlay = rows.filter(r => (r.status === 'new' && !awaitingReader(r)) || sessionDecided.has(r.id));
  const erc = inPlay.filter(isErc).sort(oldestFirst);
  const rest = inPlay.filter(r => !isErc(r));
  const known = new Set(TYPE_ORDER);
  const toReview = rest.filter(r => !known.has(r.type || '')).sort(oldestFirst);
  const grouped = TYPE_ORDER.flatMap(type =>
    rest.filter(r => (r.type || '') === type).sort(oldestFirst));
  // A kept-untyped fix-up decided this session would otherwise arrive twice.
  const seen = new Set();
  return [...toReview, ...keptUntyped(rows), ...erc, ...grouped].filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/** Per-bucket totals of the pending rows, for the filter labels. */
export function sortCounts(rows) {
  const pending = pendingRows(rows).filter(r => !awaitingReader(r));
  const fixups = keptUntyped(rows).length;
  const counts = { all: pending.length + fixups, erc: 0, untyped: fixups, erc_event: 0, research: 0, event: 0, opportunity: 0, headline: 0 };
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

const SECTION_ORDER = ['untyped', 'erc', ...TYPE_ORDER];

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

const PRIOR_WORDS = { trashed: 'deleted', kept: 'kept', circleback: 'parked', new: 'in the queue' };

/** The duplicate badge names the earlier item and what happened to it, so the
 *  flag can be acted on without a search (usability run F8). */
export function dupeBadgeText(prior) {
  const title = String(prior?.headline ?? '').trim() || '(untitled)';
  const short = title.length > 60 ? `${title.slice(0, 59).replace(/[\s—–:-]+$/, '')}…` : title;
  const what = PRIOR_WORDS[prior?.status] ?? prior?.status ?? '';
  const when = isoToSlash(prior?.submitted_at);
  return `Same link as "${short}", ${what}${when ? ` ${when}` : ''}`;
}

/** Submitted today (the desk's UTC date), so a first look can find it (F24). */
export function isNewToday(row, today) {
  return Boolean(today) && String(row?.submitted_at ?? '').slice(0, 10) === today;
}
