/**
 * Next issue: the newsletter's current state as a table, with quick add
 * (Kate, Sep 15: "it should pretty much show a list like a table. you can
 * quick add to that", then "a new page", then "quick add is a whole thing for
 * the newsletter, not something from the queue. it will get added to the
 * queue for sort so everything is talking to each other"). Reached from
 * Home's rail. A front-door page like Home: the header's tabs stay hidden
 * and the way out is back to the main page. Quick add opens the submit form;
 * what it saves lands in this issue AND in the queue, so Sort sees it too,
 * and the table marks it Not sorted yet until Sort has. Remove takes an
 * item out of the issue; it stays in the queue.
 */
import { faIcon, dotsLoader } from './icons.js';
import { isoToShort } from './queue-view.js';
import { nextIssueDate } from './schedule.js';
import { issueRows } from './issue-view.js';
import { TYPE_LABELS } from './schema.js';
import { renderSubmitForm } from './submit-form.js';

let quickOpen = false;   // view state: the form stays open across re-renders

export function resetIssueEntry() { quickOpen = false; }

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
  return row.type ? (TYPE_LABELS[row.type] ?? row.type) : 'No type';
}

export function renderIssue(container, props) {
  const { rows, schedule, today, loaded, onBack, onQuickAdd, onRemove } = props;
  const issue = nextIssueDate(schedule, today);
  const when = isoToShort(issue, today);
  const title = issue ? `Next newsletter, ${when}` : 'Next newsletter';
  const parts = [];

  const back = el('button', 'linkish back-link', ' Main page');
  back.type = 'button';
  back.prepend(faIcon('arrow-left'));
  back.addEventListener('click', onBack);
  parts.push(back);

  const head = el('div', 'screen-head');
  const h2 = el('h2', '', title);
  head.append(h2);
  parts.push(head);

  if (!loaded) { container.replaceChildren(...parts, dotsLoader()); return; }
  if (!issue) { container.replaceChildren(...parts, el('p', 'empty', 'No issue date is scheduled yet.')); return; }

  const inIssue = issueRows(rows, issue);
  h2.append(' ', el('span', 'queue-badge', String(inIssue.length)));

  // ── Quick add sits right of the title; no lede, the table says it all. ──
  const quick = el('button', 'mini-btn', quickOpen ? 'Close quick add' : 'Quick add');
  quick.type = 'button';
  quick.setAttribute('aria-expanded', String(quickOpen));
  quick.setAttribute('aria-controls', 'issue-quick');
  quick.addEventListener('click', () => { quickOpen = !quickOpen; renderIssue(container, props); });
  head.append(quick);

  // ── The table: what is in. ──
  if (!inIssue.length) {
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
      tr.append(el('td', '', isoToShort(row.submitted_at, today) || '—'));
      const td = el('td', 'bulk-remove');
      const remove = el('button', 'linkish trash-link', ' Remove');
      remove.type = 'button';
      remove.prepend(faIcon('trash-can'));
      remove.addEventListener('click', () => { remove.disabled = true; onRemove(row); });
      td.append(remove);
      tr.append(td);
      tbody.append(tr);
    }
    table.append(tbody);
    const scroll = el('div', 'table-scroll');
    scroll.append(table);
    parts.push(scroll);
  }

  // ── Quick add: the submit form, mounted once per opening and left alone
  //    across re-renders so typing survives a data refresh. ──
  if (quickOpen) {
    let panel = container.querySelector('.quick-panel');
    if (!panel) {
      panel = el('section', 'quick-panel');
      panel.id = 'issue-quick';
      panel.append(el('h3', '', `Add to the ${when} newsletter`));
      const mount = el('div');
      panel.append(mount);
      renderSubmitForm(mount, { bulk: false, onSubmitted: data => onQuickAdd(data) });
    }
    parts.push(panel);
  }
  container.replaceChildren(...parts);
}
