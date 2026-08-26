import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readAllRows, appendRow, updateRow, writeHeader, headerValues, readScheduleRows } from '../api/_lib/sheets.js';
import { SHEET_COLUMNS, blankRow } from '../js/schema.js';

/**
 * These tests never touch the network. Every test that reaches callSheetApi
 * installs a fake global.fetch and restores it afterward, and env vars are
 * reset around every test so state can't leak between them.
 */

const ORIGINAL_ENV = { SHEET_API_URL: process.env.SHEET_API_URL, SHEET_API_TOKEN: process.env.SHEET_API_TOKEN };
const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  process.env.SHEET_API_URL = 'https://script.google.com/macros/s/fake/exec';
  process.env.SHEET_API_TOKEN = 'test-token';
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function fakeFetch({ status = 200, ok = status >= 200 && status < 300, text }) {
  let capturedUrl;
  let capturedOptions;
  const fn = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok, status, text: async () => text };
  };
  fn.calls = () => ({ url: capturedUrl, options: capturedOptions });
  return fn;
}

test('headerValues is the column list, for writing row 1 at setup', () => {
  assert.deepEqual(headerValues(), SHEET_COLUMNS);
});

test('readAllRows fails closed with a clear error when SHEET_API_URL is unset', async () => {
  delete process.env.SHEET_API_URL;
  global.fetch = fakeFetch({ text: '{}' }); // should never be called
  await assert.rejects(readAllRows(), /SHEET_API_URL must be set/);
});

test('readAllRows fails closed with a clear error when SHEET_API_TOKEN is unset', async () => {
  delete process.env.SHEET_API_TOKEN;
  global.fetch = fakeFetch({ text: '{}' }); // should never be called
  await assert.rejects(readAllRows(), /SHEET_API_TOKEN must be set/);
});

test('appendRow posts the token, action, and row values as JSON', async () => {
  const fetchSpy = fakeFetch({ text: JSON.stringify({ ok: true }) });
  global.fetch = fetchSpy;

  const row = blankRow({ id: 'abc', headline: 'Test headline' });
  await appendRow(row);

  const { url, options } = fetchSpy.calls();
  assert.equal(url, 'https://script.google.com/macros/s/fake/exec');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(options.body);
  assert.equal(body.token, 'test-token');
  assert.equal(body.action, 'append');
  assert.deepEqual(body.values, SHEET_COLUMNS.map(col => (col === 'id' ? 'abc' : (col === 'headline' ? 'Test headline' : ''))));
});

test('updateRow posts the row number and throws without _rowNumber', async () => {
  const fetchSpy = fakeFetch({ text: JSON.stringify({ ok: true }) });
  global.fetch = fetchSpy;

  const row = { ...blankRow({ id: 'abc' }), _rowNumber: 5 };
  await updateRow(row);

  const { options } = fetchSpy.calls();
  const body = JSON.parse(options.body);
  assert.equal(body.action, 'update');
  assert.equal(body.rowNumber, 5);

  await assert.rejects(updateRow(blankRow({ id: 'no-row-number' })), /missing _rowNumber/);
});

test('writeHeader posts the header action with SHEET_COLUMNS as values', async () => {
  const fetchSpy = fakeFetch({ text: JSON.stringify({ ok: true }) });
  global.fetch = fetchSpy;

  await writeHeader();

  const { options } = fetchSpy.calls();
  const body = JSON.parse(options.body);
  assert.equal(body.action, 'header');
  assert.deepEqual(body.values, SHEET_COLUMNS);
});

test('readAllRows maps returned arrays back through valuesToRow and attaches _rowNumber', async () => {
  const values = SHEET_COLUMNS.map(col => (col === 'id' ? 'row-2-id' : ''));
  const otherValues = SHEET_COLUMNS.map(col => (col === 'id' ? 'row-3-id' : ''));
  global.fetch = fakeFetch({
    text: JSON.stringify({
      ok: true,
      rows: [
        { rowNumber: 2, values },
        { rowNumber: 3, values: otherValues },
      ],
    }),
  });

  const rows = await readAllRows();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'row-2-id');
  assert.equal(rows[0]._rowNumber, 2);
  assert.equal(rows[1].id, 'row-3-id');
  assert.equal(rows[1]._rowNumber, 3);
});

test('readAllRows returns an empty array when the sheet has no data rows', async () => {
  global.fetch = fakeFetch({ text: JSON.stringify({ ok: true, rows: [] }) });
  assert.deepEqual(await readAllRows(), []);
});

test('a non-200 response raises a readable error naming the status code', async () => {
  global.fetch = fakeFetch({ status: 500, text: 'Internal Server Error' });
  await assert.rejects(readAllRows(), /HTTP 500/);
});

test('an HTML body (misconfigured deployment) raises a readable error, not a JSON parse crash', async () => {
  global.fetch = fakeFetch({ text: '<!DOCTYPE html><html><body>Sign in to continue</body></html>' });
  await assert.rejects(readAllRows(), /wasn't JSON|isn't JSON|HTML/i);
});

test('an error object from the endpoint surfaces its message', async () => {
  global.fetch = fakeFetch({ text: JSON.stringify({ ok: false, error: 'Unauthorized: missing or incorrect token.' }) });
  await assert.rejects(readAllRows(), /Unauthorized: missing or incorrect token\./);
});

test('error messages never include the token', async () => {
  global.fetch = fakeFetch({ status: 500, text: 'Internal Server Error' });
  try {
    await readAllRows();
    assert.fail('expected readAllRows to reject');
  } catch (err) {
    assert.ok(!err.message.includes('test-token'));
  }
});

test('readScheduleRows reads the schedule tab by name', async () => {
  const fetchFake = fakeFetch({ status: 200, ok: true, text: JSON.stringify({ ok: true, rows: [{ rowNumber: 2, values: ['2026-09-01'] }] }) });
  global.fetch = fetchFake;
  const rows = await readScheduleRows();
  assert.deepEqual(rows, [['2026-09-01']]);
  const body = JSON.parse(fetchFake.calls().options.body);
  assert.equal(body.action, 'read');
  assert.equal(body.sheetName, 'schedule');
});
