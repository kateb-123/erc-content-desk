/**
 * The shell's contents (Kate's wireframes, Sep 17): a top bar with a
 * breadcrumb in place of the sidebar, and the two other lanes as links on
 * its right. Pure data and small rules, so node --test can hold them.
 */
export const DESK = { label: 'ERC Content Desk', href: '/' };

// The public site the desk publishes to, and the archive of sent issues.
export const EXCHANGE_URL = 'https://erc-policy-exchange.vercel.app/';
export const ARCHIVE_PATH = '/builder/archive.html';

/** The three lanes, in the front page's order. */
export const LANES = [
  { key: 'sort', label: 'Sort content', href: '/#sort' },
  { key: 'newsletter', label: 'Newsletter', href: '/#newsletter' },
  { key: 'exchange', label: 'Policy Exchange', href: '/#exchange' },
];

// Each screen: the lane it belongs to, its address, and, while the old
// screens still stand on their own, the name it crumbs under the lane. The
// builder's pages sit under Newsletter.
const SCREENS = {
  home: { lane: null, hash: '' },
  sort: { lane: 'sort', hash: '#sort' },
  finalize: { lane: 'sort', hash: '#finalize', page: 'Finalize' },
  issue: { lane: 'newsletter', hash: '#newsletter' },
  build: { lane: 'newsletter', hash: '#build', page: 'Send to Newsletter' },
  publish: { lane: 'exchange', hash: '#exchange' },
  builder: { lane: 'newsletter', hash: null, page: 'Builder', title: 'Newsletter builder' },
  past: { lane: 'newsletter', hash: null, page: 'Past issues' },
};

// Old addresses keep landing where they used to.
const OLD_HASHES = { '#issue': 'issue', '#publish': 'publish' };

// A lane's own key names a screen too (the lanes become screens as they are built).
const laneOf = screen => LANES.find(l => l.key === (SCREENS[screen]?.lane ?? screen)) ?? null;

/** The breadcrumb: the desk alone on the front page; the desk then the lane
 *  elsewhere; a page under its lane where one stands. The last crumb is the
 *  page itself, so it carries no link. */
export function crumbs(screen) {
  const lane = laneOf(screen);
  const page = SCREENS[screen]?.page;
  const trail = [{ ...DESK }];
  if (lane) trail.push({ label: lane.label, href: lane.href });
  if (page) trail.push({ label: page });
  if (trail.length > 1) delete trail[trail.length - 1].href;   // the page itself; the brand always leads home
  return trail;
}

/** The lanes the bar links to: the two the page is not in; none on the
 *  front page, which lists all three itself. */
export function laneLinks(screen) {
  const lane = laneOf(screen);
  if (!lane) return [];
  return LANES.filter(l => l.key !== lane.key);
}

/** The screen an address opens: a lane's hash, an old screen's own hash, or
 *  the front page for anything else. */
export function openedScreen(hash) {
  const key = String(hash ?? '');
  if (OLD_HASHES[key]) return OLD_HASHES[key];
  return Object.keys(SCREENS).find(s => SCREENS[s].hash && SCREENS[s].hash === key) ?? 'home';
}

/** The address a screen keeps, so a reload or a bookmark lands back on it;
 *  the front page has none. */
export function screenHash(screen) {
  return SCREENS[screen]?.hash ?? '';
}

/** The window's title: the page, then the desk. */
export function pageTitle(screen) {
  const s = SCREENS[screen];
  const name = s?.title ?? s?.page ?? laneOf(screen)?.label;
  return name ? `${name} · ${DESK.label}` : DESK.label;
}
