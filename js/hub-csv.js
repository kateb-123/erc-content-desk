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
