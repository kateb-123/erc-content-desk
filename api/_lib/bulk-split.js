/**
 * Bulk upload: one Haiku call splits a pasted document (like Kate's multi-tab
 * newsletter Google Doc) into individual submission items. No writes happen
 * here — the UI shows the split for confirmation, then submits each item
 * through the normal /api/submit path (which runs per-item extraction).
 */
import { TYPES, isValidType, isValidSubtype, subtypesFor } from '../../js/schema.js';

const MAX_ITEMS = 100;

export const BULK_MODEL = 'claude-haiku-4-5';

export const BULK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'blurb', 'link', 'type', 'subtype', 'original_text'],
        properties: {
          title: { type: 'string' },
          blurb: { type: 'string', description: 'The descriptive text for this item, lightly cleaned; "" if none.' },
          link: { type: 'string', description: 'The main URL for this item; "" if none.' },
          type: { type: 'string', enum: [...Object.keys(TYPES), ''] },
          subtype: { type: 'string', description: 'A subtype belonging to the chosen type; "" if unsure.' },
          original_text: { type: 'string', description: "This item's chunk of the document, verbatim." },
        },
      },
    },
  },
};

export function buildBulkPrompt(text) {
  const vocab = Object.entries(TYPES)
    .map(([type, def]) => `- ${type}: ${def.subtypes.join(' · ')}`)
    .join('\n');
  return [
    'Split this document into individual newsletter submission items.',
    'One item per event, paper, article, opportunity, or announcement.',
    'For each item: a clean title, its descriptive text as the blurb, its main URL as the link,',
    'a type and subtype from this vocabulary (or "" when unsure):',
    vocab,
    'and original_text = that item\'s chunk of the document, verbatim (do not paraphrase it).',
    'Skip headers, dividers, and empty scaffolding. Never merge two items into one.',
    'Document:',
    '---',
    text,
    '---',
  ].join('\n');
}

export function parseBulk(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('bulk split was not valid JSON');
  }
}

export function normalizeBulkItems(parsed) {
  const warnings = [];
  const s = v => String(v ?? '').trim();
  let raw = Array.isArray(parsed?.items) ? parsed.items : [];
  if (raw.length > MAX_ITEMS) {
    warnings.push(`Found ${raw.length} items — keeping the first ${MAX_ITEMS}.`);
    raw = raw.slice(0, MAX_ITEMS);
  }
  const items = [];
  for (const it of raw) {
    const item = {
      title: s(it?.title), blurb: s(it?.blurb), link: s(it?.link),
      type: s(it?.type), subtype: s(it?.subtype), original_text: s(it?.original_text),
    };
    if (!item.title && !item.link) continue;
    const label = item.title || item.link;
    if (item.type && !isValidType(item.type)) {
      warnings.push(`${label}: unknown type "${item.type}" — pick one during sort.`);
      item.type = '';
      item.subtype = '';
    } else if (item.type && item.subtype && !isValidSubtype(item.type, item.subtype)) {
      warnings.push(`${label}: "${item.subtype}" is not a ${item.type} subtype (expected ${subtypesFor(item.type).join(', ')}).`);
      item.subtype = '';
    } else if (!item.type) {
      item.subtype = '';
    }
    items.push(item);
  }
  return { items, warnings };
}
