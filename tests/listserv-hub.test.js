import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listservStatus } from '../js/listserv-view.js';

// The Listserv hub (Kate's drawn map, Oct 6, 2026): whether the sign-up form
// is live, the last sign-up, how many wait to be added. Counts and dates
// only: the page is open (her pick, Sort alone is locked).

// Since Oct 8 (Kate: "does it keep a live count from the sheet?", her pick)
// the count is Sheet 1's own row count, asked of the sign-up sheet's script
// as the page opens; the desk's copy still gives the last sign-up.
test('listservStatus: live, the last sign-up, and Sheet 1\'s rows right now', () => {
  assert.deepEqual(listservStatus({ live: true, kept: true, sheet: true, waiting: 4, last: '2026-10-04', since: '2026-10-01' }, '2026-10-07'), {
    form: 'Live, taking sign-ups', last: 'Oct 4', waiting: 4, note: 'Rows on Sheet 1, counted as this page opened.', retry: false, updated: '',
  });
  // Her note, Oct 8: the day Sheet 1 was seen cleared is the day the listserv was last updated.
  assert.equal(listservStatus({ live: true, kept: true, sheet: true, waiting: 0, last: '2026-10-06', since: '', updated: '2026-10-08' }, '2026-10-08').updated, 'Oct 8');
});

test('listservStatus: a form not set up, a copy not set up, a sheet that could not be counted, still asking', () => {
  assert.deepEqual(listservStatus({ live: true, kept: true, sheet: true, waiting: 0, last: '', since: '' }, '2026-10-07'),
    { form: 'Live, taking sign-ups', last: 'None yet', waiting: 0, note: 'Rows on Sheet 1, counted as this page opened.', retry: false, updated: '' });
  assert.equal(listservStatus({ live: false, kept: true, sheet: false, waiting: null, last: '', since: '' }, '2026-10-07').form, 'Not set up');
  assert.deepEqual(listservStatus({ live: true, kept: false, sheet: true, waiting: 2, last: '', since: '' }, '2026-10-07'),
    { form: 'Live, taking sign-ups', last: 'Not known', waiting: 2, note: 'Rows on Sheet 1, counted as this page opened.', retry: false, updated: '' }, 'the count needs no desk table');
  assert.deepEqual(listservStatus({ live: true, kept: true, sheet: false, waiting: null, last: '2026-10-06', since: '' }, '2026-10-07'),
    { form: 'Live, taking sign-ups', last: 'Oct 6', waiting: null, note: "Sheet 1 couldn't be counted just now.", retry: true, updated: '' });
  assert.deepEqual(listservStatus(null, '2026-10-07'), { form: 'Checking', last: '', waiting: null, note: '', retry: false, updated: '' });
});

test('the page draws the count\'s note and its Try again from the status', () => {
  const src = readFileSync(new URL('../js/listserv-ui.js', import.meta.url), 'utf8');
  assert.match(src, /s\.note/);
  assert.match(src, /s\.retry/);
  assert.match(src, /Last updated \$\{s\.updated\}/, 'the day the listserv was last updated');
  assert.doesNotMatch(src, /s\.since/, 'the old since line is gone');
});

test('the page draws counts and dates only, and the download is forthcoming', () => {
  const src = readFileSync(new URL('../js/listserv-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\.email\b|\.name\b/, 'never a name or an email');
  assert.match(src, /forthcoming\(["']Download the sign-ups in the listserv.s format["']\)/);
  assert.match(src, /copyLinkButton\(/, 'the form\'s Copy link');
});

// The sign-up sheet (Kate, Oct 8: "we need a button or something that links
// to the google sheet ... they should add people from sheet 1. once they do,
// move the items from sheet 1 to sheet 2 and then clear off sheet 1"). The
// address lives in the code (her pick); the sheet's own sharing guards it.
import { SIGNUP_SHEET, SHEET_STEPS } from '../js/listserv-view.js';
import { hubCards } from '../js/home-panel.js';

test('the sign-up sheet: her address, and the three steps in her order', () => {
  assert.deepEqual(SIGNUP_SHEET, { label: 'Sign-up sheet', href: 'https://docs.google.com/spreadsheets/d/1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E/edit?gid=0#gid=0' });
  assert.deepEqual(SHEET_STEPS, [
    'Add the people on Sheet 1 to the listserv.',
    'Move their rows from Sheet 1 to Sheet 2.',
    'Clear Sheet 1.',
  ]);
  for (const s of SHEET_STEPS) assert.doesNotMatch(s, /[–—]/);
});

test('the Listserv hub has a door to the sheet, opening in a new tab, with the steps under it', () => {
  const src = readFileSync(new URL('../js/listserv-ui.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ listservStatus, SIGNUP_SHEET, SHEET_STEPS \} from '\.\/listserv-view\.js';/);
  assert.match(src, /el\('a', 'sort-door hub-door'\)/, 'the hub\'s filled door');
  assert.match(src, /door\.href = SIGNUP_SHEET\.href; door\.target = '_blank'; door\.rel = 'noopener';/);
  assert.match(src, /'Open the sign-up sheet'/);
  assert.match(src, /SHEET_STEPS\.map\(words => el\('li', '', words\)\)/, 'an ordered list of the steps');
  assert.match(src, /'Adding people'/, 'the section label');
});

test('the Listserv card carries the sheet as a link, opening in a new tab', () => {
  const card = hubCards({ rows: [], schedule: [], today: '2026-10-08', loaded: true, signups: { live: true, kept: true, sheet: true, waiting: 0, last: '', since: '' } }).find(c => c.key === 'listserv');
  assert.deepEqual(card.links, [{ label: 'Sign-up sheet', href: SIGNUP_SHEET.href, blank: true }]);
  assert.equal(card.count, 0);
  const uncounted = hubCards({ rows: [], schedule: [], today: '2026-10-08', loaded: true, signups: { live: true, kept: true, sheet: false, waiting: null, last: '', since: '' } }).find(c => c.key === 'listserv');
  assert.equal(uncounted.count, null, 'a sheet that could not be counted leaves the card blank');
});

test('the desk keeps the whole listserv answer, sheet and updated included, so the page can draw them', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /state\.signups = \{ live: data\.live, kept: data\.kept, sheet: data\.sheet, waiting: data\.waiting, last: data\.last, since: data\.since, updated: data\.updated \};/);
});
