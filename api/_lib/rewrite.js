/**
 * The ONE batched description rewrite: events and opportunities always, a
 * Report always, and research that arrived without an abstract. Headlines
 * and other research are never rewritten, so the model call stays scoped. A
 * checked row (rewrite_checked) is done for good. buildRewritePrompt shows
 * Kate's four approved samples (voice-examples.js) in the shape of an item,
 * each with its rewrite, then the items; ERC_VOICE (voice.js) is the system
 * prompt and holds the voice, the prompt holds the rules for these items.
 */
import { VOICE_EXAMPLES } from './voice-examples.js';
import { canRewrite, readyToFinalize } from '../../js/workflow.js';

export const REWRITE_MODEL = 'claude-opus-5';

const ORIGINAL_TEXT_CAP = 1500;

export function rewriteCandidates(rows) {
  // Finalize's own list, filtered the same way (js/app.js): the stamped-row
  // gate is readyToFinalize, and canRewrite is the guard that never sends the
  // model an item with no source text to work from.
  return readyToFinalize(rows).filter(canRewrite);
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
          blurb: { type: 'string', description: 'The rewritten blurb, 1-3 sentences, at most 70 words, no padding. Empty when the material says nothing beyond the title.' },
        },
      },
    },
  },
};

const clean = v => String(v ?? '').trim();

/** An item's fields, a line each, only the ones it has. The samples and the
 *  items share it, so a sample reads the way a real item does. */
function fieldLines(r) {
  const type = [r.type, r.subtype].map(clean).filter(Boolean).join(' / ');
  return [
    ['title', r.headline], ['type', type], ['source', r.source], ['authors', r.authors],
    ['date', r.date], ['time', r.time], ['location', r.location], ['deadline', r.deadline],
  ].filter(([, v]) => clean(v)).map(([k, v]) => `${k}: ${clean(v)}`);
}

function exampleBlock() {
  return VOICE_EXAMPLES.map(ex => [
    ...fieldLines(ex),
    `original text:\n${ex.original_text}`,
    '',
    `Rewrite:\n${ex.rewrite}`,
  ].join('\n')).join('\n\n---\n\n');
}

export function buildRewritePrompt(rows) {
  const items = rows.map(r => [
    `id: ${r.id}`,
    ...fieldLines(r),
    r.blurb ? `blurb:\n${r.blurb}` : '',
    !r.blurb && r.original_text
      ? `original text:\n${String(r.original_text).slice(0, ORIGINAL_TEXT_CAP)}` : '',
  ].filter(Boolean).join('\n')).join('\n\n---\n\n');
  return [
    'Rewrite the description of each item below in the ERC newsletter voice. Return one rewrite per item, keyed by its exact id.',
    'An item with no description has none yet: draft one from its other text and its fields.',
    'Never repeat the date, time, place or deadline: the fields carry them and the layout shows them.',
    "Keep every fact true to the item's own fields and text; never add one.",
    'A short original stays short. Do not add a closing sentence about who would find the item useful.',
    'When the material says nothing beyond the title, return an empty blurb for that item; the desk keeps what it has.',
    '',
    'Examples of the voice, each an item as you will see one, then its rewrite:',
    '',
    exampleBlock(),
    '',
    'Items:',
    items,
  ].join('\n');
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
