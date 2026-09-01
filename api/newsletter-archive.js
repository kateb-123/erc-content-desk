/**
 * POST /api/newsletter-archive — the builder's Save: commit a finished
 * issue's HTML into the builder repo's newsletters/ folder and refresh the
 * archive index. Re-saving the same issue overwrites it (that's normal —
 * the last save before sending wins).
 */
import { setCors } from './_lib/cors.js';
import { readRepoFile, putRepoFile, mergeArchiveIndex, archiveLabel } from './_lib/archive.js';

export const config = { maxDuration: 60 };

const MAX_HTML_BYTES = 2 * 1024 * 1024;

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  const issueDate = String(req.body?.issueDate ?? '');
  const html = String(req.body?.html ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
    return res.status(400).json({ ok: false, error: 'Pass issueDate as YYYY-MM-DD.' });
  }
  if (!html.trim()) {
    return res.status(400).json({ ok: false, error: 'Nothing to save — the issue came through empty.' });
  }
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    return res.status(400).json({ ok: false, error: 'That issue is too big to archive.' });
  }
  try {
    const file = `builder/newsletters/${issueDate}.html`;
    const indexFile = 'builder/newsletters/index.json';
    // The two reads are independent; only the writes must stay ordered.
    const [existing, index] = await Promise.all([readRepoFile(file), readRepoFile(indexFile)]);
    await putRepoFile(file, html, existing.sha,
      `Archive newsletter: ${archiveLabel(issueDate)}`);
    let list = [];
    try { list = JSON.parse(index.text ?? '[]'); } catch { list = []; }
    const merged = mergeArchiveIndex(list, issueDate);
    await putRepoFile(indexFile, JSON.stringify(merged, null, 2) + '\n', index.sha,
      `Archive index: ${archiveLabel(issueDate)}`);
    return res.status(200).json({ ok: true, file, replaced: Boolean(existing.sha) });
  } catch (err) {
    console.error('newsletter-archive failed', err);
    return res.status(502).json({ ok: false, error: "Couldn't save to the archive. Try again in a moment." });
  }
}
