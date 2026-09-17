/**
 * Next newsletter: the issue's current state as a table, with quick add.
 * Reached from the sidebar, and from Home's Next newsletter tile. Quick add
 * opens the submit form; what it saves lands in this issue AND in the queue,
 * so Sort sees it too, and the table marks it Not sorted yet until Sort has.
 * Remove takes an item out of the issue; it stays in the queue.
 */
import { faIcon, dotsLoader } from './icons.js';
import { isoToShort, partnerFocusKey } from './queue-view.js';
import { nextIssueDate } from './schedule.js';
import { issueRows } from './issue-view.js';
import { typeDisplay } from './schema.js';
import { renderSubmitForm } from './submit-form.js';
import { tryAgain } from './home-ui.js';
import { inFlight } from './queue-ui.js';
import { titleWithInfo } from './screen-info.js';
import { focusKeyIn, restoreFocus } from './ui-aids.js';

let quickOpen = false;   // view state: the form stays open across re-renders
let quickJustOpened = false;   // the panel takes focus once, on the click that opened it
// Removed, id -> the row as it was: it stays listed, greyed, with Undo, and
// keeps standing across screen switches until a reload.
const justRemoved = new Map();
let currentRows = [];   // the rows as of the last render, for the form's "already in the queue" check

const INFO = 'Quick add puts an item in this issue and in the queue for Sort at once. Remove takes an item out of this issue; it stays in the queue. Not sorted yet marks an item Sort has not had yet.';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function titleCell(row) {
  const cell = el('td');
  cell.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  // Straight from quick add: in the issue, and still waiting in Sort's queue.
  if (row.status === 'new') cell.append(' ', el('span', 'badge', 'Not sorted yet'));
  else if (row.status === 'circleback') cell.append(' ', el('span', 'badge', 'Skipped'));
  if (row.source) cell.append(el('span', 'item-source', row.source));
  return cell;
}

function typeText(row) {
  return row.type ? typeDisplay(row.type) : 'No type';
}

