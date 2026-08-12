import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSV_COLUMNS, WORKFLOW_COLUMNS, SHEET_COLUMNS, STATUSES, TYPES, NEWSLETTER_MAP,
  blankRow, rowToValues, valuesToRow, subtypesFor, isHubEligible, isValidType, isValidSubtype,
} from '../js/schema.js';

test('the CSV columns match the hub news.csv header exactly, in order', () => {
  assert.deepEqual(CSV_COLUMNS, [
    'date', 'headline', 'link', 'type', 'subtype', 'source', 'topic', 'blurb',
    'deadline', 'medium', 'authors', 'time', 'location', 'infographic',
  ]);
});

test('the sheet is the CSV columns followed by the workflow columns', () => {
  assert.deepEqual(SHEET_COLUMNS, [...CSV_COLUMNS, ...WORKFLOW_COLUMNS]);
  assert.equal(SHEET_COLUMNS.length, 24);
});

test('blankRow has every sheet column, strings empty and flags false', () => {
  const row = blankRow();
  for (const col of SHEET_COLUMNS) assert.ok(col in row, `missing ${col}`);
  assert.equal(row.headline, '');
  assert.equal(row.newsletter, false);
  assert.equal(row.hub, false);
});

test('blankRow applies overrides', () => {
  const row = blankRow({ headline: 'Test', status: 'kept' });
  assert.equal(row.headline, 'Test');
  assert.equal(row.status, 'kept');
  assert.equal(row.blurb, '');
});

test('rowToValues writes booleans as TRUE or empty, in column order', () => {
  const values = rowToValues(blankRow({ headline: 'Test', newsletter: true, hub: false }));
  assert.equal(values.length, 24);
  assert.equal(values[CSV_COLUMNS.indexOf('headline')], 'Test');
  assert.equal(values[SHEET_COLUMNS.indexOf('newsletter')], 'TRUE');
  assert.equal(values[SHEET_COLUMNS.indexOf('hub')], '');
});

test('valuesToRow round-trips rowToValues', () => {
  const original = blankRow({ headline: 'Test', type: 'headline', newsletter: true });
  assert.deepEqual(valuesToRow(rowToValues(original)), original);
});

test('valuesToRow pads short rows from the sheet', () => {
  const row = valuesToRow(['2026-08-12', 'Short row']);
  assert.equal(row.headline, 'Short row');
  assert.equal(row.blurb, '');
  assert.equal(row.newsletter, false);
});

test('the type vocabulary matches the live hub data', () => {
  assert.deepEqual(subtypesFor('headline'), ['National', 'Texas']);
  assert.deepEqual(subtypesFor('opportunity'), ['Funding & Grants', 'Fellowships & Programs', 'Call for Proposals']);
  assert.deepEqual(subtypesFor('unknown'), []);
  assert.ok(isValidType('research'));
  assert.ok(!isValidType('Research'));
  assert.ok(isValidSubtype('research', 'Working Paper'));
  assert.ok(!isValidSubtype('research', 'Texas'));
});

test('newsletter-only types are not hub eligible', () => {
  assert.ok(isHubEligible('headline'));
  assert.ok(!isHubEligible('spotlight'));
  assert.ok(!isHubEligible('intro'));
});

test('statuses are the four workflow states', () => {
  assert.deepEqual(STATUSES, ['new', 'kept', 'processed', 'trashed']);
});

test('every type/subtype pair maps to a newsletter section and group', () => {
  for (const [type, def] of Object.entries(TYPES)) {
    for (const subtype of def.subtypes) {
      const key = `${type}|${subtype}`;
      assert.ok(NEWSLETTER_MAP[key], `no newsletter mapping for ${key}`);
    }
  }
  assert.deepEqual(NEWSLETTER_MAP['headline|Texas'], ['headlines', 'texas']);
  assert.deepEqual(NEWSLETTER_MAP['research|ERC Research'], ['research', 'brief']);
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

test('isHubEligible guards against Object.prototype keys and returns false', () => {
  assert.equal(isHubEligible('__proto__'), false);
  assert.equal(isHubEligible('constructor'), false);
  assert.equal(isHubEligible('toString'), false);
  assert.equal(isHubEligible('valueOf'), false);
  assert.equal(isHubEligible('hasOwnProperty'), false);
});
