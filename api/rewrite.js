/**
 * POST /api/rewrite — one batched Opus call over the Events + Opportunities
 * keepers. Read-only against the Sheet: Finalize shows the results
 * side-by-side and saves only what Kate accepts.
 */
import Anthropic from '@anthropic-ai/sdk';
import { ERC_VOICE } from './_lib/voice.js';
import {
  REWRITE_MODEL, REWRITE_SCHEMA, rewriteCandidates,
  buildRewritePrompt, parseRewrites, normalizeRewrites,
} from './_lib/rewrite.js';
import { readAllRows } from './_lib/sheets.js';

export const config = { maxDuration: 300 };

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  try {
    const all = await readAllRows();
    const ids = Array.isArray(req.body?.ids) ? new Set(req.body.ids) : null;
    const candidates = rewriteCandidates(all).filter(r => !ids || ids.has(r.id));
    if (!candidates.length) {
      return res.status(200).json({ ok: true, rewrites: [], warnings: ['Nothing to rewrite — only kept Events and Opportunities with blurbs get rewritten.'] });
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
      return res.status(502).json({ ok: false, error: 'Claude declined the rewrite. Edit the blurbs by hand this time.' });
    }
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({ ok: false, error: 'Too many items to rewrite in one go — publish what you have and rewrite the next batch separately.' });
    }
    const text = response.content.find(b => b.type === 'text')?.text ?? '';
    const { rewrites, warnings } = normalizeRewrites(parseRewrites(text), candidates);
    return res.status(200).json({ ok: true, rewrites, warnings });
  } catch (err) {
    console.error('rewrite failed', err);
    return res.status(502).json({ ok: false, error: "The rewrite didn't go through. Try again in a moment." });
  }
}
