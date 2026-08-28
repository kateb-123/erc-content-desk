/**
 * The queue, as one table at the bottom of Home: every pending row plus the
 * circle-backs, newest-first, each expanding in place to its blurb and meta.
 * Open rows live in module state so a re-render (a refresh, a new submission)
 * never collapses what you were reading. Sort and filter are view state only.
 */
import { pendingRows, circlebackRows, duplicateFlags, staleCirclebacks } from './workflow.js';
import { TYPE_LABELS } from './schema.js';
import { isoToDisplay } from './rows-to-issue.js';
import { safeHref } from './links.js';
import { sortRows, filterRows, typeCounts, isoToShort } from './queue-view.js';

const openRows = new Set();

// View state only — resets on reload, never persisted.
let sortState = { column: 'submitted', dir: 'desc' };
const selectedTypes = new Set();
let filtersOpen = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Everything the expanded row shows, in one cell spanning the table. */
function detailCell(row) {
  const cell = el('td');
  cell.colSpan = 6;
  if (row.blurb) cell.append(el('p', 'item-blurb', row.blurb));
  const meta = [
    row.subtype,
    row.source,
    row.authors,
    row.date && isoToDisplay(row.date),
    row.time,
    row.location,
    row.deadline && `Deadline: ${isoToDisplay(row.deadline)}`,
  ].filter(Boolean).join(' · ');
  if (meta) cell.append(el('span', 'item-meta', meta));
  if (row.note) cell.append(el('p', 'item-note', `Note: ${row.note}`));
  const href = safeHref(row.link);
  if (href) {
    const a = el('a', 'source-link', 'Open source ↗');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noreferrer';
    cell.append(a);
  }
  return cell;
}

function titleCell(row) {
  const cell = el('td');
  cell.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  return cell;
}

/** All badges live here: circle-back state, spotlight, duplicate warning. */
function noteCell(row, dupes, stale) {
  const cell = el('td', 'note-cell');
  if (row.status === 'circleback') cell.append(el('span', 'badge', 'circle back'));
  if (stale.has(row.id)) cell.append(el('span', 'badge badge-stale', 'date passed'));
  if (row.spotlight_request) cell.append(el('span', 'badge badge-star', 'spotlight'));
  if (dupes.has(row.id)) cell.append(el('span', 'badge badge-dupe', 'possible duplicate'));
  return cell;
}

function submittedDate(row) {
  const iso = String(row.submitted_at ?? '').slice(0, 10);
  return isoToShort(iso) || '—';
}

/** One data row plus, when open, its detail row. */
function bodyRows(row, dupes, stale, rerender) {
  const isOpen = openRows.has(row.id);
  const tr = el('tr', 'queue-row');
  tr.append(titleCell(row));
  tr.append(el('td', row.type ? '' : 'missing', row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'));
  tr.append(el('td', '', row.submitter || '—'));
  tr.append(el('td', '', submittedDate(row)));
  tr.append(noteCell(row, dupes, stale));

  const caretCell = el('td');
  const caret = el('button', 'caret-btn', isOpen ? '⌃' : '⌄');
  caret.type = 'button';
  caret.setAttribute('aria-expanded', String(isOpen));
  caret.setAttribute('aria-label', isOpen ? 'Collapse item' : 'Expand item');
  caretCell.append(caret);
  tr.append(caretCell);

  const toggle = () => {
    if (openRows.has(row.id)) openRows.delete(row.id);
    else openRows.add(row.id);
    rerender();
  };
  tr.addEventListener('click', toggle);

  if (!isOpen) return [tr];
  const detail = el('tr', 'queue-detail');
  detail.append(detailCell(row));
  return [tr, detail];
}

/** One row of checkboxes: All plus the four types plus Untyped, with counts. */
function filtersRow(counts, rerender) {
  const wrap = el('div', 'queue-filters');
  const options = [
    { key: 'all', label: 'All' },
    { key: 'research', label: 'Research' },
    { key: 'event', label: 'Events' },
    { key: 'opportunity', label: 'Opportunities' },
    { key: 'headline', label: 'Headlines' },
    { key: 'untyped', label: 'Untyped' },
  ];
  for (const opt of options) {
    const label = el('label', 'filter-option');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = opt.key === 'all' ? selectedTypes.size === 0 : selectedTypes.has(opt.key);
    box.addEventListener('change', () => {
      if (opt.key === 'all') selectedTypes.clear();
      else if (selectedTypes.has(opt.key)) selectedTypes.delete(opt.key);
      else selectedTypes.add(opt.key);
      rerender();
    });
    label.append(box, document.createTextNode(` ${opt.label} (${counts[opt.key]})`));
    wrap.append(label);
  }
  return wrap;
}

export function renderQueueTable(container, { rows, today, onRefresh }) {
  const rerender = () => renderQueueTable(container, { rows, today, onRefresh });
  container.replaceChildren();

  const head = el('div', 'queue-head');
  head.append(el('h2', '', 'In the queue'));
  const refresh = el('button', '', 'Refresh');
  refresh.type = 'button';
  refresh.addEventListener('click', () => { refresh.disabled = true; onRefresh(); });
  head.append(refresh);
  const filterToggle = el('button', '', filtersOpen ? 'Hide filters' : 'Show filters');
  filterToggle.type = 'button';
  filterToggle.addEventListener('click', () => { filtersOpen = !filtersOpen; rerender(); });
  head.append(filterToggle);
  container.append(head);

  const listed = [...pendingRows(rows), ...circlebackRows(rows)];
  if (!listed.length) {
    container.append(el('p', 'empty', 'Nothing waiting. Enjoy it.'));
    return;
  }
  if (filtersOpen) container.append(filtersRow(typeCounts(listed), rerender));

  const table = el('table', 'queue-table');
  const SORTABLE = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'submitter', label: 'Submitted by' },
    { key: 'submitted', label: 'Submission date' },
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
  headRow.append(el('th', '', 'Note'));
  headRow.append(el('th', '', ''));
  const thead = el('thead');
  thead.append(headRow);
  table.append(thead);
  const body = el('tbody');
  const dupes = duplicateFlags(rows);
  const stale = new Set(staleCirclebacks(rows, today).map(r => r.id));
  const visible = sortRows(filterRows(listed, selectedTypes), sortState.column, sortState.dir);
  for (const row of visible) body.append(...bodyRows(row, dupes, stale, rerender));
  table.append(body);

  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  container.append(scroll);
}
