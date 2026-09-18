/**
 * The top bar (Kate's wireframes, Sep 17): the brand mark and the breadcrumb
 * on the left, the two other lanes on the right. Built once into
 * <header class="topbar">; the crumb and the lanes are redrawn on each render,
 * since the screen changes them. On the desk its links switch screens in
 * place; on the builder's pages they are plain links.
 */
import { crumbs, laneLinks, openedScreen } from './shell-view.js';
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
  header.append(el('span', 'topbar-mark'));
  const trail = el('nav', 'topbar-crumbs');
  trail.setAttribute('aria-label', 'Breadcrumb');
  const lanes = el('nav', 'topbar-lanes');
  lanes.setAttribute('aria-label', 'Lanes');
  header.append(trail, lanes);
  header.dataset.built = '1';
}

export function renderShell(header, { screen, onGo } = {}) {
  if (!header) return;
  if (!header.dataset.built) build(header);
  const trail = header.querySelector('.topbar-crumbs');
  const parts = [];
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
}
