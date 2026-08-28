/**
 * The queue, as one table at the bottom of Home: parked circle-backs in a
 * small block above, then every pending row newest-first, each expanding in
 * place to its blurb and meta. Open rows live in module state so a re-render
 * (a refresh, a new submission) never collapses what you were reading.
 */
import { queueGlance, queueOrder } from './home-panel.js';
import { circlebackRows, duplicateFlags, staleCirclebacks } from './workflow.js';
import { TYPE_LABELS } from './schema.js';
import { nextIssueDate } from './schedule.js';
import { isoToDisplay } from './rows-to-issue.js';
import { safeHref } from './links.js';

const openRows = new Set();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The one-line summary under the heading. */
function headline(rows, schedule, today) {
  const next = nextIssueDate(schedule, today);
  return queueGlance(rows) + (next ? ` · next issue ${isoToDisplay(next)}` : '');
}

/** Everything the expanded row shows, in one cell spanning the table. */
function detailCell(row) {
  const cell = el('td');
  cell.colSpan = 7;
  if (row.blurb) cell.append(el('p', 'item-blurb', row.blurb));
  const meta = [
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

/** Spotlight and duplicate badges live here now, not in the Title cell. */
function noteCell(row, dupes) {
  const cell = el('td', 'note-cell');
  if (row.spotlight_request) cell.append(el('span', 'badge badge-star', 'spotlight'));
  if (dupes.has(row.id)) cell.append(el('span', 'badge badge-dupe', 'possible duplicate'));
  return cell;
}

function submittedDate(row) {
  const iso = String(row.submitted_at ?? '').slice(0, 10);
  return iso ? isoToDisplay(iso) : '—';
}

/** One data row plus, when open, its detail row. */
function bodyRows(row, dupes, rerender) {
  const isOpen = openRows.has(row.id);
  const tr = el('tr', 'queue-row');
  tr.append(titleCell(row));
  tr.append(el('td', row.type ? '' : 'missing', row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'));
  tr.append(el('td', row.subtype ? '' : 'missing', row.subtype || '—'));
  tr.append(el('td', '', row.submitter || '—'));
  tr.append(el('td', '', submittedDate(row)));
  tr.append(noteCell(row, dupes));

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

function parkedBlock(rows, today) {
  const parked = circlebackRows(rows);
  if (!parked.length) return null;
  const stale = new Set(staleCirclebacks(rows, today).map(r => r.id));
  const wrap = el('section', 'queue-parked');
  wrap.append(el('h3', '', `Circle back (${parked.length})`));
  for (const row of parked) {
    const line = el('div', 'parked-item');
    line.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
    const meta = [row.subtype, row.source, row.date && isoToDisplay(row.date), row.submitter]
      .filter(Boolean).join(' · ');
    if (meta) line.append(el('span', 'item-meta', ` ${meta}`));
    if (stale.has(row.id)) line.append(el('span', 'badge badge-stale', 'date passed'));
    wrap.append(line);
  }
  return wrap;
}

export function renderQueueTable(container, { rows, schedule, today, onRefresh }) {
  const rerender = () => renderQueueTable(container, { rows, schedule, today, onRefresh });
  container.replaceChildren();

  const head = el('div', 'queue-head');
  head.append(el('h2', '', 'In the queue'));
  head.append(el('p', 'lede', headline(rows, schedule, today)));
  const refresh = el('button', '', 'Refresh');
  refresh.type = 'button';
  refresh.addEventListener('click', () => { refresh.disabled = true; onRefresh(); });
  head.append(refresh);
  container.append(head);

  const parked = parkedBlock(rows, today);
  if (parked) container.append(parked);

  const pending = queueOrder(rows);
  if (!pending.length) {
    container.append(el('p', 'empty', 'Nothing waiting. Enjoy it.'));
    return;
  }

  const table = el('table', 'queue-table');
  const headRow = el('tr');
  for (const label of ['Title', 'Type', 'Subtype', 'Submitted by', 'Submission date', 'Note', '']) {
    headRow.append(el('th', '', label));
  }
  const thead = el('thead');
  thead.append(headRow);
  table.append(thead);
  const body = el('tbody');
  const dupes = duplicateFlags(rows);
  for (const row of pending) body.append(...bodyRows(row, dupes, rerender));
  table.append(body);

  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  container.append(scroll);
}
