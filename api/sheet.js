/**
 * GET  /api/sheet   -> every row, newest sheet order preserved
 * PATCH /api/sheet  -> save changed rows in place (matched by _rowNumber)
 *
 * The browser sends whole rows back. Writes are per-row PUTs rather than a batch
 * update so a single bad row can't take the rest down with it.
 */

import { readAllRows, updateRow } from '../lib/sheets.js';

const MAX_ROWS_PER_PATCH = 200;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, rows: await readAllRows() });
      return;
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
        if (!row._rowNumber) {
          res.status(400).json({ ok: false, error: 'Every row needs a _rowNumber from a read.' });
          return;
        }
      }
      for (const row of rows) await updateRow(row);
      res.status(200).json({ ok: true, saved: rows.length });
      return;
    }

    res.status(405).json({ ok: false, error: 'Use GET or PATCH.' });
  } catch (err) {
    console.error('sheet endpoint failed', err);
    res.status(502).json({ ok: false, error: "Couldn't reach the sheet." });
  }
}
