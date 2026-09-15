/**
 * Pure ordering, counting, and grouping for Sort's tables. View logic only —
 * nothing here writes anywhere.
 */
import { isoToShort } from './queue-view.js';
import { TYPE_ORDER, isValidSubtype } from './schema.js';
import { duplicateFlags, linkCheckState, pendingRows } from './workflow.js';

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

/** What the queue still has for Sort: filed pending rows, plus kept fix-ups. */
export function pendingRowCount(rows) {
  return pendingRows(rows).filter(r => !awaitingReader(r)).length + keptUntyped(rows).length;
}

/**
 * Per-pill totals, read off the same walk that builds the tables, so a pill's
 * number is exactly what that pill lists (Sep 15 — an ERC event used to be
 * counted under both ERC and Events, and a row with a legacy type under
 * neither). No All since the tables show one at a time.
 */
export function sortCounts(rows) {
  const counts = Object.fromEntries(SECTION_ORDER.map(k => [k, 0]));
  for (const g of allSections(rows)) counts[g.section] = g.live.length;
  return counts;
}

/** Where Sort lands with no pill picked: the first one holding anything,
 *  Needs a fix first; Needs a fix again when the queue is empty. */
export function landingSection(counts) {
  return SECTION_ORDER.find(k => counts[k] > 0) ?? SECTION_ORDER[0];
}

/** No real type yet: nothing picked, or a subtype the schema does not know. */
export function needsType(row) {
  return !row.type || !isValidSubtype(row.type, row.subtype);
}

/** What a row cannot tell about itself: the rest of the queue (for duplicates)
 *  and today (so a duplicate note dates itself the way every table does). */
export function fixContext(rows, today) {
  return { rows, today, dupes: duplicateFlags(rows) };
}

/**
 * Why a row sits under Needs a fix (Kate, Sep 15): the two things that keep it
 * out of Keep the rest, and a possible duplicate of an item that is not live
 * yet. One section gathers them, so the rows themselves carry no amber marks.
 */
export function fixReasons(row, ctx) {
  const rows = ctx?.rows ?? [];
  const dupes = ctx?.dupes ?? duplicateFlags(rows);
  const out = [];
  if (needsType(row)) out.push('No type');
  if (linkCheckState(row) === 'alert') out.push('Link not opened');
  if (dupes.has(row.id)) {
    const prior = rows.find(r => r.id === dupes.get(row.id));
    if (prior && !String(prior.published_at ?? '').trim()) out.push(dupeBadgeText(prior, ctx?.today));
  }
  return out;
}

/** Which section a row belongs to: 'fix', 'erc', or a TYPE_ORDER type. */
export function sectionOf(row, ctx) {
  if (fixReasons(row, ctx).length) return 'fix';
  if (isErc(row)) return 'erc';
  return TYPE_ORDER.includes(row.type) ? row.type : 'fix';
}

// Skipped last (Kate, Sep 15, option B): every parked row, any type, waits there
// with Keep and Delete, so a Skip is never the end of the road.
const SECTION_ORDER = ['fix', 'erc', ...TYPE_ORDER, 'skipped'];

const PRIOR_WORDS = { trashed: 'deleted', kept: 'kept', circleback: 'parked', new: 'in the queue' };

/** The duplicate badge names the earlier item and what happened to it, so the
 *  flag can be acted on without a search (usability run F8). */
export function dupeBadgeText(prior, today) {
  const title = String(prior?.headline ?? '').trim() || '(untitled)';
  const short = title.length > 60 ? `${title.slice(0, 59).replace(/[\s—–:-]+$/, '')}…` : title;
  const what = PRIOR_WORDS[prior?.status] ?? prior?.status ?? '';
  const when = isoToShort(prior?.submitted_at, today);
  return `Same link as "${short}", ${what}${when ? ` ${when}` : ''}`;
}

/** Submitted today (the desk's UTC date), so a first look can find it (F24). */
export function isNewToday(row, today) {
  return Boolean(today) && String(row?.submitted_at ?? '').slice(0, 10) === today;
}

/**
 * A section as a list (Kate, Sep 11, option A): its pending rows in stream
 * order, then the ones decided this session at the bottom, greyed, so a
 * mistake stays in reach. Needs a fix also lists kept rows that lost their
 * type, since typing is their fix.
 */
export function sectionRows(rows, section, sessionDecided = new Set(), ctx = fixContext(rows), decidedFrom = new Map()) {
  // Decided from Skipped this session (decidedFrom says what the row was before):
  // it greys under Skipped with Undo, not in its type section.
  const fromSkipped = r => decidedFrom.get(r.id) === 'circleback';
  if (section === 'skipped') {
    return {
      live: rows.filter(r => r.status === 'circleback' && !awaitingReader(r)).sort(oldestFirst),
      done: rows.filter(r => r.status !== 'circleback' && sessionDecided.has(r.id) && fromSkipped(r)).sort(oldestFirst),
    };
  }
  const here = rows.filter(r => sectionOf(r, ctx) === section && !awaitingReader(r));
  const fixups = section === 'fix' ? keptUntyped(rows) : [];
  const live = [...here.filter(r => r.status === 'new'), ...fixups].sort(oldestFirst);
  const seen = new Set();
  const listed = live.filter(r => !seen.has(r.id) && seen.add(r.id));
  return {
    live: listed,
    // A kept fix-up decided this session is already live above as the fix-up —
    // it must not also appear greyed at the bottom.
    done: here.filter(r => r.status !== 'new' && sessionDecided.has(r.id) && !fromSkipped(r) && !seen.has(r.id))
      .sort(oldestFirst),
  };
}

/**
 * Every section that holds something, in pill order, each with its own rows:
 * the one walk the counts are read from, and the invariant the tests hold
 * (one row, one section). The screen itself shows one section at a time.
 */
export function allSections(rows, sessionDecided = new Set(), decidedFrom = new Map()) {
  const ctx = fixContext(rows);
  return SECTION_ORDER
    .map(section => ({ section, ...sectionRows(rows, section, sessionDecided, ctx, decidedFrom) }))
    .filter(g => g.live.length || g.done.length);
}
