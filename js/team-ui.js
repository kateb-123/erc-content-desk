/**
 * The team's page, Submit content (Kate's sketch and the design handoff, Sep 22):
 * the share form in a white box on the left with the Queue under it, a fold
 * that opens open; on the right the three public Quick links with Copy link,
 * then the desk's own two as filled buttons, the Newsletter and Content Sort,
 * each switching in place (Kate, Sep 23). The form is mounted once and left alone on re-renders, so
 * typing is never wiped; the queue and the counts redraw.
 */
import { renderSubmitForm } from './submit-form.js';
import { faIcon } from './icons.js';
import { laneCounts, quickLinkNotes } from './home-panel.js';
import { sortList } from './sort-view.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { LANES, openedScreen } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

/** Quick links are the three PUBLIC-facing pages and nothing else (Kate,
 *  Sep 23): the standalone share page and listserv sign-up at
 *  erc-share.vercel.app (public-pages/ in this repo, a Vercel project of its
 *  own since Sep 22; never on the desk's address, which has no password), and
 *  the Exchange itself. No row shows its address (her words: "I friggin hate
 *  having the url displayed"); a row says what it is, or what is happening on
 *  it. The desk's own pages are the buttons under the box. */
export const QUICK_LINKS = [
  { key: 'share', label: 'Submit content', href: 'https://erc-share.vercel.app/submit/', icon: 'square-plus', sub: 'Public facing link' },
  { key: 'listserv', label: 'Join listserv', href: 'https://erc-share.vercel.app/listserv/', icon: 'address-book', sub: 'Public facing link' },
  { key: 'exchange', label: 'ERC Policy Exchange', href: 'https://erc-policy-exchange.vercel.app/', icon: 'display', sub: 'Public facing link' },
];

/** The desk's own work, a filled button each (Kate, Sep 23): the Newsletter
 *  first, then Content Sort, both switching in place. Only Content Sort
 *  wears a badge; the newsletter's pool is not something to be alerted about,
 *  so it says which issue is next instead (her word, Sep 23). */
export const DESK_DOORS = [
  { key: 'newsletter', icon: 'newspaper' },
  { key: 'sort', icon: 'layer-group', badge: true },
];

function sectionHead(label, note) {
  const head = el('div', 'section-head');
  head.append(el('h3', 'section-label', label));
  if (note !== undefined) head.append(el('span', 'section-note', note));
  return head;
}

/** The Queue folds from a chevron on its left (Kate, Sep 23), the way every
 *  other fold on the desk does: pointing down while open, right while shut.
 *  It opens open, and stays as it is left for the visit. */
let queueOpen = true;

function queueHead(list) {
  const head = el('div', 'section-head');
  const label = el('h3', 'section-label');
  const toggle = el('button', 'fold-toggle');
  toggle.type = 'button';
  const draw = () => {
    toggle.replaceChildren(faIcon(queueOpen ? 'chevron-down' : 'chevron-right'), el('span', '', 'Queue'));
    toggle.setAttribute('aria-expanded', String(queueOpen));
    list.hidden = !queueOpen;
  };
  toggle.addEventListener('click', () => { queueOpen = !queueOpen; draw(); });
  draw();
  label.append(toggle);
  head.append(label, el('span', 'section-note', ''));
  return head;
}

function quickLink(item) {
  const row = el('div', 'ql-row');
  const left = el('div', 'ql-left');
  const ico = el('span', 'ql-ico');
  ico.append(faIcon(item.icon));
  const words = el('div', 'ql-words');
  const a = el('a', 'ql-name', item.label);
  a.href = item.href; a.target = '_blank'; a.rel = 'noopener';
  a.append(' ', faIcon('arrow-up-right-from-square'));
  // Under the name: what the row is, then what is happening on it, if
  // anything (quickLinkNotes, filled once the rows are in).
  const note = el('div', 'ql-note');
  note.dataset.key = item.key;
  words.append(a, el('div', 'ql-sub', item.sub ?? ''), note);
  left.append(ico, words);
  row.append(left);
  // Copy link writes the address and says so for two seconds; only this row
  // changes. Every row in the box is a public page, so every row has one.
  const copy = el('button', 'linkish ql-copy', 'Copy link');
  copy.type = 'button';
  copy.dataset.focus = `copy:${item.key}`;
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(item.href); } catch { return; }
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy link'; }, 2000);
  });
  row.append(copy);
  return row;
}

