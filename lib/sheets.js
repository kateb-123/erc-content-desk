/**
 * Google Sheets access. Server-side only — this module reads service-account
 * credentials from the environment and must never be imported by browser code.
 *
 * Row 1 of the sheet is a header written once at setup; data starts at row 2.
 * Column order is SHEET_COLUMNS and is never read from the header, so renaming a
 * header cell in Google Sheets does not silently shift the data.
 */

import { JWT } from 'google-auth-library';
import { SHEET_COLUMNS, rowToValues, valuesToRow } from '../js/schema.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cachedClient = null;

function client() {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set');
  }
  // Vercel env vars store the PEM with literal \n sequences.
  cachedClient = new JWT({ email, key: rawKey.replace(/\\n/g, '\n'), scopes: SCOPES });
  return cachedClient;
}

function sheetId() {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error('SHEET_ID must be set');
  return id;
}

function sheetName() {
  return process.env.SHEET_NAME || 'Items';
}

export function columnLetter(n) {
  let out = '';
  let remaining = n;
  while (remaining > 0) {
    const rem = (remaining - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return out;
}

export function fullRange(name) {
  return `${name}!A1:${columnLetter(SHEET_COLUMNS.length)}`;
}

export function rowRange(name, rowNumber) {
  const last = columnLetter(SHEET_COLUMNS.length);
  return `${name}!A${rowNumber}:${last}${rowNumber}`;
}

export function rowNumberForIndex(index) {
  return index + 2;
}

export function headerValues() {
  return SHEET_COLUMNS.slice();
}

export async function readAllRows() {
  const range = encodeURIComponent(fullRange(sheetName()));
  const res = await client().request({ url: `${API}/${sheetId()}/values/${range}` });
  const values = res.data.values || [];
  return values.slice(1).map((v, i) => ({ ...valuesToRow(v), _rowNumber: rowNumberForIndex(i) }));
}

export async function appendRow(row) {
  const range = encodeURIComponent(fullRange(sheetName()));
  await client().request({
    url: `${API}/${sheetId()}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    method: 'POST',
    data: { values: [rowToValues(row)] },
  });
}

export async function updateRow(row) {
  if (!row._rowNumber) throw new Error('updateRow needs a row read from the sheet (missing _rowNumber)');
  const range = encodeURIComponent(rowRange(sheetName(), row._rowNumber));
  await client().request({
    url: `${API}/${sheetId()}/values/${range}?valueInputOption=RAW`,
    method: 'PUT',
    data: { values: [rowToValues(row)] },
  });
}

export async function writeHeader() {
  const range = encodeURIComponent(rowRange(sheetName(), 1));
  await client().request({
    url: `${API}/${sheetId()}/values/${range}?valueInputOption=RAW`,
    method: 'PUT',
    data: { values: [headerValues()] },
  });
}
