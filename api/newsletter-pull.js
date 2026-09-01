/**
 * GET /api/newsletter-pull?issue=YYYY-MM-DD — the newsletter builder's door.
 * Read-only: serves everything stamped for that issue, already in the
 * builder's own shape (rows-to-issue.js does the mapping), plus a staged
 * summary so the builder's mismatch message can point at the right date.
 * CORS admits the builder's origins only.
 */
import { readAllRows, readScheduleRows } from './_lib/sheets.js';
import { normalizeSchedule } from '../js/schedule.js';
import { issueForPull, stagedCounts } from '../js/rows-to-issue.js';

// GitHub Pages today; the Vercel address joins this list when the builder moves.
const ALLOWED_ORIGINS = new Set(['https://kateb-123.github.io']);

function setCors(req, res) {
  const origin = String(req.headers?.origin ?? '');
  if (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Use GET.' });
  }
  // ?issue is optional: without it the response carries only the schedule and
  // staged counts — what the builder's issue dropdown is built from.
  const issue = String(req.query?.issue ?? '');
  if (issue && !/^\d{4}-\d{2}-\d{2}$/.test(issue)) {
    return res.status(400).json({ ok: false, error: 'Pass ?issue=YYYY-MM-DD.' });
  }
  try {
    const rows = await readAllRows();
    let schedule = [];
    try {
      schedule = normalizeSchedule(await readScheduleRows());
    } catch (err) {
      console.error('schedule read failed (tab missing?)', err);
    }
    return res.status(200).json({
      ok: true,
      ...(issue ? { issue: issueForPull(rows, issue) } : {}),
      staged: stagedCounts(rows),
      schedule,
    });
  } catch (err) {
    console.error('newsletter-pull failed', err);
    return res.status(502).json({ ok: false, error: "Couldn't reach the sheet." });
  }
}
