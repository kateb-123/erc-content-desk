/**
 * The queue, as one slim read-only table at the bottom of Home: every pending
 * row plus the circle-backs, newest-first — title with its source underneath,
 * type, and submission date. Sort is view state only; nothing here is a link.
 */
import { dotsLoader, faIcon } from './icons.js';
import { TYPE_LABELS } from './schema.js';
import { sortRows, isoToSlash, queueRows } from './queue-view.js';

// View state only — resets on reload, never persisted.
let sortState = { column: 'submitted', dir: 'desc' };
// Deleted from this table since the page opened, id -> the status it had before.
// They stay listed, greyed, with an Undo — the trash can is one click and the
// rows are dense (Kate, Sep 9). The prior status matters: deleting a circle-back
// and undoing it must give back a circle-back, not a new row.
const justDeleted = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Title with the source in small muted text underneath (when there is one). */
function titleCell(row) {
  const cell = el('td');
  cell.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  if (row.source) cell.append(el('span', 'item-source', row.source));
  return cell;
}

function submittedDate(row) {
  const iso = String(row.submitted_at ?? '').slice(0, 10);
  return isoToSlash(iso) || '—';
}

function bodyRow(row, { onDelete, rerender }) {
  const gone = justDeleted.has(row.id);
  const tr = el('tr', `queue-row${gone ? ' is-deleted' : ''}`);
  tr.append(titleCell(row));
  tr.append(el('td', row.type ? '' : 'missing', row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'));
  tr.append(el('td', '', submittedDate(row)));

  const actions = el('td', 'queue-actions');
  if (gone) {
    actions.append(el('span', 'queue-gone', 'Deleted'));
    const undo = el('button', 'linkish', 'Undo');
    undo.type = 'button';
    undo.addEventListener('click', () => {
      const wasStatus = justDeleted.get(row.id) ?? 'new';
      justDeleted.delete(row.id);
      onDelete?.(row, wasStatus);
      rerender();
    });
    actions.append(undo);
  } else {
    const del = el('button', 'linkish trash-link', '');
    del.type = 'button';
    del.setAttribute('aria-label', `Delete ${row.headline || row.link || 'this item'}`);
    del.append(faIcon('trash-can'));
    del.addEventListener('click', () => {
      justDeleted.set(row.id, row.status);
      onDelete?.(row, 'trash');
      rerender();
    });
    actions.append(del);
  }
  tr.append(actions);
  return tr;
}

export function renderQueueTable(container, { rows, onRefresh, onDelete }) {
  const rerender = () => renderQueueTable(container, { rows, onRefresh, onDelete });
  container.replaceChildren();

  const head = el('div', 'queue-head');
  head.append(el('h2', '', 'In the queue'));
  const refresh = el('button', '', 'Refresh');
  refresh.type = 'button';
  refresh.addEventListener('click', () => {
    refresh.hidden = true;   // gone while refreshing — the dots take its place
    head.append(dotsLoader(true));
    onRefresh();
  });
  head.append(refresh);
  container.append(head);

  const listed = queueRows(rows, justDeleted);
  if (!listed.length) {
    container.append(el('p', 'empty', 'Nothing waiting. Enjoy it.'));
    return;
  }

  const table = el('table', 'queue-table');
  const SORTABLE = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'submitted', label: 'Date' },
  ];
  const headRow = el('tr');
  for (const col of SORTABLE) {
    const th = el('th');
    const active = sortState.column === col.key;
    if (active) th.setAttribute('aria-sort', sortState.dir === 'desc' ? 'descending' : 'ascending');
    const glyph = active ? (sortState.dir === 'desc' ? '↓' : '↑') : '↕';
    const btn = el('button', 'sort-btn', `${col.label} ${glyph}`);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      if (sortState.column === col.key) sortState.dir = sortState.dir === 'desc' ? 'asc' : 'desc';
      else sortState = { column: col.key, dir: col.key === 'submitted' ? 'desc' : 'asc' };
      rerender();
    });
    th.append(btn);
    headRow.append(th);
  }
  headRow.append(el('th', '', ''));   // the trash-can column has no label
  const thead = el('thead');
  thead.append(headRow);
  table.append(thead);
  const body = el('tbody');
  for (const row of sortRows(listed, sortState.column, sortState.dir)) {
    body.append(bodyRow(row, { onDelete, rerender }));
  }
  table.append(body);

  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  container.append(scroll);
}
