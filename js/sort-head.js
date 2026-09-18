/**
 * The head of the Sort content page (Kate's wireframes, Sep 17): the title,
 * then two tabs, Sort and Finalize, each with its count, and on the Sort tab
 * how long the oldest item has waited. Sort and Finalize are two screens
 * drawn as one page, so both draw this head.
 */
import { adjacentTab } from './sort-view.js';
import { el } from './ui-aids.js';

const TABS = [['sort', 'Sort'], ['finalize', 'Finalize']];

/** active: 'sort' | 'finalize'; counts: { sort, finalize }; oldestDays: a
 *  number or null; canLeave() says whether the screen may switch now. */
export function sortPageHead({ active, counts, oldestDays = null, onGoTo, canLeave = () => true }) {
  const head = el('div', 'page-head');
  head.append(el('h2', 'page-title', 'Sort content'));
  const bar = el('div', 'page-tabs');
  const nav = el('div', 'tabs');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Sort content');
  const go = key => { if (key !== active && canLeave()) onGoTo(key); };
  for (const [key, label] of TABS) {
    const tab = el('button', `tab${key === active ? ' is-active' : ''}`, label);
    tab.type = 'button';
    tab.dataset.focus = `tab:${key}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(key === active));
    tab.tabIndex = key === active ? 0 : -1;
    if (counts?.[key] != null) tab.append(el('span', 'tab-count', String(counts[key])));
    tab.addEventListener('click', () => go(key));
    nav.append(tab);
  }
  nav.addEventListener('keydown', event => {
    const next = adjacentTab(TABS.map(([key]) => key), active, event.key);
    if (!next) return;
    event.preventDefault();
    go(next);
  });
  bar.append(nav);
  if (active === 'sort' && oldestDays !== null) {
    bar.append(el('span', 'page-tabs-note', oldestDays === 0 ? 'Oldest came in today'
      : `Oldest has waited ${oldestDays} day${oldestDays === 1 ? '' : 's'}`));
  }
  head.append(bar);
  return head;
}
