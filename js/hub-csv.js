/**
 * news.csv for the ERC Policy Exchange hub.
 *
 * The output must match what kateb-123/erc-policy-exchange already parses:
 * the 14 CSV_COLUMNS, in order, header row first. Workflow columns never ship.
 */

import { CSV_COLUMNS, isHubEligible } from './schema.js';
import { readyFor } from './workflow.js';

export function escapeCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function rowsToCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map(col => escapeCell(row[col])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * readyFor(rows, 'hub') alone is not enough to ship: when Claude returns a
 * type outside the vocabulary, extract.js blanks both type and subtype, and
 * the hub flag survives that (it's only cleared when a *known* type turns
 * out to be newsletter-only — see applyExtracted). Filter those uncategorised
 * rows out here so they can never reach the public news.csv.
 */
export function hubExportableRows(rows) {
  return readyFor(rows, 'hub').filter(r => r.type && r.subtype && isHubEligible(r.type));
}

export function hubCsvFor(rows) {
  const pending = hubExportableRows(rows).slice().sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });
  return rowsToCsv(pending);
}
