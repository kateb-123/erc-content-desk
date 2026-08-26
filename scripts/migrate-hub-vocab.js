#!/usr/bin/env node
/**
 * One-time Exchange vocabulary migration: event subtype 'Online' becomes
 * 'Webinar-Online' so the hub matches the desk's v2 vocabulary. Run with:
 *   MIGRATE_CONFIRM=yes node --env-file=.env scripts/migrate-hub-vocab.js
 */
import { fetchHubCsv, putHubCsv, parseCsv } from '../api/_lib/hub.js';

const { text, sha } = await fetchHubCsv();
const rows = parseCsv(text);
const header = rows[0];
const typeIdx = header.indexOf('type');
const subIdx = header.indexOf('subtype');
const hits = rows.slice(1).filter(r => r[typeIdx] === 'event' && r[subIdx] === 'Online').length;
console.log(`${hits} event/Online rows to rename.`);
if (!hits) process.exit(0);
if (process.env.MIGRATE_CONFIRM !== 'yes') {
  console.log('Dry run only. Re-run with MIGRATE_CONFIRM=yes to commit.');
  process.exit(0);
}
// Positional, quote-safe replacement: only the bare cell sequence event,Online
const updated = text.replaceAll(',event,Online,', ',event,Webinar-Online,');
await putHubCsv(updated, sha, "Vocabulary: event subtype 'Online' -> 'Webinar-Online' (Content Desk v2)");
console.log('Committed. GitHub Pages will redeploy in about a minute.');
