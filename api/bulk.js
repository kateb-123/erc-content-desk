/**
 * POST /api/bulk — split a pasted document into submission items.
 * Read-only: the UI shows the split for confirmation and then posts each
 * item to /api/submit, so every item gets the same extraction + save path.
 * Streaming because a whole issue's doc can want a large output budget.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  BULK_MODEL, BULK_SCHEMA, buildBulkPrompt, parseBulk, normalizeBulkItems,
} from './_lib/bulk-split.js';

export const config = { maxDuration: 300 };

const MAX_TEXT_LENGTH = 200000;
const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'Paste some text first.' });
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ ok: false, error: 'That document is too big — split it in half and try again.' });
  }
  try {
    const stream = anthropic.messages.stream({
      model: BULK_MODEL,
      max_tokens: 60000,
      output_config: { format: { type: 'json_schema', schema: BULK_SCHEMA } },
      messages: [{ role: 'user', content: buildBulkPrompt(text) }],
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({ ok: false, error: 'That document is too big to split in one go — split it in half and try again.' });
    }
    const out = response.content.find(b => b.type === 'text')?.text ?? '';
    const { items, warnings } = normalizeBulkItems(parseBulk(out));
    const counts = {};
    for (const item of items) {
      const key = item.type || 'untyped';
      counts[key] = (counts[key] || 0) + 1;
    }
    return res.status(200).json({ ok: true, items, counts, warnings });
  } catch (err) {
    console.error('bulk split failed', err);
    return res.status(502).json({ ok: false, error: "Couldn't read that document. Try again in a moment." });
  }
}
