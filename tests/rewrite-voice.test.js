import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VOICE_EXAMPLES } from '../api/_lib/voice-examples.js';
import { buildRewritePrompt } from '../api/_lib/rewrite.js';

// Kate's four approved samples (Oct 8), copied byte for byte from
// .superpowers/samples-source.json, which git ignores.
const APPROVED = JSON.parse(readFileSync(new URL('./fixtures/approved-voice-samples.json', import.meta.url), 'utf8'));
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const ITEM = { id: 'x1', headline: 'Howdy Policy Trivia Night', type: 'event', subtype: 'A&M', blurb: 'Teams answer policy questions.' };

/** Each part found after the one before it; -1 where one is missing. */
function positions(text, parts) {
  let from = 0;
  return parts.map(part => {
    const at = text.indexOf(part, from);
    if (at >= 0) from = at + part.length;
    return at;
  });
}

test("the samples are Kate's four, each rewrite her approved text byte for byte", () => {
  assert.equal(VOICE_EXAMPLES.length, 4);
  assert.equal(VOICE_EXAMPLES.length, APPROVED.length);
  VOICE_EXAMPLES.forEach((ex, i) => assert.equal(ex.rewrite, APPROVED[i].rewrite, `sample ${i + 1}`));
});

test('each sample carries its approved fields and its source text', () => {
  VOICE_EXAMPLES.forEach((ex, i) => {
    const a = APPROVED[i];
    assert.equal(ex.headline, a.title);
    assert.equal(`${ex.type} / ${ex.subtype}`, a.type);
    for (const f of ['source', 'date', 'time', 'location', 'deadline']) assert.equal(ex[f] ?? '', a[f] ?? '', `${f} of sample ${i + 1}`);
    // The one change from the source: a dash in the AEFP call is a comma.
    assert.equal(ex.original_text, a.original.replace(/\s*[–—]\s*/g, ', '));
  });
});

test('the prompt shows each sample as an item: its fields, its source text, then its rewrite', () => {
  const prompt = buildRewritePrompt([ITEM]);
  for (const ex of VOICE_EXAMPLES) {
    const parts = [
      `title: ${ex.headline}`,
      `type: ${ex.type} / ${ex.subtype}`,
      `source: ${ex.source}`,
      ...['date', 'time', 'location', 'deadline'].filter(f => ex[f]).map(f => `${f}: ${ex[f]}`),
      `original text:\n${ex.original_text}`,
      `Rewrite:\n${ex.rewrite}`,
    ];
    const at = positions(prompt, parts);
    assert.ok(at.every(n => n >= 0), `${ex.headline}: ${parts.filter((_, i) => at[i] < 0).join(' | ')}`);
  }
  assert.ok(prompt.indexOf(VOICE_EXAMPLES.at(-1).rewrite) < prompt.indexOf('id: x1'), 'the samples come before the items');
});

test('the old caveat is gone: the new samples add no fact', () => {
  assert.doesNotMatch(buildRewritePrompt([ITEM]), /add a fact the editor pulled/);
  const src = read('../api/_lib/voice-examples.js');
  assert.doesNotMatch(src, /CAVEAT/);
  assert.doesNotMatch(src, /add facts she looked up/);
});
