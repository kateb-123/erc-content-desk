/**
 * discarded.js: the pure side of kept drafts (Kate, Sep 23, 2026). Discard
 * sends the in-progress issue to the desk, which keeps it 90 days, and only
 * then clears it here; Review lists what was discarded, newest first, with
 * Restore. app.js draws; nothing here touches the DOM.
 */

import { countIssueItems } from './model.js';
import { isoToDisplayDate, displayDateToISO } from './wizard.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const itemCount = n => `${n} ${n === 1 ? 'item' : 'items'}`;

/** What POST /api/drafts takes: the issue as it stands, and its date as ISO. */
export function discardBody(issue) {
  return { issueDate: displayDateToISO(issue?.date || ''), draft: issue };
}

/**
 * Discard: the desk keeps the draft first, and only then is it cleared here,
 * so a send that fails loses nothing (the rejection reaches the caller).
 * @param {object} issue
 * @param {{ send: (body: object) => Promise<object>, clear: () => void }} io
 */
export async function discardToDesk(issue, { send, clear }) {
  const reply = await send(discardBody(issue));
  clear();
  return reply;
}

/** A draft worth asking about before Restore replaces it: items, or an introduction. */
export function draftIsOpen(issue) {
  return countIssueItems(issue) > 0 || Boolean(String(issue?.intro ?? '').trim());
}

/** The one-line ask before Restore replaces the open draft, naming it. */
export function replaceAskMessage(open) {
  const date = String(open?.date ?? '').trim();
  const items = itemCount(countIssueItems(open));
  return date ? `Replace the open draft for ${date} (${items})?` : `Replace the open draft (${items})?`;
}

/** An entry's first line: the issue it was for. */
export function discardedTitle(entry) {
  return isoToDisplayDate(entry?.issueDate ?? '') || 'No issue picked';
}

/** The calendar day an instant falls on where the builder is being used. */
const dayOf = (date, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/**
 * When a draft was discarded: "today at 2:14 PM", "yesterday at 9:05 AM",
 * else the date ("Sep 3"); '' when the time is unreadable. By the local
 * clock; the tests pin the zone.
 */
export function discardedWhen(iso, now = new Date(), timeZone = undefined) {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return '';
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(at);
  const day = dayOf(at, timeZone);
  if (day === dayOf(now, timeZone)) return `today at ${time}`;
  if (day === dayOf(new Date(now.getTime() - DAY_MS), timeZone)) return `yesterday at ${time}`;
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(at);
}

/** An entry's second line: what it holds, and when it went. */
export function discardedDetail(entry, now = new Date(), timeZone = undefined) {
  const when = discardedWhen(entry?.discardedAt, now, timeZone);
  const items = itemCount(Number(entry?.items) || 0);
  return when ? `${items} · discarded ${when}` : items;
}

/** The list with a new entry leading it (newest first), never twice. */
export function withEntry(list, entry) {
  return [entry, ...(list ?? []).filter((e) => e.id !== entry.id)];
}

/** The list without one entry: restored, or gone from the desk. */
export function withoutEntry(list, id) {
  return (list ?? []).filter((e) => e.id !== id);
}
