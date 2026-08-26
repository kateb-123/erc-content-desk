/**
 * Submit-time metadata extraction. The submitter already chose title, type,
 * subtype, blurb, and link — this call only files the metadata columns from
 * the typed text. Offline-testable: no network calls here; api/submit.js owns
 * the Claude call. Runs on Haiku — a fraction of a cent per submission.
 */
const FIELD_KEYS = ['date', 'source', 'topic', 'deadline', 'medium', 'authors', 'time', 'location'];

export const EXTRACT_MODEL = 'claude-haiku-4-5';

export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [...FIELD_KEYS, 'needs_review'],
  properties: {
    date: { type: 'string', description: 'Event date or publication date as YYYY-MM-DD; "" if not stated.' },
    source: { type: 'string', description: 'Outlet, publisher, journal, or host organization; "" if not stated.' },
    topic: { type: 'string', description: 'One short cross-cutting topic, e.g. "Teacher workforce"; "" if unclear.' },
    deadline: { type: 'string', description: 'Opportunities only: deadline as YYYY-MM-DD; else "".' },
    medium: { type: 'string', description: 'Headlines only: the outlet name; else "".' },
    authors: { type: 'string', description: 'Research only: author list as written; else "".' },
    time: { type: 'string', description: 'Events only: start time in Central Time, e.g. "1:00 PM CT"; else "".' },
    location: { type: 'string', description: 'Events only: venue/city or "Virtual"; else "".' },
    needs_review: { type: 'boolean', description: 'true if the text was too thin or confusing to file confidently.' },
  },
};

export function buildExtractionPrompt(row) {
  const parts = [
    'File this newsletter submission into its metadata columns.',
    `Title: ${row.headline}`,
    `Type: ${row.type} / ${row.subtype}`,
    `Link: ${row.link || '(none)'}`,
    'Submitted text:',
    '---',
  ];
  if (row.blurb) parts.push(row.blurb);
  if (row.original_text) parts.push(row.original_text);
  if (!row.blurb && !row.original_text) parts.push('(none — the title and link are all we have)');
  parts.push(
    '---',
    'Rules: work only from the text above — do not fetch the link.',
    'Never invent a date, deadline, author, time, location, or source; use "" when the text does not state it.',
    'Dates are YYYY-MM-DD. Event times are Central Time, written like "1:00 PM CT" — convert from ET/PT when the zone is given.',
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

export function normalizeExtraction(extracted) {
  const fields = {};
  const warnings = [];
  for (const key of FIELD_KEYS) {
    const value = extracted?.[key];
    if (value === undefined || value === null || String(value) === '') continue;
    fields[key] = String(value);
  }
  if (extracted?.needs_review === true) {
    warnings.push('Claude was unsure about this one — double-check its fields.');
  }
  return { fields, warnings };
}
