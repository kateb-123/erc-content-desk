#!/usr/bin/env node
/**
 * One-shot setup: write the header row to the Google Sheet. Every other
 * failure (a bad URL, a bad token, an HTML reply) already arrives from
 * sheets.js with its own explanation.
 */

import { writeHeader } from '../api/_lib/sheets.js';
import { SHEET_COLUMNS } from '../js/schema.js';

const missing = ['SHEET_API_URL', 'SHEET_API_TOKEN'].filter(name => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing environment variable${missing.length === 1 ? '' : 's'}:`);
  missing.forEach(name => console.error(`  ${name}`));
  process.exit(1);
}

try {
  await writeHeader();
  console.log(`Header row written: ${SHEET_COLUMNS.length} columns.`);
  console.log('Safe to run again — writing the header is idempotent.');
} catch (err) {
  console.error('Error writing header:', err.message || String(err));
  console.error('See README.md for setup steps.');
  process.exit(1);
}
