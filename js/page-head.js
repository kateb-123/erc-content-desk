/**
 * A lane page's head (Kate's wireframes, Sep 17): the title, then its tabs,
 * each with an optional count, and an optional fact at the row's right. A
 * tab is a screen of its own (Sort content's Sort and Finalize, Newsletter's
 * Next issue and Past issues), so each of those screens draws this head.
 */
import { adjacentTab } from './sort-view.js';
import { el } from './ui-aids.js';

/** The tab row under a page's title: tabs [{ key, label, count? }], the
 *  active key, and an optional fact at the row's right; canLeave() says
 *  whether the page may switch now. Read as tabs: one tab stop, Left and
 *  Right move, Home and End jump. The Content queue draws it under its hub
 *  head (Oct 8). */
export function tabBar({ label, tabs, active, note = '', onGoTo, canLeave = () => true }) {
  const bar = el('div', 'page-tabs');
  const nav = el('div', 'tabs');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', label);
  const go = key => { if (key !== active && canLeave()) onGoTo(key); };
  for (const { key, label: words, count } of tabs) {
    const tab = el('button', `tab${key === active ? ' is-active' : ''}`, words);
    tab.type = 'button';
    tab.dataset.focus = `tab:${key}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(key === active));
    tab.tabIndex = key === active ? 0 : -1;
    if (count != null) tab.append(el('span', 'tab-count', String(count)));
    tab.addEventListener('click', () => go(key));
    nav.append(tab);
  }
  nav.addEventListener('keydown', event => {
    const next = adjacentTab(tabs.map(t => t.key), active, event.key);
    if (!next) return;
    event.preventDefault();
    go(next);
  });
  bar.append(nav);
  if (note) bar.append(el('span', 'page-tabs-note', note));
  return bar;
}

/** tabs: [{ key, label, count? }]; active: the key of this screen;
 *  canLeave() says whether the screen may switch now. */
export function pageHead({ title, tabs, active, note = '', onGoTo, canLeave = () => true }) {
  const head = el('div', 'page-head');
  head.append(el('h2', 'page-title', title), tabBar({ label: title, tabs, active, note, onGoTo, canLeave }));
  return head;
}

/** Sort content's head: Sort and Finalize with their counts, and on the Sort
 *  tab how long the oldest item has waited. */
export function sortPageHead({ active, counts, oldestDays = null, onGoTo, canLeave }) {
  const note = active === 'sort' && oldestDays !== null
    ? (oldestDays === 0 ? 'Oldest came in today' : `Oldest has waited ${oldestDays} day${oldestDays === 1 ? '' : 's'}`)
    : '';
  return pageHead({
    title: 'Content Sort', active, note, onGoTo, canLeave,
    tabs: [{ key: 'sort', label: 'Sort', count: counts?.sort }, { key: 'finalize', label: 'Finalize', count: counts?.finalize }],
  });
}

/** Newsletter's head: Next issue and Past issues. */
export function newsletterPageHead({ active, onGoTo, canLeave }) {
  return pageHead({
    title: 'Newsletter', active, onGoTo, canLeave,
    tabs: [{ key: 'issue', label: 'Next issue' }, { key: 'schedule', label: 'Schedule' }, { key: 'past', label: 'Past issues' }],   // Schedule since Sep 22
  });
}