/** A door to the desk's own work: the filled button under the Quick links,
 *  with the lane's name, whatever is next on it, and its count as a badge.
 *  It switches in place to the screen its address opens, the way the front
 *  page's cards do: the Newsletter's lane key is not its screen's. */
function deskDoor(door, onGoTo) {
  const lane = LANES.find(l => l.key === door.key);
  const a = el('a', 'sort-door');
  a.href = lane.href;
  a.dataset.key = lane.key;
  a.addEventListener('click', event => { event.preventDefault(); onGoTo(openedScreen(new URL(a.href, location.href).hash)); });
  const words = el('span', 'door-words');
  const note = el('span', 'door-note');
  note.dataset.key = lane.key;
  words.append(el('span', 'door-name', lane.label), note);
  a.append(faIcon(door.icon), words);
  if (door.badge) a.append(el('span', 'door-count'));
  a.append(faIcon('arrow-right'));
  return a;
}

function queueRow(row, today) {
  const box = el('div', 'queue-row');
  box.append(el('div', 'queue-title', row.headline || row.link || '(untitled)'));
  const meta = [row.source, row.submitter && `added by ${row.submitter}`, isoToShort(row.submitted_at, today)].filter(Boolean).join(' · ');
  box.append(el('div', 'queue-meta', meta));
  return box;
}

export function renderTeam(container, props) {
  const { rows, schedule, today, loaded, loadFailed, onGoTo, onSubmitted, onRefresh, knownLinks } = props;
  let page = container.querySelector('.team-page');
  if (!page) {
    page = el('div', 'team-page');
    const head = el('div', 'page-head');
    head.append(el('h2', 'page-title', 'Submit content'), el('p', 'lede', 'It lands in the queue and the desk sorts it before it goes out.'));
    const cols = el('div', 'team-cols');
    const main = el('div', 'team-main');
    const box = el('div', 'form-box');
    renderSubmitForm(box, { onSubmitted, knownLinks });
    const queue = el('section', 'queue');
    const queueRows = el('div', 'queue-rows');
    queue.append(queueHead(queueRows), queueRows);
    main.append(box, queue);
    const side = el('aside', 'team-side');
    const links = el('section', 'side-box');
    links.append(sectionHead('Quick links'));
    for (const item of QUICK_LINKS) links.append(quickLink(item));
    side.append(links, ...DESK_DOORS.map(door => deskDoor(door, onGoTo)));
    cols.append(main, side);
    page.append(head, cols);
    container.replaceChildren(page);
  }

  // The counts once the rows are in: what waits on each page.
  const issue = nextIssueDate(schedule, today);
  const counts = loaded ? laneCounts(rows, { schedule, issue, today, preview: null }) : null;
  // A door's badge, where it has one: the count, and nothing at all at zero.
  for (const badge of page.querySelectorAll('.sort-door .door-count')) {
    const n = counts ? counts[badge.parentElement.dataset.key] : null;
    badge.textContent = n ? String(n) : '';
  }
  // The live line under each row: the Exchange's last update, the newsletter's
  // next issue (Kate, Sep 22 and 23). It sits under the row's own line, which
  // says what the row is, and a row with nothing to report shows none.
  const notes = loaded ? quickLinkNotes(rows, { schedule, today }) : null;
  for (const n of page.querySelectorAll('.ql-note, .door-note')) n.textContent = (notes && notes[n.dataset.key]) || '';

  // The queue, read only: every waiting item, newest first.
  const list = page.querySelector('.queue-rows');
  const note = page.querySelector('.queue .section-note');
  if (!loaded) {
    note.textContent = '';
    list.replaceChildren(loadFailed ? tryAgain(onRefresh) : el('p', 'queue-meta', 'Loading'));
    return;
  }
  const waiting = sortList(rows).live;
  note.textContent = `${waiting.length} waiting · newest first`;
  list.replaceChildren(...(waiting.length ? waiting.map(r => queueRow(r, today)) : [el('p', 'queue-meta', 'Nothing waiting.')]));
}
