/**
 * The sidebar's contents (Kate, Sep 16, from the Claude Design docs: "I like
 * the sidebar the most. but then I think keep our stuff"). Four groups in her
 * order: the desk itself, the pipeline, the newsletter, the Policy Exchange.
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

export const NAV = [
  { label: '', items: [
    { key: 'home', label: 'ERC Content Desk', icon: 'house', screen: 'home' },
  ] },
  { label: 'Pipeline', items: [
    { key: 'sort', label: 'Sort', icon: 'layer-group', screen: 'sort' },
    { key: 'finalize', label: 'Finalize', icon: 'pen', screen: 'finalize' },
    { key: 'publish', label: 'Publish to Exchange', icon: 'globe', screen: 'publish' },
    { key: 'build', label: 'Send to Newsletter', icon: 'paper-plane', screen: 'build' },
  ] },
  { label: 'Newsletter', items: [
    { key: 'issue', label: 'Next newsletter', icon: 'envelope-open-text', screen: 'issue' },
    { key: 'builder', label: 'Newsletter builder', icon: 'wrench', href: BUILDER_PATH },
    { key: 'past', label: 'Past newsletters', icon: 'box-archive', href: ARCHIVE_PATH },
  ] },
  { label: 'Policy Exchange', items: [
    { key: 'exchange', label: 'Policy Exchange', icon: 'arrow-up-right-from-square', href: EXCHANGE_URL, copy: EXCHANGE_URL },
    { key: 'share', label: 'Share an item', icon: 'share-nodes', href: SHARE_PATH, copy: shareLine(SHARE_PATH) },
    { key: 'listserv', label: 'Listserv sign-up', icon: 'user-plus', href: SIGNUP_PATH, copy: signupLine(SIGNUP_PATH) },
  ] },
];

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
