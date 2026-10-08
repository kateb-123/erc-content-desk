import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VOICE_EXAMPLES } from '../api/_lib/voice-examples.js';
import { buildRewritePrompt, REWRITE_SCHEMA } from '../api/_lib/rewrite.js';
import { ERC_VOICE } from '../api/_lib/voice.js';

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
    assert.equal(ex.original_text, a.original.replace(/\s*[\u2013\u2014]\s*/g, ', '));
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

// Kate, Oct 8, on the rewrites: "it will pull things about all the speakers
// but the main thing is what they're going to be presenting on".
test('the voice leads with the substance and names a speaker by one role', () => {
  assert.match(ERC_VOICE, /Lead with what is being presented, found or offered/);
  assert.match(ERC_VOICE, /a talk's topic and argument, a paper's findings, a call's scope and who can apply/);
  assert.match(ERC_VOICE, /one role/);
  assert.match(ERC_VOICE, /Never career history, degrees, honors,? or past posts/);
  assert.match(ERC_VOICE, /boilerplate/);
});

test('the voice bans restating the title, the lead-ins and the newsletter an item came from', () => {
  assert.match(ERC_VOICE, /Never restate the title/);
  assert.match(ERC_VOICE, /"This report examines"/);
  assert.match(ERC_VOICE, /"In this talk"/);
  assert.match(ERC_VOICE, /Never name the newsletter, digest or inbox an item was found in/);
  assert.match(ERC_VOICE, /No em dashes or en dashes/);
  assert.match(ERC_VOICE, /at most 70 words/);
  assert.match(ERC_VOICE, /Never invent a fact/);
});

test('the prompt: the fields carry the date, time and place, and an item with nothing past its title gets an empty blurb', () => {
  const prompt = buildRewritePrompt([ITEM]);
  assert.match(prompt, /Never repeat the date, time, place or deadline/);
  assert.match(prompt, /says nothing beyond the title, return an empty blurb/);
  assert.match(REWRITE_SCHEMA.properties.rewrites.items.properties.blurb.description, /Empty when the material says nothing beyond the title/);
  assert.doesNotMatch(prompt, /the examples that end that way/);
  assert.doesNotMatch(ERC_VOICE, /empty blurb/, 'the card words share the voice, so the empty-blurb rule stays in the rewrite prompt');
});

test('no em or en dash in the voice, the samples or the built prompt', () => {
  const dash = /[\u2013\u2014]/;
  assert.doesNotMatch(read('../api/_lib/voice.js'), dash);
  assert.doesNotMatch(read('../api/_lib/voice-examples.js'), dash);
  assert.doesNotMatch(ERC_VOICE, dash);
  const prompt = buildRewritePrompt([
    ITEM,
    { id: 'x2', headline: 'Gig Em Grants', type: 'opportunity', subtype: 'Funding & Grants', deadline: '2026-11-01', blurb: '', original_text: 'Grants for Aggie teachers.' },
  ], new Map([['x2', 'The page of the grants.']]));
  assert.doesNotMatch(prompt, dash);
});

// Kate, Oct 8: the rewrites were "too scarce or not really pulling the right
// information". The model now reads every text the desk has for an item.
const long = (head, near, tail) => `${head} ${'y'.repeat(5900)} ${near} ${'y'.repeat(2000)} ${tail}`;

test('the prompt carries page text and original text together, with the description, under the fields', () => {
  const row = {
    id: 'p1', headline: 'Howdy Policy Trivia Night', type: 'event', subtype: 'A&M', source: 'Aggie Policy Club',
    date: '2026-10-20', time: '6:00 PM CT', location: 'Rudder Tower', authors: '',
    blurb: 'Teams answer policy questions.', original_text: 'The flyer: teams of four, prizes for the top three.',
  };
  const prompt = buildRewritePrompt([row], new Map([['p1', 'The page: questions on school finance and the STAAR.']]));
  const at = positions(prompt, [
    'Items:',
    'id: p1',
    'title: Howdy Policy Trivia Night',
    'type: event / A&M',
    'source: Aggie Policy Club',
    'date: 2026-10-20',
    'time: 6:00 PM CT',
    'location: Rudder Tower',
    'current description:\nTeams answer policy questions.',
    'original text:\nThe flyer: teams of four, prizes for the top three.',
    'page text:\nThe page: questions on school finance and the STAAR.',
  ]);
  assert.ok(at.every(n => n >= 0), String(at));
  assert.match(prompt, /every text the desk has for it/);
});

test('each text is capped near 6,000 characters, not 1,500', () => {
  const row = {
    id: 'c1', headline: 'T', type: 'research', subtype: 'Report',
    blurb: long('DESC_HEAD', 'DESC_NEAR', 'DESC_TAIL'),
    original_text: long('ORIG_HEAD', 'ORIG_NEAR', 'ORIG_TAIL'),
  };
  const prompt = buildRewritePrompt([row], new Map([['c1', long('PAGE_HEAD', 'PAGE_NEAR', 'PAGE_TAIL')]]));
  for (const k of ['DESC', 'ORIG', 'PAGE']) {
    assert.ok(prompt.includes(`${k}_HEAD`) && prompt.includes(`${k}_NEAR`), `${k} kept up to the cap`);
    assert.ok(!prompt.includes(`${k}_TAIL`), `${k} cut at the cap`);
  }
});

test('no page text line when the page was not read, a text the same as another shown once, a type with no subtype bare', () => {
  const row = { id: 'd1', headline: 'Gig Em Grants', type: 'opportunity', subtype: '', blurb: 'Same words.', original_text: 'Same words.' };
  const prompt = buildRewritePrompt([row]);
  const item = prompt.slice(prompt.indexOf('id: d1'));
  assert.doesNotMatch(item, /page text:/);
  assert.equal(item.split('Same words.').length - 1, 1);
  assert.match(item, /^type: opportunity$/m);
});
