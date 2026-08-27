/**
 * Finalize: the keeps as an editable table, plus the one batched rewrite.
 * Cells save on blur. Nothing publishes from this screen.
 */
import { readyToPublish } from './workflow.js';
import { TYPES } from './schema.js';

const EDITABLE = ['headline', 'date', 'source', 'topic', 'blurb', 'deadline', 'authors', 'time', 'location'];
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

export function renderFinalize(container, { rows, rewrites, busy, onEdit, onRewrite, onAcceptRewrite, onRejectRewrite }) {
  container.replaceChildren();
  const keeps = readyToPublish(rows);

  const head = el('div', 'screen-head');
  head.append(el('h2', '', 'Finalize'));
  head.append(el('p', 'lede', keeps.length
    ? `${keeps.length} kept item(s) — click any cell to fix it.`
    : 'No unpublished keeps right now.'));
  const rewriteBtn = el('button', 'primary', busy ? 'Rewriting…' : 'Rewrite Events + Opportunities blurbs');
  rewriteBtn.disabled = busy || !keeps.some(r => r.type === 'event' || r.type === 'opportunity');
  rewriteBtn.addEventListener('click', () => { rewriteBtn.disabled = true; onRewrite(); });
  head.append(rewriteBtn);
  container.append(head);

  if (rewrites?.length) {
    const wrap = el('section', 'rewrite-review');
    wrap.append(el('h3', '', `Rewrites to review (${rewrites.length})`));
    for (const { id, blurb } of rewrites) {
      const row = rows.find(r => r.id === id);
      if (!row) continue;
      const pair = el('div', 'rewrite-pair');
      pair.append(el('strong', '', row.headline));
      pair.append(el('p', 'old', row.blurb));
      pair.append(el('p', 'new', blurb));
      const acceptBtn = el('button', 'primary', 'Use the rewrite');
      acceptBtn.addEventListener('click', () => { acceptBtn.disabled = true; onAcceptRewrite(id, blurb); });
      const rejectBtn = el('button', '', 'Keep the original');
      rejectBtn.addEventListener('click', () => onRejectRewrite(id));
      pair.append(acceptBtn, ' ', rejectBtn);
      wrap.append(pair);
    }
    container.append(wrap);
  }

  for (const type of [...Object.keys(TYPES), '']) {
    const group = keeps.filter(r => (r.type || '') === type);
    if (!group.length) continue;
    container.append(el('h3', '', `${GROUP_LABELS[type]} · ${group.length}`));
    const table = el('table', 'grid finalize-table');
    const thead = el('thead');
    const headRow = el('tr');
    for (const col of ['Spotlight', ...EDITABLE, 'subtype']) headRow.append(el('th', '', col));
    thead.append(headRow);
    table.append(thead);
    const tbody = el('tbody');
    for (const row of group) {
      const tr = el('tr');
      tr.append(el('td', '', row.spotlight_request ? 'yes' : ''));
      for (const field of EDITABLE) {
        const td = el('td', '', row[field]);
        td.contentEditable = 'plaintext-only';
        td.addEventListener('blur', () => {
          const value = td.textContent.trim();
          if (value !== row[field]) onEdit(row, field, value);
        });
        tr.append(td);
      }
      tr.append(el('td', '', row.subtype));
      tbody.append(tr);
    }
    table.append(tbody);
    const scroll = el('div', 'table-scroll');
    scroll.append(table);
    container.append(scroll);
  }
}
