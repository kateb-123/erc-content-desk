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

test('summary: how many wait, the last sign-up, the first kept and the last added, as College Station dates', async () => {
  const q = fakeQuery([[{ waiting: 4, last: new Date('2026-10-05T02:00:00Z'), since: '2026-09-30T18:00:00Z', updated: '2026-10-08T16:00:00Z' }]]);
  assert.deepEqual(await store(q).summary(), { waiting: 4, last: '2026-10-04', since: '2026-09-30', updated: '2026-10-08' });
  assert.match(q.calls[0].text, /added_at IS NULL/);
  assert.match(q.calls[0].text, /max\(added_at\) AS updated/);
  assert.doesNotMatch(q.calls[0].text, /\bname\b|\bemail\b/, 'the count never reads a name or an email');
  const none = fakeQuery([[{ waiting: 0, last: null, since: null, updated: null }]]);
  assert.deepEqual(await store(none).summary(), { waiting: 0, last: '', since: '', updated: '' });
});

// Kate, Oct 8: "when the sheet 1 goes from a count to 0 that means it was
// updated. so it needs to log the date it was last updated." Sheet 1 holds
// the newest N sign-ups, so every kept row older than those N has been
// added: markAdded stamps them with the day the desk noticed.
test('markAdded: every waiting row but the newest N is stamped added now', async () => {
  const q = fakeQuery();
  await store(q).markAdded(2);
  assert.equal(q.calls.length, 1);
  assert.match(q.calls[0].text, /UPDATE signups SET added_at = \$2 WHERE added_at IS NULL/);
  assert.match(q.calls[0].text, /ORDER BY signed_up_at DESC LIMIT \$1/, 'the newest N stay waiting');
  assert.deepEqual(q.calls[0].params, [2, '2026-10-07T15:00:00.000Z']);
});

test('isMissingSignups knows the missing table by its code or its words', () => {
  assert.equal(isMissingSignups(missing()), true);
  assert.equal(isMissingSignups(new Error('relation "signups" does not exist')), true);
  assert.equal(isMissingSignups(new Error('timeout')), false);
});

const handlerOver = (q, { mode = 'db', url = 'https://script.example/exec' } = {}) =>
  createListservHandler({ env: () => ({ LISTSERV_URL: url }), mode: () => mode, signups: () => store(q) });

// Since Oct 8 (Kate's pick: "Count Sheet 1 live") GET asks the sign-up
// sheet's script for Sheet 1's rows (?action=count); the desk's copy still
// gives the last sign-up. The count comes from the script alone, never from
// the desk's table, which drifts once rows move to Sheet 2.
const jsonReply = body => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
async function withFetch(reply, fn) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); if (reply instanceof Error) throw reply; return reply; };
  try { await fn(); } finally { globalThis.fetch = real; }
  return calls;
}

test('GET asks the script for Sheet 1\'s rows and answers the count, the last sign-up, never a name or an email', async () => {
  const q = fakeQuery([[], [{ waiting: 3, last: '2026-10-04T15:00:00Z', since: '2026-10-01T15:00:00Z', updated: null }]]);
  const res = fakeRes();
  const calls = await withFetch(jsonReply({ ok: true, waiting: 7 }), () => handlerOver(q)({ method: 'GET', headers: SAME_ORIGIN }, res));
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, live: true, kept: true, sheet: true, waiting: 7, last: '2026-10-04', since: '2026-10-01', updated: '' }, 'the sheet\'s 7, not the table\'s 3');
  assert.equal(calls.length, 1);
  assert.match(q.calls[0].text, /UPDATE signups SET added_at/, 'the rows beyond the newest 7 are stamped added before the summary');
  assert.equal(q.calls[0].params[0], 7);
  assert.match(q.calls[1].text, /SELECT count/);
  assert.equal(calls[0].url, 'https://script.example/exec?action=count');
  assert.equal(calls[0].init?.method ?? 'GET', 'GET');
});

test('a script that fails, stalls or answers no number leaves the count blank, and says so with sheet: false', async () => {
  const q = () => fakeQuery([[{ waiting: 3, last: '2026-10-04T15:00:00Z', since: '2026-10-01T15:00:00Z', updated: '2026-10-06T16:00:00Z' }]]);
  for (const reply of [new Error('timed out'), { ok: false, status: 500, text: async () => 'oops' }, jsonReply({ ok: true }), jsonReply({ ok: true, waiting: 'many' }), { ok: true, status: 200, text: async () => '<html>sign in</html>' }]) {
    const res = fakeRes();
    await withFetch(reply, () => handlerOver(q())({ method: 'GET', headers: SAME_ORIGIN }, res));
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { ok: true, live: true, kept: true, sheet: false, waiting: null, last: '2026-10-04', since: '2026-10-01', updated: '2026-10-06' });
  }
});

test('a sheet that could not be counted marks nothing added', async () => {
  const q = fakeQuery([[{ waiting: 3, last: null, since: null, updated: null }]]);
  await withFetch(new Error('down'), () => handlerOver(q)({ method: 'GET', headers: SAME_ORIGIN }, fakeRes()));
  assert.ok(q.calls.every(c => !/UPDATE/.test(c.text)));
});

test('the count going to 0 stamps every waiting row, and the day shows as updated', async () => {
  const q = fakeQuery([[], [{ waiting: 0, last: '2026-10-06T15:00:00Z', since: '2026-10-01T15:00:00Z', updated: '2026-10-08T16:00:00Z' }]]);
  const res = fakeRes();
  await withFetch(jsonReply({ ok: true, waiting: 0 }), () => handlerOver(q)({ method: 'GET', headers: SAME_ORIGIN }, res));
  assert.equal(q.calls[0].params[0], 0, 'keep none waiting');
  assert.equal(res.body.updated, '2026-10-08');
  assert.equal(res.body.waiting, 0);
});

test('GET before the table is made, or on the Sheet, still counts the sheet and keeps no copy', async () => {
  for (const [q, mode] of [[fakeQuery([missing()]), 'db'], [fakeQuery(), 'sheet']]) {
    const res = fakeRes();
    await withFetch(jsonReply({ ok: true, waiting: 2 }), () => handlerOver(q, { mode })({ method: 'GET', headers: SAME_ORIGIN }, res));
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { ok: true, live: true, kept: false, sheet: true, waiting: 2, last: '', since: '', updated: '' });
  }
  const off = fakeRes();
  const calls = await withFetch(jsonReply({ ok: true, waiting: 2 }), () => handlerOver(fakeQuery([[{ waiting: 0 }]]), { url: '' })({ method: 'GET', headers: SAME_ORIGIN }, off));
  assert.equal(off.body.live, false, 'no LISTSERV_URL: the form is not set up');
  assert.deepEqual([off.body.sheet, off.body.waiting, calls.length], [false, null, 0], 'and nothing is asked');
});

test('the script snippet for the sign-up sheet answers ?action=count with Sheet 1\'s rows', async () => {
  const { readFileSync } = await import('node:fs');
  const gs = readFileSync(new URL('../apps-script/listserv-count.gs', import.meta.url), 'utf8');
  assert.match(gs, /e\.parameter\.action === 'count'/);
  assert.match(gs, /getSheets\(\)\[0\]/, 'the first tab, Sheet 1');
  assert.match(gs, /waiting: waitingCount\(\)/);
  assert.doesNotMatch(gs, /[\u2013\u2014]/);
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
