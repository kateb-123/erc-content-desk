/**
 * The front page (Kate, Oct 23, 2026, her pick E, drawn in her pick A of the
 * looks the same evening): the hubs as one white grouped list per step, Bring
 * it in, Send it out and Research, each under its label, and Public links as a
 * menu at the right with the team's own submit page under it. A row is the
 * hub's icon, its name, a line per kind of fact (the first fact darker, no
 * line wrapping: her line rules), its own links, the count and a chevron. The
 * name is the row's link, stretched over the whole row, so the row's own
 * links sit above it and never nest. The rows paint at once; the counts wait
 * on the rows and the quiet checks.
 */
import { lineIcon } from './icons.js';
import { HOME_GROUPS, hubCards } from './home-panel.js';
import { copyLinkButton, TEAM_SUBMIT } from './public-links.js';
import { NAV, openedScreen } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

const newTab = a => { a.target = '_blank'; a.rel = 'noopener'; a.append(el('span', 'sr-only', ' (opens in a new tab)')); };
const ICONS = Object.fromEntries(NAV.flatMap(g => g.items).map(i => [i.key, i.icon]));

/** An icon on its rounded tile. */
function tile(name) {
  const box = el('span', 'home-tile');
  box.setAttribute('aria-hidden', 'true');
  box.append(lineIcon(name));
  return box;
}

/** One line of a row: a single kind of fact, never wrapping; the full words show on hover when it is cut. */
function line(parts) {
  const p = el('p', 'home-line');
  p.append(...parts);
  p.setAttribute('title', p.textContent);
  return p;
}

/** The count's line: what the count counts, darker, then the rest. */
function leadLine(sub) {
  const [lead, ...rest] = sub.split(' · ');
  return line([el('span', 'home-lead', lead), ...(rest.length ? [` · ${rest.join(' · ')}`] : [])]);
}

function hubRow(item, onGoTo) {
  const row = el('div', 'home-row');
  row.dataset.key = item.key;
  const words = el('div', 'home-words');
  const go = el('a', 'home-name', item.label);
  go.href = item.href;
  // A screen of the desk switches in place; a click meant for a new tab stays one.
  go.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onGoTo(openedScreen(new URL(go.href, location.href).hash));
  });
  words.append(go);
  if (item.sub) words.append(item.counts ? leadLine(item.sub) : line([item.sub]));
  if (item.foot) {
    const marks = item.lock ? [lineIcon('lock')] : item.live ? [el('span', 'home-dot')] : [];
    words.append(line([...marks, item.foot]));
  }
  if (item.links?.length) {
    const links = el('div', 'home-row-links');
    for (const link of item.links) {
      const a = el('a', '', link.label);
      a.href = link.href;
      if (link.blank) newTab(a);
      links.append(a);
    }
    words.append(links);
  }
  const main = el('div', 'home-main');
  main.append(words);
  if (item.counts) main.append(el('span', `home-count${item.count === 0 ? ' is-zero' : ''}`, item.count == null ? '' : String(item.count)));
  main.append(lineIcon('chevron', 'home-chevron'));
  row.append(tile(ICONS[item.key]), main);
  return row;
}

/** The newsletter's schedule warning: a note of its own under its row. */
function warnNote(words) {
  const note = el('div', 'home-warn');
  note.append(lineIcon('warning'), el('span', '', words));
  return note;
}

/** Public links: each public page, its icon and name opening it in a new tab,
 *  and Copy link; then, set apart, the team's own submit page to pin. */
function publicLinks(copies) {
  const menu = el('aside', 'home-links');
  menu.setAttribute('aria-label', 'Public links');
  const box = el('div', 'home-list home-links-box');
  for (const link of copies) {
    const row = el('div', 'home-link-row');
    const a = el('a', 'home-link-name', link.label);
    a.href = link.href;
    newTab(a);
    // Copy link is a pill here, not the quiet word it is on the Listserv page.
    const copy = copyLinkButton(link);
    copy.className = 'ql-copy home-copy';
    const main = el('div', 'home-main');
    main.append(a, copy);
    row.append(tile(link.line), main);
    box.append(row);
  }
  const pin = el('div', 'home-pin');
  const a = el('a', 'home-pin-link', TEAM_SUBMIT.label);
  a.href = TEAM_SUBMIT.href;
  newTab(a);
  const words = el('div', 'home-pin-words');
  words.append(a, el('p', 'home-pin-note', TEAM_SUBMIT.note));
  pin.append(tile(TEAM_SUBMIT.line), words);
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
    const head = el('div', 'page-head home-head');
    const titles = el('div', 'home-titles');
    titles.append(el('h2', 'home-title', 'Content Desk'), el('p', 'lede', 'What waits in each hub.'));
    // The handoff (Oct 22, 2026): the whole pipeline in one picture. Every how-to is in the sidebar.
    const guide = el('a', 'home-guide');
    guide.href = '/how-to/pipeline/';
    guide.append(lineIcon('book'), 'How it all connects');
    head.append(titles, guide);
    const groups = el('div', 'home-groups');
    for (const { label } of HOME_GROUPS) {
      const group = el('section', 'home-group');
      group.append(el('h3', 'section-label hub-label', label), el('div', 'home-list'));
      groups.append(group);
    }
    // The public links never change, so the menu is drawn once: a Copy link
    // that just said Copied keeps its word across a redraw.
    const hubs = el('div', 'home-hubs');
    hubs.append(groups, publicLinks(cards.find(c => c.key === 'links').copies));
    page.append(head, hubs, el('div', 'home-note'));
    container.replaceChildren(page);
  }
  const byKey = new Map(cards.map(c => [c.key, c]));
  page.querySelectorAll('.home-groups .home-list').forEach((list, i) => {
    list.replaceChildren(...HOME_GROUPS[i].keys.flatMap(key => {
      const item = byKey.get(key);
      return item.warn ? [hubRow(item, onGoTo), warnNote(item.warn)] : [hubRow(item, onGoTo)];
    }));
  });
  const note = page.querySelector('.home-note');
  note.replaceChildren(...(!loaded && loadFailed ? [tryAgain(onRefresh)] : []));
}
