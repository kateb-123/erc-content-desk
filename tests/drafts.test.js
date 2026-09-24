import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../api/_lib/db.js';
import { createDrafts, KEEP_DAYS, NEEDS_DB, NO_TABLE } from '../api/_lib/drafts.js';
import { createDraftsHandler } from '../api/drafts.js';

/** A query function that records every call and answers from a script;
 *  an Error in the script is thrown instead of answered. */
function fakeQuery(answers = []) {
  const calls = [];
  const query = async (text, params = []) => {
    calls.push({ text, params });
    const next = answers.shift() ?? [];
    if (next instanceof Error) throw next;
    return next;
  };
  query.calls = calls;
  return query;
}

function fakeRes() {
  return {
    code: 0, body: null, headers: {},
    status(code) { this.code = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    end() { return this; },
  };
}

const NOW = Date.parse('2026-09-23T15:00:00.000Z');
const issue = (n = 2) => ({
  date: 'September 22, 2026',
  intro: 'Hello',
  sections: { events: { enabled: true, items: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, group: 'tamu', fields: { title: `E${i}` } })) } },
});
const store = (q, id = 'draft-1') => createDrafts(q, { now: () => NOW, newId: () => id });
const handlerOver = (q, mode = 'db') => createDraftsHandler({ mode: () => mode, drafts: () => store(q) });
const missingTable = () => Object.assign(new Error('relation "drafts" does not exist'), { code: '42P01' });

test('the schema step makes the drafts table, only when run by hand: ensureSchema, beside items', async () => {
  const q = fakeQuery();
  await createDb(q).ensureSchema();
  const make = q.calls.find(c => /CREATE TABLE IF NOT EXISTS drafts/.test(c.text));
  assert.ok(make, 'ensureSchema creates the drafts table');
  for (const col of ['id text PRIMARY KEY', 'issue_date text', 'discarded_at timestamptz', 'item_count integer', 'body jsonb']) {
    assert.ok(make.text.includes(col), `drafts has ${col}`);
  }
});

test('save keeps the whole draft as jsonb, with its issue date, the time and how many items it holds', async () => {
  const q = fakeQuery();
  const saved = await store(q).save({ issueDate: '2026-09-22', body: issue(3) });
  assert.deepEqual(saved, { id: 'draft-1', issueDate: '2026-09-22', discardedAt: '2026-09-23T15:00:00.000Z', items: 3 });
  const { text, params } = q.calls[0];
  assert.match(text, /INSERT INTO drafts \(id, issue_date, discarded_at, item_count, body\)/);
  assert.match(text, /\$5::jsonb/);
  assert.deepEqual(params.slice(0, 4), ['draft-1', '2026-09-22', '2026-09-23T15:00:00.000Z', 3]);
  assert.deepEqual(JSON.parse(params[4]), issue(3));
});

test(`list drops drafts older than ${KEEP_DAYS} days first, then answers newest first`, async () => {
  const q = fakeQuery([[], [
    { id: 'b', issue_date: '2026-10-06', discarded_at: new Date('2026-09-23T14:00:00Z'), item_count: 4 },
    { id: 'a', issue_date: '', discarded_at: '2026-09-01T09:30:00.000Z', item_count: '0' },
  ]]);
  const list = await store(q).list();
  assert.match(q.calls[0].text, /DELETE FROM drafts WHERE discarded_at < \$1/);
  assert.deepEqual(q.calls[0].params, ['2026-06-25T15:00:00.000Z']);   // 90 days before NOW
  assert.match(q.calls[1].text, /ORDER BY discarded_at DESC/);
  assert.doesNotMatch(q.calls[1].text, /body/, 'the list never ships the bodies');
  assert.deepEqual(list, [
    { id: 'b', issueDate: '2026-10-06', discardedAt: '2026-09-23T14:00:00.000Z', items: 4 },
    { id: 'a', issueDate: '', discardedAt: '2026-09-01T09:30:00.000Z', items: 0 },
  ]);
});

test('get hands back one draft with its body, parsed whether the driver gives an object or text; null when gone', async () => {
  const row = { id: 'a', issue_date: '2026-09-22', discarded_at: new Date(NOW), item_count: 2 };
  const asObject = await store(fakeQuery([[{ ...row, body: issue() }]])).get('a');
  assert.deepEqual(asObject.body, issue());
  assert.equal(asObject.items, 2);
  const q = fakeQuery([[{ ...row, body: JSON.stringify(issue()) }]]);
  assert.deepEqual((await store(q).get('a')).body, issue());
  assert.match(q.calls[0].text, /WHERE id = \$1/);
  assert.deepEqual(q.calls[0].params, ['a']);
  assert.equal(await store(fakeQuery([[]])).get('nope'), null);
});

test('remove deletes one by id and says how many went', async () => {
  const q = fakeQuery([[{ id: 'a' }]]);
  assert.equal(await store(q).remove('a'), 1);
  assert.match(q.calls[0].text, /DELETE FROM drafts WHERE id = \$1 RETURNING id/);
  assert.equal(await store(fakeQuery([[]])).remove('gone'), 0);
});

test('POST keeps a draft and answers with its list entry', async () => {
  const res = fakeRes();
  await handlerOver(fakeQuery())({ method: 'POST', headers: {}, body: { issueDate: '2026-09-22', draft: issue() } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, draft: { id: 'draft-1', issueDate: '2026-09-22', discardedAt: '2026-09-23T15:00:00.000Z', items: 2 } });
});

