/**
 * The queue, as one slim table in Home's fold: every pending row plus the
 * skipped ones, newest first, with the title and its source, the type and the
 * submission date. Refresh re-reads; a row's trash can deletes it and leaves
 * an Undo. The column sort is view state only; nothing here is a link.
 */
import { faIcon } from './icons.js';
import { typeDisplay } from './schema.js';
import { sortRows, isoToShort, queueRows, partnerFocusKey } from './queue-view.js';
import { el, button, focusKeyIn, restoreFocus, inFlight } from './ui-aids.js';

// View state only — resets on reload, never persisted.
let sortState = { column: 'submitted', dir: 'desc' };
// Deleted from this table since the page opened, id -> the row as it was.
// They stay listed, greyed, with an Undo: the trash can is one click and the
// rows are dense. The whole row matters, not just its status, so Undo puts
// back a circle-back as a circle-back and a quick-added item with its
// newsletter stamp.
const justDeleted = new Map();

/** Title with the source in small muted text underneath (when there is one). */
function titleCell(row) {
  const cell = el('td');
  cell.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  // A parked row says so; it waits under Sort's Skipped tab.
  if (row.status === 'circleback') cell.append(' ', el('span', 'badge', 'Skipped'));
  if (row.source) cell.append(el('span', 'item-source', row.source));
  return cell;
}

function submittedDate(row, today) {
  return isoToShort(row.submitted_at, today) || '';
}

function bodyRow(row, { onDelete, today }) {
  const gone = justDeleted.has(row.id);
  const tr = el('tr', `queue-row${gone ? ' is-deleted' : ''}`);
  tr.append(titleCell(row));
  // A row the reader has not filed yet says so; its type is not settled.
  if (row.pending_read === 'yes') tr.append(el('td', 'missing', 'Reading…'));
  // "No type" in words, muted: a red dash read as an error and said nothing.
  else tr.append(el('td', row.type ? '' : 'missing', row.type ? typeDisplay(row.type) : 'No type'));
  tr.append(el('td', '', submittedDate(row, today)));

  // The caller's change re-renders the table; there is no stale redraw here.
  const actions = el('td', 'queue-actions');
  if (gone) {
    actions.append(el('span', 'queue-gone', 'Deleted'));
    actions.append(button('Undo', 'linkish', {
      focus: `undo:${row.id}`,
      onClick: () => {
        const snapshot = justDeleted.get(row.id) ?? row;
        justDeleted.delete(row.id);
        onDelete?.(snapshot, 'restore');
      },
    }));
  } else {
    const del = el('button', 'linkish trash-link', '');
    del.type = 'button';
    del.dataset.focus = `delete:${row.id}`;
    del.setAttribute('aria-label', `Delete ${row.headline || row.link || 'this item'}`);
    del.append(faIcon('trash-can'));
    del.addEventListener('click', () => {
      justDeleted.set(row.id, row);
      onDelete?.(row, 'trash');
    });
    actions.append(del);
  }
  tr.append(actions);
  return tr;
}

export function renderQueueTable(container, { rows, today, onRefresh, onDelete }) {
  const rerender = () => renderQueueTable(container, { rows, today, onRefresh, onDelete });
  const focusKey = focusKeyIn(container);   // a redraw keeps the keyboard's place
  container.replaceChildren();

  // The fold's summary is the heading; the head holds Refresh alone.
  const head = el('div', 'queue-head');
  const refresh = button('Refresh', '', {
    focus: 'refresh',
    onClick: () => {
      inFlight(refresh, 'refresh', 'Refreshing');   // gone while refreshing; the dots take its place
      onRefresh();
    },
  });
  head.append(refresh);
  container.append(head);

  // After Delete the keyboard lands on that row's Undo, after Undo on its
  // trash can; a control that is simply gone hands over to Refresh.
  const land = () => {
    if (focusKey === null) return;
    if (restoreFocus(container, focusKey, null)) return;
    restoreFocus(container, partnerFocusKey(focusKey) || 'refresh', refresh);
  };

  const listed = queueRows(rows, justDeleted);
  if (!listed.length) {
    container.append(el('p', 'empty', 'Nothing waiting. Enjoy it.'));
    land();
    return;
  }

  const table = el('table', 'queue-table');
  const SORTABLE = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'submitted', label: 'Submitted' },
  ];
  const headRow = el('tr');
  for (const col of SORTABLE) {
    const th = el('th');
    const active = sortState.column === col.key;
    if (active) th.setAttribute('aria-sort', sortState.dir === 'desc' ? 'descending' : 'ascending');
    const btn = el('button', 'sort-btn', col.label);
    btn.type = 'button';
    btn.dataset.focus = `sort:${col.key}`;
    btn.append(faIcon(active ? (sortState.dir === 'desc' ? 'arrow-down' : 'arrow-up') : 'sort'));
    if (active) btn.append(el('span', 'sr-only', sortState.dir === 'desc' ? ', sorted descending' : ', sorted ascending'));
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
    body.append(bodyRow(row, { onDelete, today }));
  }
  table.append(body);

  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  container.append(scroll);
  land();
}
