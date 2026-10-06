/**
 * The Content queue hub (Kate's drawn map, Oct 6, 2026): everything ever
 * submitted, newest first, each saying where it stands now, with a search by
 * title or source; outside submissions tagged From outside, never with a
 * name or an email (the page is open). Content Sort hangs under it, behind
 * the password: its door sits at the page's right with how many wait. The
 * page is built once and only the list redraws, so the search keeps its
 * typing.
 */
import { contentQueue } from './queue-view.js';
import { sortList } from './sort-view.js';
import { hubHead, HUB_LEDES } from './hub-head.js';
import { faIcon } from './icons.js';
import { el, busyLine, tryAgain } from './ui-aids.js';

let term = '';   // the search, for the visit

const WHERE_CLASS = { Waiting: 'badge badge-waiting', Kept: 'badge', 'On the Exchange': 'badge badge-live' };
const whereClass = word => WHERE_CLASS[word] ?? 'badge badge-new';   // In the <date> issue

/** A line saying something is coming, in the quiet grey (her red Forthcoming). */
export function forthcoming(words) {
  const line = el('p', 'forthcoming');
  line.append(faIcon('clock'), ` ${words} · Forthcoming`);
  return line;
}

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
  page.append(hubHead('Content queue', HUB_LEDES.queue), split);
  container.replaceChildren(page);
  return page;
}

export function renderQueue(container, props) {
  const { rows, today, loaded, loadFailed, onGoTo, onRefresh } = props;
  const page = container.querySelector('.queue-hub') ?? build(container, onGoTo);
  const list = page.querySelector('.qh-list');
  const count = page.querySelector('.qh-count');
  const search = page.querySelector('.qh-search');
  const note = page.querySelector('.qh-door .door-note');
  // Typing redraws the list alone, from the rows this draw was handed.
  search.oninput = () => { term = search.value; renderQueue(container, props); };

  if (!loaded) {
    count.textContent = '';
    note.textContent = '';
    list.replaceChildren(loadFailed ? tryAgain(onRefresh) : busyLine('Loading the queue'));
    return;
  }
  const waiting = sortList(rows).live.length;
  note.textContent = waiting ? `${waiting} waiting` : 'Nothing waiting';
  const all = contentQueue(rows, { today });
  const shown = term.trim() ? contentQueue(rows, { today, term }) : all;
  count.textContent = term.trim()
    ? `${shown.length} of ${all.length} item${all.length === 1 ? '' : 's'}`
    : `${all.length} item${all.length === 1 ? '' : 's'} · newest first`;
  list.replaceChildren(...(shown.length
    ? shown.map(queueRow)
    : [el('p', 'qh-empty', all.length ? 'Nothing matches that search.' : 'Nothing submitted yet.')]));
}
