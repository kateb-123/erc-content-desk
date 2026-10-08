import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, CSV_COLUMNS } from '../js/schema.js';
import { pageTextFor, readPages, TEXT_CAP } from '../api/_lib/rewrite.js';
import { ERC_VOICE } from '../api/_lib/voice.js';
import { issueToken, COOKIE } from '../api/_lib/session.js';

// Kate, Oct 8: the rewriter never saw the item's page, so a talk's abstract
// or a paper's findings never reached it. /api/rewrite now reads each
// candidate's link before the model call.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.DESK_PASSWORD = 'gig-em-test';
delete process.env.DATABASE_URL;
delete process.env.SHEET_API_URL;
const { createRewriteHandler } = await import('../api/rewrite.js');

const kept = o => blankRow({ status: 'kept', ...o });
const tick = ms => new Promise(r => setTimeout(r, ms));
const ABSTRACT = `Mathematicians spend time on examples while proving; students rarely do. ${'The projects look at how students use examples. '.repeat(10)}`;

test('pageTextFor: the longest abstract the page offers, else its text, capped', () => {
  assert.equal(pageTextFor({ text: 'Whole page.', description: '', abstracts: [ABSTRACT, 'A shorter one.'] }), ABSTRACT.trim());
  // A description tag of a line or two is no abstract: the page's text has more.
  assert.equal(pageTextFor({ text: 'Whole page with the talk in it.', description: 'Welcome to the center.', abstracts: ['Welcome to the center.'] }), 'Whole page with the talk in it.');
  assert.equal(pageTextFor({ text: '', description: 'Only this.', abstracts: ['Only this.'] }), 'Only this.');
  assert.equal(pageTextFor({ text: 'x'.repeat(TEXT_CAP + 500), abstracts: [] }).length, TEXT_CAP);
  assert.equal(pageTextFor('A page as a string.'), 'A page as a string.');
  assert.equal(pageTextFor({ text: '', description: '', abstracts: [] }), '');
  assert.equal(pageTextFor(null), '');
});

test('readPages reads each linked candidate, a few at a time, and a failed read leaves that item out', async () => {
  let live = 0, peak = 0;
  const asked = [];
  const fetchPage = async link => {
    asked.push(link);
    live += 1; peak = Math.max(peak, live);
    await tick(5);
    live -= 1;
    if (link.endsWith('/down')) throw new Error('timed out');
    if (link.endsWith('/empty')) return { text: '', description: '', abstracts: [] };
    return { text: `Page of ${link}`, description: '', abstracts: [] };
  };
  const rows = [
    kept({ id: 'a', link: 'https://example.org/aggie/a' }),
    kept({ id: 'b', link: 'https://example.org/aggie/down' }),
    kept({ id: 'c', link: '' }),
    kept({ id: 'd', link: 'https://example.org/aggie/empty' }),
    kept({ id: 'e', link: 'https://example.org/aggie/e' }),
    kept({ id: 'f', link: 'https://example.org/aggie/f' }),
    kept({ id: 'g', link: 'https://example.org/aggie/other', link_checked: 'mismatch' }),
  ];
  const pages = await readPages(rows, { fetchPage, limit: 2 });
  assert.deepEqual([...pages.keys()].sort(), ['a', 'e', 'f']);
  assert.equal(pages.get('a'), 'Page of https://example.org/aggie/a');
  assert.ok(peak <= 2, `at most 2 at once, saw ${peak}`);
  assert.ok(!asked.includes(''), 'no link, no read');
  assert.ok(!asked.includes('https://example.org/aggie/other'), 'a link the reader found to be another item is not read');
});

test('readPages stops at its time budget and keeps what came back', async () => {
  const fetchPage = link => (link.endsWith('/slow') ? new Promise(() => {}) : Promise.resolve({ text: 'Fast page.', abstracts: [] }));
  const rows = [kept({ id: 'slow', link: 'https://example.org/aggie/slow' }), kept({ id: 'fast', link: 'https://example.org/aggie/fast' })];
  const started = Date.now();
  const pages = await readPages(rows, { fetchPage, limit: 2, budgetMs: 60 });
  assert.ok(Date.now() - started < 1000, 'returns at the budget, not when the slow page answers');
  assert.deepEqual([...pages], [['fast', 'Fast page.']]);
});

