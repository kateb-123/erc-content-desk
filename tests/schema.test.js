import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSV_COLUMNS, WORKFLOW_COLUMNS, SHEET_COLUMNS, BOOLEAN_COLUMNS, TYPES, NEWSLETTER_MAP,
  TYPE_ORDER, TYPE_LABELS, TYPE_DISPLAY, typeDisplay, typeIsFlat,
  blankRow, rowToValues, valuesToRow, subtypesFor, isValidType, isValidSubtype,
} from '../js/schema.js';
import { GROUP_LABELS } from '../js/newsletter-view.js';

test('the CSV columns match the hub news.csv header exactly, in order', () => {
  assert.deepEqual(CSV_COLUMNS, [
    'date', 'headline', 'link', 'type', 'subtype', 'source', 'topic', 'blurb',
    'deadline', 'medium', 'authors', 'time', 'location', 'infographic',
  ]);
});

test('sheet columns are the 14 hub columns plus the 15 workflow columns', () => {
  assert.deepEqual(WORKFLOW_COLUMNS, [
    'id', 'status', 'submitter', 'submitted_at', 'spotlight_request',
    'note', 'original_text', 'published_at', 'newsletter_issue', 'auto_filled',
    'link_checked', 'rewrite_checked', 'submitter_email', 'needs_review',
    'pending_read',
  ]);
  assert.deepEqual(SHEET_COLUMNS, [...CSV_COLUMNS, ...WORKFLOW_COLUMNS]);
  // needs_review, then pending_read, were APPENDED, never inserted: the sheet is
  // written by position, so an insert would shift every existing row's data right.
  assert.equal(WORKFLOW_COLUMNS.at(-2), 'needs_review');
  assert.equal(WORKFLOW_COLUMNS.at(-1), 'pending_read');
  assert.deepEqual(BOOLEAN_COLUMNS, ['spotlight_request']);
});

test('blankRow has every sheet column, strings empty and flags false', () => {
  const row = blankRow();
  for (const col of SHEET_COLUMNS) assert.equal(row[col], BOOLEAN_COLUMNS.includes(col) ? false : '', col);
});

test('blankRow applies overrides', () => {
  const row = blankRow({ headline: 'Test', status: 'kept' });
  assert.equal(row.headline, 'Test');
  assert.equal(row.status, 'kept');
  assert.equal(row.blurb, '');
});

test('rowToValues writes booleans as TRUE or empty, in column order', () => {
  const values = rowToValues(blankRow({ headline: 'Test', spotlight_request: true }));
  assert.equal(values.length, 29);
  assert.equal(values[CSV_COLUMNS.indexOf('headline')], 'Test');
  assert.equal(values[SHEET_COLUMNS.indexOf('spotlight_request')], 'TRUE');
});

test('valuesToRow round-trips rowToValues', () => {
  const original = blankRow({ headline: 'Test', type: 'headline', spotlight_request: true });
  assert.deepEqual(valuesToRow(rowToValues(original)), original);
  assert.deepEqual(valuesToRow(rowToValues(blankRow())), blankRow());   // a false flag survives the trip too
});

test('valuesToRow pads short rows from the sheet', () => {
  const row = valuesToRow(['2026-08-12', 'Short row']);
  assert.equal(row.headline, 'Short row');
  assert.equal(row.blurb, '');
  assert.equal(row.spotlight_request, false);
});

test('the submission types carry the v2 subtype vocabulary', () => {
  assert.deepEqual(Object.keys(TYPES), ['opportunity', 'research', 'headline', 'event', 'erc_event']);
  assert.deepEqual(TYPES.event.subtypes, ['A&M', 'Off-Campus', 'Webinar-Online']);
  assert.deepEqual(TYPES.research.subtypes, ['Working Paper', 'Peer-Reviewed', 'Report', 'ERC Research']);
});

test('opportunity subtypes include Other', () => {
  assert.ok(subtypesFor('opportunity').includes('Other'));
});

test('every type/subtype pair maps to a newsletter section and group', () => {
  for (const [type, def] of Object.entries(TYPES)) {
    for (const subtype of def.subtypes) {
      const entry = NEWSLETTER_MAP[`${type}|${subtype}`];
      assert.ok(Array.isArray(entry) && entry.length === 2, `${type}|${subtype} unmapped`);
    }
  }
  assert.deepEqual(NEWSLETTER_MAP['event|A&M'], ['events', 'tamu']);
  assert.deepEqual(NEWSLETTER_MAP['event|Webinar-Online'], ['events', 'offcampus']);
  assert.deepEqual(NEWSLETTER_MAP['research|ERC Research'], ['research', 'brief']);
});

const PROTO_KEYS = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];

test('subtypesFor guards against Object.prototype keys and returns empty array', () => {
  for (const key of PROTO_KEYS) assert.deepEqual(subtypesFor(key), [], key);
});

test('isValidSubtype guards against Object.prototype keys and returns false', () => {
  for (const key of PROTO_KEYS) assert.equal(isValidSubtype(key, 'anything'), false, key);
});

test('TYPE_ORDER covers every schema type exactly once, and each one is labelled', () => {
  assert.deepEqual([...TYPE_ORDER].sort(), Object.keys(TYPES).sort());
  for (const type of TYPE_ORDER) assert.ok(TYPE_LABELS[type]);
  // Which type LEADS is asserted in the ERC Event test below.
});

test('ERC Event leads the display order and carries no subtypes', () => {
  assert.equal(TYPE_ORDER[0], 'erc_event');
  assert.equal(TYPE_LABELS.erc_event, 'ERC Event');
  assert.deepEqual(subtypesFor('erc_event'), []);
  assert.ok(isValidType('erc_event'));
});

test('a type with no subtypes accepts a blank subtype and nothing else', () => {
  assert.ok(isValidSubtype('erc_event', ''));
  assert.ok(!isValidSubtype('erc_event', 'A&M'));
  // Types that DO have subtypes still require one.
  assert.ok(!isValidSubtype('event', ''));
});

test('ERC Event maps into the newsletter\'s existing ERC Spotlight > Events group', () => {
  assert.deepEqual(NEWSLETTER_MAP['erc_event|'], ['spotlight', 'events']);
});

test('a flat type (ERC Event) has no subtype step: picking the type is the whole pick', () => {
  assert.equal(typeIsFlat('erc_event'), true);
  assert.equal(typeIsFlat('event'), false);
  assert.equal(typeIsFlat(''), false);
  assert.equal(typeIsFlat('banana'), false);
});

// ── In-app type names (audit round two, f7): sentence case on screen, the sheet keys untouched ──

test('typeDisplay gives the in-app name for every type, in sentence case, and leaves the sheet keys alone', () => {
  assert.deepEqual(TYPE_DISPLAY, {
    erc_event: 'ERC event', research: 'New research', event: 'Event', opportunity: 'Opportunity', headline: 'Headline',
  });
  for (const type of TYPE_ORDER) assert.equal(typeDisplay(type), TYPE_DISPLAY[type]);
  assert.equal(typeDisplay('banana'), 'banana');   // an unknown key shows as itself, never blank
  assert.equal(typeDisplay(''), '');
  assert.equal(TYPE_LABELS.research, 'New Ed Policy Research');   // what the sheet and the bulk parser know is unchanged
});

// Send to Newsletter folds the pool by type, so every type the desk knows needs
// a heading: an ERC event with no spotlight request used to land under "undefined".
test('every type has a newsletter section heading', () => {
  for (const type of TYPE_ORDER) assert.equal(typeof GROUP_LABELS[type], 'string', type);
});
