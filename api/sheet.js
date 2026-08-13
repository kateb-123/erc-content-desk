/**
 * GET  /api/sheet   -> every row, newest sheet order preserved
 * PATCH /api/sheet  -> save changed rows in place (matched by _rowNumber)
 *
 * The browser sends whole rows back. Writes are per-row and already-written rows
 * are not rolled back, so a failure partway through leaves the sheet partially updated.
 */

import { readAllRows, updateRow } from '../lib/sheets.js';
import { checkDeskPassword } from './_auth.js';

const MAX_ROWS_PER_PATCH = 200;

export default async function handler(req, res) {
  if (!checkDeskPassword(req, res)) return;

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
        if (typeof row !== 'object' || row === null || !row._rowNumber) {
          res.status(400).json({ ok: false, error: 'Every row needs a _rowNumber from a read.' });
          return;
        }
      }
      let saved = 0;
      for (let i = 0; i < rows.length; i++) {
        try {
          await updateRow(rows[i]);
          saved++;
        } catch (err) {
          console.error(`Failed to write row ${i}`, err);
          res.status(502).json({ ok: false, error: 'Couldn\'t reach the sheet.', saved });
          return;
        }
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
