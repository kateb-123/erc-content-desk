/**
 * The Content queue hub (Kate's drawn map, Oct 6, 2026): everything ever
 * submitted, newest first, each saying where it stands now, with a search by
 * title or source; outside submissions tagged From outside, never with a
 * name or an email (the page is open). Content Sort hangs under it, behind
 * the password: its door sits at the page's right with how many wait. The
 * page is built once and only the list redraws, so the search keeps its
 * typing. Since Oct 8 it opens on what came in since the last issue went
 * out, with Everything as a second tab (Kate: "the queue has too many
 * items"; her pick of a second tab).
 */
import { contentQueue, lastIssueSent, isoToShort } from './queue-view.js';
import { tabBar } from './page-head.js';
import { sortList } from './sort-view.js';
import { hubHead, HUB_LEDES, forthcoming } from './hub-head.js';
import { faIcon } from './icons.js';
import { el, busyLine, tryAgain } from './ui-aids.js';

let term = '';   // the search, for the visit
let tab = 'since';   // the open tab, for the visit: since the last issue, or all

const WHERE_CLASS = { Waiting: 'badge badge-waiting', Kept: 'badge', 'On the Exchange': 'badge badge-live' };
const whereClass = word => WHERE_CLASS[word] ?? 'badge badge-new';   // In the <date> issue

function queueRow(entry) {
  const row = el('div', 'qh-row');
  const words = el('div', 'qh-words');
  const title = el('div', 'qh-title', entry.title);
  if (entry.outside) title.append(' ', el('span', 'badge badge-new qh-outside', 'From outside'));
  words.append(title, el('div', 'qh-meta', entry.meta));
  const where = el('div', 'qh-where');
  for (const word of entry.where) where.append(el('span', whereClass(word), word));
  row.append(words, where);
  return row;
}

function build(container, onGoTo) {
  const page = el('div', 'queue-hub');
  const split = el('div', 'qh-split');
  const main = el('div', 'qh-main');
  const bar = el('div', 'qh-bar');
  const count = el('span', 'qh-count');
  count.setAttribute('role', 'status');
  const search = el('input', 'qh-search');
  search.type = 'search';
  search.placeholder = 'Search by title or source';
  search.setAttribute('aria-label', 'Search the queue by title or source');
  search.value = term;
  bar.append(count, search);
  main.append(bar, el('div', 'qh-list'));

  const side = el('aside', 'qh-side');
  const door = el('a', 'sort-door qh-door');
  door.href = '/#sort';
  door.addEventListener('click', event => { event.preventDefault(); onGoTo('sort'); });
  const doorWords = el('span', 'door-words');
  doorWords.append(el('span', 'door-name', 'Content Sort'), el('span', 'door-note'));
  door.append(faIcon('lock'), doorWords, faIcon('arrow-right'));
  side.append(door, el('p', 'qh-side-note', 'Password protected. Sort and Finalize ask the desk password.'), forthcoming('How to sort'));

  split.append(main, side);
  page.append(hubHead('Content queue', HUB_LEDES.queue), el('div', 'qh-tabs'), split);
  container.replaceChildren(page);
  return page;
}

export function renderQueue(container, props) {
  const { rows, schedule, today, loaded, loadFailed, onGoTo, onRefresh } = props;
  const page = container.querySelector('.queue-hub') ?? build(container, onGoTo);
  const list = page.querySelector('.qh-list');
  const count = page.querySelector('.qh-count');
  const search = page.querySelector('.qh-search');
  const note = page.querySelector('.qh-door .door-note');
  const tabs = page.querySelector('.qh-tabs');
  // Typing redraws the list alone, from the rows this draw was handed.
  search.oninput = () => { term = search.value; renderQueue(container, props); };

  if (!loaded) {
    count.textContent = '';
    note.textContent = '';
    tabs.replaceChildren();
    list.replaceChildren(loadFailed ? tryAgain(onRefresh) : busyLine('Loading the queue'));
    return;
  }
  const waiting = sortList(rows).live.length;
  note.textContent = waiting ? `${waiting} waiting` : 'Nothing waiting';
  // The last issue that went out sets the first tab's cutoff; with none yet, both tabs hold everything.
  const since = lastIssueSent(schedule, today);
  const all = contentQueue(rows, { today });
  const fresh = since ? contentQueue(rows, { today, since }) : all;
  tabs.replaceChildren(tabBar({
    label: 'Content queue', active: tab,
    tabs: [{ key: 'since', label: 'Since the last issue', count: fresh.length }, { key: 'all', label: 'Everything', count: all.length }],
    note: since ? `Last issue: ${isoToShort(since, today)}` : '',
    onGoTo: key => { tab = key; renderQueue(container, props); tabs.querySelector('[aria-selected="true"]')?.focus(); },
  }));
  const listed = tab === 'since' ? fresh : all;
  const shownSince = tab === 'since' ? since : '';
  const shown = term.trim() ? contentQueue(rows, { today, since: shownSince, term }) : listed;
  count.textContent = term.trim()
    ? `${shown.length} of ${listed.length} item${listed.length === 1 ? '' : 's'}`
    : `${listed.length} item${listed.length === 1 ? '' : 's'} · newest first`;
  const empty = listed.length ? 'Nothing matches that search.'
    : shownSince ? `Nothing new since the ${isoToShort(since, today)} issue.` : 'Nothing submitted yet.';
  list.replaceChildren(...(shown.length ? shown.map(queueRow) : [el('p', 'qh-empty', empty)]));
}