export function renderIssue(container, props) {
  const { rows, schedule, today, loaded, loadFailed, onQuickAdd, onRemove, onRestore, onRefresh } = props;
  currentRows = rows;
  const issue = nextIssueDate(schedule, today);
  const when = isoToShort(issue, today);
  const title = issue ? `Next newsletter, ${when}` : 'Next newsletter';
  const parts = [];

  // The title with View info beside it, as on every other screen.
  const head = el('div', 'screen-head');
  const info = titleWithInfo(title, 'issue', INFO);
  const h2 = info.row.querySelector('h2');
  head.append(info.row);
  parts.push(head, info.panel);

  if (!loaded) { container.replaceChildren(...parts, loadFailed ? tryAgain(onRefresh) : dotsLoader()); return; }
  if (!issue) {
    // A dead end said so and nothing else: where the date lives, and a way to look again.
    const empty = el('p', 'empty', 'No issue date is scheduled yet. Add a date to the Schedule sheet, then refresh. ');
    const again = el('button', '', 'Refresh');
    again.type = 'button';
    again.addEventListener('click', () => { again.disabled = true; onRefresh?.(); });
    empty.append(again);
    container.replaceChildren(...parts, empty);
    return;
  }

  const inIssue = issueRows(rows, issue);
  const removed = [...justRemoved.values()].filter(r => !inIssue.some(x => x.id === r.id));
  const badge = el('span', 'queue-badge', String(inIssue.length));
  badge.append(el('span', 'sr-only', ' items'));
  h2.append(' ', badge);

  // ── Quick add sits right of the title; no lede, the table says it all. ──
  const quick = el('button', 'mini-btn', quickOpen ? 'Close quick add' : 'Quick add');
  quick.type = 'button';
  quick.dataset.focus = 'quick';
  quick.setAttribute('aria-expanded', String(quickOpen));
  if (quickOpen) quick.setAttribute('aria-controls', 'issue-quick');   // only while the panel is in the page
  quick.addEventListener('click', () => { quickOpen = !quickOpen; quickJustOpened = quickOpen; renderIssue(container, props); });
  head.append(quick);

  // Quick add's panel sits right under the head, where the click was, not
  // below a long table.
  let panel = null;
  if (quickOpen) {
    panel = container.querySelector('.quick-panel');
    if (!panel) {
      panel = el('section', 'quick-panel');
      panel.id = 'issue-quick';
      panel.append(el('h3', '', `Add to the ${when} newsletter`));
      const mount = el('div');
      panel.append(mount);
      // The confirmation names this destination and waits for the stamp, in the panel.
      renderSubmitForm(mount, {
        bulk: false,
        onSubmitted: data => onQuickAdd(data),
        knownLinks: () => currentRows,
        pendingLine: `Adding it to the ${when} newsletter`,
        doneLine: `In the ${when} newsletter, and in the queue for Sort.`,
      });
    }
    parts.push(panel);
  }

  // ── The table: what is in. ──
  if (!inIssue.length && !removed.length) {
    parts.push(el('p', 'empty', 'Nothing in yet.'));
  } else {
    const table = el('table', 'queue-table issue-table');
    const thead = el('thead');
    const headRow = el('tr');
    for (const label of ['Title', 'Type', 'Submitted', '']) headRow.append(el('th', '', label));
    thead.append(headRow);
    table.append(thead);
    const tbody = el('tbody');
    for (const row of inIssue) {
      const tr = el('tr');
      tr.append(titleCell(row));
      tr.append(el('td', row.type ? '' : 'missing', typeText(row)));
      tr.append(el('td', '', isoToShort(row.submitted_at, today) || ''));
      const td = el('td', 'bulk-remove');
      const remove = el('button', 'linkish trash-link', ' Remove');
      remove.type = 'button';
      remove.dataset.focus = `remove:${row.id}`;
      remove.prepend(faIcon('trash-can'));
      remove.addEventListener('click', () => { inFlight(remove, `remove:${row.id}`, 'Removing'); justRemoved.set(row.id, row); onRemove(row); });
      td.append(remove);
      tr.append(td);
      tbody.append(tr);
    }
    for (const row of removed) {
      const tr = el('tr', 'queue-row is-deleted');
      tr.append(titleCell(row));
      tr.append(el('td', '', typeText(row)));
      tr.append(el('td', '', isoToShort(row.submitted_at, today) || ''));
      const td = el('td', 'bulk-remove queue-actions');
      td.append(el('span', 'queue-gone', 'Removed'));
      const undo = el('button', 'linkish', 'Undo');
      undo.type = 'button';
      undo.dataset.focus = `undo:${row.id}`;
      undo.addEventListener('click', () => { inFlight(undo, `undo:${row.id}`, 'Putting it back'); justRemoved.delete(row.id); onRestore?.(row); });
      td.append(undo);
      tr.append(td);
      tbody.append(tr);
    }
    table.append(tbody);
    const scroll = el('div', 'table-scroll');
    scroll.append(table);
    parts.push(scroll);
  }

  // The form is mounted once per opening and left alone across re-renders,
  // so typing survives a data refresh; focus inside it survives too, and a
  // table action's focus lands on its partner.
  const active = document.activeElement;
  const inPanel = Boolean(panel?.contains(active));
  const focusKey = inPanel ? null : focusKeyIn(container);
  container.replaceChildren(...parts);
  if (panel && quickJustOpened) {
    quickJustOpened = false;
    panel.querySelector('#sf-title')?.focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'nearest' });
  } else if (inPanel) {
    active.focus({ preventScroll: true });
  } else if (focusKey !== null && !restoreFocus(container, focusKey, null)) {
    restoreFocus(container, partnerFocusKey(focusKey, 'remove') || 'quick', h2);
  }
}
