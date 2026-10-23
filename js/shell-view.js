/**
 * The shell's contents. Kate's drawn map (Oct 6, 2026): the desk is seven
 * hubs, each a row on the front page and a page of its own, with Content Sort
 * under the Content queue, the builder under Newsletter and Publish under
 * Policy Exchange. Since her pick A of the looks (Oct 23) the shell is a
 * sidebar: Home, then the hubs by step, each with what waits there. Pure data
 * and small rules, so node --test can hold them.
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
// that hub where it is not the hub's own page; the window's title reads them.
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
  // One brief's page: /#briefs/<id>, the id read from the address (openedId); the page carries its title.
  brief: { hub: 'briefs', hash: null, page: 'Brief' },
};

const BRIEF_PREFIX = '#briefs/';

// Old addresses keep landing where they used to.
const OLD_HASHES = { '#issue': 'issue', '#build': 'issue' };   // Send to Newsletter folded into Next issue (Sep 18)

const hubOf = screen => HUBS.find(h => h.key === SCREENS[screen]?.hub) ?? null;

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

/** The sidebar (Kate's pick A, Oct 23): Home, then the hubs by step under the
 *  front page's own group names, Content Sort under Bring it in. Public links
 *  has no page, so it stays on the front page. `lock`: behind the password;
 *  `waits`: what the item's count or date means, read aloud. */
export const NAV = [
  { label: '', items: [{ key: 'home', label: 'Home', href: '/', icon: 'home' }] },
  { label: 'Bring it in', items: [
    { key: 'team', label: 'Submit content', href: '/#team', icon: 'submit' },
    { key: 'queue', label: 'Content queue', href: '/#queue', icon: 'queue' },
    { key: 'sort', label: 'Content Sort', href: '/#sort', icon: 'sort', lock: true, waits: '{n} waiting' },
  ] },
  { label: 'Send it out', items: [
    { key: 'newsletter', label: 'Newsletter', href: '/#newsletter', icon: 'newsletter', waits: 'next issue {n}' },
    { key: 'listserv', label: 'Listserv', href: '/#listserv', icon: 'listserv', waits: '{n} to be added' },
    { key: 'exchange', label: 'Policy Exchange', href: '/#exchange', icon: 'exchange', waits: '{n} waiting to publish' },
  ] },
  { label: 'Research', items: [{ key: 'briefs', label: 'Research briefs', href: '/#briefs', icon: 'briefs', lock: true, waits: '{n} in progress' }] },
];

/** The sidebar item a screen marks: its own, or its hub's for a page under a
 *  hub; Finalize, Sort's tab, marks Content Sort. */
export function navCurrent(screen) {
  if (screen === 'home') return 'home';
  if (screen === 'sort' || screen === 'finalize') return 'sort';
  return SCREENS[screen]?.hub ?? null;
}

/** What waits at each item, from the front page's rows (home-panel.js's
 *  hubCards): Sort's count is the queue's, the newsletter shows its next send
 *  date. '' while a count is not known. */
export function navBadges(cards = []) {
  const by = Object.fromEntries(cards.map(c => [c.key, c]));
  const n = c => (Number.isFinite(c?.count) ? String(c.count) : '');
  return { sort: n(by.queue), newsletter: by.newsletter?.next ?? '', listserv: n(by.listserv), exchange: n(by.exchange), briefs: n(by.briefs) };
}

/** What a sidebar item says to a screen reader: its name, its lock, and what waits there. */
export function navLabel(item, badge = '') {
  const said = [item.label];
  if (item.lock) said.push('password protected');
  if (badge && item.waits) said.push(item.waits.replace('{n}', badge));
  return said.join(', ');
}
