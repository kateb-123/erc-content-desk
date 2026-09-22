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
import { laneCounts } from './home-panel.js';
import { sortList } from './sort-view.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { LANES } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

/** The three public pages the team shares, all on the Exchange's address:
 *  the share page, the listserv sign-up, the Exchange itself. Copies on the
 *  desk's own address were tried and taken down the same day (Sep 22): the
 *  desk has no password, and a public page there is a door into it. */
export const QUICK_LINKS = [
  { key: 'share', label: 'Submit Content to ERC', href: 'https://erc-policy-exchange.vercel.app/share/' },
  { key: 'listserv', label: 'Join listserv', href: 'https://erc-policy-exchange.vercel.app/newsletter/' },
  { key: 'exchange', label: 'ERC Policy Exchange', href: 'https://erc-policy-exchange.vercel.app/' },
];

/** The address as a person reads it: no scheme, no trailing slash. */
const shownUrl = href => href.replace(/^https?:\/\//, '').replace(/\/$/, '');

function sectionHead(label, note) {
  const head = el('div', 'section-head');
  head.append(el('h3', 'section-label', label));
  if (note !== undefined) head.append(el('span', 'section-note', note));
  return head;
}

function quickLink(item) {
  const row = el('div', 'ql-row');
  const words = el('div', 'ql-words');
  const a = el('a', 'ql-name', item.label);
  a.href = item.href; a.target = '_blank'; a.rel = 'noopener';
  a.append(' ', faIcon('arrow-up-right-from-square'));
  words.append(a, el('div', 'ql-url', shownUrl(item.href)));
  row.append(words);
  // Copy link writes the address and says so for two seconds; only this row changes.
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

function doorRow(lane, { onGoTo, newWindow }) {
  const a = el('a', 'door-row');
  a.href = lane.href;
  a.dataset.key = lane.key;
  if (newWindow) { a.target = '_blank'; a.rel = 'noopener'; }   // the newsletter is its own hub (Kate, Sep 22)
  else a.addEventListener('click', event => { event.preventDefault(); onGoTo(lane.key); });
  a.append(el('span', 'door-name', lane.label), el('span', 'door-count'), faIcon('arrow-right'));
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
    queue.append(sectionHead('Queue', ''), el('div', 'queue-rows'));
    main.append(box, queue);
    const side = el('aside', 'team-side');
    const links = el('section', 'side-box');
    links.append(sectionHead('Quick links'));
    for (const item of QUICK_LINKS) links.append(quickLink(item));
    const work = el('section', 'side-box');
    work.append(sectionHead('Desk work'));
    const doors = el('div', 'door-rows');
    doors.append(doorRow(LANES.find(l => l.key === 'sort'), { onGoTo }), doorRow(LANES.find(l => l.key === 'newsletter'), { onGoTo, newWindow: true }));
    work.append(doors);
    side.append(links, work);
    cols.append(main, side);
    page.append(head, cols);
    container.replaceChildren(page);
  }

  // The counts once the rows are in: what waits on each page.
  const issue = nextIssueDate(schedule, today);
  const counts = loaded ? laneCounts(rows, { schedule, issue, today, preview: null }) : null;
  for (const a of page.querySelectorAll('.door-row')) a.querySelector('.door-count').textContent = counts ? String(counts[a.dataset.key]) : '';

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
