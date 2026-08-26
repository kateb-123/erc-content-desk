/**
 * GET  /api/publish — preview: what would be added vs skipped, against the
 *                     LIVE news.csv (the overwrite worry dies here).
 * POST /api/publish — append the new rows, commit, stamp published_at.
 * Never modifies or deletes an existing hub row.
 */
import { readAllRows, updateRow } from './_lib/sheets.js';
import { readyToPublish, markPublished } from '../js/workflow.js';
import { fetchHubCsv, putHubCsv, diffAgainstHub, appendRowsToCsv, parseCsv } from './_lib/hub.js';

export const config = { maxDuration: 300 };

const label = r => ({ id: r.id, headline: r.headline || r.link || r.id });

export default async function handler(req, res) {
  try {
    const all = await readAllRows();
    const candidates = readyToPublish(all);

    if (req.method === 'GET') {
      const { text } = await fetchHubCsv();
      const { newRows, skipped } = diffAgainstHub(text, candidates);
      return res.status(200).json({
        ok: true,
        adding: newRows.map(label),
        skipped: skipped.map(label),
        hubCount: Math.max(parseCsv(text).length - 1, 0),
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Use GET or POST.' });
    }
    if (!candidates.length) {
      return res.status(200).json({ ok: true, published: 0, skipped: 0 });
    }

    let published = [], skipped = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { text, sha } = await fetchHubCsv();
      const diff = diffAgainstHub(text, candidates);
      published = diff.newRows;
      skipped = diff.skipped;
      if (!published.length) break;
      try {
        await putHubCsv(
          appendRowsToCsv(text, published), sha,
          `Publish from Content Desk: ${published.length} item(s)`,
        );
        break;
      } catch (err) {
        if (!err.conflict || attempt === 1) throw err;
      }
    }

    // Stamp published_at — dupes too: they are already on the hub.
    const now = new Date().toISOString();
    const rowNumberById = new Map(all.map(r => [r.id, r._rowNumber]));
    for (const row of [...published, ...skipped]) {
      const liveRowNumber = rowNumberById.get(row.id);
      if (!liveRowNumber) continue;
      await updateRow(markPublished({ ...row, _rowNumber: liveRowNumber }, now));
    }
    return res.status(200).json({ ok: true, published: published.length, skipped: skipped.length });
  } catch (err) {
    console.error('publish failed', err);
    const message = /GITHUB_TOKEN|GitHub/.test(err.message)
      ? "Couldn't reach the Exchange on GitHub. Check the GITHUB_TOKEN setup."
      : "Couldn't reach the sheet.";
    return res.status(502).json({ ok: false, error: message });
  }
}
