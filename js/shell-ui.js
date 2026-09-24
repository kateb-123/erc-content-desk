/**
 * The top bar (Kate's wireframes, Sep 17): the breadcrumb on the left (no
 * mark: the wireframe's placeholder square read as a checkbox, design
 * critique Sep 18), the two other lanes on the right. Built once into
 * <header class="topbar">; the crumb and the lanes are redrawn on each render,
 * since the screen changes them. On the desk its links switch screens in
 * place; on the builder's pages they are plain links.
 */
import { DESK, crumbs, laneLinks, openedScreen } from './shell-view.js';
import { el } from './ui-aids.js';

function deskLink(label, href, onGo) {
  const a = el('a', null, label);
  a.href = href;
  // A desk address switches in place where the desk is running.
  if (onGo) a.addEventListener('click', event => { event.preventDefault(); onGo(openedScreen(new URL(a.href, location.href).hash)); });
  return a;
}

function build(header) {
  header.replaceChildren();
  const trail = el('nav', 'topbar-crumbs');
  trail.setAttribute('aria-label', 'Breadcrumb');
  const lanes = el('nav', 'topbar-lanes');
  lanes.setAttribute('aria-label', 'Lanes');
  header.append(trail, lanes);
  header.dataset.built = '1';
}

/** signedIn and onSignOut: the desk's own sign-in (Kate, Sep 23); while it
 *  holds, Sign out sits at the bar's right end. `bare` is a sign-in screen's
 *  bar: the brand alone, nothing to go to. The builder passes none of these. */
export function renderShell(header, { screen, onGo, signedIn = false, onSignOut, bare = false } = {}) {
  if (!header) return;
  if (!header.dataset.built) build(header);
  const trail = header.querySelector('.topbar-crumbs');
  const parts = [];
  if (bare) {
    const brand = el('span', 'topbar-brand topbar-here', DESK.label);
    trail.replaceChildren(brand);
    header.querySelector('.topbar-lanes').replaceChildren();
    return;
  }
  crumbs(screen).forEach((crumb, i) => {
    if (i) parts.push(el('span', 'topbar-sep', '/'));
    if (crumb.href) {
      const a = deskLink(crumb.label, crumb.href, onGo);
      if (i === 0) a.classList.add('topbar-brand');
      parts.push(a);
    } else {
      const here = el('span', i === 0 ? 'topbar-brand topbar-here' : 'topbar-here', crumb.label);
      here.setAttribute('aria-current', 'page');
      parts.push(here);
    }
  });
  trail.replaceChildren(...parts);
  const lanes = header.querySelector('.topbar-lanes');
  lanes.replaceChildren(...laneLinks(screen).map(lane => deskLink(lane.label, lane.href, onGo)));
  if (signedIn && onSignOut) {
    const out = el('button', 'topbar-signout', 'Sign out');
    out.type = 'button';
    out.addEventListener('click', () => { out.disabled = true; onSignOut(); });
    lanes.append(out);
  }
}
