/**
 * The sidebar's contents (Kate, Sep 16, from the Claude Design docs: "I like
 * the sidebar the most. but then I think keep our stuff"; reordered the same
 * day from round two): the desk itself, the Policy Exchange, the newsletter,
 * then Desk work (the pipeline) as a fold.
 * Pure data and two small rules, so node --test can hold them.
 *
 * Each item is one of three kinds:
 *   screen  — a desk screen (in this window, or the pipeline's own window)
 *   href    — another page, opened in a new tab
 *   copy    — an href that also carries a sentence to copy (the hand-outs)
 */
import { shareLine, signupLine } from './home-panel.js';

export const EXCHANGE_URL = 'https://erc-policy-exchange.vercel.app/';
// The public share and sign-up pages live in the Policy Exchange hub, a
// separate origin from the desk on purpose: nothing on them can lead back here.
export const SHARE_PATH = 'https://erc-policy-exchange.vercel.app/share/';
export const SIGNUP_PATH = 'https://erc-policy-exchange.vercel.app/newsletter/';
export const BUILDER_PATH = '/builder/';
export const ARCHIVE_PATH = '/builder/archive.html';

/** The pipeline's screens: from the front door they open in their own window
 *  (Kate, Sep 15: "a new section and a new set of activities"). */
export const SECTION_SCREENS = ['sort', 'finalize', 'publish', 'build'];

// Claude Design round two, Kate's pick (Sep 16): the team's links first, the
// pipeline last as a "Desk work" fold; icons on the group headings, none on
// the items under them; Sort shows the queue count.
export const NAV = [
  { label: '', items: [
    { key: 'home', label: 'ERC Content Desk', icon: 'house', screen: 'home' },
  ] },
  { label: 'Policy Exchange', icon: 'globe', items: [
    { key: 'exchange', label: 'Policy Exchange', href: EXCHANGE_URL, copy: EXCHANGE_URL },
    { key: 'share', label: 'Share an item', href: SHARE_PATH, copy: shareLine(SHARE_PATH) },
    { key: 'listserv', label: 'Listserv sign-up', href: SIGNUP_PATH, copy: signupLine(SIGNUP_PATH) },
  ] },
  { label: 'Newsletter', icon: 'envelope-open-text', items: [
    { key: 'issue', label: 'Next newsletter', screen: 'issue' },
    { key: 'builder', label: 'Newsletter builder', href: BUILDER_PATH },
    { key: 'past', label: 'Past newsletters', href: ARCHIVE_PATH },
  ] },
  { label: 'Desk work', icon: 'layer-group', fold: true, items: [
    { key: 'sort', label: 'Sort', screen: 'sort', count: true },
    { key: 'finalize', label: 'Finalize', screen: 'finalize' },
    { key: 'publish', label: 'Publish to Exchange', screen: 'publish' },
    { key: 'build', label: 'Send to Newsletter', screen: 'build' },
  ] },
];

/** Whether Desk work shows its items: open unless it was shut (the stored
 *  value is 'closed'), and always open on a pipeline screen so the lit item
 *  is never hidden. */
export function foldOpen(stored, screen) {
  return stored !== 'closed' || SECTION_SCREENS.includes(screen);
}

/** Desk work tucks the sidebar away (Kate, Sep 16: "b when it's expanded and
 *  the button. but also the thin grey bar to the left like C"). On a pipeline
 *  screen a thin grey strip holds the menu button until it is opened; open,
 *  the sidebar is back in place with a close button. The front door always
 *  keeps its sidebar. */
export function menuLayout(screen, open) {
  const tucks = SECTION_SCREENS.includes(screen);
  return { strip: tucks && !open, sidebar: !tucks || open, close: tucks && open };
}

/** Which item is lit for a screen; '' when none is. */
export function currentKey(screen) {
  const item = NAV.flatMap(g => g.items).find(i => i.screen === screen);
  return item ? item.key : '';
}

/** Whether a click on the item leaves this window: every outside page does;
 *  a pipeline screen does from the front door, but not from inside the
 *  pipeline's own window, where it just switches. */
export function opensNewWindow(item, isSectionWindow) {
  if (item.href) return true;
  if (item.screen && SECTION_SCREENS.includes(item.screen)) return !isSectionWindow;
  return false;
}
