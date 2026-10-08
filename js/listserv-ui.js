/**
 * The Listserv hub (Kate's drawn map, Oct 6, 2026): the sign-up form's
 * status and its link, the last sign-up, and how many wait to be added to
 * the listserv. Counts and dates only: the page is open, so the sign-ups'
 * names and addresses stay in the desk's table and her sheet. Since Oct 8
 * (Kate) the count is Sheet 1's own, a door opens the sign-up sheet with the
 * three steps for adding people under it, and the day Sheet 1 was seen
 * cleared shows as when the listserv was last updated. The download in the
 * listserv's format her map marked forthcoming was dropped (Kate, Oct 8):
 * Sheet 1 is the list to add from.
 */
import { listservStatus, SIGNUP_SHEET, SHEET_STEPS } from './listserv-view.js';
import { PUBLIC_LINKS, copyLinkButton } from './public-links.js';
import { hubHead, HUB_LEDES } from './hub-head.js';
import { faIcon } from './icons.js';
import { el, button, focusKeyIn, restoreFocus } from './ui-aids.js';

const FORM = PUBLIC_LINKS.find(l => l.key === 'listserv');

function stat(label, ...value) {
  const row = el('div', 'hub-stat');
  const v = el('span', 'hub-stat-v');
  v.append(...value);
  row.append(el('span', 'hub-stat-k', label), v);
  return row;
}

export function renderListserv(container, { signups, today, onRetry }) {
  const focusKey = focusKeyIn(container);   // a late load redraws the page; the keyboard keeps its place
  // Copy link keeps its node, so a Copied it just said survives the redraw.
  const copy = container.querySelector('.ql-copy') ?? copyLinkButton(FORM);
  const s = listservStatus(signups, today);
  const open = el('a', 'hub-link', 'Open it');
  open.href = FORM.href; open.target = '_blank'; open.rel = 'noopener';
  open.dataset.focus = 'form';
  open.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
  const formBox = el('div', 'hub-box');
  const status = el('span', s.form.startsWith('Live') ? 'hub-ok' : 'hub-quiet', s.form);
  // A check or a count that failed says so, with its way to try again (review, Oct 6).
  const retry = s.retry && onRetry
    ? [' ', button('Try again', 'linkish', { focus: 'retry', onClick: () => { retry[1].disabled = true; onRetry(); } })]
    : [];
  formBox.append(
    stat('Status', status, ...(signups?.error ? retry : [])),
    stat('Last sign-up', s.last),
    stat('The form', open, ' · ', copy),
  );
  // Sheet 1's rows right now, and the day the listserv was last updated (Kate, Oct 8).
  const countBox = el('div', 'hub-box hub-count');
  countBox.append(el('span', 'hub-numeral', s.waiting == null ? '' : String(s.waiting)));
  if (s.note) { const note = el('p', 'hub-count-note', s.note); if (!signups?.error) note.append(...retry); countBox.append(note); }
  if (s.updated) countBox.append(el('p', 'hub-count-note', `Last updated ${s.updated}.`));

  // Adding people (Kate, Oct 8): the sheet's door, then her three steps.
  const door = el('a', 'sort-door hub-door');
  door.href = SIGNUP_SHEET.href; door.target = '_blank'; door.rel = 'noopener';
  door.dataset.focus = 'sheet';
  const doorWords = el('span', 'door-words');
  doorWords.append(el('span', 'door-name', 'Open the sign-up sheet'), el('span', 'sr-only', ' (opens in a new tab)'));
  door.append(faIcon('table'), doorWords, faIcon('arrow-up-right-from-square'));
  const steps = el('ol', 'hub-steps');
  steps.append(...SHEET_STEPS.map(words => el('li', '', words)));
  const addBox = el('div', 'hub-box hub-adding');
  addBox.append(door, steps);

  const main = el('div');
  main.append(
    el('h3', 'section-label hub-label', 'Sign-up form'), formBox,
    el('h3', 'section-label hub-label', 'To be added'), countBox,
    el('h3', 'section-label hub-label', 'Adding people'), addBox,
  );
  const side = el('aside', 'qh-side');
  side.append(el('p', 'hub-aside', 'Names and email addresses never show here: the page is open. Sign-ups from before the desk kept a copy are in the sign-up sheet.'));
  const split = el('div', 'qh-split');
  split.append(main, side);
  const page = el('div', 'hub-page');
  page.append(hubHead('Listserv', HUB_LEDES.listserv), split);
  container.replaceChildren(page);
  if (focusKey !== null) restoreFocus(container, focusKey, page.querySelector('.page-title'));
}
