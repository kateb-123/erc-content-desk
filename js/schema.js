/**
 * The one place that knows the shape of a Content Desk row.
 *
 * CSV_COLUMNS are the ERC Policy Exchange hub's news.csv columns, in the hub's
 * own order — verified against kateb-123/erc-policy-exchange/data/news.csv.
 * WORKFLOW_COLUMNS are ours; they never reach the hub.
 */

export const CSV_COLUMNS = [
  'date', 'headline', 'link', 'type', 'subtype', 'source', 'topic', 'blurb',
  'deadline', 'medium', 'authors', 'time', 'location', 'infographic',
];

export const WORKFLOW_COLUMNS = [
  'id', 'status', 'submitter', 'submitted_at', 'spotlight_request',
  'note', 'original_text', 'published_at', 'newsletter_issue',
];

export const SHEET_COLUMNS = [...CSV_COLUMNS, ...WORKFLOW_COLUMNS];

export const BOOLEAN_COLUMNS = ['spotlight_request'];

export const STATUSES = ['new', 'kept', 'circleback', 'trashed'];

/**
 * Type vocabulary. Every type is hub-eligible in v2 — all keeps publish to
 * the Exchange. ERC Spotlight is a per-row flag (spotlight_request), not a type.
 */
export const TYPES = {
  opportunity: {
    subtypes: ['Funding & Grants', 'Fellowships & Programs', 'Call for Proposals'],
    extraFields: ['deadline'],
  },
  research: {
    subtypes: ['Working Paper', 'Peer-Reviewed', 'Report', 'ERC Research'],
    extraFields: ['authors'],
  },
  headline: {
    subtypes: ['National', 'Texas'],
    extraFields: ['medium'],
  },
  event: {
    subtypes: ['A&M', 'Off-Campus', 'Webinar-Online'],
    extraFields: ['time', 'location'],
  },
};

/** `${type}|${subtype}` -> [newsletter section key, group key] (see js/model.js). */
export const NEWSLETTER_MAP = {
  'opportunity|Funding & Grants': ['opportunities', 'funding'],
  'opportunity|Fellowships & Programs': ['opportunities', 'fellowships'],
  'opportunity|Call for Proposals': ['opportunities', 'calls'],
  'research|Working Paper': ['policy', 'working'],
  'research|Peer-Reviewed': ['policy', 'peer'],
  'research|Report': ['policy', 'misc'],
  'research|ERC Research': ['research', 'brief'],
  'headline|National': ['headlines', 'federal'],
  'headline|Texas': ['headlines', 'texas'],
  'event|A&M': ['events', 'tamu'],
  'event|Off-Campus': ['events', 'offcampus'],
  'event|Webinar-Online': ['events', 'offcampus'],
};

export function blankRow(overrides = {}) {
  const row = {};
  for (const col of SHEET_COLUMNS) {
    row[col] = BOOLEAN_COLUMNS.includes(col) ? false : '';
  }
  return { ...row, ...overrides };
}

export function rowToValues(row) {
  return SHEET_COLUMNS.map(col => {
    if (BOOLEAN_COLUMNS.includes(col)) return row[col] ? 'TRUE' : '';
    return String(row[col] ?? '');
  });
}

export function valuesToRow(values) {
  const row = blankRow();
  SHEET_COLUMNS.forEach((col, i) => {
    const raw = values[i] ?? '';
    row[col] = BOOLEAN_COLUMNS.includes(col) ? raw === 'TRUE' : String(raw);
  });
  return row;
}

export function subtypesFor(type) {
  return Object.prototype.hasOwnProperty.call(TYPES, type) ? TYPES[type].subtypes.slice() : [];
}

export function isValidType(type) {
  return Object.prototype.hasOwnProperty.call(TYPES, type);
}

export function isValidSubtype(type, subtype) {
  return subtypesFor(type).includes(subtype);
}

export function isHubEligible(type) {
  return isValidType(type);
}
