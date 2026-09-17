/**
 * GET  /api/sheet   -> every row, in the store's own order
 * PATCH /api/sheet  -> save changed rows in place (matched by id)
 *
 * The browser sends whole rows back. Writes are per-row and already-written rows
 * are not rolled back, so a failure partway through leaves the store partially updated.
 * Since Sep 10 the store is Postgres with the Sheet mirrored behind it (api/_lib/store.js).
 */

import { readAllRows, readSchedule, updateRows } from './_lib/store.js';

const MAX_ROWS_PER_PATCH = 200;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Side by side: the schedule read can be the slow one.
      const [rows, schedule] = await Promise.all([readAllRows(), readSchedule()]);
      return res.status(200).json({ ok: true, rows, schedule });
    }

    if (req.method === 'PATCH') {
      const rows = req.body?.rows ?? [];
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'Send a rows array.' });
      }
      if (rows.length > MAX_ROWS_PER_PATCH) {
        return res.status(400).json({ ok: false, error: `Send at most ${MAX_ROWS_PER_PATCH} rows at a time.` });
      }
      if (rows.some(row => !row?._rowNumber)) {
        return res.status(400).json({ ok: false, error: 'Every row needs a _rowNumber from a read.' });
      }

      // _rowNumber is advisory, not authoritative: the store matches every
      // row by id, and rows whose id no longer exists are never written.
      let result;
      try {
        result = await updateRows(rows);
      } catch (err) {
        console.error('sheet PATCH: write failed', err);
        return res.status(502).json({ ok: false, error: "Couldn't save that. Try again in a moment.", saved: 0 });
      }
      if (result.unmatched) {
        return res.status(409).json({
          ok: false,
          error: `${result.unmatched} row${result.unmatched === 1 ? '' : 's'} couldn't be matched to the sheet. Reload and try again.`,
        });
      }
      return res.status(200).json({ ok: true, saved: result.saved });
    }

    return res.status(405).json({ ok: false, error: 'Use GET or PATCH.' });
  } catch (err) {
    console.error('sheet endpoint failed', err);
    return res.status(502).json({ ok: false, error: "Couldn't reach the sheet." });
  }
}
