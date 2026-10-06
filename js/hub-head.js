/**
 * A hub page's head (Kate's drawn map, Oct 6, 2026): its name as the page
 * title and one line under it saying what the hub holds. The Content queue,
 * the Listserv and the Policy Exchange open with it; Submit content and the
 * Newsletter keep their own heads.
 */
import { el } from './ui-aids.js';

export function hubHead(title, lede) {
  const head = el('div', 'page-head hub-head');
  head.append(el('h2', 'page-title', title), el('p', 'lede', lede));
  return head;
}

/** What a hub page opens with until its body is drawn. */
export const HUB_LEDES = {
  queue: 'Everything submitted, and where it stands now.',
  listserv: 'Sign-ups for the ERC newsletter.',
  exchange: 'The public site, and what waits to go on it.',
};
