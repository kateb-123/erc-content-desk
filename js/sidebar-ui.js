/**
 * The sidebar: built once into <nav class="side">, then only the lit item
 * changes on each render. Screen items switch in place, or open the
 * pipeline in its own window from the front door; outside pages open in a
 * new tab; the three hand-outs carry a copy icon that puts one sentence with
 * the link on the clipboard (Kate, Sep 16).
 */
import { NAV, SECTION_SCREENS, currentKey, opensNewWindow } from './sidebar-view.js';
import { faIcon } from './icons.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

function build(nav, { isSectionWindow, onGo }) {
  nav.replaceChildren();
  for (const group of NAV) {
    const box = el('div', 'side-group');
    if (group.label) box.append(el('span', 'side-label', group.label));
    for (const item of group.items) {
      const row = el('div', 'side-row');
      const a = el('a', item.key === 'home' ? 'side-item is-brand' : 'side-item');
      a.dataset.key = item.key;
      // Only the pipeline's screens answer to a hash; the front door's pages start at /.
      a.href = item.href ?? (SECTION_SCREENS.includes(item.screen) ? `/#${item.screen}` : '/');
      a.append(faIcon(item.icon), el('span', 'side-text', item.label));
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
  nav.dataset.built = '1';
}

export function renderSidebar(nav, { screen, isSectionWindow, onGo }) {
  if (!nav) return;
  if (!nav.dataset.built) build(nav, { isSectionWindow, onGo });
  const current = currentKey(screen);
  for (const a of nav.querySelectorAll('.side-item')) {
    const here = a.dataset.key === current;
    a.classList.toggle('is-current', here);
    if (here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}
