/** Queue: everything new, structured and grouped, circle-backs pinned on top. */
import { pendingRows, circlebackRows, duplicateFlags, staleCirclebacks } from './workflow.js';
import { TYPES } from './schema.js';
import { isoToDisplay } from './rows-to-issue.js';

const GROUP_LABELS = {
  research: 'New Ed Policy Research', event: 'Events',
  opportunity: 'Opportunities', headline: 'Headlines', '': 'Untyped',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function itemRow(row, { dupes }) {
  const details = el('details', 'queue-item');
  const summary = el('summary');
  if (row.spotlight_request) summary.append(el('span', 'badge badge-star', '⭐'));
  if (dupes.has(row.id)) summary.append(el('span', 'badge badge-dupe', 'possible duplicate'));
  summary.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  summary.append(el('span', 'item-meta',
    [row.subtype, row.source, row.date && isoToDisplay(row.date), row.submitter]
      .filter(Boolean).join(' · ')));
  details.append(summary);
  const body = el('div', 'item-body');
  if (row.blurb) body.append(el('p', 'item-blurb', row.blurb));
  if (row.note) body.append(el('p', 'item-note', `Note: ${row.note}`));
  if (row.original_text && row.original_text !== row.blurb) {
    const orig = el('details', 'item-original');
    orig.append(el('summary', '', 'Original text'), el('pre', '', row.original_text));
    body.append(orig);
  }
  if (row.link) {
    const a = el('a', 'source-link', 'Open source ↗');
    a.href = row.link; a.target = '_blank'; a.rel = 'noreferrer';
    body.append(a);
  }
  details.append(body);
  return details;
}

export function renderQueue(container, { rows, nextIssue, today, onRefresh }) {
  container.replaceChildren();
  const pending = pendingRows(rows);
  const parked = circlebackRows(rows);
  const dupes = duplicateFlags(rows);
  const stale = new Set(staleCirclebacks(rows, today).map(r => r.id));

  const head = el('div', 'screen-head');
  head.append(el('h2', '', 'Queue'));
  head.append(el('p', 'lede', (nextIssue ? `Next issue: ${isoToDisplay(nextIssue)} — ` : '') +
    `${pending.length} in queue${parked.length ? `, ${parked.length} parked` : ''}`));
  const refresh = el('button', '', 'Refresh');
  refresh.addEventListener('click', () => { refresh.disabled = true; onRefresh(); });
  head.append(refresh);
  container.append(head);

  if (parked.length) {
    const wrap = el('section', 'queue-group queue-parked');
    wrap.append(el('h3', '', `Circle back (${parked.length})`));
    for (const row of parked) {
      const item = itemRow(row, { dupes });
      if (stale.has(row.id)) item.querySelector('summary')
        .append(el('span', 'badge badge-stale', 'date passed'));
      wrap.append(item);
    }
    container.append(wrap);
  }

  if (!pending.length) {
    container.append(el('p', 'empty', 'Nothing waiting. Enjoy it.'));
    return;
  }
  for (const type of [...Object.keys(TYPES), '']) {
    const group = pending.filter(r => (r.type || '') === type);
    if (!group.length) continue;
    const wrap = el('section', 'queue-group');
    wrap.append(el('h3', '', `${GROUP_LABELS[type]} (${group.length})`));
    for (const row of group) wrap.append(itemRow(row, { dupes }));
    container.append(wrap);
  }
}
