/**
 * Home, the team's main page (Kate's Sep 15 sketch; the sidebar since Sep 16):
 * four stat cards on top — the queue count, the next newsletter, Exchange
 * updated, the last newsletter — then the shared submit form, and the queue table folded at
 * the bottom (a details, its own chevron). Every way elsewhere is in the
 * sidebar. The form and the fold are mounted once and left alone on
 * re-renders, so typing is never wiped and the fold stays the way it was
 * left; the strip and the table inside the fold rebuild.
 */
import { renderSubmitForm } from './submit-form.js';
import { dotsLoader, faIcon } from './icons.js';
import { renderQueueTable } from './queue-ui.js';
import { queueBadgeCount, issueSummary, issueTally } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { EXCHANGE_URL, ARCHIVE_PATH } from './sidebar-view.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * One stat card (Kate's pick J, Sep 16): an icon, a label, the value in the
 * deep accent, on the tint. An href makes it a link out; an onClick makes
 * it a button; neither makes it a plain card.
 */
function stat({ icon, label, value, unit, href, onClick, controls }) {
  const node = el(href ? 'a' : onClick ? 'button' : 'div', 'stat');
  if (href) { node.href = href; node.target = '_blank'; node.rel = 'noreferrer'; }
  if (onClick) { node.type = 'button'; node.addEventListener('click', onClick); }
  if (controls) node.setAttribute('aria-controls', controls);
  node.append(faIcon(icon));
  node.append(el('span', 'stat-label', label));
  const v = el('span', 'stat-value', value);
  if (unit) v.append(' ', el('small', '', unit));
  node.append(v);
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

  // ── The stats: four cards on the tint (Kate's pick J of four, Sep 16). ──
  const dash = v => (!loaded ? '…' : (v || '—'));
  const issue = nextIssueDate(schedule, today);
  const count = loaded ? String(queueBadgeCount(rows)) : '·';   // the queue card and the fold's heading share it
  strip.replaceChildren(
    stat({
      icon: 'inbox', label: 'In the queue',
      value: loaded ? count : '…', unit: loaded ? 'waiting' : '',
      controls: 'home-queue',
      onClick: () => {
        const fold = container.querySelector('.queue-fold');
        fold.open = true;
        fold.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }),
    stat({
      icon: 'paper-plane', label: 'Next newsletter',
      value: dash(isoToShort(issue, today)), unit: loaded && issue ? issueTally(issueSummary(rows, issue).inIssue) : '',
      onClick: () => onGoTo('issue'),
    }),
    stat({ icon: 'globe', label: 'Exchange updated', value: dash(isoToShort(hubUpdated, today)), href: EXCHANGE_URL }),
    stat({ icon: 'envelope-open-text', label: 'Last newsletter', value: dash(isoToShort(lastIssue, today)), href: ARCHIVE_PATH }),
  );

  // ── The queue, folded at the bottom. The summary is the heading. ──
  const summary = container.querySelector('.queue-fold summary');
  summary.replaceChildren(faIcon('chevron-down'), el('span', '', 'In the queue'), el('span', 'queue-badge', count));
  const body = container.querySelector('.queue-body');
  if (!loaded) body.replaceChildren(dotsLoader());
  else renderQueueTable(body, { rows, schedule, today, onRefresh, onDelete: onDeleteFromQueue, bare: true });
}
