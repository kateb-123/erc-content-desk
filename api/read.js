/**
 * POST /api/read {ids} — Sort's catch-up. Reads the asked-for rows still
 * waiting for the reader (status new, pending_read 'yes'), a batch per call,
 * and saves each. The background reading after submit is best-effort
 * (waitUntil has no retries); this is what makes sure no card is shown unread
 * (Kate, Sep 10).
 */
import Anthropic from '@anthropic-ai/sdk';
import { fetchPageText } from './_lib/fetch-page.js';
import { readRow, extractWithClaude } from './_lib/reader.js';
import { crossrefText } from './_lib/crossref.js';
import { readAllRows, updateRow } from './_lib/store.js';
import { runPool } from '../js/pool.js';

export const config = { maxDuration: 60 };

/** Rows read per call, so one call fits well inside maxDuration. */
export const READ_BATCH = 8;
const CONCURRENCY = 4;

/** Built over its dependencies so the tests can hand in fakes. */
export function createReadHandler(deps) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ ok: false, error: 'Send an ids array.' });
    try {
      const wanted = new Set(ids);
      const waiting = (await deps.readAllRows())
        .filter(r => wanted.has(r.id) && r.status === 'new' && r.pending_read === 'yes');
      const batch = waiting.slice(0, READ_BATCH);
      const results = await runPool(batch, CONCURRENCY, row => deps.readRow(row));
      // A row deleted from Home's queue while it was being read is never brought back.
      const fresh = new Map((await deps.readAllRows()).map(r => [r.id, r]));
      let read = 0, failed = 0;
      for (const [i, result] of results.entries()) {
        const row = batch[i];
        if (!result.ok) {
          failed += 1;
          console.error('reader failed; the row stays pending', row.id, result.error);
          continue;
        }
        const now = fresh.get(row.id);
        if (!now || now.status !== 'new' || now.pending_read !== 'yes') continue;
        await deps.updateRow(result.value);
        read += 1;
      }
      return res.status(200).json({ ok: true, read, failed, left: waiting.length - batch.length });
    } catch (err) {
      console.error('read endpoint failed', err);
      return res.status(502).json({ ok: false, error: "Couldn't read the new items. Try again in a moment." });
    }
  };
}

const anthropic = new Anthropic({ timeout: 20_000, maxRetries: 1 });
const extract = extractWithClaude(anthropic);

export default createReadHandler({
  readAllRows,
  updateRow,
  readRow: row => readRow(row, { fetchPage: fetchPageText, extract, lookupDoi: crossrefText }),
});
