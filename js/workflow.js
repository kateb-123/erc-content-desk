/**
 * Status transitions and derived views over sheet rows. Everything here is
 * pure — callers persist the returned copies. v2 statuses:
 * new -> kept | circleback | trashed; kept rows then gain published_at
 * (Publish to Exchange) and newsletter_issue (Send to Newsletter). Where a
 * kept row goes is its send_to (Sort's "Send it to", Sep 18).
 */
import { CSV_COLUMNS, TYPES } from './schema.js';

export function pendingRows(rows) {
  return rows.filter(r => r.status === 'new');
}

export function circlebackRows(rows) {
  return rows.filter(r => r.status === 'circleback');
}

/** Keep freezes the row's Send it to, so a later stamp or type change never
 *  moves it off a page it was kept for. */
export function keep(row) {
  return { ...row, status: 'kept', send_to: sendToValue(sendTo(row)) };
}

export function trash(row) {
  // A deleted item never rides into an issue: the stamp goes with it, since
  // quick add can stamp a row Sort has not seen yet. Undo restores the row as
  // it was, stamp included.
  return { ...row, status: 'trashed', newsletter_issue: '' };
}

export function circleback(row) {
  return { ...row, status: 'circleback' };
}

/**
 * Merge extracted CSV fields into a row, with provenance: only non-empty
 * extracted values are applied, and only into columns the row left blank, so
 * extraction can never overwrite what a submitter typed. Status is untouched
 * — extraction runs at submit time on 'new' rows. Returns the merged row plus
 * the list of CSV columns the machine filled (also stamped into auto_filled).
 */
export function applyExtractedWithProvenance(row, fields) {
  const next = { ...row };
  const filled = [];
  for (const col of CSV_COLUMNS) {
    const value = fields?.[col];
    if (value === undefined || value === null || String(value) === '') continue;
    // Only fill if the row value is empty
    if (!row[col]) {
      next[col] = String(value);
      filled.push(col);
    }
  }
  filled.sort();
  return { row: { ...next, auto_filled: filled.join(',') }, filled };
}

/** Drop the named fields from a comma-separated auto_filled list. */
export function withoutAutoFilled(list, cleared) {
  return String(list ?? '').split(',').map(s => s.trim()).filter(Boolean)
    .filter(f => !cleared.includes(f)).join(',');
}

/** What submit records in link_checked after trying to read the linked page. */
export function linkCheckedFromFetch(pageText) {
  return pageText ? 'ok' : 'failed';
}

/**
 * Whether Sort has to ask about a row's link: the desk recorded a failed read
 * or a page about a different item (mismatch), so an editor must Verify or
 * Change it. A human check and legacy rows with no link_checked value at all
 * are quiet, and a row with no link has nothing to check.
 */
export function linkNeedsCheck(row) {
  if (!String(row.link ?? '').trim()) return false;
  return row.link_checked === 'failed' || row.link_checked === 'mismatch';
}

/**
 * Newsletter-only by default: the campus rule (Kate, Sep 22). An Event with
 * the A&M subtype, another campus unit's event, starts held off the public
 * Exchange; the sorter can untick it. Nothing else is held: ERC's own events
 * publish there as events tagged ERC Events, webinars and off-campus events
 * go, and the old spotlight_request flag moves nothing any more (the form's
 * checkbox went the same day). Not sort-view.js's isErc, which says whose
 * an item is, not where it goes.
 */
export function newsletterOnly(row) {
  return row.type === 'event' && row.subtype === 'A&M';
}

/**
 * The one rewrite predicate, shared by Finalize (client) and /api/rewrite
 * (server) so the two can never disagree: events and opportunities always
 * get the ERC voice; research only when it arrived without an abstract.
 * A checked row (rewrite_checked) is done for good.
 */
export function needsErcVoice(row) {
  if (String(row.rewrite_checked ?? '').trim()) return false;
  if (row.type === 'event' || row.type === 'erc_event' || row.type === 'opportunity') return true;
  // A Report's "abstract" is usually a page-long findings summary, so it always
  // needs the ERC voice, not only when it arrived blank.
  return row.type === 'research' && (row.subtype === 'Report' || !row.blurb);
}

const hasText = row => Boolean(String(row.blurb ?? '').trim() || String(row.original_text ?? '').trim());

/** What Rewrite can act on: needs the voice and has words to draft from.
 *  Finalize's count and /api/rewrite's candidates both use this, so the
 *  screen never offers a rewrite the server declines. */
export function canRewrite(row) {
  return needsErcVoice(row) && hasText(row);
}

/** Needs the voice but arrived with no text at all (a bare link the reader
 *  couldn't open): a person has to write the description with Edit. */
