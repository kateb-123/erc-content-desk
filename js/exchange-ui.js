/**
 * The Policy Exchange hub (Kate's drawn map, Oct 6, 2026): the public site's
 * status (live, when it last changed, the live link) and how many wait to
 * publish; Publish opens from it as a page of its own, the way the builder
 * sits under Newsletter, and its Confirm still asks the desk password. The
 * code, the handoff and where the logins are kept are forthcoming; the
 * logins themselves never go on a page (the repo is public).
 */
import { exchangeStatus } from './exchange-view.js';
import { hubHead, HUB_LEDES, forthcoming } from './hub-head.js';
import { faIcon } from './icons.js';
import { el } from './ui-aids.js';

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
  const s = exchangeStatus({ rows, today, loaded, preview, hubUpdated });
  const page = el('div', 'hub-page');
  const split = el('div', 'qh-split');
  const main = el('div');

  const live = el('a', 'hub-link', 'Open the Exchange');
  live.href = SITE; live.target = '_blank'; live.rel = 'noopener';
  live.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
  const site = el('span', s.site === 'Live' ? 'hub-ok' : 'hub-quiet', s.site);
  const box = el('div', 'hub-box');
  box.append(
    stat('The site', [site, ' · ', live]),
    stat('Last updated', s.updated || (s.site === 'Checking' ? '' : 'Not known')),
    stat('Waiting to publish', s.waiting == null ? '' : String(s.waiting)),
  );
  main.append(el('h3', 'section-label hub-label', 'Status'), box,
    forthcoming('The code'), forthcoming('The handoff'), forthcoming('Where the logins are kept'));

  const side = el('aside', 'qh-side');
  const door = el('a', 'sort-door qh-door');
  door.href = '/#publish';
  door.addEventListener('click', event => { event.preventDefault(); onGoTo('publish'); });
  const words = el('span', 'door-words');
  words.append(el('span', 'door-name', 'Publish'), el('span', 'door-note', s.waiting ? `${s.waiting} waiting` : ''));
  door.append(faIcon('paper-plane'), words, faIcon('arrow-right'));
  side.append(door, el('p', 'qh-side-note', 'Confirm asks the desk password before anything reaches the site.'));

  split.append(main, side);
  page.append(hubHead('Policy Exchange', HUB_LEDES.exchange), split);
  container.replaceChildren(page);
}
