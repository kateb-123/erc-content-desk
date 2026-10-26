/**
 * The top right of every page with the sidebar (Kate, Oct 24, 2026). Her pick
 * E: today's date, College Station's, a small gray line in the status line's
 * row that stays put while the page scrolls. Her pick D: a How-tos button just
 * right of it, opening a panel from the right over the page: the guide for
 * this page first, the part for this page tagged This page, then every other
 * guide under the sidebar's own headings, all from js/howto-index.js. The
 * panel is the browser's own modal dialog, named by its heading: focus moves
 * in as it opens and back to the button as it closes, however it closes (X,
 * Escape, a click beside it, a link followed). renderSidebar draws the corner
 * once per page and tells it the page; the panel's words are drawn each time
 * it opens, for where you are then (the builder's step, a how-to's part).
 */
import { todayCentral, todayWords } from './today.js';
import { panelPlace, panelModel } from './howto-index.js';
import { lineIcon } from './icons.js';
import { el } from './ui-aids.js';

const PANEL_ID = 'howto-panel';
const TITLE_ID = 'howto-panel-title';

let screenNow = '';
let date = null;     // the date line, once drawn
let refill = null;   // redraws the open panel for the page now on screen

/** The date in words, redrawn only when the day has turned. */
function paintDate() {
  const now = new Date();
  const words = todayWords(now);
  if (!date || date.dataset.words === words) return;
  date.dataset.words = words;
  date.setAttribute('datetime', todayCentral(now));
  date.replaceChildren(lineIcon('calendar'), words);
}

/** Where the panel opens: the page, the builder's step on screen, a how-to's part on screen. */
function placeNow() {
  const step = document.querySelector('.wizard-step:not([hidden])')?.dataset.step ?? '';
  const lit = document.querySelector('.chips a[aria-current], .jump a[aria-current]');
  let part = (lit ? lit.hash : location.hash).slice(1);
  try { part = decodeURIComponent(part); } catch { part = ''; }
  return panelPlace({ screen: screenNow, path: location.pathname, part, step });
}

/** A link in the panel: its icon, then its words. */
function guideLink(guide) {
  const a = el('a', 'howto-other');
  a.href = guide.href;
  a.append(lineIcon(guide.icon), el('span', '', guide.title));
  return a;
}

/** The panel's words for a place: the guide and its parts first, then every other guide by heading. */
function fill(body, { first, restLabel, groups }) {
  const nodes = [];
  if (first) {
    const card = el('div', 'howto-card');
    const lead = el('a', 'howto-guide');
    lead.href = first.guide.href;
    const tile = el('span', 'howto-tile');
    tile.append(lineIcon(first.guide.icon));
    lead.append(tile, el('span', 'howto-guide-title', first.guide.title), el('span', 'howto-guide-line', first.guide.line));
    card.append(lead);
    if (first.parts.length) {
      const list = el('ul', 'howto-parts');
      for (const part of first.parts) {
        const a = el('a', 'howto-part');
        a.href = part.href;
        a.append(el('span', 'howto-part-name', part.name));
        if (part.here) a.append(el('span', 'howto-here', 'This page'));
        if (part.current) a.setAttribute('aria-current', 'true');
        a.append(lineIcon('chevron'));
        const li = el('li');
        li.append(a);
        list.append(li);
      }
      card.append(list);
    }
    nodes.push(el('p', 'howto-label', first.label), card);
  }
  nodes.push(el('p', 'howto-label', restLabel));
  for (const group of groups) {
    const section = el('section', 'howto-group');
    const list = el('ul', 'howto-list');
    for (const guide of group.guides) {
      const li = el('li');
      li.append(guideLink(guide));
      list.append(li);
    }
    section.append(el('h3', 'howto-group-title', group.label), list);
    nodes.push(section);
  }
  body.replaceChildren(...nodes);
}

function build(nav) {
  const corner = el('div', 'page-corner');
  date = el('time', 'today-line');
  const opener = el('button', 'howto-open');
  opener.type = 'button';
  opener.setAttribute('aria-haspopup', 'dialog');
  opener.setAttribute('aria-expanded', 'false');
  opener.setAttribute('aria-controls', PANEL_ID);
  opener.append(lineIcon('book'), 'How-tos');
  corner.append(date, opener);
  // Beside the sidebar, before the page's own column: css/shell.css seats it
  // at the column's top right, and the status line keeps its words clear of it.
  nav.after(corner);
  paintDate();
  // A minute's clock keeps the date right past midnight, and a tab that slept comes back to today.
  setInterval(paintDate, 30_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paintDate(); });
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => document.documentElement.style.setProperty('--corner-w', `${Math.ceil(corner.getBoundingClientRect().width)}px`)).observe(corner);
  }

  const panel = el('dialog', 'howto-panel');
  panel.id = PANEL_ID;
  panel.setAttribute('aria-labelledby', TITLE_ID);
  const head = el('div', 'howto-panel-head');
  const title = el('h2', 'howto-panel-title', 'How-tos');
  title.id = TITLE_ID;
  const shut = el('button', 'howto-close');
  shut.type = 'button';
  shut.setAttribute('aria-label', 'Close');
  shut.append(lineIcon('close'));
  head.append(title, shut);
  const body = el('div', 'howto-panel-body');
  panel.append(head, body);
  document.body.append(panel);

  refill = () => fill(body, panelModel(placeNow()));
  opener.addEventListener('click', () => {
    if (panel.open) return;
    refill();
    panel.showModal();
    opener.setAttribute('aria-expanded', 'true');
  });
  shut.addEventListener('click', () => panel.close());
  // A click beside the panel lands on the dialog itself, behind its words: it closes.
  panel.addEventListener('click', event => { if (event.target === panel) panel.close(); });
  // A link followed closes it, so a part of the guide on this page shows at once.
  body.addEventListener('click', event => { if (event.target.closest('a')) panel.close(); });
  // Escape closes it wherever focus is (the browser's own close request does too).
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.open) { event.preventDefault(); panel.close(); }
  });
  panel.addEventListener('close', () => {
    opener.setAttribute('aria-expanded', 'false');
    opener.focus();
  });
}

/** Draws the corner once, beside the page's sidebar, and keeps the page it is
 *  on; a page that changes under the open panel (Back, say) redraws its words. */
export function renderCorner({ screen } = {}) {
  const moved = (screen ?? '') !== screenNow;
  screenNow = screen ?? '';
  if (date) {
    if (moved && document.getElementById(PANEL_ID)?.open) refill?.();
    return;
  }
  if (typeof document === 'undefined') return;
  const nav = document.querySelector('nav.sidebar');
  if (nav) build(nav);
}
