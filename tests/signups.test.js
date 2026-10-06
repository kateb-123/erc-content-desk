import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../api/_lib/db.js';
import { createSignups, SIGNUPS_SCHEMA, isMissingSignups } from '../api/_lib/signups.js';

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
delete process.env.TURNSTILE_SECRET_KEY;
const { createListservHandler } = await import('../api/listserv.js');

// Kate's drawn map (Oct 6, 2026): the Listserv hub counts who waits to be
// added. Every sign-up already passes through the desk on its way to her
// sheet, so the desk keeps a copy (her pick); the open page and this
// endpoint's answer carry counts and dates only, never a name or an email.

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
const NOW = Date.parse('2026-10-07T15:00:00.000Z');
const SAME_ORIGIN = { host: 'erc-content-desk.vercel.app', origin: 'https://erc-content-desk.vercel.app' };
const store = q => createSignups(q, { now: () => NOW, newId: () => 'su-1' });
const missing = () => Object.assign(new Error('relation "signups" does not exist'), { code: '42P01' });

test('the signups table is made by ensureSchema, by hand, beside the others', async () => {
  const q = fakeQuery();
  await createDb(q).ensureSchema();
  assert.ok(q.calls.some(c => c.text === SIGNUPS_SCHEMA));
  assert.match(SIGNUPS_SCHEMA, /CREATE TABLE IF NOT EXISTS signups/);
  assert.match(SIGNUPS_SCHEMA, /added_at timestamptz/);
});

test('keep: one row, trimmed, stamped now, not yet added', async () => {
  const q = fakeQuery();
  await store(q).keep({ name: ' Reveille IX ', email: ' rev@example.org ' });
  assert.match(q.calls[0].text, /INSERT INTO signups/);
  assert.deepEqual(q.calls[0].params, ['su-1', 'Reveille IX', 'rev@example.org', '2026-10-07T15:00:00.000Z']);
});

test('summary: how many wait, the last sign-up and the first kept, as College Station dates', async () => {
  const q = fakeQuery([[{ waiting: 4, last: new Date('2026-10-05T02:00:00Z'), since: '2026-09-30T18:00:00Z' }]]);
  assert.deepEqual(await store(q).summary(), { waiting: 4, last: '2026-10-04', since: '2026-09-30' });
  assert.match(q.calls[0].text, /added_at IS NULL/);
  assert.doesNotMatch(q.calls[0].text, /\bname\b|\bemail\b/, 'the count never reads a name or an email');
  const none = fakeQuery([[{ waiting: 0, last: null, since: null }]]);
  assert.deepEqual(await store(none).summary(), { waiting: 0, last: '', since: '' });
});

test('isMissingSignups knows the missing table by its code or its words', () => {
  assert.equal(isMissingSignups(missing()), true);
  assert.equal(isMissingSignups(new Error('relation "signups" does not exist')), true);
  assert.equal(isMissingSignups(new Error('timeout')), false);
});

const handlerOver = (q, { mode = 'db', url = 'https://script.example/exec' } = {}) =>
  createListservHandler({ env: () => ({ LISTSERV_URL: url }), mode: () => mode, signups: () => store(q) });

test('GET answers the count and dates, never a name or an email', async () => {
  const q = fakeQuery([[{ waiting: 3, last: '2026-10-04T15:00:00Z', since: '2026-10-01T15:00:00Z' }]]);
  const res = fakeRes();
  await handlerOver(q)({ method: 'GET', headers: SAME_ORIGIN }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, live: true, kept: true, waiting: 3, last: '2026-10-04', since: '2026-10-01' });
});

test('GET before the table is made, or on the Sheet, says the desk keeps no copy yet', async () => {
  for (const [q, mode] of [[fakeQuery([missing()]), 'db'], [fakeQuery(), 'sheet']]) {
    const res = fakeRes();
    await handlerOver(q, { mode })({ method: 'GET', headers: SAME_ORIGIN }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { ok: true, live: true, kept: false, waiting: null, last: '', since: '' });
  }
  const off = fakeRes();
  await handlerOver(fakeQuery([[{ waiting: 0 }]]), { url: '' })({ method: 'GET', headers: SAME_ORIGIN }, off);
  assert.equal(off.body.live, false, 'no LISTSERV_URL: the form is not set up');
});

test('a good sign-up is forwarded, then a copy is kept; a refused one keeps nothing; a failed copy never fails it', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, status: 200 });
    const q = fakeQuery();
    const res = fakeRes();
    await handlerOver(q)({ method: 'POST', headers: SAME_ORIGIN, body: { name: 'Reveille IX', email: 'rev@example.org' } }, res);
    assert.equal(res.body.ok, true);
    assert.equal(q.calls.length, 1, 'one copy kept');

    globalThis.fetch = async () => ({ ok: false, status: 500 });
    const q2 = fakeQuery();
    const res2 = fakeRes();
    await handlerOver(q2)({ method: 'POST', headers: SAME_ORIGIN, body: { name: 'A', email: 'a@b.edu' } }, res2);
    assert.equal(res2.code, 502);
    assert.equal(q2.calls.length, 0, 'not on the list, so not kept');

    globalThis.fetch = async () => ({ ok: true, status: 200 });
    const res3 = fakeRes();
    const realError = console.error; console.error = () => {};
    try { await handlerOver(fakeQuery([missing()]))({ method: 'POST', headers: SAME_ORIGIN, body: { name: 'A', email: 'a@b.edu' } }, res3); }
    finally { console.error = realError; }
    assert.equal(res3.code, 200);
    assert.equal(res3.body.ok, true, 'the sign-up stands; the copy is the desk\'s own business');
  } finally { globalThis.fetch = real; }
});

// Review, Oct 6: the copy runs after the script took the sign-up, inside the
// function's 30 seconds; a stalled database must never turn that into a
// failure the visitor sees and retries.
test('a copy that hangs is given up after a moment, and the sign-up still answers ok', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  const realError = console.error; console.error = () => {};
  try {
    const hangs = { keep: () => new Promise(() => {}), summary: async () => ({}) };
    const handler = createListservHandler({ env: () => ({ LISTSERV_URL: 'https://script.example/exec' }), mode: () => 'db', signups: () => hangs, copyTimeoutMs: 20 });
    const res = fakeRes();
    const started = Date.now();
    await handler({ method: 'POST', headers: SAME_ORIGIN, body: { name: 'A', email: 'a@b.edu' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Date.now() - started < 1000, 'it did not wait on the database');
  } finally { globalThis.fetch = real; console.error = realError; }
});
