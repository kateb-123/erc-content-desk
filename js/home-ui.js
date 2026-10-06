/**
 * The front page: Kate's drawn map (Oct 6, 2026), six hub cards in her
 * order, each with its status, and each opening its hub's page in place.
 * Public links opens nothing: its Copy links work on the card. A card's name
 * is its link, stretched over the whole card, so the links a card carries of
 * its own (a how-to, a Copy link) stay links and never nest inside another.
 * The cards paint at once; the counts wait on the rows and the quiet checks.
 */
import { faIcon } from './icons.js';
import { hubCards } from './home-panel.js';
import { copyLinkButton } from './public-links.js';
import { openedScreen } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

function card(item, onGoTo) {
  const box = el('div', `desk-card${item.href ? ' is-live' : ''}`);
  box.dataset.key = item.key;
  const head = el('div', 'desk-card-head');
  if (item.href) {
    const go = el('a', 'desk-card-name desk-card-go', item.label);
    go.href = item.href;
    // A screen of the desk switches in place.
    go.addEventListener('click', event => { event.preventDefault(); onGoTo(openedScreen(new URL(go.href, location.href).hash)); });
    head.append(go, faIcon('arrow-right'));
  } else {
    head.append(el('h3', 'desk-card-name', item.label));
  }
  box.append(head);
  if (item.copies) {
    // Public links: each row its name, opening the page in a new tab, and Copy link.
    const list = el('div', 'desk-card-rows');
    for (const link of item.copies) {
      const row = el('div', 'desk-card-row');
      const a = el('a', 'desk-card-link', link.label);
      a.href = link.href; a.target = '_blank'; a.rel = 'noopener';
      a.append(el('span', 'sr-only', ' (opens in a new tab)'));
      row.append(a, copyLinkButton(link));
      list.append(row);
    }
    box.append(list);
    return box;
  }
  box.append(el('span', 'desk-card-count', item.count == null ? '' : String(item.count)));
  if (item.sub) box.append(el('span', 'desk-card-sub', item.sub));
  const foot = el('div', 'desk-card-foot');
  for (const link of item.links ?? []) { const a = el('a', 'desk-card-link', link.label); a.href = link.href; foot.append(a); }
  if (item.foot) {
    const line = el('span', 'desk-card-sub');
    if (item.lock) line.append(faIcon('lock'), ' ');
    line.append(item.foot);
    foot.append(line);
  }
  if (foot.childNodes.length) box.append(foot);
  return box;
}

export function renderHome(container, props) {
  const { rows, schedule, today, loaded, loadFailed, preview, archive, hubUpdated, signups, onGoTo, onRefresh } = props;
  let page = container.querySelector('.home-page');
  if (!page) {
    page = el('div', 'home-page');
    const head = el('div', 'page-head');
    head.append(el('h2', 'home-title', 'Content Desk'), el('p', 'lede', 'What waits in each hub.'));
    page.append(head, el('div', 'desk-cards'), el('div', 'home-note'));
    container.replaceChildren(page);
  }
  const grid = page.querySelector('.desk-cards');
  // A Copy link that just said Copied keeps its word across a redraw: only
  // the cards that count anything are redrawn.
  const cards = hubCards({ rows, schedule, today, loaded, preview, archive, hubUpdated, signups });
  const kept = new Map([...grid.children].map(c => [c.dataset.key, c]));
  grid.replaceChildren(...cards.map(item => (item.copies && kept.get(item.key)) || card(item, onGoTo)));
  const note = page.querySelector('.home-note');
  note.replaceChildren(...(!loaded && loadFailed ? [tryAgain(onRefresh)] : []));
}
