/**
 * A hub page's head (Kate's drawn map, Oct 6, 2026): its name as the page
 * title and one line under it saying what the hub holds. The Content queue,
 * the Listserv and the Policy Exchange open with it; Submit content and the
 * Newsletter keep their own heads.
 */
import { faIcon } from './icons.js';
import { el } from './ui-aids.js';

export function hubHead(title, lede) {
  const head = el('div', 'page-head hub-head');
  head.append(el('h2', 'page-title', title), el('p', 'lede', lede));
  return head;
}

/** What a hub page opens with until its body is drawn. */
export const HUB_LEDES = {
  queue: 'Everything submitted.',
  listserv: 'Sign-ups for the ERC newsletter.',
  exchange: 'The public site.',
  briefs: 'Where each brief stands.',
};

/** A how-to link under a hub (the handoff, Oct 22, 2026: no dead ends; every "forthcoming" became a page). */
export function howToLink(words, href) {
  const line = el('p', 'howto-link');
  const a = el('a', '', words);
  a.href = href;
  line.append(faIcon('book-open'), ' ', a);
  return line;
}

/** A line saying something is coming, in the quiet grey (her red Forthcoming). */
export function forthcoming(words) {
  const line = el('p', 'forthcoming');
  line.append(faIcon('clock'), ` ${words} · Forthcoming`);
  return line;
}
