/**
 * POST /api/bulk — split a dropped file into submission items.
 * Two pipelines: spreadsheets (.xlsx/.csv) are row-mapped — one row, one
 * item, no model call (submit-time enrichment fills gaps per item); docs
 * (.docx/.md/.txt) go through the Claude split. Text formats arrive as
 * body.text; .docx/.xlsx arrive as body.file (base64). Read-only: the UI
 * shows the split for confirmation and then posts each item to /api/submit,
 * so every item gets the same extraction + save path.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  BULK_MODEL, BULK_SCHEMA, buildBulkPrompt, normalizeBulkItems,
} from './_lib/bulk-split.js';
import { parseModelJson } from './_lib/reply-json.js';
import { rowsToItems } from './_lib/bulk-rows.js';
import { parseCsv } from './_lib/hub.js';

export const config = { maxDuration: 300 };

const MAX_TEXT_LENGTH = 200000;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  const name = String(req.body?.name ?? '');
  const fileB64 = String(req.body?.file ?? '');
  let text = String(req.body?.text ?? '').trim();

  let buffer = null;
  if (fileB64) {
    buffer = Buffer.from(fileB64, 'base64');
    if (buffer.length > MAX_FILE_BYTES) {
      return res.status(400).json({ ok: false, error: 'That file is too big. Split it in half and try again.' });
    }
  }

  try {
    // .docx extracts to text before the length check, so a small file that
    // unpacks to a huge body is refused like a huge paste.
    if (/\.docx$/i.test(name)) {
      if (!buffer) return res.status(400).json({ ok: false, error: 'The document upload came through empty. Try again.' });
      const mammoth = await import('mammoth');
      text = String((await mammoth.extractRawText({ buffer })).value ?? '').trim();
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ ok: false, error: 'That document is too big. Split it in half and try again.' });
    }

    // Spreadsheets: one row = one item, straight mapping, no model call.
    if (/\.(xlsx|csv)$/i.test(name)) {
      let matrix;
      if (/\.csv$/i.test(name)) {
        matrix = parseCsv(text);
      } else {
        if (!buffer) return res.status(400).json({ ok: false, error: 'The spreadsheet upload came through empty. Try again.' });
        const XLSX = await import('xlsx');
        const book = XLSX.read(buffer, { type: 'buffer' });
        const sheet = book.Sheets[book.SheetNames[0]];
        matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      }
      const { items, warnings } = normalizeBulkItems({ items: rowsToItems(matrix) });
      return res.status(200).json({ ok: true, items, warnings });
    }

    // Documents: the Claude split.
    if (!text) return res.status(400).json({ ok: false, error: 'Nothing readable in that file.' });
    const stream = anthropic.messages.stream({
      model: BULK_MODEL,
      max_tokens: 60000,
      output_config: { format: { type: 'json_schema', schema: BULK_SCHEMA } },
      messages: [{ role: 'user', content: buildBulkPrompt(text) }],
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({ ok: false, error: 'That document is too big to split in one go. Split it in half and try again.' });
    }
    const out = response.content.find(b => b.type === 'text')?.text ?? '';
    const { items, warnings } = normalizeBulkItems(parseModelJson(out, 'bulk split'));
    return res.status(200).json({ ok: true, items, warnings });
  } catch (err) {
    console.error('bulk split failed', err);
    return res.status(502).json({ ok: false, error: "Couldn't read that document. Try again in a moment." });
  }
}
