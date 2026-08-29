/**
 * Sort: one stream, one card at a time — untyped first, then the
 * newsletter's type order, oldest first within a group. Keep / Circle back /
 * Trash with K / C / T shortcuts and U for undo. No stack picker; the
 * filters are quiet text buttons and the type pickers hide behind "change".
 */
import { duplicateFlags } from './workflow.js';
import { TYPES, TYPE_LABELS, subtypesFor } from './schema.js';
import { isoToDisplay } from './rows-to-issue.js';
import { safeHref } from './links.js';
import { sortStream, sortCounts, filterStream, isErc } from './sort-view.js';

const FILTER_LABELS = [
  ['', 'All'], ['erc', 'ERC'], ['untyped', 'Untyped'], ['research', 'Research'],
  ['event', 'Events'], ['opportunity', 'Opportunities'], ['headline', 'Headlines'],
];

let keyHandler = null;
let fixOpenId = null;   // card id whose type pickers are open via "change"

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function detachSortKeys() {
  if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
}

export function renderSort(container, props) {
  container.replaceChildren();
  detachSortKeys();
  const { rows, filter, sortedCount, lastDecision, onFilter, onDecide, onUndo } = props;
  const rerenderSelf = () => renderSort(container, props);

  const stream = sortStream(rows);
  const counts = sortCounts(rows);
  const visible = filterStream(stream, filter);

  const head = el('div', 'screen-head');
  head.append(el('h2', '', 'Sort'));
  head.append(el('p', 'lede sort-progress', `${sortedCount} sorted · ${visible.length} to go`));
  container.append(head);

  const total = sortedCount + visible.length;
  const bar = el('div', 'sort-bar');
  const fill = el('div', 'sort-bar-fill');
  fill.style.width = `${total ? Math.round((100 * sortedCount) / total) : 100}%`;
  bar.append(fill);
  container.append(bar);

  // With All selected, the current card's own group gets a gentle highlight
  // so you can see which pile you are passing through.
  const currentGroup = visible.length
    ? (isErc(visible[0]) ? 'erc' : (visible[0].type || 'untyped'))
    : null;
  const filters = el('p', 'sort-filters');
  for (const [key, label] of FILTER_LABELS) {
    const count = key === '' ? counts.all : counts[key];
    let cls = 'sort-filter';
    if (filter === key) cls += ' is-active';
    else if (filter === '' && key === currentGroup) cls += ' is-here';
    const btn = el('button', cls, `${label} (${count})`);
    btn.type = 'button';
    btn.addEventListener('click', () => onFilter(key));
    filters.append(btn);
  }
  container.append(filters);

  const attachKeys = handlers => {
    keyHandler = event => {
      if (event.target.matches('input, textarea, select, [contenteditable]')) return;
      const action = handlers[event.key.toLowerCase()];
      if (action) action();
    };
    document.addEventListener('keydown', keyHandler);
  };

  if (!visible.length) {
    container.append(el('p', 'empty', sortedCount ? 'All sorted.' : 'Nothing to sort.'));
    if (lastDecision) {
      const undo = el('button', 'undo-link', 'Undo last (U)');
      undo.addEventListener('click', () => { undo.disabled = true; onUndo(); });
      container.append(undo);
      attachKeys({ u: onUndo });
    }
    return;
  }

  const row = visible[0];
  const groupOf = r => isErc(r) ? 'erc' : (r.type && FILTER_LABELS.some(([k]) => k === r.type)) ? r.type : 'untyped';
  const groupKey = groupOf(row);
  const groupLabel = FILTER_LABELS.find(([k]) => k === groupKey)?.[1] ?? 'Untyped';
  const inGroup = visible.filter(r => groupOf(r) === groupKey).length;
  container.append(el('p', 'sort-group', `${groupLabel} — ${inGroup} to go`));
  const card = el('div', 'sort-card');
  const dupes = duplicateFlags(rows);
  const badges = el('div');
  if (row.spotlight_request) badges.append(el('span', 'badge badge-star', 'spotlight requested'));
  if (dupes.has(row.id)) badges.append(el('span', 'badge badge-dupe', 'possible duplicate — check before keeping'));
  card.append(badges);
  card.append(el('h3', '', row.headline || '(untitled)'));
  card.append(el('p', 'item-meta', [
    row.source, row.date && isoToDisplay(row.date), row.time, row.location,
    row.submitter && `from ${row.submitter}`,
  ].filter(Boolean).join(' · ')));
  if (row.blurb) card.append(el('p', 'item-blurb', row.blurb));
  if (row.note) card.append(el('p', 'item-note', `Note: ${row.note}`));

  // The quiet type line: current typing, auto-filed marker, change, source.
  const typeLine = el('p', 'type-line');
  typeLine.append(el('span', 'type-label',
    `${row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'} · ${row.subtype || '—'}`));
  const autoTyped = String(row.auto_filled ?? '').split(',')
    .some(f => f === 'type' || f === 'subtype');
  if (autoTyped) {
    const flag = el('span', 'auto-flag', '!');
    flag.title = 'Filed by the desk from the link/blurb — check it.';
    flag.setAttribute('role', 'img');
    flag.setAttribute('aria-label', 'Type was filed automatically — check it');
    typeLine.append(' ', flag);
  }
  const mustFix = !row.type || !row.subtype;
  const fixOpen = mustFix || fixOpenId === row.id;
  if (!fixOpen) {
    const change = el('button', 'linkish', 'change');
    change.type = 'button';
    change.addEventListener('click', () => { fixOpenId = row.id; rerenderSelf(); });
    typeLine.append(' ', change);
  }
  const href = safeHref(row.link);
  if (href) {
    const a = el('a', 'source-link', 'Open source ↗');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    typeLine.append(' · ', a);
  }
  card.append(typeLine);

  if (fixOpen) {
    const fix = el('p', 'item-note', mustFix ? 'Type: pick or fix before deciding.' : 'Type:');
    const typeSel = document.createElement('select');
    typeSel.replaceChildren(new Option('Type…', ''),
      ...Object.keys(TYPES).map(t => new Option(t, t, false, t === row.type)));
    const subSel = document.createElement('select');
    const fillSubs = () => subSel.replaceChildren(new Option('Subtype…', ''),
      ...subtypesFor(typeSel.value).map(s => new Option(s, s, false, s === row.subtype)));
    fillSubs();
    typeSel.addEventListener('change', fillSubs);
    const apply = el('button', '', 'Set type');
    apply.addEventListener('click', () => {
      for (const x of card.querySelectorAll('button')) x.disabled = true;
      props.onEditType?.(row, typeSel.value, subSel.value);
    });
    fix.append(' ', typeSel, ' ', subSel, ' ', apply);
    card.append(fix);
  }

  const actions = el('div', 'sort-actions');
  const mk = (label, cls, action) => {
    const b = el('button', cls, label);
    b.addEventListener('click', () => {
      for (const x of card.querySelectorAll('button')) x.disabled = true;
      onDecide(row, action);
    });
    return b;
  };
  const keepBtn = mk('Keep', 'btn-keep', 'keep');
  const circleBtn = mk('Circle back', 'btn-circle', 'circleback');
  const trashBtn = mk('Trash', 'btn-trash', 'trash');
  actions.append(keepBtn, circleBtn, trashBtn);
  card.append(actions);
  card.append(el('p', 'keys-hint', 'K keep · C circle back · T trash · U undo'));
  if (lastDecision) {
    const undo = el('button', 'undo-link', 'Undo last (U)');
    undo.addEventListener('click', () => { undo.disabled = true; onUndo(); });
    card.append(undo);
  }
  container.append(card);

  attachKeys({
    k: () => keepBtn.click(),
    c: () => circleBtn.click(),
    t: () => trashBtn.click(),
    u: () => { if (lastDecision) onUndo(); },
  });
}
