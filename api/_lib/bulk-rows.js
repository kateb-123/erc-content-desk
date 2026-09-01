/**
 * The spreadsheet half of the bulk door: one row = one item. Recognizable
 * headers map straight into item fields; every other column folds into
 * original_text so submit-time enrichment can still read it. Type cells
 * accept keys, display labels, or plurals; anything unrecognized passes
 * through for normalizeBulkItems to warn about and untype — untyped items
 * enter untyped, and Sort's "To review" catches them.
 */
import { TYPES, TYPE_LABELS } from '../../js/schema.js';

const HEADER_ALIASES = {
  title: ['title', 'headline', 'name', 'item'],
  blurb: ['blurb', 'description', 'summary', 'abstract', 'details'],
  link: ['link', 'url', 'website'],
  type: ['type', 'category'],
  subtype: ['subtype', 'subcategory'],
};

const norm = s => String(s ?? '').trim().toLowerCase();

function typeFromValue(value) {
  const n = norm(value);
  if (!n) return '';
  if (TYPES[n]) return n;
  const byLabel = Object.entries(TYPE_LABELS).find(([, label]) => norm(label) === n);
  if (byLabel) return byLabel[0];
  const singular = n.replace(/s$/, '');
  if (TYPES[singular]) return singular;
  return String(value).trim();
}

export function rowsToItems(matrix) {
  const [header = [], ...rows] = matrix;
  const map = header.map(h => {
    const n = norm(h);
    return Object.keys(HEADER_ALIASES).find(f => HEADER_ALIASES[f].includes(n)) ?? null;
  });
  return rows.map(cells => {
    const item = { title: '', blurb: '', link: '', type: '', subtype: '', original_text: '' };
    const extras = [];
    cells.forEach((cell, i) => {
      const value = String(cell ?? '').trim();
      if (!value) return;
      const field = map[i];
      if (field === 'type') item.type = typeFromValue(value);
      else if (field) item[field] = value;
      else extras.push(`${String(header[i] ?? '').trim() || `column ${i + 1}`}: ${value}`);
    });
    item.original_text = extras.join('\n');
    return item;
  });
}
