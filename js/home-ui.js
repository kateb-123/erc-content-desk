/**
 * Home, the team's main page (Kate's Sep 15 sketch; the sidebar since Sep 16):
 * a stats strip on top — last issue, Exchange updated, next newsletter, the
 * queue count — then the shared submit form, and the queue table folded at
 * the bottom (a details, its own chevron). Every way elsewhere is in the
 * sidebar. The form and the fold are mounted once and left alone on
 * re-renders, so typing is never wiped and the fold stays the way it was
 * left; the strip and the table inside the fold rebuild.
 */
import { renderSubmitForm } from './submit-form.js';
import { dotsLoader, faIcon } from './icons.js';
import { renderQueueTable } from './queue-ui.js';
import { queueBadgeCount, issueSummary, issueLine } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { EXCHANGE_URL } from './sidebar-view.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** One fact on the strip. With an href it is a link out (the Exchange). */
function fact(label, value, href) {
  const node = el(href ? 'a' : 'div', 'strip-fact');
  if (href) {
    node.href = href;
    node.target = '_blank';
    node.rel = 'noreferrer';
  }
  node.append(el('span', 'strip-label', label));
  node.append(el('span', 'strip-value', value));
  return node;
}

export function renderHome(container, props) {
  const {
    rows, schedule, today, loaded, hubUpdated, lastIssue,
    onGoTo, onSubmitted, onRefresh, onDeleteFromQueue,
  } = props;
  // The shell (form, links, headings) paints immediately — only the
  // data-backed parts wait on the ~4s Sheet read, so the page is usable at once.
  let strip = container.querySelector('.stats-strip');
  if (!strip) {
    strip = el('div', 'stats-strip');
    const grid = el('div', 'home-grid');
    const formSide = el('div', 'home-form card');
    // The team already knows what belongs here — the ask is for detail, not
    // permission. (The public share page keeps the fuller framing.)
    formSide.append(el('h2', '', 'Add to the queue'));
    formSide.append(el('p', 'lede', 'Share whatever details you have.'));
    const mount = el('div');
    formSide.append(mount);
    renderSubmitForm(mount, { onSubmitted });
    grid.append(formSide);
    // The fold: a native details, closed on arrival, whose open state lives in
    // the DOM (the element is never rebuilt, so a data re-render keeps it).
    const fold = el('details', 'queue-fold');
    fold.id = 'home-queue';
    fold.append(el('summary'), el('div', 'queue-body'));
    container.replaceChildren(strip, grid, fold);
  }

  // ── The stats strip: one line of facts. ──
  const dash = v => (!loaded ? '…' : (v || '—'));
  strip.replaceChildren();
  strip.append(fact('Last issue', dash(isoToShort(lastIssue, today))));
  strip.append(fact('Exchange updated', dash(isoToShort(hubUpdated, today)), EXCHANGE_URL));
  // The next newsletter's date and count (back on the strip since the rail
  // went, Sep 16); it opens the Next newsletter page.
  const issue = nextIssueDate(schedule, today);
  const nextFact = el('button', 'strip-fact strip-go');
  nextFact.type = 'button';
  nextFact.append(el('span', 'strip-label', 'Next newsletter'));
  nextFact.append(el('span', 'strip-value', dash(issue ? issueLine(issueSummary(rows, issue).inIssue, isoToShort(issue, today)) : '')));
  nextFact.addEventListener('click', () => onGoTo('issue'));
  strip.append(nextFact);
  // The count opens the queue fold and goes there.
  const count = loaded ? String(queueBadgeCount(rows)) : '·';
  const queueFact = el('button', 'strip-fact strip-jump');
  queueFact.type = 'button';
  queueFact.setAttribute('aria-controls', 'home-queue');
  queueFact.append(el('span', 'strip-label', 'In the queue'));
  const queueSide = el('span', 'strip-side');
  queueSide.append(el('span', 'queue-badge', count));
  queueSide.append(el('span', 'strip-label', 'waiting'));
  queueSide.append(faIcon('chevron-down'));
  queueFact.append(queueSide);
  queueFact.addEventListener('click', () => {
    const fold = container.querySelector('.queue-fold');
    fold.open = true;
    fold.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  strip.append(queueFact);

  // ── The queue, folded at the bottom. The summary is the heading. ──
  const summary = container.querySelector('.queue-fold summary');
  summary.replaceChildren(faIcon('chevron-down'), el('span', '', 'In the queue'), el('span', 'queue-badge', count));
  const body = container.querySelector('.queue-body');
  if (!loaded) body.replaceChildren(dotsLoader());
  else renderQueueTable(body, { rows, schedule, today, onRefresh, onDelete: onDeleteFromQueue, bare: true });
}
