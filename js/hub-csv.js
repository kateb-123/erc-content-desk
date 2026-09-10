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

export function hubRowLine(row) {
  return CSV_COLUMNS.map(col => escapeCell(row[col])).join(',');
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
 * Filename for the copy Kate keeps when she publishes (Sep 9): dated, so a
 * folder of them sorts chronologically. An unparseable date drops the stamp
 * rather than writing "Invalid Date" into a filename.
 */
export function hubCsvFilename(when = new Date()) {
  const t = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(t.getTime())) return 'erc-exchange.csv';
  const pad = n => String(n).padStart(2, '0');
  return `erc-exchange-${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}.csv`;
}
