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
  'id', 'status', 'submitter', 'submitted_at', 'note', 'original_text',
  'newsletter', 'hub', 'newsletter_used_at', 'hub_used_at',
];

export const SHEET_COLUMNS = [...CSV_COLUMNS, ...WORKFLOW_COLUMNS];

export const BOOLEAN_COLUMNS = ['newsletter', 'hub'];

export const STATUSES = ['new', 'kept', 'processed', 'trashed'];

/**
 * Type vocabulary. Subtypes for the four hub types are exactly the values that
 * appear in the live hub CSV — do not invent new ones without adding them to
 * the hub's own data first. `spotlight` and `intro` are newsletter-only.
 */
export const TYPES = {
  opportunity: {
    subtypes: ['Funding & Grants', 'Fellowships & Programs', 'Call for Proposals'],
    extraFields: ['deadline'],
    hubEligible: true,
  },
  research: {
    subtypes: ['Working Paper', 'Peer-Reviewed', 'Report', 'ERC Research'],
    extraFields: ['authors'],
    hubEligible: true,
  },
  headline: {
    subtypes: ['National', 'Texas'],
    extraFields: ['medium'],
    hubEligible: true,
  },
  event: {
    subtypes: ['Online'],
    extraFields: ['time', 'location'],
    hubEligible: true,
  },
  spotlight: {
    subtypes: ['Programs & Opportunities', 'Events', 'This & That'],
    extraFields: ['time', 'location'],
    hubEligible: false,
  },
  intro: {
    subtypes: ['Intro'],
    extraFields: [],
    hubEligible: false,
  },
};

/** `${type}|${subtype}` -> [newsletter section key, newsletter group key]. */
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
  'event|Online': ['events', 'offcampus'],
  'spotlight|Programs & Opportunities': ['spotlight', 'programs'],
  'spotlight|Events': ['spotlight', 'events'],
  'spotlight|This & That': ['spotlight', 'thisandthat'],
  'intro|Intro': ['intro', ''],
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
  return Object.prototype.hasOwnProperty.call(TYPES, type) && TYPES[type].hubEligible;
}