test('POST refuses what is not a draft, a date that is not ISO, and a draft too big to keep', async () => {
  for (const body of [{}, { draft: 'text' }, { draft: [] }, { draft: { date: 'x' } }, { draft: { sections: [] } }]) {
    const res = fakeRes();
    const q = fakeQuery();
    await handlerOver(q)({ method: 'POST', headers: {}, body }, res);
    assert.equal(res.code, 400, JSON.stringify(body));
    assert.equal(res.body.ok, false);
    assert.equal(q.calls.length, 0);
  }
  const badDate = fakeRes();
  await handlerOver(fakeQuery())({ method: 'POST', headers: {}, body: { issueDate: 'Sep 22', draft: issue() } }, badDate);
  assert.equal(badDate.code, 400);
  assert.match(badDate.body.error, /YYYY-MM-DD/);
  const huge = issue();
  huge.intro = 'x'.repeat(1024 * 1024 + 1);
  const tooBig = fakeRes();
  await handlerOver(fakeQuery())({ method: 'POST', headers: {}, body: { issueDate: '', draft: huge } }, tooBig);
  assert.equal(tooBig.code, 400);
  assert.match(tooBig.body.error, /too big/);
});

test('GET lists the kept drafts; GET with an id hands back that draft, or 404 once it is gone', async () => {
  const listed = fakeRes();
  await handlerOver(fakeQuery([[], [{ id: 'a', issue_date: '2026-09-22', discarded_at: new Date(NOW), item_count: 2 }]]))(
    { method: 'GET', headers: {}, query: {} }, listed);
  assert.equal(listed.code, 200);
  assert.deepEqual(listed.body, { ok: true, drafts: [{ id: 'a', issueDate: '2026-09-22', discardedAt: '2026-09-23T15:00:00.000Z', items: 2 }] });

  const one = fakeRes();
  await handlerOver(fakeQuery([[{ id: 'a', issue_date: '2026-09-22', discarded_at: new Date(NOW), item_count: 2, body: issue() }]]))(
    { method: 'GET', headers: {}, query: { id: 'a' } }, one);
  assert.equal(one.code, 200);
  assert.deepEqual(one.body.draft.body, issue());
  assert.equal(one.body.draft.id, 'a');

  const gone = fakeRes();
  await handlerOver(fakeQuery([[]]))({ method: 'GET', headers: {}, query: { id: 'a' } }, gone);
  assert.equal(gone.code, 404);
  assert.equal(gone.body.ok, false);
});

test('DELETE removes one by id; without an id it is refused', async () => {
  const res = fakeRes();
  await handlerOver(fakeQuery([[{ id: 'a' }]]))({ method: 'DELETE', headers: {}, query: { id: 'a' } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, removed: 1 });
  const bare = fakeRes();
  const q = fakeQuery();
  await handlerOver(q)({ method: 'DELETE', headers: {}, query: {} }, bare);
  assert.equal(bare.code, 400);
  assert.equal(q.calls.length, 0);
});

test('in Sheet mode every call says kept drafts need the database, and nothing is asked of any store', async () => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    const res = fakeRes();
    let asked = false;
    const handler = createDraftsHandler({ mode: () => 'sheet', drafts: () => { asked = true; return store(fakeQuery()); } });
    await handler({ method, headers: {}, query: { id: 'a' }, body: { issueDate: '', draft: issue() } }, res);
    assert.equal(res.code, 503, method);
    assert.deepEqual(res.body, { ok: false, error: NEEDS_DB });
    assert.equal(asked, false);
  }
  assert.match(NEEDS_DB, /^Kept drafts need the database/);
});

test('with the table missing every call says so plainly, and the API never makes the table itself', async () => {
  const requests = [
    { method: 'GET', headers: {}, query: {} },
    { method: 'GET', headers: {}, query: { id: 'a' } },
    { method: 'POST', headers: {}, body: { issueDate: '', draft: issue() } },
    { method: 'DELETE', headers: {}, query: { id: 'a' } },
  ];
  for (const req of requests) {
    const q = fakeQuery([missingTable(), missingTable()]);
    const res = fakeRes();
    await handlerOver(q)(req, res);
    assert.equal(res.code, 503, `${req.method} ${JSON.stringify(req.query ?? {})}`);
    assert.deepEqual(res.body, { ok: false, error: NO_TABLE });
    assert.ok(q.calls.every(c => !/CREATE|ALTER/i.test(c.text)), 'no call makes or changes a table');
  }
  assert.match(NO_TABLE, /^Kept drafts need the database/);
});

test('any other database failure is a plain 502, logged', async () => {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    const res = fakeRes();
    await handlerOver(fakeQuery([new Error('connection reset')]))({ method: 'GET', headers: {}, query: {} }, res);
    assert.equal(res.code, 502);
    assert.equal(res.body.ok, false);
    assert.doesNotMatch(res.body.error, /connection reset/, 'the raw error stays in the log');
  } finally {
    console.error = original;
  }
  assert.ok(errors.some(e => /connection reset/.test(e)));
});

test('the preflight is answered, and any other verb is refused', async () => {
  const pre = fakeRes();
  await handlerOver(fakeQuery())({ method: 'OPTIONS', headers: { origin: 'http://localhost:4173' } }, pre);
  assert.equal(pre.code, 204);
  assert.equal(pre.headers['Access-Control-Allow-Methods'], 'GET, POST, DELETE');
  const put = fakeRes();
  await handlerOver(fakeQuery())({ method: 'PUT', headers: {} }, put);
  assert.equal(put.code, 405);
});
