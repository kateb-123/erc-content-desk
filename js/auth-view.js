/**
 * The sign-in (Kate, Sep 23; since her drawn map of Oct 6, Content Sort
 * alone): the locked screens ask for the desk password. Pure rules, so node --test can hold them; the
 * screen (auth-ui.js) draws what these say.
 */

/** The screens behind the password. Kate, Sep 30: "turn off the password";
 *  then her drawn map (Oct 6): Sort is "password protected (Kate only)", and
 *  only Sort, with Finalize, its tab. Everything else opens to anyone; the
 *  password lives on at Publish's Confirm, the one write to the public site. */
export const LOCKED_SCREENS = new Set(['sort', 'finalize']);

/** Whether any page asks for a sign-in at all. */
export const SIGN_IN_ON = LOCKED_SCREENS.size > 0;

export function isLocked(screen) {
  return LOCKED_SCREENS.has(screen);
}

const PAGE_OF = { sort: 'Content Sort', finalize: 'Content Sort', publish: 'Policy Exchange' };

/** The one line over the field: which page the sign-in opens. */
export function signInLine(screen) {
  return `Sign in to open ${PAGE_OF[screen] ?? 'the desk'}.`;
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
