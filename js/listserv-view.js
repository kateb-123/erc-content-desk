/**
 * The Listserv hub's words (Kate's drawn map, Oct 6, 2026), pure so node
 * --test can hold them. `signups` is /api/listserv's answer: { live, kept,
 * waiting, last, since }, counts and dates only; null while it is asked.
 */
import { isoToShort } from './queue-view.js';

export function listservStatus(signups, today) {
  if (!signups) return { form: 'Checking', last: '', waiting: null, since: '' };
  if (signups.error) return { form: "Couldn't check just now", last: '', waiting: null, since: '' };
  const form = signups.live ? 'Live, taking sign-ups' : 'Not set up';
  if (!signups.kept) return { form, last: 'Not known', waiting: null, since: 'The desk starts counting once its sign-up table is set up.' };
  return {
    form,
    last: signups.last ? isoToShort(signups.last, today) : 'None yet',
    waiting: signups.waiting,
    since: signups.since ? `Counted since ${isoToShort(signups.since, today)}, when the desk began keeping a copy.` : '',
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
