import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listservStatus } from '../js/listserv-view.js';

// The Listserv hub (Kate's drawn map, Oct 6, 2026): whether the sign-up form
// is live, the last sign-up, how many wait to be added. Counts and dates
// only: the page is open (her pick, Sort alone is locked).

test('listservStatus: live, the last sign-up, and how many wait since the desk began keeping a copy', () => {
  assert.deepEqual(listservStatus({ live: true, kept: true, waiting: 4, last: '2026-10-04', since: '2026-10-01' }, '2026-10-07'), {
    form: 'Live, taking sign-ups', last: 'Oct 4', waiting: 4, since: 'Counted since Oct 1, when the desk began keeping a copy.',
  });
});

test('listservStatus: no sign-ups yet, a form not set up, the copy not set up, still asking', () => {
  assert.deepEqual(listservStatus({ live: true, kept: true, waiting: 0, last: '', since: '' }, '2026-10-07'),
    { form: 'Live, taking sign-ups', last: 'None yet', waiting: 0, since: '' });
  assert.equal(listservStatus({ live: false, kept: true, waiting: 0, last: '', since: '' }, '2026-10-07').form, 'Not set up');
  assert.deepEqual(listservStatus({ live: true, kept: false, waiting: null, last: '', since: '' }, '2026-10-07'),
    { form: 'Live, taking sign-ups', last: 'Not known', waiting: null, since: 'The desk starts counting once its sign-up table is set up.' });
  assert.deepEqual(listservStatus(null, '2026-10-07'), { form: 'Checking', last: '', waiting: null, since: '' });
});

test('the page draws counts and dates only, and the download is forthcoming', () => {
  const src = readFileSync(new URL('../js/listserv-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\.email\b|\.name\b/, 'never a name or an email');
  assert.match(src, /forthcoming\(["']Download the sign-ups in the listserv.s format["']\)/);
  assert.match(src, /copyLinkButton\(/, 'the form\'s Copy link');
});
