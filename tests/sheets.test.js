import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnLetter, fullRange, rowRange, rowNumberForIndex, headerValues } from '../lib/sheets.js';
import { SHEET_COLUMNS } from '../js/schema.js';

test('columnLetter converts 1-based indexes to A1 letters', () => {
  assert.equal(columnLetter(1), 'A');
  assert.equal(columnLetter(24), 'X');
  assert.equal(columnLetter(26), 'Z');
  assert.equal(columnLetter(27), 'AA');
  assert.equal(columnLetter(52), 'AZ');
});

test('fullRange spans every sheet column with no bottom bound', () => {
  assert.equal(fullRange('Items'), 'Items!A1:X');
});

test('rowRange targets one row across every column', () => {
  assert.equal(rowRange('Items', 7), 'Items!A7:X7');
});

test('row 1 is the header, so data index 0 is sheet row 2', () => {
  assert.equal(rowNumberForIndex(0), 2);
  assert.equal(rowNumberForIndex(5), 7);
});

test('headerValues is the column list, for writing row 1 at setup', () => {
  assert.deepEqual(headerValues(), SHEET_COLUMNS);
});
