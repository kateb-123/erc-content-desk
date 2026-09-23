/**
 * One row -> one line of the hub's news.csv. Kept browser-safe and tiny;
 * parsing/merging live server-side in api/_lib/hub.js.
 */
import { CSV_COLUMNS } from './schema.js';

export function escapeCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * The desk's own types and the Exchange's are not the same list. `erc_event`
 * exists here so ERC's own events can lead the newsletter; the Exchange has
 * four sections and no such type, so a row published as `erc_event` lands in
 * news.csv matching nothing and is unreachable on the site (Sep 22, 2026: six
 * of them did). Publish it as a plain event carrying the ERC Events subtype,
 * which the Exchange already prints in maroon beside ERC Research and sorts
 * first in Quick Search. A subtype she set by hand wins.
 */
export function toHubRow(row) {
  if (row?.type !== 'erc_event') return row;
  return { ...row, type: 'event', subtype: String(row.subtype ?? '').trim() || 'ERC Events' };
}

export function hubRowLine(row) {
  const hubRow = toHubRow(row);
  return CSV_COLUMNS.map(col => escapeCell(hubRow[col])).join(',');
}

/** The header line, then one hub line per row: the copy she downloads
 *  before Publish (Kate, Sep 22: the CSV comes first), the rows being added. */
export function hubCsvText(rows) {
  return [CSV_COLUMNS.join(','), ...rows.map(hubRowLine), ''].join('\n');
}

/** Parse CSV text into rows of cells (quoted commas, doubled quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  const src = String(text ?? '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ''));
}

/**
 * Filename for the copy Kate keeps when she publishes: dated, so a
 * folder of them sorts chronologically. An unparseable date drops the stamp
 * rather than writing "Invalid Date" into a filename.
 */
export function hubCsvFilename(when = new Date()) {
  const t = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(t.getTime())) return 'erc-exchange.csv';
  const pad = n => String(n).padStart(2, '0');
  return `erc-exchange-${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}.csv`;
}
