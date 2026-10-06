import test from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, COOKIE, SIGN_IN_FIRST } from '../api/_lib/session.js';

// Kate's drawn map (Oct 6): Content Sort is behind the desk password again,
// so the model call it makes (the Finalize rewrite) asks for the sign-in
// too, as it did from Sep 23 to 30. The Exchange card's words stay open:
// Publish, which asks for them, is an open page.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.DESK_PASSWORD = 'gig-em-test';
delete process.env.DATABASE_URL;
delete process.env.SHEET_API_URL;
const { default: rewrite } = await import('../api/rewrite.js');

function fakeRes() {
  return {
    code: 0, body: null,
    status(c) { this.code = c; return this; },
    json(o) { this.body = o; return this; },
  };
}
const quiet = async fn => { const e = console.error; console.error = () => {}; try { await fn(); } finally { console.error = e; } };

test('the Finalize rewrite refuses a browser that is not signed in', async () => {
  const res = fakeRes();
  await rewrite({ method: 'POST', headers: {}, body: { ids: ['a'] } }, res);
  assert.equal(res.code, 401);
  assert.equal(res.body.error, SIGN_IN_FIRST);
  const none = fakeRes();
  await rewrite({ method: 'POST', headers: {}, body: {} }, none);
  assert.equal(none.code, 401, 'nor a body with no ids at all');
});

test('signed in, the rewrite goes on to the rows; the card words never ask', async () => {
  const token = await issueToken('gig-em-test');
  const signed = fakeRes();
  await quiet(() => rewrite({ method: 'POST', headers: { cookie: `${COOKIE}=${token}` }, body: { ids: ['a'] } }, signed));
  assert.notEqual(signed.code, 401);
  const card = fakeRes();
  await quiet(() => rewrite({ method: 'POST', headers: {}, body: { card: ['https://example.org/aggie/gig-em-grants'] } }, card));
  assert.notEqual(card.code, 401);
});
