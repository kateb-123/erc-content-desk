import test from 'node:test';
import assert from 'node:assert/strict';
import { readReply } from '../js/sheet-client.js';

// A fetch Response stand-in: json() throws when the body is not JSON (a
// Vercel timeout page, a proxy error), which is what reached the status bar
// as "Unexpected token '<'" (design audit finding 15, Sep 15).
const reply = (status, body) => ({
  ok: status < 400,
  status,
  json: async () => { if (body === undefined) throw new SyntaxError("Unexpected token '<'"); return body; },
});

test('readReply hands back the data when the server said ok', async () => {
  assert.deepEqual(await readReply(reply(200, { ok: true, n: 1 }), 'publish'), { ok: true, n: 1 });
});

test('readReply turns a non-JSON page into a sentence, not a parser error', async () => {
  await assert.rejects(readReply(reply(504), 'check the Exchange'),
    { message: "The desk couldn't check the Exchange right now (server error 504). Try again in a minute." });
});

test("readReply keeps the server's own sentence when it gave one", async () => {
  await assert.rejects(readReply(reply(400, { ok: false, error: 'Nothing to publish.' }), 'publish'),
    { message: 'Nothing to publish.' });
});

test('readReply names the failure in plain words when the server gave only a status', async () => {
  await assert.rejects(readReply(reply(500, { ok: false }), 'rewrite the descriptions'),
    { message: "The desk couldn't rewrite the descriptions right now (server error 500). Try again in a minute." });
});
