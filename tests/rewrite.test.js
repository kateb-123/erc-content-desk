import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import {
  REWRITE_MODEL, REWRITE_SCHEMA, rewriteCandidates,
  buildRewritePrompt, parseRewrites, normalizeRewrites,
} from '../api/_lib/rewrite.js';
import { VOICE_EXAMPLES } from '../api/_lib/voice-examples.js';

const kept = o => blankRow({ status: 'kept', ...o });

test('kept events, opportunities, and description-less research are candidates', () => {
  const rows = [
    kept({ id: 'a', type: 'event', blurb: 'x' }),
    kept({ id: 'b', type: 'opportunity', blurb: 'x' }),
    kept({ id: 'c', type: 'research', blurb: 'x' }),      // has an abstract — never rewritten
    kept({ id: 'd', type: 'headline', blurb: 'x' }),      // never rewritten
    kept({ id: 'e', type: 'event', blurb: '' }),          // drafted from its own facts
    kept({ id: 'g', type: 'research', blurb: '', original_text: 'the announcement' }),
    blankRow({ id: 'f', status: 'new', type: 'event', blurb: 'x' }),
  ];
  assert.deepEqual(rewriteCandidates(rows).map(r => r.id), ['a', 'b', 'e', 'g']);
});

test('a checked rewrite is never a candidate again', () => {
  const rows = [
    kept({ id: 'a', type: 'event', blurb: 'x', rewrite_checked: '2026-08-31T00:00:00.000Z' }),
    kept({ id: 'b', type: 'opportunity', blurb: 'x' }),
  ];
  assert.deepEqual(rewriteCandidates(rows).map(r => r.id), ['b']);
});

test('a kept event that has already been published is not a candidate', () => {
  const rows = [
    kept({ id: 'a', type: 'event', blurb: 'x', published_at: '2026-08-01T00:00:00.000Z' }),
    kept({ id: 'b', type: 'opportunity', blurb: 'x' }),
  ];
  assert.deepEqual(rewriteCandidates(rows).map(r => r.id), ['b']);
});

test('the batched prompt lists every candidate with its id', () => {
  const rows = [kept({ id: 'a1', type: 'event', headline: 'Webinar', blurb: 'Long blurb.' })];
  const prompt = buildRewritePrompt(rows);
  assert.ok(prompt.includes('a1'));
  assert.ok(prompt.includes('Webinar'));
  assert.ok(prompt.includes('Long blurb.'));
  assert.equal(REWRITE_MODEL, 'claude-opus-5');
  assert.equal(REWRITE_SCHEMA.additionalProperties, false);
});

test('the prompt includes real voice examples ahead of the items', () => {
  const rows = [kept({ id: 'a1', type: 'event', headline: 'Webinar', blurb: 'Long blurb.' })];
  const prompt = buildRewritePrompt(rows);
  assert.ok(prompt.includes(VOICE_EXAMPLES[0].rewrite));
});

test('a description-less item brings its original text (capped) so Claude can draft', () => {
  const rows = [kept({
    id: 'a1', type: 'research', headline: 'Working paper', blurb: '',
    original_text: `start ${'y'.repeat(2000)} ZZTAIL`, authors: 'Someone',
  })];
  const prompt = buildRewritePrompt(rows);
  assert.ok(prompt.includes('original text:'));
  assert.ok(prompt.includes('start'));
  assert.ok(!prompt.includes('ZZTAIL'));        // capped, not the whole document
  assert.ok(prompt.includes('Someone'));
});

test('normalizeRewrites drops unknown ids and empty blurbs', () => {
  const rows = [kept({ id: 'a', type: 'event', blurb: 'x' })];
  const { rewrites, warnings } = normalizeRewrites(
    { rewrites: [{ id: 'a', blurb: 'Better.' }, { id: 'ghost', blurb: 'z' }, { id: 'a', blurb: '' }] },
    rows,
  );
  assert.deepEqual(rewrites, [{ id: 'a', blurb: 'Better.' }]);
  assert.equal(warnings.length, 1);
});

test('parseRewrites rejects prose', () => {
  assert.throws(() => parseRewrites('nope'), /valid JSON/);
});
