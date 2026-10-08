/**
 * POST /api/rewrite: one batched Opus call over the kept items that need the
 * ERC voice. Read-only against the Sheet: Finalize shows the results
 * side-by-side and saves only what Kate accepts. Before the call it reads
 * each item's page (Kate, Oct 8: the rewrites were "not really pulling the
 * right information"), so the model sees the talk's abstract or the paper's
 * findings and not only the desk's short description.
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
  buildRewritePrompt, normalizeRewrites, readPages,
} from './_lib/rewrite.js';
import { CARD_SCHEMA, cardItems, buildCardPrompt, normalizeCards } from './_lib/card-words.js';
import { parseModelJson } from './_lib/reply-json.js';
import { readAllRows } from './_lib/store.js';
import { fetchHubCsv } from './_lib/hub.js';
import { fetchPage } from './_lib/fetch-page.js';
import { hubRows } from './_lib/highlights.js';
import { refuseUnlessSignedIn } from './_lib/session.js';

export const config = { maxDuration: 300 };

let client;
const liveClient = () => (client ??= new Anthropic());

/** Built over its dependencies so the tests can hand in fakes. */
export function createRewriteHandler({ anthropic = liveClient, readAllRows, fetchHubCsv, fetchPage }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Use POST.' });
    }
    // The Exchange card's words are asked by Publish, an open page. The
    // rewrite is Finalize's, and Content Sort is behind the desk password
    // again (Kate's drawn map, Oct 6), so its model call is too.
    if (!Array.isArray(req.body?.card) && await refuseUnlessSignedIn(req, res)) return;
    try {
      if (Array.isArray(req.body?.card)) return await cardWords(req.body.card, res, { anthropic, readAllRows, fetchHubCsv });
      const all = await readAllRows();
      const ids = Array.isArray(req.body?.ids) ? new Set(req.body.ids) : null;
      const candidates = rewriteCandidates(all).filter(r => !ids || ids.has(r.id));
      if (!candidates.length) {
        return res.status(200).json({ ok: true, rewrites: [], warnings: ['Nothing to rewrite. Only kept events, opportunities, and research without a description are candidates.'] });
      }
      const pages = await readPages(candidates, { fetchPage });
      const stream = anthropic().beta.messages.stream({
        model: REWRITE_MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: ERC_VOICE,
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: REWRITE_SCHEMA },
        },
        messages: [{ role: 'user', content: buildRewritePrompt(candidates, pages) }],
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
  };
}

/** One call over the asked picks; nothing is saved here, the words ride the
 *  publish with the picks. */
async function cardWords(links, res, { anthropic, readAllRows, fetchHubCsv }) {
  const [rows, live] = await Promise.all([readAllRows(), fetchHubCsv()]);
  const items = cardItems(links, { rows, hub: hubRows(live.text) });
  if (!items.length) {
    return res.status(200).json({ ok: true, cards: [], warnings: ['Nothing to write: only an event or an opportunity gets card words.'] });
  }
  const stream = anthropic().beta.messages.stream({
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

export default createRewriteHandler({ readAllRows, fetchHubCsv, fetchPage });
