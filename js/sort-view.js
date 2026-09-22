/**
 * Pure ordering and checks for Sort's one list and its card (Kate's
 * wireframes, Sep 17, and her answers, Sep 18). View logic only; nothing
 * here writes anywhere.
 */
import { isoToShort, bySubmitted } from './queue-view.js';
import { TYPE_ORDER, isValidSubtype } from './schema.js';
import { duplicateFlags, linkNeedsCheck, missingFields } from './workflow.js';

// What each field is called on the card; medium is the outlet.
export const FIELD_LABELS = {
  headline: 'Title', date: 'Date', source: 'Source', topic: 'Topic', deadline: 'Deadline',
  authors: 'Authors', time: 'Time', location: 'Location', medium: 'Outlet',
};

// Newest first, a row with no date last.
const newestFirst = bySubmitted('desc');
const oldestFirst = bySubmitted('asc');

/**
 * ERC first: a spotlight request of any type, or ERC Research. Broader than
 * workflow.js's newsletterOnly (which is spotlight events only, minus
 * webinars) — don't conflate the two.
 */
export function isErc(row) {
  return Boolean(row.spotlight_request) || row.subtype === 'ERC Research';
}

/** Kept rows that still lack a real type: they come BACK to Sort's list,
 *  because fixing a type belongs here, not at the bottom of Publish.
 *  Setting the type releases them; rows already in an issue stay gone. */
export function keptUntyped(rows) {
  return rows.filter(r => r.status === 'kept'
    && !TYPE_ORDER.includes(r.type || '')
    && !String(r.published_at ?? '').trim()
    && !String(r.newsletter_issue ?? '').trim()).sort(oldestFirst);
}

/** Submitted but not yet filed by the reader (pending_read). Every card is
 *  read before she sees it, so these wait out of the list until it is. */
function awaitingReader(row) {
  return row.pending_read === 'yes';
}

/** Ids of the waiting rows still headed for Sort, for the catch-up read. */
export function readerQueue(rows) {
  return rows.filter(r => r.status === 'new' && awaitingReader(r)).map(r => r.id);
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
 * What the card asks about a row: the two things that lock Keep and next, and
 * a possible duplicate of an item that is not live yet. The list marks such a
 * row with the triangle; the card says why.
 */
export function fixReasons(row, ctx) {
  const out = [];
  if (needsType(row)) out.push('No type');
  if (linkNeedsCheck(row)) out.push('Link not opened');
  const dupe = dupeReason(row, ctx);
  if (dupe) out.push(dupe);
  return out;
}

/** The earlier item this row repeats, in the words the card shows; '' when
 *  there is none, or when the earlier one is already live. */
export function dupeReason(row, ctx) {
  const rows = ctx?.rows ?? [];
  const dupes = ctx?.dupes ?? duplicateFlags(rows);
  if (!dupes.has(row.id)) return '';
  const prior = rows.find(r => r.id === dupes.get(row.id));
  return prior && !String(prior.published_at ?? '').trim() ? dupeBadgeText(prior, ctx?.today) : '';
}

const PRIOR_WORDS = { trashed: 'deleted', kept: 'kept', circleback: 'parked', new: 'in the queue' };

/** The duplicate badge names the earlier item and what happened to it, so the
 * flag can be acted on without a search. */
export function dupeBadgeText(prior, today) {
  const title = String(prior?.headline ?? '').trim() || '(untitled)';
  const short = title.length > 60 ? `${title.slice(0, 59).replace(/[\s—–:-]+$/, '')}…` : title;
  const what = PRIOR_WORDS[prior?.status] ?? prior?.status ?? '';
  const when = isoToShort(prior?.submitted_at, today);
  return `Same link as "${short}", ${what}${when ? ` ${when}` : ''}`;
}

/** Submitted today (the desk's UTC date), so a first look can find it. */
export function isNewToday(row, today) {
  return Boolean(today) && String(row?.submitted_at ?? '').slice(0, 10) === today;
}

/**
 * Sort's one list: the waiting rows newest first (the kept rows that lost
 * their type among them), then the skipped ones newest first under them
 * (Kate, Sep 18: skipped sinks to the bottom, tagged); last, greyed, the rows
 * kept or deleted this visit, so a mistake stays in reach. A row skipped this
 * visit is live with the skipped, not greyed.
 */
export function sortList(rows, sessionDecided = new Set()) {
  const waiting = rows.filter(r => r.status === 'new' && !awaitingReader(r));
  const seen = new Set(waiting.map(r => r.id));
  const live = [...waiting, ...keptUntyped(rows).filter(r => !seen.has(r.id))].sort(newestFirst);
  const skipped = rows.filter(r => r.status === 'circleback' && !awaitingReader(r)).sort(newestFirst);
  const listed = new Set([...live, ...skipped].map(r => r.id));
  const done = rows.filter(r => sessionDecided.has(r.id) && !listed.has(r.id)
    && (r.status === 'kept' || r.status === 'trashed')).sort(newestFirst);
  return { live: [...live, ...skipped], done };
}

/** Whole days the oldest waiting row has sat, by the desk's UTC date; null
 *  when nothing waits or nothing is dated. */
export function oldestWait(rows, today) {
  const dates = rows.filter(r => r.status === 'new')
    .map(r => String(r.submitted_at ?? '').slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!dates.length || !today) return null;
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(dates[0])) / 86400000));
}

