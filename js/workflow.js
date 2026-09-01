/**
 * Status transitions and derived views over sheet rows. Everything here is
 * pure — callers persist the returned copies. v2 statuses:
 * new -> kept | circleback | trashed; kept rows then gain published_at
 * (Publish screen) and newsletter_issue (Build screen).
 */
import { CSV_COLUMNS, SHEET_COLUMNS } from './schema.js';

export function pendingRows(rows) {
  return rows.filter(r => r.status === 'new');
}

export function circlebackRows(rows) {
  return rows.filter(r => r.status === 'circleback');
}

export function decidedRows(rows) {
  return rows.filter(r => r.status === 'kept' || r.status === 'trashed');
}

export function keep(row) {
  return { ...row, status: 'kept' };
}

export function trash(row) {
  return { ...row, status: 'trashed' };
}

export function circleback(row, note = '') {
  const trimmed = String(note ?? '').trim();
  const existing = String(row.note ?? '');
  const merged = trimmed ? (existing ? `${existing}\n${trimmed}` : trimmed) : existing;
  return { ...row, status: 'circleback', note: merged };
}

export function undecide(row) {
  return { ...row, status: 'new' };
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
 * How Sort treats a row's link. 'alert' = the desk recorded a failed read, an
 * editor must Verify or Change the link; 'verified' = a human did; 'quiet'
 * otherwise — including legacy rows with no link_checked value at all.
 */
export function linkCheckState(row) {
  if (!String(row.link ?? '').trim()) return 'quiet';
  if (row.link_checked === 'human') return 'verified';
  if (row.link_checked === 'failed') return 'alert';
  return 'quiet';
}

/**
 * Newsletter-only: spotlight events stay off the public Exchange — webinars
 * excepted. Narrower than sort-view.js's isErc (which also counts ERC
 * Research and non-event spotlights) — don't conflate the two.
 */
export function newsletterOnly(row) {
  return row.type === 'event' && Boolean(row.spotlight_request) && row.subtype !== 'Webinar-Online';
}

/**
 * The one rewrite predicate, shared by Finalize (client) and /api/rewrite
 * (server) so the two can never disagree: events and opportunities always
 * get the ERC voice; research only when it arrived without an abstract.
 * A checked row (rewrite_checked) is done for good.
 */
export function needsErcVoice(row) {
  if (String(row.rewrite_checked ?? '').trim()) return false;
  return row.type === 'event' || row.type === 'opportunity'
    || (row.type === 'research' && !row.blurb);
}

export function readyToPublish(rows) {
  // A row stamped into an issue is done with Publish — newsletter-only holds
  // drain here instead of sitting in the held list forever.
  return rows.filter(r => r.status === 'kept' && !r.published_at && !r.newsletter_issue);
}

export function publishedRows(rows) {
  return rows.filter(r => r.status === 'kept' && Boolean(r.published_at));
}

export function buildPool(rows) {
  return rows.filter(r => r.status === 'kept' && !r.newsletter_issue
    && (Boolean(r.published_at) || newsletterOnly(r)));
}

export function markPublished(row, timestamp) {
  return { ...row, published_at: timestamp };
}

export function markNewsletterIssue(row, issueDate) {
  return { ...row, newsletter_issue: issueDate };
}

/** The un-send: clear the stamp and the row rejoins the pool (and Publish's held list). */
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

/** Parked events whose date has already passed — quietly flagged in the UI. */
export function staleCirclebacks(rows, todayIso) {
  return circlebackRows(rows).filter(
    r => r.type === 'event' && r.date && r.date < todayIso,
  );
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

export function counts(rows) {
  return {
    pending: pendingRows(rows).length,
    circleback: circlebackRows(rows).length,
    kept: rows.filter(r => r.status === 'kept').length,
    trashed: rows.filter(r => r.status === 'trashed').length,
    readyToPublish: readyToPublish(rows).length,
    published: publishedRows(rows).length,
    pool: buildPool(rows).length,
  };
}
