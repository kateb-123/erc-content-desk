/**
 * POST /api/process — run Claude over the keepers.
 *
 * Keepers only, by design: the team decides on verbatim text first, and we only
 * spend a call on things that survived. Each item is one request with the
 * web_fetch server tool available, so Claude reads the actual page when the
 * submission was just a link.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ERC_VOICE } from '../lib/voice.js';
import {
  EXTRACTION_SCHEMA, buildExtractionPrompt, parseExtraction, normalizeExtraction,
} from '../lib/extract.js';
import { readAllRows, updateRow } from '../lib/sheets.js';
import { applyExtracted, keepersAwaitingProcess } from '../js/workflow.js';
import { checkDeskPassword } from './_auth.js';

const MODEL = 'claude-opus-5';
/**
 * Bounds one request's spend, and — since each item is a non-streaming Opus
 * call that can run 20-60s — keeps a full run inside Vercel's 300s ceiling.
 * Raise it only alongside a move to background/streaming execution.
 */
const MAX_ITEMS_PER_RUN = Number(process.env.MAX_ITEMS_PER_RUN || 3);
/** web_fetch can pause a long turn; resume a few times, then give up. */
const MAX_RESUMES = 3;

/** Vercel's per-invocation ceiling; matches the sequential-call budget above. */
export const config = { maxDuration: 300 };

const anthropic = new Anthropic();

class ItemError extends Error {}

async function extractOne(row) {
  let messages = [{ role: 'user', content: buildExtractionPrompt(row) }];
  let response;

  for (let attempt = 0; attempt <= MAX_RESUMES; attempt += 1) {
    response = await anthropic.beta.messages.create({
      model: MODEL,
      // Thinking is on by default on Opus 5 and shares this budget with the
      // response, so a tight cap truncates the JSON rather than the reasoning.
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: ERC_VOICE,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
      },
      tools: [{ type: 'web_fetch_20260209', name: 'web_fetch' }],
      messages,
    });

    if (response.stop_reason !== 'pause_turn') break;
    messages = [messages[0], { role: 'assistant', content: response.content }];
  }

  if (response.stop_reason === 'refusal') {
    throw new ItemError('Claude declined this item. Fill it in by hand.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ItemError('Response ran long and got cut off. Try trimming the pasted text.');
  }

  const block = response.content.find(b => b.type === 'text');
  if (!block) throw new ItemError('Claude returned no text.');

  let extracted;
  try {
    extracted = parseExtraction(block.text);
  } catch (err) {
    throw new ItemError(err.message);
  }
  return normalizeExtraction(extracted);
}

export default async function handler(req, res) {
  if (!checkDeskPassword(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Use POST.' });
    return;
  }

  let candidates;
  let rowNumberById;
  try {
    const all = await readAllRows();
    rowNumberById = new Map(all.map(r => [r.id, r._rowNumber]));
    const wanted = req.body && Array.isArray(req.body.ids) ? new Set(req.body.ids) : null;
    candidates = keepersAwaitingProcess(all).filter(r => !wanted || wanted.has(r.id));
  } catch (err) {
    console.error('process: could not read the sheet', err);
    res.status(502).json({ ok: false, error: "Couldn't reach the sheet." });
    return;
  }

  const skipped = Math.max(0, candidates.length - MAX_ITEMS_PER_RUN);
  candidates = candidates.slice(0, MAX_ITEMS_PER_RUN);

  const warnings = [];
  const failures = [];
  let processed = 0;

  for (const row of candidates) {
    try {
      const { fields, warnings: rowWarnings } = await extractOne(row);
      // A run spans minutes; re-resolve _rowNumber against id — advisory,
      // not authoritative — immediately before writing, in case someone
      // sorted or deleted rows in the Sheet while this item was in flight.
      const liveRowNumber = rowNumberById.get(row.id);
      if (liveRowNumber === undefined) {
        failures.push({ id: row.id, error: "This row is no longer in the sheet, so it wasn't saved. Reload and try again." });
        continue;
      }
      await updateRow(applyExtracted({ ...row, _rowNumber: liveRowNumber }, fields));
      processed += 1;
      for (const w of rowWarnings) warnings.push(`${row.headline || row.link || row.id}: ${w}`);
    } catch (err) {
      if (err instanceof ItemError) {
        failures.push({ id: row.id, error: err.message });
      } else {
        console.error('process: item failed', row.id, err);
        failures.push({ id: row.id, error: 'Something went wrong on this item. It stays in the keeper list — try again.' });
      }
    }
  }

  if (skipped) {
    warnings.push(`${skipped} more keeper${skipped === 1 ? '' : 's'} left for the next run (cap is ${MAX_ITEMS_PER_RUN} per click).`);
  }

  res.status(200).json({ ok: true, processed, warnings, failures });
}
