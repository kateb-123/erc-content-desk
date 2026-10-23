/**
 * The shell's contents. Kate's drawn map (Oct 6, 2026): the desk is six hubs,
 * each a card on the front page and a page of its own, with Content Sort
 * under the Content queue, the builder under Newsletter and Publish under
 * Policy Exchange. The top bar carries the breadcrumb alone (her pick A):
 * the desk, the hub, the page. Pure data and small rules, so node --test can
 * hold them.
 */
export const DESK = { label: 'ERC Content Desk', href: '/' };

/** The six hubs, in the order the front page lays them out. Public links has
 *  no page: its Copy links work on the card. */
export const HUBS = [
  { key: 'team', label: 'Submit content', href: '/#team' },
  { key: 'queue', label: 'Content queue', href: '/#queue' },
  { key: 'newsletter', label: 'Newsletter', href: '/#newsletter' },
  { key: 'listserv', label: 'Listserv', href: '/#listserv' },
  { key: 'links', label: 'Public links', href: '' },
  { key: 'exchange', label: 'Policy Exchange', href: '/#exchange' },
  // The seventh (Kate, Oct 20, 2026): the research-brief pipeline, hers alone.
  { key: 'briefs', label: 'Research briefs', href: '/#briefs' },
];

// Each screen: the hub it belongs to, its address, and the page it is under
// that hub where it is not the hub's own page. A tab of a page (Finalize,
// Schedule, Past issues) crumbs as the page it is a tab of.
const SCREENS = {
  home: { hub: null, hash: '' },
  team: { hub: 'team', hash: '#team' },
  queue: { hub: 'queue', hash: '#queue' },
  sort: { hub: 'queue', hash: '#sort', page: 'Content Sort' },
  finalize: { hub: 'queue', hash: '#finalize', page: 'Content Sort', title: 'Finalize' },
  issue: { hub: 'newsletter', hash: '#newsletter' },
  schedule: { hub: 'newsletter', hash: '#schedule', title: 'Schedule' },
  past: { hub: 'newsletter', hash: '#past', title: 'Past issues' },
  listserv: { hub: 'listserv', hash: '#listserv' },
  exchange: { hub: 'exchange', hash: '#exchange' },
  publish: { hub: 'exchange', hash: '#publish', page: 'Publish' },
  // The Highlight's own page (Kate, Oct 23): the home page's card, any day, beside Publish.
  highlight: { hub: 'exchange', hash: '#highlight', page: 'Highlight' },
  builder: { hub: 'newsletter', hash: null, page: 'Builder', title: 'Newsletter builder' },
  // The newsletter's HTML pages (Kate, Oct 8): the blank template, the sample and the read me, each a page of its own.
  emailpage: { hub: 'newsletter', hash: null, page: 'The email' },
  briefs: { hub: 'briefs', hash: '#briefs' },
  // One brief's page: /#briefs/<id>, the id read from the address (openedId); the crumb carries its title.
  brief: { hub: 'briefs', hash: null, page: 'Brief' },
};

const BRIEF_PREFIX = '#briefs/';

// Old addresses keep landing where they used to.
const OLD_HASHES = { '#issue': 'issue', '#build': 'issue' };   // Send to Newsletter folded into Next issue (Sep 18)

const hubOf = screen => HUBS.find(h => h.key === SCREENS[screen]?.hub) ?? null;

/** The breadcrumb: the desk alone on the front page; the desk then the hub
 *  elsewhere; then the page under the hub where one stands. The last crumb
 *  is where you are, so it carries no link. */
export function crumbs(screen, { page: pageLabel } = {}) {
  const hub = hubOf(screen);
  const page = pageLabel || SCREENS[screen]?.page;
  const trail = [{ ...DESK }];
  if (hub) trail.push({ label: hub.label, href: hub.href });
  if (page) trail.push({ label: page });
  if (trail.length > 1) delete trail[trail.length - 1].href;   // where you are; the brand always leads home
  return trail;
}

/** The screen an address opens: a screen's own hash, an old one, or the
 *  front page for anything else. */
export function openedScreen(hash) {
  const key = String(hash ?? '');
  if (OLD_HASHES[key]) return OLD_HASHES[key];
  if (key.startsWith(BRIEF_PREFIX) && key.length > BRIEF_PREFIX.length) return 'brief';
  return Object.keys(SCREENS).find(s => SCREENS[s].hash && SCREENS[s].hash === key) ?? 'home';
}

/** The brief a /#briefs/<id> address names; '' for any other address. */
export function openedId(hash) {
  const key = String(hash ?? '');
  return key.startsWith(BRIEF_PREFIX) ? decodeURIComponent(key.slice(BRIEF_PREFIX.length)) : '';
}

/** A brief's own address. */
export const briefHash = id => `${BRIEF_PREFIX}${encodeURIComponent(id)}`;

/** The address a screen keeps, so a reload or a bookmark lands back on it;
 *  the front page has none. */
export function screenHash(screen) {
  return SCREENS[screen]?.hash ?? '';
}

/** The window's title: the page, then the desk. */
export function pageTitle(screen) {
  const s = SCREENS[screen];
  const name = s?.title ?? s?.page ?? hubOf(screen)?.label;
  return name ? `${name} · ${DESK.label}` : DESK.label;
}
