/**
 * The ONE batched blurb rewrite: Events + Opportunities only, one call per
 * issue. Research abstracts and headlines are never rewritten — this was
 * v1's credit burner and v2 scopes it hard. buildRewritePrompt leads with a
 * few real before/after examples from Kate's own newsletters (see
 * voice-examples.js) so the model has concrete voice/compression targets on
 * top of ERC_VOICE, which still carries the style rules.
 */
import { VOICE_EXAMPLES } from './voice-examples.js';

export const REWRITE_MODEL = 'claude-opus-5';

export function rewriteCandidates(rows) {
  return rows.filter(r =>
    r.status === 'kept' && (r.type === 'event' || r.type === 'opportunity') && r.blurb);
}

export const REWRITE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rewrites'],
  properties: {
    rewrites: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'blurb'],
        properties: {
          id: { type: 'string', description: 'The item id, copied exactly.' },
          blurb: { type: 'string', description: 'The rewritten blurb, 2-3 sentences, 40-70 words.' },
        },
      },
    },
  },
};

function exampleBlock() {
  return VOICE_EXAMPLES.map(ex => [
    'Original:',
    ex.original,
    '',
    'Rewrite:',
    ex.rewrite,
  ].join('\n')).join('\n\n---\n\n');
}

export function buildRewritePrompt(rows) {
  const items = rows.map(r => [
    `id: ${r.id}`,
    `title: ${r.headline}`,
    `type: ${r.type} / ${r.subtype}`,
    r.date ? `date: ${r.date}` : '',
    r.time ? `time: ${r.time}` : '',
    r.location ? `location: ${r.location}` : '',
    r.deadline ? `deadline: ${r.deadline}` : '',
    'blurb:',
    r.blurb,
  ].filter(Boolean).join('\n')).join('\n\n---\n\n');
  return [
    'Rewrite each blurb below in the ERC newsletter voice.',
    'Return one rewrite per item, keyed by its exact id.',
    'Keep every fact — never add one. Do not restate the date/time/location line-for-line if the blurb flows better without it; the layout shows those separately.',
    'Examples of the voice:',
    exampleBlock(),
    '',
    "(Note: some of those human rewrites add a fact the editor pulled from the source page — do not do that. Use only facts present in each item's own blurb below.)",
    '',
    'Items:',
    items,
  ].join('\n');
}

export function parseRewrites(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('rewrite was not valid JSON');
  }
}

export function normalizeRewrites(parsed, rows) {
  const known = new Set(rows.map(r => r.id));
  const rewrites = [];
  const warnings = [];
  for (const entry of parsed?.rewrites ?? []) {
    const id = String(entry?.id ?? '');
    const blurb = String(entry?.blurb ?? '').trim();
    if (!known.has(id)) {
      warnings.push(`Skipped a rewrite that didn't match an item (${id || 'no id'}).`);
      continue;
    }
    if (!blurb) continue; // nothing to show; not a data problem worth flagging
    if (!rewrites.some(r => r.id === id)) rewrites.push({ id, blurb });
  }
  return { rewrites, warnings };
}
