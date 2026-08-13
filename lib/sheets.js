/**
 * Google Sheets access. Server-side only — this module reads a shared secret
 * from the environment and must never be imported by browser code.
 *
 * Talks to a Google Apps Script web app bound to the Sheet (see
 * apps-script/Code.gs) instead of the Google Sheets REST API, because the
 * owner's Google account has Google Cloud disabled and can't create a
 * service account. Apps Script runs under the owner's own identity inside
 * the Sheet, so no service account is needed.
 *
 * Row 1 of the sheet is a header written once at setup; data starts at row 2.
 * Column order is SHEET_COLUMNS and is never read from the header, so renaming a
 * header cell in Google Sheets does not silently shift the data.
 */

import { SHEET_COLUMNS, rowToValues, valuesToRow } from '../js/schema.js';

function sheetApiUrl() {
  const url = process.env.SHEET_API_URL;
  if (!url) throw new Error('SHEET_API_URL must be set');
  return url;
}

function sheetApiToken() {
  const token = process.env.SHEET_API_TOKEN;
  if (!token) throw new Error('SHEET_API_TOKEN must be set');
  return token;
}

export function headerValues() {
  return SHEET_COLUMNS.slice();
}

/**
 * Posts one action to the Apps Script web app and returns its parsed JSON
 * body. Throws a readable, non-secret error for every way this can fail:
 * a network error, a non-200 response, an HTML response (a misconfigured
 * deployment's most common symptom), or the endpoint's own JSON error.
 */
async function callSheetApi(action, payload) {
  const url = sheetApiUrl();
  const token = sheetApiToken();

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, ...payload }),
    });
  } catch (err) {
    throw new Error(`Couldn't reach the sheet API: ${err.message}`);
  }

  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `Sheet API returned HTTP ${res.status}. Check that SHEET_API_URL points at the deployed web app's URL.`,
    );
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      "Sheet API returned something that wasn't JSON (likely an HTML page). This usually means the Apps "
      + 'Script deployment\'s "Who has access" setting isn\'t "Anyone" — check Deploy > Manage deployments '
      + 'in the Apps Script editor.',
    );
  }

  if (!body || body.ok !== true) {
    const message = (body && body.error) || 'Sheet API returned an error with no message.';
    throw new Error(`Sheet API error: ${message}`);
  }

  return body;
}

export async function readAllRows() {
  const body = await callSheetApi('read', {});
  const rows = body.rows || [];
  return rows.map(r => ({ ...valuesToRow(r.values), _rowNumber: r.rowNumber }));
}

export async function appendRow(row) {
  await callSheetApi('append', { values: rowToValues(row) });
}

export async function updateRow(row) {
  if (!row._rowNumber) throw new Error('updateRow needs a row read from the sheet (missing _rowNumber)');
  await callSheetApi('update', { rowNumber: row._rowNumber, values: rowToValues(row) });
}

export async function writeHeader() {
  await callSheetApi('header', { values: headerValues() });
}
