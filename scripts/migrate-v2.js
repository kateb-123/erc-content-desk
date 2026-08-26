#!/usr/bin/env node
/**
 * One-time v1 -> v2 Sheet migration. Run with:
 *   MIGRATE_CONFIRM=yes node --env-file=.env scripts/migrate-v2.js
 * Without MIGRATE_CONFIRM=yes it prints the plan and writes nothing.
 *
 * v1 layout (24 cols): 14 CSV + id, status, submitter, submitted_at, note,
 *   original_text, newsletter, hub, newsletter_used_at, hub_used_at
 * v2 layout (23 cols): 14 CSV + id, status, submitter, submitted_at,
 *   spotlight_request, note, original_text, published_at, newsletter_issue
 * Mapping: processed -> kept; published_at = hub_used_at;
 *   newsletter_issue = newsletter_used_at date part; spotlight_request = ''.
 * The old 24th column is blanked so no stale hub_used_at value lingers.
 */
const url = process.env.SHEET_API_URL;
const token = process.env.SHEET_API_TOKEN;
if (!url || !token) {
  console.error('Set SHEET_API_URL and SHEET_API_TOKEN (use --env-file=.env).');
  process.exit(1);
}

async function call(action, payload = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action, ...payload }),
  });
  const body = await res.json();
  if (body.ok !== true) throw new Error(body.error || 'sheet API error');
  return body;
}

const NEW_HEADER = [
  'date', 'headline', 'link', 'type', 'subtype', 'source', 'topic', 'blurb',
  'deadline', 'medium', 'authors', 'time', 'location', 'infographic',
  'id', 'status', 'submitter', 'submitted_at', 'spotlight_request',
  'note', 'original_text', 'published_at', 'newsletter_issue', '',
];

function migrateRow(values) {
  const v = i => String(values[i] ?? '');
  const csv = values.slice(0, 14).map(x => String(x ?? ''));
  const oldStatus = v(15);
  const status = oldStatus === 'processed' ? 'kept' : oldStatus;
  return [
    ...csv,
    v(14),                       // id
    status,
    v(16),                       // submitter
    v(17),                       // submitted_at
    '',                          // spotlight_request
    v(18),                       // note
    v(19),                       // original_text
    v(23),                       // published_at  <- hub_used_at
    v(22).slice(0, 10),          // newsletter_issue <- newsletter_used_at date
    '',                          // blank the old 24th column
  ];
}

const { rows } = await call('read');
console.log(`Read ${rows.length} data rows.`);
const migrated = rows.map(r => ({ rowNumber: r.rowNumber, values: migrateRow(r.values) }));
if (migrated[0]) {
  console.log('First row becomes:');
  console.log(NEW_HEADER.map((h, i) => `  ${h || '(blank)'}: ${migrated[0].values[i]}`).join('\n'));
}
if (process.env.MIGRATE_CONFIRM !== 'yes') {
  console.log('\nDry run only. Re-run with MIGRATE_CONFIRM=yes to write.');
  process.exit(0);
}
await call('header', { values: NEW_HEADER });
for (const row of migrated) {
  await call('update', { rowNumber: row.rowNumber, values: row.values });
}
console.log(`Migrated header + ${migrated.length} rows. Old statuses 'processed' are now 'kept'.`);
