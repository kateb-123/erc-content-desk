/**
 * The Policy Exchange hub (Kate's drawn map, Oct 6, 2026): the public site's
 * status (live, when it last changed, the live link) and how many wait to
 * publish; Publish opens from it as a page of its own, the way the builder
 * sits under Newsletter, and its Confirm still asks the desk password. The
 * code, the handoff and where the logins are kept are forthcoming; the
 * logins themselves never go on a page (the repo is public).
 */
import { exchangeStatus } from './exchange-view.js';
import { hubHead, HUB_LEDES, howToLink } from './hub-head.js';
import { faIcon } from './icons.js';
import { el, focusKeyIn, restoreFocus } from './ui-aids.js';

const SITE = 'https://erc-policy-exchange.vercel.app/';

function stat(label, value) {
  const row = el('div', 'hub-stat');
  row.append(el('span', 'hub-stat-k', label));
  const v = el('span', 'hub-stat-v');
  v.append(...[].concat(value));
  row.append(v);
  return row;
}

export function renderExchange(container, { rows, today, loaded, preview, hubUpdated, onGoTo }) {
  const focusKey = focusKeyIn(container);   // a late load redraws the page; the keyboard keeps its place
  const s = exchangeStatus({ rows, today, loaded, preview, hubUpdated });
  const page = el('div', 'hub-page');
  const split = el('div', 'qh-split');
  const main = el('div');

  const live = el('a', 'hub-link', 'Open the Exchange');
  live.href = SITE; live.target = '_blank'; live.rel = 'noopener';
  live.dataset.focus = 'site';
  live.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
  const site = el('span', s.site === 'Live' ? 'hub-ok' : 'hub-quiet', s.site);
  const box = el('div', 'hub-box');
  box.append(
    stat('The site', [site, ' · ', live]),
    stat('Last updated', s.updated || (s.site === 'Checking' ? '' : 'Not known')),
    stat('Waiting to publish', s.waiting == null ? '' : String(s.waiting)),
  );
  main.append(el('h3', 'section-label hub-label', 'Status'), box,
    howToLink('How to publish to the Exchange', '/how-to/sort/#exchange'), howToLink('How it all connects', '/how-to/pipeline/'),
    el('p', 'qh-side-note', 'Code: github.com/kateb-123/erc-policy-exchange-app. Who holds the logins: READ ME FIRST, in the shared drive.'));

  const side = el('aside', 'qh-side');
  const door = el('a', 'sort-door qh-door');
  door.href = '/#publish';
  door.dataset.focus = 'publish';
  door.addEventListener('click', event => { event.preventDefault(); onGoTo('publish'); });
  const words = el('span', 'door-words');
  words.append(el('span', 'door-name', 'Publish'), el('span', 'door-note', s.waiting ? `${s.waiting} waiting` : ''));
  door.append(faIcon('paper-plane'), words, faIcon('arrow-right'));
  // The Exchange's own edit door (Kate, Oct 23): the one place a live item is
  // fixed, hidden or deleted. Its password is the Exchange's own, given in person.
  const edit = el('a', 'hub-link qh-edit', 'Edit live items');
  edit.href = 'https://erc-policy-exchange.vercel.app/2ujhtc8daz/';
  edit.target = '_blank'; edit.rel = 'noopener';
  edit.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
  side.append(door, edit, el('p', 'qh-side-note', 'Fix, hide or delete what is already live. It asks the Exchange\'s own password.'));

  split.append(main, side);
  page.append(hubHead('Policy Exchange', HUB_LEDES.exchange), split);
  container.replaceChildren(page);
  if (focusKey !== null) restoreFocus(container, focusKey, page.querySelector('.page-title'));
}
