#!/usr/bin/env node
/**
 * One-shot setup: write the header row to the Google Sheet.
 *
 * Checks that required environment variables are set, calls writeHeader(),
 * and reports success or a helpful error.
 */

import { writeHeader, headerValues } from '../lib/sheets.js';

async function main() {
  // Check environment variables
  const required = ['SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
  const missing = required.filter(name => !process.env[name]);

  if (missing.length > 0) {
    console.error(`Missing environment variable${missing.length === 1 ? '' : 's'}:`);
    missing.forEach(name => console.error(`  ${name}`));
    process.exit(1);
  }

  try {
    await writeHeader();
    const columnCount = headerValues().length;
    console.log(`Header row written: ${columnCount} columns.`);
    console.log('Safe to run again — writing the header is idempotent.');
  } catch (err) {
    const message = err.message || String(err);
    console.error('Error writing header:', message);

    // Check if it looks like a permissions error
    if (
      message.includes('403') ||
      message.includes('Forbidden') ||
      message.includes('permission') ||
      message.includes('cannot edit')
    ) {
      console.error();
      console.error('This looks like a permissions error. Make sure the Google Sheet is shared');
      console.error('with the service account as an Editor:');
      console.error(`  ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
    }

    process.exit(1);
  }
}

main();
