/**
 * POST /api/rewrite — one batched Opus call over the Events + Opportunities
 * keepers. Read-only against the Sheet: Finalize shows the results
 * side-by-side and saves only what Kate accepts.
 *
 * With `card: [links]` in the body it writes the Exchange card's words
 * instead (Kate, Sep 30): a summary that fits the New & upcoming card and a
 * title that does, for each highlight pick that is an event, an ERC event
 * or an opportunity. Same function, since api/ holds the Hobby plan's twelve.
 */
import Anthropic from '@anthropic-ai/sdk';
import { ERC_VOICE } from './_lib/voice.js';
import {
  REWRITE_MODEL, REWRITE_SCHEMA, rewriteCandidates,
  buildRewritePrompt, normalizeRewrites,
} from './_lib/rewrite.js';
import { CARD_SCHEMA, cardItems, buildCardPrompt, normalizeCards } from './_lib/card-words.js';
import { parseModelJson } from './_lib/reply-json.js';
import { readAllRows } from './_lib/store.js';
import { fetchHubCsv } from './_lib/hub.js';
import { hubRows } from './_lib/highlights.js';

export const config = { maxDuration: 300 };

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  // The sign-in is off (Kate, Sep 30), so the model call is open like the
  // page that makes it.
  try {
    if (Array.isArray(req.body?.card)) return await cardWords(req.body.card, res);
    const all = await readAllRows();
    const ids = Array.isArray(req.body?.ids) ? new Set(req.body.ids) : null;
    const candidates = rewriteCandidates(all).filter(r => !ids || ids.has(r.id));
    if (!candidates.length) {
      return res.status(200).json({ ok: true, rewrites: [], warnings: ['Nothing to rewrite. Only kept events, opportunities, and research without a description are candidates.'] });
    }
    const stream = anthropic.beta.messages.stream({
      model: REWRITE_MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: ERC_VOICE,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: REWRITE_SCHEMA },
      },
      messages: [{ role: 'user', content: buildRewritePrompt(candidates) }],
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'refusal') {
      return res.status(502).json({ ok: false, error: 'The rewrite was refused. Edit the descriptions by hand.' });
    }
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({ ok: false, error: 'Too many to rewrite at once. Rewrite in smaller batches.' });
    }
    const text = response.content.find(b => b.type === 'text')?.text ?? '';
    const { rewrites, warnings } = normalizeRewrites(parseModelJson(text, 'rewrite'), candidates);
    return res.status(200).json({ ok: true, rewrites, warnings });
  } catch (err) {
    console.error('rewrite failed', err);
    return res.status(502).json({ ok: false, error: "The rewrite didn't go through. Try again in a moment." });
  }
}

/** One call over the asked picks; nothing is saved here, the words ride the
 *  publish with the picks. */
async function cardWords(links, res) {
  const [rows, live] = await Promise.all([readAllRows(), fetchHubCsv()]);
  const items = cardItems(links, { rows, hub: hubRows(live.text) });
  if (!items.length) {
    return res.status(200).json({ ok: true, cards: [], warnings: ['Nothing to write: only an event or an opportunity gets card words.'] });
  }
  const stream = anthropic.beta.messages.stream({
    model: REWRITE_MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: ERC_VOICE,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: CARD_SCHEMA },
    },
    messages: [{ role: 'user', content: buildCardPrompt(items) }],
  });
  const response = await stream.finalMessage();
  if (response.stop_reason === 'refusal') {
    return res.status(502).json({ ok: false, error: 'The card words were refused. Write them by hand with Edit.' });
  }
  const text = response.content.find(b => b.type === 'text')?.text ?? '';
  const { cards, warnings } = normalizeCards(parseModelJson(text, 'card words'), items);
  return res.status(200).json({ ok: true, cards, warnings });
}
