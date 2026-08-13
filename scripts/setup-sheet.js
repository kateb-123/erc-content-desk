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
  const required = ['SHEET_API_URL', 'SHEET_API_TOKEN'];
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

    // Check if it looks like an access/deployment error
    if (
      message.includes('Unauthorized') ||
      message.includes("wasn't JSON") ||
      message.includes('HTTP')
    ) {
      console.error();
      console.error('This looks like a deployment or token problem. Check that SHEET_API_URL points at the');
      console.error("Apps Script web app's deployed URL, and that SHEET_API_TOKEN matches the SHEET_API_TOKEN");
      console.error('script property set in the Apps Script project. See README.md for setup steps.');
    }

    process.exit(1);
  }
}

main();
