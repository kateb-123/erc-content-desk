import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSV_COLUMNS, WORKFLOW_COLUMNS, SHEET_COLUMNS, BOOLEAN_COLUMNS, STATUSES, TYPES, NEWSLETTER_MAP,
  TYPE_ORDER, TYPE_LABELS,
  blankRow, rowToValues, valuesToRow, subtypesFor, isValidType, isValidSubtype,
} from '../js/schema.js';

test('the CSV columns match the hub news.csv header exactly, in order', () => {
  assert.deepEqual(CSV_COLUMNS, [
    'date', 'headline', 'link', 'type', 'subtype', 'source', 'topic', 'blurb',
    'deadline', 'medium', 'authors', 'time', 'location', 'infographic',
  ]);
});

test('sheet columns are the 14 hub columns plus the 9 v2 workflow columns', () => {
  assert.deepEqual(WORKFLOW_COLUMNS, [
    'id', 'status', 'submitter', 'submitted_at', 'spotlight_request',
    'note', 'original_text', 'published_at', 'newsletter_issue',
  ]);
  assert.equal(SHEET_COLUMNS.length, 23);
  assert.deepEqual(BOOLEAN_COLUMNS, ['spotlight_request']);
});

test('blankRow has every sheet column, strings empty and flags false', () => {
  const row = blankRow();
  for (const col of SHEET_COLUMNS) assert.ok(col in row, `missing ${col}`);
  assert.equal(row.headline, '');
  assert.equal(row.spotlight_request, false);
});

test('blankRow applies overrides', () => {
  const row = blankRow({ headline: 'Test', status: 'kept' });
  assert.equal(row.headline, 'Test');
  assert.equal(row.status, 'kept');
  assert.equal(row.blurb, '');
});

test('rowToValues writes booleans as TRUE or empty, in column order', () => {
  const values = rowToValues(blankRow({ headline: 'Test', spotlight_request: true }));
  assert.equal(values.length, 23);
  assert.equal(values[CSV_COLUMNS.indexOf('headline')], 'Test');
  assert.equal(values[SHEET_COLUMNS.indexOf('spotlight_request')], 'TRUE');
});

test('valuesToRow round-trips rowToValues', () => {
  const original = blankRow({ headline: 'Test', type: 'headline', spotlight_request: true });
  assert.deepEqual(valuesToRow(rowToValues(original)), original);
});

test('valuesToRow pads short rows from the sheet', () => {
  const row = valuesToRow(['2026-08-12', 'Short row']);
  assert.equal(row.headline, 'Short row');
  assert.equal(row.blurb, '');
  assert.equal(row.spotlight_request, false);
});

test('statuses are the v2 set — processed is gone', () => {
  assert.deepEqual(STATUSES, ['new', 'kept', 'circleback', 'trashed']);
});

test('the four submission types carry the v2 subtype vocabulary', () => {
  assert.deepEqual(Object.keys(TYPES), ['opportunity', 'research', 'headline', 'event']);
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

test('spotlight_request round-trips as a boolean', () => {
  const row = blankRow({ spotlight_request: true });
  const back = valuesToRow(rowToValues(row));
  assert.equal(back.spotlight_request, true);
  assert.equal(valuesToRow(rowToValues(blankRow())).spotlight_request, false);
});

test('subtypesFor guards against Object.prototype keys and returns empty array', () => {
  assert.deepEqual(subtypesFor('__proto__'), []);
  assert.deepEqual(subtypesFor('constructor'), []);
  assert.deepEqual(subtypesFor('toString'), []);
  assert.deepEqual(subtypesFor('valueOf'), []);
  assert.deepEqual(subtypesFor('hasOwnProperty'), []);
});

test('isValidSubtype guards against Object.prototype keys and returns false', () => {
  assert.equal(isValidSubtype('constructor', 'anything'), false);
  assert.equal(isValidSubtype('__proto__', 'anything'), false);
  assert.equal(isValidSubtype('toString', 'anything'), false);
  assert.equal(isValidSubtype('valueOf', 'anything'), false);
  assert.equal(isValidSubtype('hasOwnProperty', 'anything'), false);
});

test('TYPE_ORDER covers every schema type exactly once, research first', () => {
  assert.deepEqual([...TYPE_ORDER].sort(), Object.keys(TYPES).sort());
  assert.equal(TYPE_ORDER[0], 'research');
  for (const type of TYPE_ORDER) assert.ok(TYPE_LABELS[type]);
});
