/**
 * The Listserv hub's words (Kate's drawn map, Oct 6, 2026), pure so node
 * --test can hold them. `signups` is /api/listserv's answer: { live, kept,
 * waiting, last, since }, counts and dates only; null while it is asked.
 */
import { isoToShort } from './queue-view.js';

/**
 * Since Oct 8 (Kate: "does it keep a live count from the sheet?"; her pick)
 * the count is Sheet 1's own row count, read as the page opens (`sheet` says
 * whether the script answered); the desk's copy gives the last sign-up, and
 * `updated` the day the listserv was last updated, the day Sheet 1 was seen
 * cleared. `retry` says the page should offer Try again.
 */
export function listservStatus(signups, today) {
  if (!signups) return { form: 'Checking', last: '', waiting: null, note: '', retry: false, updated: '' };
  if (signups.error) return { form: "Couldn't check just now", last: '', waiting: null, note: '', retry: true, updated: '' };
  const form = signups.live ? 'Live, taking sign-ups' : 'Not set up';
  const counted = signups.sheet === true && Number.isFinite(signups.waiting);
  return {
    form,
    last: !signups.kept ? 'Not known' : signups.last ? isoToShort(signups.last, today) : 'None yet',
    waiting: counted ? signups.waiting : null,
    note: counted ? 'Rows on Sheet 1, counted as this page opened.' : signups.live ? "Sheet 1 couldn't be counted just now." : '',
    retry: Boolean(signups.live) && !counted,
    updated: signups.updated ? isoToShort(signups.updated, today) : '',
  };
}

/** The sign-up sheet (Kate, Oct 8): where the sign-ups land, and where the
 *  people to add are read from. The address sits in the code (her pick); the
 *  sheet's own sharing guards the names and addresses, never this page. */
export const SIGNUP_SHEET = { label: 'Sign-up sheet', href: 'https://docs.google.com/spreadsheets/d/1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E/edit?gid=0#gid=0' };

/** Adding people, in her words: Sheet 1 holds the new sign-ups, Sheet 2 the added. */
export const SHEET_STEPS = [
  'Add the people on Sheet 1 to the listserv.',
  'Move their rows from Sheet 1 to Sheet 2.',
  'Clear Sheet 1.',
];
