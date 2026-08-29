/**
 * Submit-time metadata extraction. The submitter already chose title, type,
 * subtype, blurb, and link — this call only files the metadata columns from
 * the typed text. Offline-testable: no network calls here; api/submit.js owns
 * the Claude call. Runs on Haiku — a fraction of a cent per submission.
 */
import { TYPES, isValidType, isValidSubtype } from '../../js/schema.js';

const FIELD_KEYS = ['date', 'source', 'topic', 'deadline', 'medium', 'authors', 'time', 'location'];
const GUESS_KEYS = ['headline', 'blurb', 'type', 'subtype'];

export const EXTRACT_MODEL = 'claude-haiku-4-5';

export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [...FIELD_KEYS, ...GUESS_KEYS, 'needs_review'],
  properties: {
    date: { type: 'string', description: 'Event date or publication date as YYYY-MM-DD; "" if not stated.' },
    source: { type: 'string', description: 'Outlet, publisher, journal, or host organization; "" if not stated.' },
    topic: { type: 'string', description: 'One short cross-cutting topic, e.g. "Teacher workforce"; "" if unclear.' },
    deadline: { type: 'string', description: 'Opportunities only: deadline as YYYY-MM-DD; else "".' },
    medium: { type: 'string', description: 'Headlines only: the outlet name; else "".' },
    authors: { type: 'string', description: 'Research only: author list as written; else "".' },
    time: { type: 'string', description: 'Events only: start time in Central Time, e.g. "1:00 PM CT"; else "".' },
    location: { type: 'string', description: 'Events only: venue/city or "Virtual"; else "".' },
    headline: { type: 'string', description: 'Required when no title was provided: a clear, specific title from the text. "" only when a title already exists.' },
    blurb: { type: 'string', description: 'Required when no blurb was provided: 2-3 factual sentences from the text. "" only when a blurb already exists.' },
    type: { type: 'string', enum: ['', 'research', 'event', 'opportunity', 'headline'], description: 'Best-fit type when none was provided; "" if unsure.' },
    subtype: { type: 'string', description: 'Legal subtype for the type, from the lists in the prompt; "" if unsure.' },
    needs_review: { type: 'boolean', description: 'true if the text was too thin or confusing to file confidently.' },
  },
};

export function buildExtractionPrompt(row, pageText = '') {
  const subtypeLists = Object.entries(TYPES)
    .map(([t, def]) => `${t}: ${def.subtypes.join(', ')}`).join('\n');
  const parts = [
    'File this newsletter submission into its metadata columns.',
    `Title: ${row.headline || '(none)'}`,
    `Type: ${row.type || '(none)'} / ${row.subtype || '(none)'}`,
    `Link: ${row.link || '(none)'}`,
    'Submitted text:',
    '---',
    row.original_text || row.blurb || '(none — the title and link are all we have)',
    '---',
  ];
  if (pageText) {
    parts.push('Text of the page behind the link:', '---', pageText, '---');
  }
  parts.push(
    'Rules: work only from the text above.',
    'Never invent a date, deadline, author, time, location, or source; use "" when the text does not state it.',
    'Dates are YYYY-MM-DD. Event times are Central Time, written like "1:00 PM CT" — convert from ET/PT when the zone is given.',
  );
  if (!row.headline) parts.push('No title was provided — you MUST write `headline`: a clear, specific title from the text.');
  if (!row.blurb && !row.original_text) parts.push('No blurb was provided — you MUST write `blurb`: 2-3 factual sentences from the text.');
  if (!row.type) parts.push('No type was provided — you MUST pick `type` (and a legal `subtype`) unless the text truly fits none.');
  parts.push(
    'Return "" for headline, blurb, type, and subtype when a value was already provided above.',
    'A subtype must come from the legal lists below (matched to the type); use "" if none fits:',
    subtypeLists,
  );
  return parts.join('\n');
}

export function parseExtraction(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('extraction was not valid JSON');
  }
}

export function normalizeExtraction(extracted, row) {
  const fields = {};
  const warnings = [];
  for (const key of [...FIELD_KEYS, ...GUESS_KEYS]) {
    const value = extracted?.[key];
    if (value === undefined || value === null || String(value) === '') continue;
    fields[key] = String(value);
  }
  if (fields.type && !isValidType(fields.type)) delete fields.type;
  const effectiveType = row?.type || fields.type || '';
  if (fields.subtype && !isValidSubtype(effectiveType, fields.subtype)) {
    delete fields.subtype;
  }
  if (extracted?.needs_review === true) {
    warnings.push('Claude was unsure about this one — double-check its fields.');
  }
  return { fields, warnings };
}
