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

/**
 * Newsletter-only: spotlight events stay off the public Exchange — webinars
 * excepted. Narrower than sort-view.js's isErc (which also counts ERC
 * Research and non-event spotlights) — don't conflate the two.
 */
export function newsletterOnly(row) {
  return row.type === 'event' && Boolean(row.spotlight_request) && row.subtype !== 'Webinar-Online';
}

export function readyToPublish(rows) {
  return rows.filter(r => r.status === 'kept' && !r.published_at);
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
