/**
 * GET  /api/sheet   -> every row, newest sheet order preserved
 * PATCH /api/sheet  -> save changed rows in place (matched by _rowNumber)
 *
 * The browser sends whole rows back. Writes are per-row and already-written rows
 * are not rolled back, so a failure partway through leaves the store partially updated.
 * Since Sep 10 the store is Postgres with the Sheet mirrored behind it (api/_lib/store.js).
 */

import { readAllRows, readScheduleRows, updateRows } from './_lib/store.js';
import { normalizeSchedule } from '../js/schedule.js';

const MAX_ROWS_PER_PATCH = 200;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Side by side: the schedule read can be the slow one.
      const [rows, schedule] = await Promise.all([
        readAllRows(),
        readScheduleRows().then(normalizeSchedule).catch(err => {
          console.error('schedule read failed (tab missing?)', err);
          return [];
        }),
      ]);
      return res.status(200).json({ ok: true, rows, schedule });
    }

    if (req.method === 'PATCH') {
      const rows = (req.body && req.body.rows) || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ ok: false, error: 'Send a rows array.' });
        return;
      }
      if (rows.length > MAX_ROWS_PER_PATCH) {
        res.status(400).json({ ok: false, error: `Send at most ${MAX_ROWS_PER_PATCH} rows at a time.` });
        return;
      }
      for (const row of rows) {
        if (typeof row !== 'object' || row === null || !row._rowNumber) {
          res.status(400).json({ ok: false, error: 'Every row needs a _rowNumber from a read.' });
          return;
        }
      }

      // _rowNumber is advisory, not authoritative: the store matches every
      // row by id, and rows whose id no longer exists are never written.
      let saved = 0, unmatchedCount = 0;
      try {
        ({ saved, unmatched: unmatchedCount } = await updateRows(rows));
      } catch (err) {
        console.error('sheet PATCH: write failed', err);
        res.status(502).json({ ok: false, error: "Couldn't save that. Try again in a moment.", saved });
        return;
      }

      if (unmatchedCount) {
        res.status(409).json({
          ok: false,
          error: `${unmatchedCount} row${unmatchedCount === 1 ? '' : 's'} couldn't be matched to the sheet — reload and try again.`,
        });
        return;
      }

      res.status(200).json({ ok: true, saved });
      return;
    }

    res.status(405).json({ ok: false, error: 'Use GET or PATCH.' });
  } catch (err) {
    console.error('sheet endpoint failed', err);
    res.status(502).json({ ok: false, error: "Couldn't reach the sheet." });
  }
}
