/**
 * Status transitions for a Content Desk row.
 *
 * new -> kept -> processed        (a keep, then Claude fills the CSV fields)
 * new -> trashed
 *
 * "Used" is per destination, not a status: one row can feed both the newsletter
 * and the hub, and each consumes it independently.
 *
 * Every function here is pure and returns a new object.
 */

import { CSV_COLUMNS, isHubEligible } from './schema.js';

const DESTINATIONS = ['newsletter', 'hub'];

export function pendingRows(rows) {
  return rows.filter(r => r.status === 'new');
}

export function decidedRows(rows) {
  return rows.filter(r => r.status === 'kept' || r.status === 'processed');
}

export function keepersAwaitingProcess(rows) {
  return rows.filter(r => r.status === 'kept');
}

export function keep(row, { newsletter = false, hub = false } = {}) {
  // A pending row has no type yet — Process assigns it. So only veto the hub
  // flag when we actually know the type and it is newsletter-only; otherwise
  // every hub tick made on the Sort screen would be silently discarded.
  const hubAllowed = !row.type || isHubEligible(row.type);
  return {
    ...row,
    status: 'kept',
    newsletter: Boolean(newsletter),
    hub: Boolean(hub) && hubAllowed,
  };
}

export function trash(row) {
  return { ...row, status: 'trashed', newsletter: false, hub: false };
}

export function undecide(row) {
  return { ...row, status: 'new', newsletter: false, hub: false };
}

/** Merge Claude's output. Only CSV columns are writable — workflow columns are ours. */
export function applyExtracted(row, fields) {
  const next = { ...row };
  for (const col of CSV_COLUMNS) {
    if (fields[col] !== undefined && fields[col] !== null) next[col] = String(fields[col]);
  }
  next.status = 'processed';
  // Now that the type is known, re-check hub eligibility: the team ticked Hub
  // before anyone knew this was ERC-internal content.
  if (next.hub && next.type && !isHubEligible(next.type)) next.hub = false;
  return next;
}

export function readyFor(rows, dest) {
  if (!DESTINATIONS.includes(dest)) throw new Error(`unknown destination: ${dest}`);
  return rows.filter(r => r.status === 'processed' && r[dest] && !r[`${dest}_used_at`]);
}

export function markUsed(row, dest, timestamp) {
  if (!DESTINATIONS.includes(dest)) throw new Error(`unknown destination: ${dest}`);
  return { ...row, [`${dest}_used_at`]: timestamp };
}

export function counts(rows) {
  return {
    pending: pendingRows(rows).length,
    kept: rows.filter(r => r.status === 'kept').length,
    processed: rows.filter(r => r.status === 'processed').length,
    trashed: rows.filter(r => r.status === 'trashed').length,
    newsletterReady: readyFor(rows, 'newsletter').length,
    hubReady: readyFor(rows, 'hub').length,
  };
}
