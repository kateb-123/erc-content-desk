/**
 * Pure ordering, counting, and grouping for Sort's tables. View logic only —
 * nothing here writes anywhere.
 */
import { isoToSlash } from './queue-view.js';
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

/**
 * Per-bucket totals for the pill labels. One row, one bucket: a pill's number
 * is exactly what that pill lists (Sep 15 — an ERC event used to be counted
 * under both ERC and Events, and a row with a legacy type under neither).
 */
export function sortCounts(rows, ctx = fixContext(rows)) {
  const pending = pendingRows(rows).filter(r => !awaitingReader(r));
  const fixups = keptUntyped(rows).length;
  const counts = { all: pending.length + fixups, erc: 0, fix: fixups, erc_event: 0, research: 0, event: 0, opportunity: 0, headline: 0 };
  for (const r of pending) counts[sectionOf(r, ctx)]++;
  return counts;
}

/** No real type yet: nothing picked, or a subtype the schema does not know. */
export function needsType(row) {
  return !row.type || !isValidSubtype(row.type, row.subtype);
}

/** What a row cannot tell about itself: the rest of the queue, for duplicates. */
export function fixContext(rows) {
  return { rows, dupes: duplicateFlags(rows) };
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
    if (prior && !String(prior.published_at ?? '').trim()) out.push(dupeBadgeText(prior));
  }
  return out;
}

/** Which section a row belongs to: 'fix', 'erc', or a TYPE_ORDER type. */
export function sectionOf(row, ctx) {
  if (fixReasons(row, ctx).length) return 'fix';
  if (isErc(row)) return 'erc';
  return TYPE_ORDER.includes(row.type) ? row.type : 'fix';
}

const SECTION_ORDER = ['fix', 'erc', ...TYPE_ORDER];

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

/**
 * A section as a list (Kate, Sep 11, option A): its pending rows in stream
 * order, then the ones decided this session at the bottom, greyed, so a
 * mistake stays in reach. Needs a fix also lists kept rows that lost their
 * type, since typing is their fix.
 */
export function sectionRows(rows, section, sessionDecided = new Set(), ctx = fixContext(rows)) {
  const here = rows.filter(r => sectionOf(r, ctx) === section && !awaitingReader(r));
  const fixups = section === 'fix' ? keptUntyped(rows) : [];
  const live = [...here.filter(r => r.status === 'new'), ...fixups].sort(oldestFirst);
  const seen = new Set();
  const listed = live.filter(r => !seen.has(r.id) && seen.add(r.id));
  return {
    live: listed,
    // A kept fix-up decided this session is already live above as the fix-up —
    // it must not also appear greyed at the bottom.
    done: here.filter(r => r.status !== 'new' && sessionDecided.has(r.id) && !seen.has(r.id))
      .sort(oldestFirst),
  };
}

/**
 * All, as tables (Kate, Sep 15): every section that holds something, in the
 * pill order, each with its own rows. Replaces the one-card stream — going
 * through them one at a time took too long.
 */
export function allSections(rows, sessionDecided = new Set()) {
  const ctx = fixContext(rows);
  return SECTION_ORDER
    .map(section => ({ section, ...sectionRows(rows, section, sessionDecided, ctx) }))
    .filter(g => g.live.length || g.done.length);
}
