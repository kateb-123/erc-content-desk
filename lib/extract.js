/**
 * The pure half of the Process step: what we ask Claude for, and what we accept
 * back. No network calls live here, so the prompt and the validation are both
 * testable offline.
 */

import { CSV_COLUMNS, TYPES, isValidType, isValidSubtype, subtypesFor } from '../js/schema.js';

/**
 * Fed to output_config.format so the response is guaranteed-parseable JSON.
 * Structured outputs require additionalProperties: false and an explicit
 * required list.
 */
export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'The item title, cleaned up but not editorialised.' },
    type: { type: 'string', enum: Object.keys(TYPES), description: 'Which category this item belongs to.' },
    subtype: { type: 'string', description: 'The group within that type. Must be one of the listed values for the chosen type.' },
    blurb: { type: 'string', description: 'Two to three sentences in the ERC voice, 40 to 70 words.' },
    source: { type: 'string', description: 'The outlet, journal, publisher, or host. Empty if unclear.' },
    topic: { type: 'string', description: 'A short cross-cutting topic label, e.g. "Early literacy". Empty if unclear.' },
    date: { type: 'string', description: 'ISO date (YYYY-MM-DD) when known; a year or year-month is fine when that is all there is. Empty if unknown.' },
    link: { type: 'string', description: 'The canonical URL for the item. Empty if there is none.' },
    deadline: { type: 'string', description: 'Opportunities only: application deadline, ISO date or prose like "Fall 2026".' },
    medium: { type: 'string', description: 'Headlines only: one of online, newspaper, radio, tv, magazine.' },
    authors: { type: 'string', description: 'Research only: author list as printed.' },
    time: { type: 'string', description: 'Events only: start time in Central Time, e.g. "1:00 PM CT".' },
    location: { type: 'string', description: 'Events only: venue, or the format when virtual.' },
  },
  required: ['headline', 'type', 'subtype', 'blurb'],
  additionalProperties: false,
};

function vocabularyBlock() {
  return Object.entries(TYPES)
    .map(([type, def]) => {
      const subtypes = def.subtypes.join(' · ');
      const extras = def.extraFields.length ? ` (also fill: ${def.extraFields.join(', ')})` : '';
      return `- ${type}: ${subtypes}${extras}`;
    })
    .join('\n');
}

export function buildExtractionPrompt(row) {
  const parts = [
    'Read the submitted item below and turn it into one structured entry.',
    '',
    'Choose exactly one type, and a subtype that belongs to it:',
    vocabularyBlock(),
    '',
    'Use `spotlight` for ERC-internal content (our own programs, events, and happenings) and `intro` for the newsletter opening. Everything else is one of the four public types.',
    '',
  ];

  if (row.link) {
    parts.push(`Source URL: ${row.link}`);
    parts.push('Fetch that page and use what it actually says. If it will not load, work from the submitted text alone.');
    parts.push('');
  }

  parts.push('Submitted text:');
  parts.push('---');
  parts.push(row.original_text || '(none — the link is all we have)');
  parts.push('---');

  if (row.note) parts.push('', `Note from ${row.submitter || 'the submitter'}: ${row.note}`);

  return parts.join('\n');
}

export function parseExtraction(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Claude returned something that is not JSON.');
  }
}

/**
 * Trust nothing: keep only CSV columns, verify the type/subtype pair against the
 * live vocabulary, and blank anything that does not check out so a bad guess
 * shows up as an empty cell rather than a wrong one.
 */
export function normalizeExtraction(extracted) {
  const fields = {};
  const warnings = [];

  for (const col of CSV_COLUMNS) {
    if (extracted[col] !== undefined && extracted[col] !== null) fields[col] = String(extracted[col]);
  }

  if (fields.type && !isValidType(fields.type)) {
    warnings.push(`Claude picked an unknown type "${fields.type}" — left blank for you to set.`);
    fields.type = '';
    fields.subtype = '';
  } else if (fields.type && fields.subtype && !isValidSubtype(fields.type, fields.subtype)) {
    warnings.push(`"${fields.subtype}" is not a ${fields.type} subtype (expected one of ${subtypesFor(fields.type).join(', ')}) — left blank.`);
    fields.subtype = '';
  }

  return { fields, warnings };
}
