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