export function needsDescription(row) {
  return needsErcVoice(row) && !hasText(row);
}

/**
 * Where a row goes (Kate, Sep 18: "Tick = it waits on that page"): its
 * send_to, 'both' | 'newsletter' | 'exchange' | 'none'. A row nobody has
 * ticked (every row kept before Send it to) takes the old routing: both,
 * except a campus event (newsletterOnly) and a row stamped into an issue
 * before it was published (quick add stamps before Sort), which stay off the
 * Exchange.
 */
const SEND_TO = {
  both: { newsletter: true, exchange: true },
  newsletter: { newsletter: true, exchange: false },
  exchange: { newsletter: false, exchange: true },
  none: { newsletter: false, exchange: false },
};
export function sendTo(row) {
  const set = SEND_TO[String(row?.send_to ?? '')];
  if (set) return { ...set };
  const newsletterOnlyHold = newsletterOnly(row) || (Boolean(row?.newsletter_issue) && !row?.published_at);
  return { newsletter: true, exchange: !newsletterOnlyHold };
}

/** The ticks as the one word the row stores. */
export function sendToValue({ newsletter, exchange }) {
  if (newsletter && exchange) return 'both';
  if (newsletter) return 'newsletter';
  return exchange ? 'exchange' : 'none';
}

/** Kept and still on its way, wherever it is ticked for: Finalize's list and
 *  the rewrite's candidates. Out once it is published or in an issue. */
export function readyToFinalize(rows) {
  return rows.filter(r => r.status === 'kept' && !r.published_at && !r.newsletter_issue);
}

/** Kept, ticked for the Exchange, not published yet: an issue stamp does not take a row off the Exchange's list. */
export function readyToPublish(rows) {
  return rows.filter(r => r.status === 'kept' && !r.published_at && sendTo(r).exchange);
}

/** Kept, ticked for the Newsletter, not in an issue yet: it waits there at once, published or not. */
export function buildPool(rows) {
  return rows.filter(r => r.status === 'kept' && !r.newsletter_issue && sendTo(r).newsletter);
}

export function markPublished(row, timestamp) {
  return { ...row, published_at: timestamp };
}

export function markNewsletterIssue(row, issueDate) {
  return { ...row, newsletter_issue: issueDate };
}

/** The un-send: clear the stamp and the row rejoins the pool. */
export function clearNewsletterIssue(row) {
  return { ...row, newsletter_issue: '' };
}

/**
 * Re-share detection: a row whose link matches a DIFFERENT row already sent
 * in an issue that has gone out (issue date <= today). Returns
 * Map<id, thatIssueDate> — the note is informational, never a blocker.
 */
export function reshareFlags(rows, todayIso) {
  const sentByLink = new Map();
  for (const row of rows) {
    const link = String(row.link ?? '').trim();
    const issue = String(row.newsletter_issue ?? '').trim();
    if (!link || !issue || issue > todayIso) continue;
    const prior = sentByLink.get(link);
    if (!prior || issue > prior.issue) sentByLink.set(link, { id: row.id, issue });
  }
  const flags = new Map();
  for (const row of rows) {
    const link = String(row.link ?? '').trim();
    if (!link) continue;
    const sent = sentByLink.get(link);
    if (sent && sent.id !== row.id) flags.set(row.id, sent.issue);
  }
  return flags;
}

/**
 * Duplicate detection across ALL history: rows are never deleted, so a link
 * match against every row is the duplicate index. Returns Map<id, priorId>
 * pointing each later submission at the earliest one with the same link.
 */
export function duplicateFlags(rows) {
  const ordered = [...rows].sort((a, b) =>
    String(a.submitted_at).localeCompare(String(b.submitted_at)));
  const firstByLink = new Map();
  const flags = new Map();
  for (const row of ordered) {
    const link = String(row.link ?? '').trim();
    if (!link) continue;
    if (firstByLink.has(link)) flags.set(row.id, firstByLink.get(link));
    else firstByLink.set(link, row.id);
  }
  return flags;
}

/**
 * The load-bearing fields this row's type needs and does not have. Driven by the
 * schema's extraFields, plus a date for anything event-shaped — an event with no
 * date is not usable. Sort shows these so she can go find them or bin the
 * item; it never blocks Keep. An untyped row says nothing: fixing the type
 * comes first.
 */
export function missingFields(row) {
  const def = TYPES[row?.type];
  if (!def) return [];
  const wanted = row.type === 'event' || row.type === 'erc_event'
    ? ['date', ...def.extraFields]
    : def.extraFields;
  return wanted.filter(f => !String(row[f] ?? '').trim());
}