// ── The card ──

/** Why the card's Keep and next is locked, in the words of its tooltip; ''
 *  when the row can be kept. A row ticked for neither page has nowhere to go. */
/** The ask before Keep when the type's fields are still empty (Kate, Sep 22:
 *  warn and let them keep): "Still missing: Date, Time." or nothing. */
export function missingLine(row) {
  const missing = missingFields(row);
  return missing.length ? `Still missing: ${missing.map(f => FIELD_LABELS[f] ?? f).join(', ')}.` : '';
}

export function keepBlock(row) {
  if (needsType(row)) return 'Set a type first';
  if (linkNeedsCheck(row)) return 'Check the link first';
  return '';
}

/** The row the card shows: the chosen one while it is live; otherwise the
 *  row now standing where it stood (so a decision moves you to the next);
 *  otherwise none. */
export function nextSelected(liveIds, selectedId, lastIndex = 0) {
  if (selectedId && liveIds.includes(selectedId)) return selectedId;
  if (!liveIds.length) return null;
  return liveIds[Math.min(Math.max(lastIndex, 0), liveIds.length - 1)];
}

const UNDO_VERBS = { keep: 'kept', circleback: 'skipped', trash: 'deleted' };
const UNDO_NOUNS = { edit: 'the edit to', type: 'the type on', link: 'the link check on' };

/** What Undo last just restored, in words for the status line. */
export function undoWords(entry) {
  const rows = entry?.rows ?? [];
  const name = rows[0]?.headline || rows[0]?.link || 'this item';
  if (entry?.kind === 'keep-all') return `Undid: kept ${rows.length}`;
  if (UNDO_VERBS[entry?.kind]) return `Undid: ${UNDO_VERBS[entry.kind]} ${name}`;
  return `Undid: ${UNDO_NOUNS[entry?.kind] ?? 'the change to'} ${name}`;
}

/** The undo stack without one row: a row's own Undo already put it back, so
 * Undo last must never re-apply that decision. */
export function withoutRow(stack, id) {
  return stack
    .map(entry => ({ ...entry, rows: entry.rows.filter(r => r.id !== id) }))
    .filter(entry => entry.rows.length);
}

/** The tab a key moves to in a row of tabs, or null. */
export function adjacentTab(keys, current, key) {
  const at = keys.indexOf(current);
  if (key === 'Home') return keys[0];
  if (key === 'End') return keys[keys.length - 1];
  if (key === 'ArrowRight') return keys[(at + 1) % keys.length];
  if (key === 'ArrowLeft') return keys[(at - 1 + keys.length) % keys.length];
  return null;
}
