/**
 * The screen-header info door: "View info" sits beside
 * the title and opens a tinted instruction panel. Open/closed is remembered
 * per screen for the visit — re-renders keep whatever state the reader chose.
 */
import { el, button } from './ui-aids.js';

const openInfo = new Set();

export function titleWithInfo(title, key, text) {
  const row = el('div', 'title-row');
  const h2 = el('h2', '', title);
  const panel = el('div', 'info-panel', text);
  panel.id = `info-${key}`;
  const toggle = button('', 'info-toggle');
  toggle.setAttribute('aria-controls', panel.id);
  const sync = () => {
    panel.hidden = !openInfo.has(key);
    toggle.textContent = openInfo.has(key) ? 'Hide info' : 'View info';
    toggle.setAttribute('aria-expanded', String(openInfo.has(key)));
  };
  toggle.addEventListener('click', () => {
    if (openInfo.has(key)) openInfo.delete(key);
    else openInfo.add(key);
    sync();
  });
  sync();
  row.append(h2, toggle);
  return { row, panel };
}

/** The head Finalize, Publish and Send to Newsletter share: the title with
 *  its info door, the panel it opens, and an empty lede the caller fills.
 *  Anything else on the head (a door, the one primary) goes on `head`. */
export function screenHead(title, key, text) {
  const head = el('div', 'screen-head finalize-head');
  const lead = el('div');
  const info = titleWithInfo(title, key, text);
  const lede = el('p', 'lede');
  lead.append(info.row, info.panel, lede);
  head.append(lead);
  return { head, lede };
}
