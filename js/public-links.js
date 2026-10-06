/**
 * The public links (Kate, Sep 22 and 23; a hub of their own since her drawn
 * map of Oct 6): the three PUBLIC-facing pages and nothing else. The
 * standalone share page and listserv sign-up at erc-share.vercel.app
 * (public-pages/ in this repo, a Vercel project of its own; never on the
 * desk's address), and the Exchange itself. No row shows its address (her
 * words: "I friggin hate having the url displayed"). In her drawing's order:
 * the Exchange, Submit content, the listserv sign-up. The team's how-to draws
 * its Links to share from this list too.
 */
import { el } from './ui-aids.js';

export const PUBLIC_LINKS = [
  { key: 'exchange', label: 'ERC Policy Exchange', href: 'https://erc-policy-exchange.vercel.app/', icon: 'display', sub: 'Public facing link' },
  { key: 'share', label: 'Submit content', href: 'https://erc-share.vercel.app/submit/', icon: 'square-plus', sub: 'Public facing link' },
  { key: 'listserv', label: 'Join listserv', href: 'https://erc-share.vercel.app/listserv/', icon: 'address-book', sub: 'Public facing link' },
];

/** Copy link: writes the address and says Copied for two seconds; only this
 *  button changes. Every public link has one. */
export function copyLinkButton(link) {
  const copy = el('button', 'linkish ql-copy', 'Copy link');
  copy.type = 'button';
  copy.dataset.focus = `copy:${link.key}`;
  copy.setAttribute('aria-label', `Copy the link to ${link.label}`);
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link.href); } catch { return; }
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy link'; }, 2000);
  });
  return copy;
}
