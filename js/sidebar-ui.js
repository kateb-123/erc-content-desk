/**
 * The sidebar: built once into <nav class="side">, then only the lit item,
 * the Sort count and the fold change on each render. Screen items switch in
 * place, or open the pipeline in its own window from the front door; outside
 * pages open in a new tab; the three hand-outs carry a copy icon that puts
 * one sentence with the link on the clipboard. Desk work folds, and the desk
 * remembers it shut (Kate, Sep 16, Claude Design round two). On a Desk work
 * screen the sidebar tucks behind a thin grey strip with a menu button and
 * comes back in place when opened (Kate, Sep 16, from four clickable options).
 */
import { NAV, SECTION_SCREENS, currentKey, opensNewWindow, foldOpen, menuLayout } from './sidebar-view.js';
import { faIcon } from './icons.js';

const FOLD_KEY = 'desk.deskWorkFold';

// Desk work's tucked sidebar: whether it is open, and the strip, menu button
// and close button that build() makes once.
let menuOpen = false;
const menu = { nav: null, strip: null, burger: null, close: null };

function paintMenu() {
  const { nav, strip, burger } = menu;
  if (!nav) return;
  const layout = menuLayout(screenRef.screen, menuOpen);
  nav.classList.toggle('is-tucked', !layout.sidebar);
  nav.classList.toggle('can-close', layout.close);
  strip.classList.toggle('is-shown', layout.strip);
  burger.setAttribute('aria-expanded', String(layout.close));
}

function setMenu(open, focusTo) {
  menuOpen = open;
  paintMenu();
  focusTo?.focus();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readFold() {
  try { return localStorage.getItem(FOLD_KEY); } catch { return null; }
}

function writeFold(value) {
  try { localStorage.setItem(FOLD_KEY, value); } catch { /* a blocked store just forgets */ }
}

function copyButton(item) {
  const btn = el('button', 'side-copy');
  btn.type = 'button';
  btn.title = `Copy the link for ${item.label}`;
  btn.setAttribute('aria-label', `Copy the link for ${item.label}`);
  const icon = faIcon('copy');
  btn.append(icon);
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(item.copy);
      icon.className = 'fa-solid fa-check';
      btn.title = 'Copied';
    } catch {
      btn.title = "Can't copy";
    }
    setTimeout(() => { icon.className = 'fa-solid fa-copy'; btn.title = `Copy the link for ${item.label}`; }, 1500);
  });
  return btn;
}

function heading(group, box, screenRef) {
  if (!group.fold) {
    const label = el('span', 'side-label');
    label.append(faIcon(group.icon), group.label);
    return label;
  }
  const btn = el('button', 'side-label side-fold');
  btn.type = 'button';
  const chevron = faIcon('chevron-down');
  chevron.classList.add('side-chevron');
  btn.append(faIcon(group.icon), group.label, chevron);
  btn.addEventListener('click', () => {
    const open = !box.classList.contains('is-folded');
    writeFold(open ? 'closed' : 'open');
    paintFold(box, btn, foldOpen(readFold(), screenRef.screen));
  });
  return btn;
}

function paintFold(box, btn, open) {
  box.classList.toggle('is-folded', !open);
  btn.setAttribute('aria-expanded', String(open));
  const chevron = btn.querySelector('.side-chevron');
  if (chevron) chevron.className = `fa-solid fa-chevron-${open ? 'down' : 'right'} side-chevron`;
}

function build(nav, { isSectionWindow, onGo, screenRef }) {
  nav.replaceChildren();
  for (const group of NAV) {
    const box = el('div', 'side-group');
    if (group.fold) box.classList.add('is-fold');
    if (group.label) box.append(heading(group, box, screenRef));
    for (const item of group.items) {
      const row = el('div', 'side-row');
      const a = el('a', item.key === 'home' ? 'side-item is-brand' : 'side-item');
      a.dataset.key = item.key;
      // A pick tucks the Desk work menu away again, before the screen switches.
      a.addEventListener('click', () => { if (menuOpen) setMenu(false); });
      // Only the pipeline's screens answer to a hash; the front door's pages start at /.
      a.href = item.href ?? (SECTION_SCREENS.includes(item.screen) ? `/#${item.screen}` : '/');
      if (item.icon) a.append(faIcon(item.icon));
      a.append(el('span', 'side-text', item.label));
      if (item.count) a.append(el('span', 'side-count'));
      if (opensNewWindow(item, isSectionWindow)) {
        a.target = '_blank';
        a.rel = 'noreferrer';
      } else {
        a.addEventListener('click', (event) => { event.preventDefault(); onGo(item.screen); });
      }
      row.append(a);
      if (item.copy) row.append(copyButton(item));
      box.append(row);
    }
    nav.append(box);
  }
  nav.id ||= 'desk-menu';
  const strip = el('div', 'side-strip');
  const burger = el('button', 'side-burger');
  burger.type = 'button';
  burger.setAttribute('aria-label', 'Show the menu');
  burger.setAttribute('aria-controls', nav.id);
  burger.setAttribute('aria-expanded', 'false');
  burger.append(faIcon('bars'));
  strip.append(burger);
  nav.after(strip);
  const close = el('button', 'side-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Hide the menu');
  close.append(faIcon('xmark'));
  // First in the top row, on the menu button's own spot: a second click in the
  // same place closes the menu instead of landing on the home link.
  nav.querySelector('.side-item.is-brand')?.parentElement.prepend(close);
  burger.addEventListener('click', () => setMenu(true, close));
  close.addEventListener('click', () => setMenu(false, burger));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menuOpen) setMenu(false, burger); });
  Object.assign(menu, { nav, strip, burger, close });
  nav.dataset.built = '1';
}

// The screen the fold should respect, read when the heading is clicked.
const screenRef = { screen: 'home' };

export function renderSidebar(nav, { screen, isSectionWindow, onGo, queueCount }) {
  if (!nav) return;
  if (screenRef.screen !== screen) menuOpen = false;   // every screen starts with the menu tucked
  screenRef.screen = screen;
  if (!nav.dataset.built) build(nav, { isSectionWindow, onGo, screenRef });
  const current = currentKey(screen);
  for (const a of nav.querySelectorAll('.side-item')) {
    const here = a.dataset.key === current;
    a.classList.toggle('is-current', here);
    if (here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const count = nav.querySelector('.side-count');
  if (count) count.textContent = queueCount == null ? '' : String(queueCount);
  const foldBox = nav.querySelector('.side-group.is-fold');
  if (foldBox) paintFold(foldBox, foldBox.querySelector('.side-fold'), foldOpen(readFold(), screen));
  paintMenu();
}