// The handler, over fakes: no database, no network, no model.
function fakeRes() {
  return { code: 0, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
}
function fakeModel(reply) {
  const calls = [];
  const client = {
    beta: { messages: { stream: params => {
      calls.push(params);
      return { finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply(params)) }] }) };
    } } },
  };
  return { calls, anthropic: () => client };
}
const signedIn = async () => ({ cookie: `${COOKIE}=${await issueToken('gig-em-test')}` });
const TALK = kept({
  id: 't1', type: 'event', subtype: 'A&M', headline: 'Howdy Proof Talk', link: 'https://example.org/aggie/proof-talk',
  blurb: 'A talk on proofs.', original_text: 'Speaker: Reveille IX. Topic: examples in proof.',
});

test('the rewrite reads the page before the model call and sends its text with the item', async () => {
  const asked = [];
  const model = fakeModel(() => ({ rewrites: [{ id: 't1', blurb: 'Students rarely study examples when they prove.' }] }));
  const handler = createRewriteHandler({
    anthropic: model.anthropic,
    readAllRows: async () => [TALK],
    fetchHubCsv: async () => { throw new Error('the rewrite never reads the Exchange'); },
    fetchPage: async link => { asked.push(link); return { text: 'Page text: the talk shares results on how students use examples.', description: '', abstracts: [] }; },
  });
  const res = fakeRes();
  await handler({ method: 'POST', headers: await signedIn(), body: { ids: ['t1'] } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.rewrites, [{ id: 't1', blurb: 'Students rarely study examples when they prove.' }]);
  assert.deepEqual(asked, ['https://example.org/aggie/proof-talk']);
  assert.equal(model.calls.length, 1);
  assert.equal(model.calls[0].system, ERC_VOICE);
  const prompt = model.calls[0].messages[0].content;
  assert.ok(prompt.includes('page text:\nPage text: the talk shares results on how students use examples.'));
  assert.ok(prompt.includes('original text:\nSpeaker: Reveille IX. Topic: examples in proof.'));
});

test('a page that cannot be read leaves the item without page text; the rewrite still runs', async () => {
  const model = fakeModel(() => ({ rewrites: [{ id: 't1', blurb: 'A talk on examples in proof.' }] }));
  const handler = createRewriteHandler({
    anthropic: model.anthropic,
    readAllRows: async () => [TALK],
    fetchHubCsv: async () => ({ text: '' }),
    fetchPage: async () => { throw new Error('refused'); },
  });
  const res = fakeRes();
  await handler({ method: 'POST', headers: await signedIn(), body: { ids: ['t1'] } }, res);
  assert.equal(res.code, 200);
  assert.equal(model.calls.length, 1);
  assert.doesNotMatch(model.calls[0].messages[0].content, /page text:/);
});

test('nothing to rewrite reads no page and calls no model', async () => {
  let reads = 0;
  const model = fakeModel(() => ({ rewrites: [] }));
  const handler = createRewriteHandler({
    anthropic: model.anthropic,
    readAllRows: async () => [kept({ id: 'h1', type: 'headline', link: 'https://example.org/aggie/h', blurb: 'x' })],
    fetchHubCsv: async () => ({ text: '' }),
    fetchPage: async () => { reads += 1; return { text: 'x', abstracts: [] }; },
  });
  const res = fakeRes();
  await handler({ method: 'POST', headers: await signedIn(), body: {} }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.rewrites, []);
  assert.equal(reads, 0);
  assert.equal(model.calls.length, 0);
});

test('the card words are as they were: no sign-in, no page read, the card prompt', async () => {
  let reads = 0;
  const csv = `${CSV_COLUMNS.join(',')}\n,SDP Fellowship,https://x.org/sdp,opportunity,Fellowships & Programs,Harvard,,A year in a district data office.,2026-11-01,,,,,\n`;
  const model = fakeModel(() => ({ cards: [{ link: 'https://x.org/sdp', title: 'SDP Fellowship', summary: 'A year in a district data office.' }] }));
  const handler = createRewriteHandler({
    anthropic: model.anthropic,
    readAllRows: async () => [],
    fetchHubCsv: async () => ({ text: csv }),
    fetchPage: async () => { reads += 1; return { text: 'x', abstracts: [] }; },
  });
  const res = fakeRes();
  await handler({ method: 'POST', headers: {}, body: { card: ['https://x.org/sdp'] } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.cards, [{ link: 'https://x.org/sdp', title: 'SDP Fellowship', summary: 'A year in a district data office.' }]);
  assert.equal(reads, 0);
  assert.equal(model.calls[0].max_tokens, 8000);
  assert.match(model.calls[0].messages[0].content, /home-page card of the ERC Policy Exchange/);
});
