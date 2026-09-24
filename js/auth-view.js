/**
 * The sign-in (Kate, Sep 23): the front page, Content Sort and Publish are
 * hers, so they ask for the desk password; the team's page and the
 * Newsletter stay open. Pure rules, so node --test can hold them; the
 * screen (auth-ui.js) draws what these say.
 */
import { LANES } from './shell-view.js';

/** The screens behind the password. Finalize is a tab of Content Sort. */
export const LOCKED_SCREENS = new Set(['home', 'sort', 'finalize', 'publish']);

export function isLocked(screen) {
  return LOCKED_SCREENS.has(screen);
}

const LANE_OF = { sort: 'sort', finalize: 'sort', publish: 'exchange' };

/** The one line over the field: which page the sign-in opens. */
export function signInLine(screen) {
  const lane = LANES.find(l => l.key === LANE_OF[screen]);
  return `Sign in to open ${lane ? lane.label : 'the desk'}.`;
}

/** The server's two sentences, word for word (api/_lib/session.js; a test
 *  holds the two files to the same words): the page acts on them. */
export const SIGN_IN_FIRST = 'Sign in to the desk first.';
export const WRONG_PASSWORD = "That's not the password.";

/** A refusal that means the session is gone: the page shows the sign-in. */
export function lockedOut(err) {
  return err?.status === 401 || err?.message === SIGN_IN_FIRST;
}

/** The sentence for a refused sign-in: the server's own where it gave one,
 *  a dropped connection its own, and the bare status otherwise. */
export function authError(err) {
  if (err instanceof TypeError) return "Couldn't reach the server. Check your connection.";
  if (err?.error) return err.error;
  if (err?.status === 403) return "That's not the password.";
  if (err?.status === 400) return 'Type the password.';
  return err?.message || "The desk couldn't sign you in right now. Try again in a minute.";
}
