/**
 * The front page (Kate, Oct 23, 2026, her pick E): the hubs as one list per
 * step, Bring it in, Send it out and Research, each under a label over the
 * maize rule, and Public links as a menu at the right with the team's own
 * submit page under it. A row is the hub's name with its arrow, the count,
 * what it counts with its status lines, and the hub's own links. The name is
 * the row's link, stretched over the whole row, so the row's own links (a
 * how-to, the email pages) sit above it and never nest. The rows paint at
 * once; the counts wait on the rows and the quiet checks.
 */
import { faIcon } from './icons.js';
import { HOME_GROUPS, hubCards } from './home-panel.js';
import { howToLink } from './hub-head.js';
import { copyLinkButton, TEAM_SUBMIT } from './public-links.js';
import { openedScreen } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

const newTab = a => { a.target = '_blank'; a.rel = 'noopener'; a.append(el('span', 'sr-only', ' (opens in a new tab)')); };

function hubRow(item, onGoTo) {
  const row = el('div', `desk-card${item.href ? ' is-live' : ''}`);
  row.dataset.key = item.key;
  const head = el('div', 'desk-card-head');
  if (item.href) {
    const go = el('a', 'desk-card-name desk-card-go', item.label);
    go.href = item.href;
    // A screen of the desk switches in place.
    go.addEventListener('click', event => { event.preventDefault(); onGoTo(openedScreen(new URL(go.href, location.href).hash)); });
    head.append(go, faIcon('arrow-right'));
  } else {
    head.append(el('span', 'desk-card-name', item.label));
  }
  const words = el('div', 'desk-card-words');
  if (item.sub) words.append(el('span', 'desk-card-sub', item.sub));
  if (item.warn) {
    const line = el('span', 'desk-card-sub desk-card-warn');
    line.append(faIcon('triangle-exclamation'), ' ', item.warn);
    words.append(line);
  }
  if (item.foot) {
    const line = el('span', 'desk-card-sub');
    if (item.lock) line.append(faIcon('lock'), ' ');
    line.append(item.foot);
    words.append(line);
  }
  const links = el('div', 'desk-card-links');
  for (const link of item.links ?? []) {
    const a = el('a', 'desk-card-link', link.label);
    a.href = link.href;
    if (link.blank) newTab(a);
    links.append(a);
  }
  row.append(head, el('span', 'desk-card-count', item.count == null ? '' : String(item.count)), words, links);
  return row;
}

/** Public links: each public page, its icon and name opening it in a new tab,
 *  and Copy link; then, set apart, the team's own submit page to pin. */
function publicLinks(copies) {
  const menu = el('aside', 'home-links');
  menu.setAttribute('aria-label', 'Public links');
  const box = el('div', 'home-links-box');
  for (const link of copies) {
    const row = el('div', 'desk-card-row');
    const a = el('a', 'desk-card-link');
    a.href = link.href;
    a.append(faIcon(link.icon), link.label);
    newTab(a);
    row.append(a, copyLinkButton(link));
    box.append(row);
  }
  const pin = el('div', 'home-pin');
  const a = el('a', 'home-pin-link');
  a.href = TEAM_SUBMIT.href;
  a.append(faIcon(TEAM_SUBMIT.icon), TEAM_SUBMIT.label);
  newTab(a);
  pin.append(a, el('p', 'home-pin-note', TEAM_SUBMIT.note));
  box.append(pin);
  menu.append(el('h3', 'section-label hub-label', 'Public links'), box);
  return menu;
}

export function renderHome(container, props) {
  const { rows, schedule, today, loaded, loadFailed, preview, archive, hubUpdated, signups, briefs, onGoTo, onRefresh } = props;
  const cards = hubCards({ rows, schedule, today, loaded, preview, archive, hubUpdated, signups, briefs });
  let page = container.querySelector('.home-page');
  if (!page) {
    page = el('div', 'home-page');
    const head = el('div', 'page-head');
    head.append(el('h2', 'home-title', 'Content Desk'), el('p', 'lede', 'What waits in each hub.'));
    // The handoff (Oct 22, 2026): the whole pipeline in one picture, and every how-to in one place.
    const guides = el('div', 'home-guides');
    guides.append(howToLink('How it all connects', '/how-to/pipeline/'), howToLink('All how-tos', '/how-to/'));
    const groups = el('div', 'home-groups');
    for (const { label } of HOME_GROUPS) {
      const group = el('section', 'home-group');
      group.append(el('h3', 'section-label hub-label', label), el('div', 'desk-list'));
      groups.append(group);
    }
    // The public links never change, so the menu is drawn once: a Copy link
    // that just said Copied keeps its word across a redraw.
    const hubs = el('div', 'home-hubs');
    hubs.append(groups, publicLinks(cards.find(c => c.key === 'links').copies));
    page.append(head, guides, hubs, el('div', 'home-note'));
    container.replaceChildren(page);
  }
  const byKey = new Map(cards.map(c => [c.key, c]));
  page.querySelectorAll('.desk-list').forEach((list, i) => {
    list.replaceChildren(...HOME_GROUPS[i].keys.map(key => hubRow(byKey.get(key), onGoTo)));
  });
  const note = page.querySelector('.home-note');
  note.replaceChildren(...(!loaded && loadFailed ? [tryAgain(onRefresh)] : []));
}
