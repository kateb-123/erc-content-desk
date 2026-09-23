/**
 * The team's page, Submit content (Kate's sketch and the design handoff, Sep 22):
 * the share form in a white box on the left with the Queue under it, an
 * open list of what is waiting; on the right the three public Quick links
 * with Copy link, and the two doors, Content Sort in place and Newsletter in
 * its own window. The form is mounted once and left alone on re-renders, so
 * typing is never wiped; the queue and the counts redraw.
 */
import { renderSubmitForm } from './submit-form.js';
import { faIcon } from './icons.js';
import { laneCounts, quickLinkNotes } from './home-panel.js';
import { sortList } from './sort-view.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { LANES } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

/** Everything the page links to, in one list (Kate's pick C, Sep 23). The
 *  three public pages the team shares: the standalone share page and listserv
 *  sign-up at erc-share.vercel.app (public-pages/ in this repo, a Vercel
 *  project of its own since Sep 22; never on the desk's address, which has no
 *  password), and the Exchange itself. Then the Newsletter, the desk's own hub,
 *  which opens in its own window and carries no Copy link: its address is the
 *  desk's, and the desk is not for handing out. No row shows its address (Kate,
 *  Sep 23); a row says what it is or what is happening on it instead. */
export const QUICK_LINKS = [
  { key: 'share', label: 'Submit content', href: 'https://erc-share.vercel.app/submit/', icon: 'paper-plane', sub: 'The form anyone can use' },
  { key: 'listserv', label: 'Join listserv', href: 'https://erc-share.vercel.app/listserv/', icon: 'user-plus', sub: 'Where people sign up' },
  { key: 'exchange', label: 'ERC Policy Exchange', href: 'https://erc-policy-exchange.vercel.app/', icon: 'globe' },
  { key: 'newsletter', label: 'Newsletter', href: '/#newsletter', icon: 'envelope', inHouse: true },
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
  a.href = item.href; a.target = '_blank'; a.rel = 'noopener';   // the newsletter is its own hub too (Kate, Sep 22)
  a.append(' ', faIcon('arrow-up-right-from-square'));
  // One line under the name: what is happening on it (quickLinkNotes, filled
  // once the rows are in), or what it is when there is nothing to report.
  const note = el('div', 'ql-note', item.sub ?? '');
  note.dataset.key = item.key;
  if (item.sub) note.dataset.sub = item.sub;
  words.append(a, note);
  left.append(ico, words);
  row.append(left);
  // Copy link writes the address and says so for two seconds; only this row
  // changes. The desk's own pages have none: their address stays in-house.
  if (!item.inHouse) {
    const copy = el('button', 'linkish ql-copy', 'Copy link');
    copy.type = 'button';
    copy.dataset.focus = `copy:${item.key}`;
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(item.href); } catch { return; }
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy link'; }, 2000);
    });
    row.append(copy);
  }
  return row;
}

/** Content Sort, the one thing on this page that is work rather than a link
 *  (Kate's pick C, Sep 23): its own filled button under the Quick links. */
function sortDoor(onGoTo) {
  const lane = LANES.find(l => l.key === 'sort');
  const a = el('a', 'sort-door');
  a.href = lane.href;
  a.dataset.key = lane.key;
  a.addEventListener('click', event => { event.preventDefault(); onGoTo(lane.key); });
  a.append(faIcon('inbox'), el('span', 'door-name', lane.label), el('span', 'door-count'), faIcon('arrow-right'));
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
    side.append(links, sortDoor(onGoTo));
    cols.append(main, side);
    page.append(head, cols);
    container.replaceChildren(page);
  }

  // The counts once the rows are in: what waits on each page.
  const issue = nextIssueDate(schedule, today);
  const counts = loaded ? laneCounts(rows, { schedule, issue, today, preview: null }) : null;
  for (const a of page.querySelectorAll('.sort-door')) a.querySelector('.door-count').textContent = counts ? String(counts[a.dataset.key]) : '';
  // Under each Quick link: the Exchange's last update, the last issue and the
  // next, what waits for the newsletter (Kate, Sep 22 and 23). A row with
  // nothing to report falls back to the line that says what it is.
  const notes = loaded ? quickLinkNotes(rows, { schedule, today }) : null;
  for (const n of page.querySelectorAll('.ql-note')) n.textContent = (notes && notes[n.dataset.key]) || n.dataset.sub || '';

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
