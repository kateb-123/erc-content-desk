/**
 * Sort: pick a stack, then one card at a time. Keep / Circle Back / Trash
 * as buttons with K / C / T keyboard shortcuts and U for undo. No swiping.
 */
import { pendingRows, duplicateFlags } from './workflow.js';
import { TYPES, subtypesFor } from './schema.js';
import { isoToDisplay } from './rows-to-issue.js';

const STACK_LABELS = {
  research: 'New Research', event: 'Events',
  opportunity: 'Opportunities', headline: 'Headlines', '': 'Untyped',
};

let keyHandler = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderSort(container, props) {
  container.replaceChildren();
  if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
  const { rows, stack, lastDecision, onPickStack, onDecide, onUndo } = props;
  const pending = pendingRows(rows);

  const head = el('div', 'screen-head');
  head.append(el('h2', '', 'Sort'));
  container.append(head);

  if (!stack) {
    head.append(el('p', 'lede', pending.length
      ? 'Pick a stack to sort.' : 'Nothing to sort. 🎉'));
    const grid = el('div', 'stack-grid');
    for (const type of [...Object.keys(TYPES), '']) {
      const count = pending.filter(r => (r.type || '') === type).length;
      if (!count) continue;
      const btn = el('button', '', `${STACK_LABELS[type]} (${count})`);
      btn.addEventListener('click', () => onPickStack(type));
      grid.append(btn);
    }
    container.append(grid);
    return;
  }

  const stackRows = pending.filter(r => (r.type || '') === stack);
  const back = el('button', '', '← All stacks');
  back.addEventListener('click', () => onPickStack(''));
  head.append(back);

  if (!stackRows.length) {
    head.append(el('p', 'lede', `${STACK_LABELS[stack]}: done ✓`));
    if (lastDecision) {
      const undo = el('button', '', 'Undo last (U)');
      undo.addEventListener('click', () => { undo.disabled = true; onUndo(); });
      container.append(undo);
    }
    return;
  }

  const row = stackRows[0];
  head.append(el('p', 'lede', `${STACK_LABELS[stack]} — ${stackRows.length} to go`));

  const card = el('div', 'sort-card');
  const dupes = duplicateFlags(rows);
  const badges = el('div');
  if (row.spotlight_request) badges.append(el('span', 'badge badge-star', '⭐ spotlight requested'));
  if (dupes.has(row.id)) badges.append(el('span', 'badge badge-dupe', 'possible duplicate — check before keeping'));
  card.append(badges);
  card.append(el('h3', '', row.headline || '(untitled)'));
  card.append(el('p', 'item-meta', [
    row.subtype, row.source, row.date && isoToDisplay(row.date), row.time, row.location,
    row.submitter && `from ${row.submitter}`,
  ].filter(Boolean).join(' · ')));
  if (row.blurb) card.append(el('p', 'item-blurb', row.blurb));
  if (row.note) card.append(el('p', 'item-note', `Note: ${row.note}`));
  if (row.link) {
    const a = el('a', 'source-link', 'Open source ↗');
    a.href = row.link; a.target = '_blank'; a.rel = 'noreferrer';
    card.append(a);
  }

  // Untyped/mistyped rescue: type + subtype pickers persist through onDecide-free edits
  if (!row.type || !row.subtype) {
    const fix = el('p', 'item-note', 'This one needs a type — set it below before deciding.');
    const typeSel = document.createElement('select');
    typeSel.replaceChildren(new Option('Type…', ''),
      ...Object.keys(TYPES).map(t => new Option(t, t, false, t === row.type)));
    const subSel = document.createElement('select');
    const fillSubs = () => subSel.replaceChildren(new Option('Subtype…', ''),
      ...subtypesFor(typeSel.value).map(s => new Option(s, s, false, s === row.subtype)));
    fillSubs();
    typeSel.addEventListener('change', fillSubs);
    const apply = el('button', '', 'Set type');
    apply.addEventListener('click', () => props.onEditType?.(row, typeSel.value, subSel.value));
    fix.append(' ', typeSel, ' ', subSel, ' ', apply);
    card.append(fix);
  }

  const actions = el('div', 'sort-actions');
  const mk = (label, cls, action) => {
    const b = el('button', cls, label);
    b.addEventListener('click', () => {
      for (const x of actions.querySelectorAll('button')) x.disabled = true;
      onDecide(row, action);
    });
    return b;
  };
  const keepBtn = mk('Keep (K)', 'btn-keep', 'keep');
  const circleBtn = mk('Circle back (C)', 'btn-circle', 'circleback');
  const trashBtn = mk('Trash (T)', 'btn-trash', 'trash');
  actions.append(keepBtn, circleBtn, trashBtn);
  card.append(actions);
  if (lastDecision) {
    const undo = el('button', 'undo-link', 'Undo last (U)');
    undo.addEventListener('click', () => { undo.disabled = true; onUndo(); });
    card.append(undo);
  }
  container.append(card);

  keyHandler = event => {
    if (event.target.matches('input, textarea, select, [contenteditable]')) return;
    const key = event.key.toLowerCase();
    if (key === 'k') keepBtn.click();
    else if (key === 'c') circleBtn.click();
    else if (key === 't') trashBtn.click();
    else if (key === 'u' && lastDecision) onUndo();
  };
  document.addEventListener('keydown', keyHandler);
}
