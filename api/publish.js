/**
 * GET  /api/publish — preview: what would be added vs skipped, against the
 *                     LIVE news.csv (the overwrite worry dies here).
 * POST /api/publish — append the new rows, commit, stamp published_at.
 * Never modifies or deletes an existing hub row.
 */
import { readAllRows, updateRow } from './_lib/sheets.js';
import { readyToPublish, markPublished, newsletterOnly } from '../js/workflow.js';
import { isValidType, isValidSubtype } from '../js/schema.js';
import { isSafeLink } from '../js/links.js';
import { fetchHubCsv, putHubCsv, diffAgainstHub, appendRowsToCsv, parseCsv } from './_lib/hub.js';
import { PUBLISH_PAUSED } from '../js/flags.js';

export const config = { maxDuration: 300 };

const label = r => ({ id: r.id, headline: r.headline || r.link || r.id });

export default async function handler(req, res) {
  try {
    // Team trial: the Exchange door is closed. The GET preview stays open so
    // the desk can still show what would publish; only the write is refused.
    if (req.method === 'POST' && PUBLISH_PAUSED) {
      return res.status(200).json({
        ok: false,
        error: 'Publishing is paused for the team trial. Nothing was sent to the Exchange.',
      });
    }
    const all = await readAllRows();
    const candidates = readyToPublish(all);

    // Split candidates into publishable (valid type/subtype and a safe link) and notReady.
    const eligible = candidates.filter(r =>
      isValidType(r.type) && isValidSubtype(r.type, r.subtype) && isSafeLink(r.link));
    const held = eligible.filter(newsletterOnly);
    const publishable = eligible.filter(r => !newsletterOnly(r));
    const notReady = candidates.filter(r => !eligible.includes(r));

    if (req.method === 'GET') {
      const { text } = await fetchHubCsv();
      const { newRows, skipped } = diffAgainstHub(text, publishable);
      return res.status(200).json({
        ok: true,
        adding: newRows.map(label),
        skipped: skipped.map(label),
        notReady: notReady.map(label),
        newsletterOnly: held.map(label),
        hubCount: Math.max(parseCsv(text).length - 1, 0),
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Use GET or POST.' });
    }
    if (!publishable.length) {
      return res.status(200).json({ ok: true, published: 0, skipped: 0 });
    }

    let published = [], skipped = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { text, sha } = await fetchHubCsv();
      const diff = diffAgainstHub(text, publishable);
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

    // Stamp published_at — dupes too: they are already on the hub. The
    // GitHub commit above already succeeded, so a stamping failure here must
    // not report total failure — the rows are live either way.
    const now = new Date().toISOString();
    const rowNumberById = new Map(all.map(r => [r.id, r._rowNumber]));
    try {
      for (const row of [...published, ...skipped]) {
        const liveRowNumber = rowNumberById.get(row.id);
        if (!liveRowNumber) continue;
        await updateRow(markPublished({ ...row, _rowNumber: liveRowNumber }, now));
      }
    } catch (err) {
      console.error('publish stamping failed', err);
      return res.status(200).json({
        ok: true, published: published.length, skipped: skipped.length,
        warning: 'Published, but the bookkeeping stamps failed for some rows — publish again to finish stamping (already-published rows are skipped safely).',
      });
    }
    return res.status(200).json({ ok: true, published: published.length, skipped: skipped.length });
  } catch (err) {
    console.error('publish failed', err);
    if (err.conflict) {
      return res.status(502).json({ ok: false, error: 'The Exchange changed while this publish was running — run the check again and publish once more.' });
    }
    const message = /GITHUB_TOKEN|GitHub/.test(err.message)
      ? "Couldn't reach the Exchange on GitHub. Check the GITHUB_TOKEN setup."
      : "Couldn't reach the sheet.";
    return res.status(502).json({ ok: false, error: message });
  }
}
