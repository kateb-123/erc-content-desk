import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCKED_SCREENS, SIGN_IN_FIRST, WRONG_PASSWORD, isLocked, signInLine, authError, lockedOut } from '../js/auth-view.js';
import { SIGN_IN_FIRST as SERVER_SIGN_IN_FIRST, WRONG as SERVER_WRONG } from '../api/_lib/session.js';

test('the page and the server use the same two sentences, so the page can act on them', () => {
  assert.equal(SIGN_IN_FIRST, SERVER_SIGN_IN_FIRST);
  assert.equal(WRONG_PASSWORD, SERVER_WRONG);
  assert.equal(lockedOut({ status: 401 }), true);
  assert.equal(lockedOut(new Error(SIGN_IN_FIRST)), true);
  assert.equal(lockedOut(new Error(WRONG_PASSWORD)), false);
  assert.equal(lockedOut(null), false);
});

// Kate, Sep 23: the front page, Content Sort (both tabs) and Publish are
// hers; the team's page and the Newsletter stay open to the team.

test('the locked screens are the front page, Sort, Finalize and Publish; the team page and the newsletter are open', () => {
  assert.deepEqual([...LOCKED_SCREENS].sort(), ['finalize', 'home', 'publish', 'sort']);
  for (const s of ['home', 'sort', 'finalize', 'publish']) assert.equal(isLocked(s), true, s);
  for (const s of ['team', 'issue', 'schedule', 'past', 'builder']) assert.equal(isLocked(s), false, s);
});

test('the sign-in names the page it opens', () => {
  assert.equal(signInLine('sort'), 'Sign in to open Content Sort.');
  assert.equal(signInLine('finalize'), 'Sign in to open Content Sort.');
  assert.equal(signInLine('publish'), 'Sign in to open Policy Exchange.');
  assert.equal(signInLine('home'), 'Sign in to open the desk.');
});

test('a refused sign-in reads as one plain sentence', () => {
  assert.equal(authError({ status: 403 }), "That's not the password.");
  assert.equal(authError({ status: 400 }), 'Type the password.');
  assert.equal(authError({ status: 503, error: 'The desk password is not set up yet. Add DESK_PASSWORD on Vercel.' }), 'The desk password is not set up yet. Add DESK_PASSWORD on Vercel.');
  assert.equal(authError(new TypeError('fetch failed')), "Couldn't reach the server. Check your connection.");
});
