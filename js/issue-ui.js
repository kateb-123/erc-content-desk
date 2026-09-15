/**
 * Next issue: the newsletter's current state as a table, with quick add
 * (Kate, Sep 15: "it should pretty much show a list like a table. you can
 * quick add to that", then "i think a new page?"). Reached from Home's rail.
 * A front-door page like Home: the header's tabs stay hidden and the way out
 * is back to the main page. Quick add opens the kept-and-waiting pool, a
 * tick each; a tick stamps the row for this issue at once and it moves up
 * into the table; Remove sends it back. Nothing here skips Sort: the pool is
 * what Sort already kept.
 */
import { faIcon, dotsLoader } from './icons.js';
import { isoToShort } from './queue-view.js';
import { nextIssueDate } from './schedule.js';
import { issueRows, poolRows } from './issue-view.js';
import { TYPE_LABELS } from './schema.js';

let poolOpen = false;   // view state: Quick add's panel stays as it was across re-renders

export function resetIssueEntry() { poolOpen = false; }

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function titleCell(row) {
  const cell = el('td');
  cell.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  if (row.source) cell.append(el('span', 'item-source', row.source));
  return cell;
}

function typeText(row) {
  return row.type ? (TYPE_LABELS[row.type] ?? row.type) : 'No type';
}

export function renderIssue(container, props) {
  const { rows, schedule, today, loaded, onBack, onAdd, onRemove } = props;
  container.replaceChildren();

  const issue = nextIssueDate(schedule, today);
  const title = issue ? `${isoToShort(issue, today)} issue` : 'Next issue';

  const back = el('button', 'linkish back-link', ' Main page');
  back.type = 'button';
  back.prepend(faIcon('arrow-left'));
  back.addEventListener('click', onBack);
  container.append(back);

  const head = el('div', 'screen-head');
  const h2 = el('h2', '', title);
  head.append(h2);
  container.append(head);

  if (!loaded) { container.append(dotsLoader()); return; }
  if (!issue) { container.append(el('p', 'empty', 'No issue date is scheduled yet.')); return; }

  const inIssue = issueRows(rows, issue);
  const pool = poolRows(rows, schedule, issue);
  h2.append(' ', el('span', 'queue-badge', String(inIssue.length)));

  // ── The lede, with Quick add on its right. ──
  const lede = el('div', 'issue-lede');
  const waiting = pool.length === 0 ? 'Nothing else is waiting.'
    : `${pool.length} kept item${pool.length === 1 ? ' is' : 's are'} still waiting for an issue.`;
  lede.append(el('p', 'lede', `What Kathy will pull into the builder. ${waiting}`));
  if (pool.length || poolOpen) {
    const quick = el('button', 'mini-btn', poolOpen ? 'Close quick add' : 'Quick add');
    quick.type = 'button';
    quick.setAttribute('aria-expanded', String(poolOpen));
    quick.setAttribute('aria-controls', 'issue-pool');
    quick.addEventListener('click', () => { poolOpen = !poolOpen; renderIssue(container, props); });
    lede.append(quick);
  }
  container.append(lede);

  // ── The table: what is in. ──
  if (!inIssue.length) {
    container.append(el('p', 'empty', 'Nothing in yet.'));
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
    container.append(scroll);
  }

  // ── Quick add: the pool, a tick each. ──
  if (!poolOpen) return;
  const panel = el('section', 'pool-panel');
  panel.id = 'issue-pool';
  panel.append(el('h3', '', 'Quick add · kept and waiting'));
  if (!pool.length) {
    panel.append(el('p', 'empty', 'Nothing kept and waiting.'));
  } else {
    const list = el('ul', 'pool-list');
    for (const row of pool) {
      const li = el('li');
      const label = el('label', 'pool-item');
      const tick = el('input');
      tick.type = 'checkbox';
      tick.addEventListener('change', () => {
        if (!tick.checked) return;
        tick.disabled = true;   // in flight: the re-render moves the row up
        onAdd(row);
      });
      label.append(tick, el('span', 'pool-title', row.headline || row.link || '(untitled)'));
      if (row.later) {
        const badge = el('span', 'badge', 'Later issue');
        badge.title = 'An event that happens after the next issue lands';
        label.append(badge);
      }
      label.append(el('span', 'pool-type', typeText(row)));
      li.append(label);
      list.append(li);
    }
    panel.append(list);
  }
  panel.append(el('p', 'quick-note', 'Tick one and it moves up into the issue. Remove in the table sends it back.'));
  container.append(panel);
}
