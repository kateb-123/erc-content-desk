/**
 * POST /api/submit — public, unauthenticated by design.
 * Validates the structured form, runs the small Haiku metadata extraction,
 * and appends one row. Extraction failure never loses a submission: the row
 * saves with just the typed fields and the caller gets a warning.
 */
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { buildSubmission, validateSubmission } from '../js/intake.js';
import { applyExtracted } from '../js/workflow.js';
import {
  EXTRACT_MODEL, EXTRACTION_SCHEMA, buildExtractionPrompt,
  parseExtraction, normalizeExtraction,
} from './_lib/extract.js';
import { appendRow } from './_lib/sheets.js';

export const config = { maxDuration: 60 };

const MAX_FIELD_LENGTH = 20000;
const anthropic = new Anthropic({ timeout: 20_000, maxRetries: 1 });

async function extractInto(row) {
  const response = await anthropic.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 1024,
    output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
    messages: [{ role: 'user', content: buildExtractionPrompt(row) }],
  });
  const text = response.content.find(b => b.type === 'text')?.text ?? '';
  const { fields, warnings } = normalizeExtraction(parseExtraction(text));
  return { row: applyExtracted(row, fields), warnings };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, errors: ['Use POST.'] });
  }
  try {
    const body = req.body ?? {};
    for (const key of ['title', 'blurb', 'link', 'type', 'subtype', 'spotlight', 'submitter']) {
      if (String(body[key] ?? '').length > MAX_FIELD_LENGTH) {
        return res.status(400).json({ ok: false, errors: ['That submission is too long.'] });
      }
    }
    const errors = validateSubmission(body, { allowBlankSubtype: true });
    if (errors.length) return res.status(400).json({ ok: false, errors });

    let row = buildSubmission({
      ...body, id: randomUUID(), submittedAt: new Date().toISOString(),
    });
    const warnings = [];
    try {
      const extracted = await extractInto(row);
      row = extracted.row;
      warnings.push(...extracted.warnings);
    } catch (err) {
      console.error('extraction failed', err);
      warnings.push('Saved, but the automatic filing failed — fill in the details during Finalize.');
    }
    await appendRow(row);
    return res.status(200).json({ ok: true, id: row.id, warnings });
  } catch (err) {
    console.error('submit failed', err);
    return res.status(502).json({ ok: false, errors: ["Couldn't save that. Try again in a moment."] });
  }
}
