/**
 * The sidebar (Kate's pick A of the looks, Oct 23): the desk as a Mac app.
 * The desk's name, Home, the hubs by step under the front page's group names,
 * each with what waits there; at the foot All how-tos, I need help! (seated
 * by report-problem.js) and Sign out while a sign-in holds. Built once into
 * <nav class="sidebar">; each render marks where you are and what waits. On
 * the desk its links switch screens in place; on the builder's and the
 * email's pages they are plain links.
 */
import { DESK, NAV, navCurrent, navLabel, openedScreen } from './shell-view.js';
import { el } from './ui-aids.js';
import { lineIcon } from './icons.js';

const signOuts = new WeakMap();   // each sidebar's Sign out, as the latest render passed it

function deskLink(className, href, onGo) {
  const a = el('a', className);
  a.href = href;
  // A desk address switches in place where the desk is running; a click
  // meant for a new tab or window stays one.
  if (onGo) a.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onGo(openedScreen(new URL(a.href, location.href).hash));
  });
  return a;
}

/** An item's icon and words. */
const parts = (icon, label) => [lineIcon(icon), el('span', 'sidebar-label', label)];

function build(nav, onGo) {
  nav.replaceChildren();
  const brand = el('div', 'sidebar-brand');
  const mark = el('span', 'sidebar-mark');
  mark.append(lineIcon('check'));
  brand.append(mark, el('span', 'sidebar-name', DESK.label));
  nav.append(brand);

  NAV.forEach((group, i) => {
    const list = el('ul', 'sidebar-list');
    if (group.label) {
      const head = el('div', 'sidebar-group', group.label);
      head.id = `sidebar-group-${i}`;
      list.setAttribute('aria-labelledby', head.id);
      nav.append(head);
    }
    for (const entry of group.items) {
      const a = deskLink('sidebar-item', entry.href, onGo);
      a.dataset.key = entry.key;
      const badge = el('span', 'sidebar-badge');
      if (entry.lock) badge.append(lineIcon('lock'));
      badge.append(el('span', 'sidebar-count'));
      a.append(...parts(entry.icon, entry.label), badge);
      const li = el('li');
      li.append(a);
      list.append(li);
    }
    nav.append(list);
  });

  const foot = el('div', 'sidebar-foot');
  const guides = el('a', 'sidebar-item is-quiet sidebar-guides');
  guides.href = '/how-to/';
  guides.append(...parts('book', 'All how-tos'));
  const out = el('button', 'sidebar-item is-quiet sidebar-signout');
  out.type = 'button';
  out.hidden = true;
  out.append(...parts('signout', 'Sign out'));
  out.addEventListener('click', () => { out.disabled = true; signOuts.get(nav)?.(); });
  foot.append(guides, out);
  nav.append(foot);
  nav.dataset.built = '1';
}

/** signedIn and onSignOut: the desk's own sign-in (Kate, Sep 23); while it
 *  holds, Sign out sits at the foot. badges: what waits at each item
 *  (shell-view.js's navBadges). The builder and the email's pages pass the
 *  screen alone. */
export function renderSidebar(nav, { screen, onGo, signedIn = false, onSignOut, badges = {} } = {}) {
  if (!nav) return;
  if (!nav.dataset.built) build(nav, onGo);
  const here = navCurrent(screen);
  const entries = NAV.flatMap(g => g.items);
  for (const a of nav.querySelectorAll('.sidebar-item[data-key]')) {
    const entry = entries.find(e => e.key === a.dataset.key);
    if (entry.key === here) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
    const badge = badges[entry.key] ?? '';
    a.querySelector('.sidebar-count').textContent = badge;
    a.setAttribute('aria-label', navLabel(entry, badge));
  }
  // A how-to page lights All how-tos at the foot (Oct 23).
  const guides = nav.querySelector('.sidebar-guides');
  if (here === 'howto') guides.setAttribute('aria-current', 'page');
  else guides.removeAttribute('aria-current');
  signOuts.set(nav, onSignOut);
  const out = nav.querySelector('.sidebar-signout');
  const show = Boolean(signedIn && onSignOut);
  if (out.hidden === show) { out.hidden = !show; out.disabled = false; }
}
