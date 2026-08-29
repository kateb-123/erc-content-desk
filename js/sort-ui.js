/**
 * Sort: one stream, one card at a time — untyped first, then the
 * newsletter's type order, oldest first within a group. Keep / Circle back /
 * Trash with K / C / T shortcuts and U for undo. No stack picker; the
 * filters are quiet text buttons and the type pickers hide behind "change".
 */
import { duplicateFlags, linkCheckState } from './workflow.js';
import { TYPE_ORDER, TYPE_LABELS, subtypesFor } from './schema.js';
import { isoToDisplay } from './rows-to-issue.js';
import { safeHref } from './links.js';
import { sortStream, sortCounts, streamFrom, sectionOf } from './sort-view.js';

const FILTER_LABELS = [
  ['', 'All'], ['erc', 'ERC'], ['research', 'Research'], ['event', 'Events'],
  ['opportunity', 'Opportunities'], ['headline', 'Headlines'], ['untyped', 'To review'],
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
  const { rows, filter, sortedCount, lastDecision, onFilter, onDecide, onUndo, browse = 0, onBrowse } = props;
  const rerenderSelf = () => renderSort(container, props);

  const stream = sortStream(rows);
  const counts = sortCounts(rows);
  const visible = streamFrom(stream, filter);

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

  // Browsing: ← → walks a viewing position through the stream without
  // deciding anything. Deciding acts on the card in view; the position holds.
  const idx = Math.max(0, Math.min(browse, visible.length - 1));

  // Sections are jump points into one continuous stream. The underline marks
  // where you jumped in; the darker text tracks the group you're passing
  // through as the stream flows on.
  const currentGroup = visible.length ? sectionOf(visible[idx]) : null;
  const filters = el('p', 'sort-filters');
  for (const [key, label] of FILTER_LABELS) {
    const count = key === '' ? counts.all : counts[key];
    let cls = 'sort-filter';
    if (filter === key) cls += ' is-active';
    if (key && key === currentGroup) cls += ' is-here';
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

  const row = visible[idx];
  const groupKey = sectionOf(row);
  const groupLabel = FILTER_LABELS.find(([k]) => k === groupKey)?.[1] ?? 'To review';
  const inGroup = visible.filter(r => sectionOf(r) === groupKey).length;

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

  // The filing section: quiet type line, link-check alert, pill picker.
  // No "— · —" placeholder — an untyped card's picker speaks for itself.
  const fileRow = el('div', 'file-row');
  const linkState = linkCheckState(row);
  const href = safeHref(row.link);
  const mustFix = !row.type || !row.subtype;
  const fixOpen = mustFix || fixOpenId === row.id;

  const typeLine = el('p', 'type-line');
  if (row.type && row.subtype) {
    typeLine.append(el('span', 'type-label',
      `${TYPE_LABELS[row.type] ?? row.type} · ${row.subtype}`));
    const autoTyped = String(row.auto_filled ?? '').split(',')
      .some(f => f === 'type' || f === 'subtype');
    if (autoTyped) {
      const flag = el('span', 'auto-flag', '!');
      flag.title = 'Filed by the desk from the link/blurb — check it.';
      flag.setAttribute('role', 'img');
      flag.setAttribute('aria-label', 'Type was filed automatically — check it');
      typeLine.append(' ', flag);
    }
    if (!fixOpen) {
      const change = el('button', 'linkish', 'change');
      change.type = 'button';
      change.addEventListener('click', () => { fixOpenId = row.id; rerenderSelf(); });
      typeLine.append(' ', change);
    }
  }
  // The alert strip carries the link while it needs checking.
  if (href && linkState !== 'alert') {
    const a = el('a', 'source-link', 'Open source ↗');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    typeLine.append(typeLine.childNodes.length ? ' · ' : '', a);
    if (linkState === 'verified') typeLine.append(' ', el('span', 'link-verified', '✓ verified'));
  }
  if (typeLine.childNodes.length) fileRow.append(typeLine);

  if (linkState === 'alert') {
    const alert = el('div', 'link-alert');
    const line = el('p', 'alert-line');
    line.append(el('span', 'alert-mark', '!'), ' Check link');
    const actions = el('p', 'alert-actions');
    if (href) {
      const a = el('a', '', 'Open source ↗');
      a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
      a.addEventListener('click', () => actions.classList.add('is-open'));
      line.append(' · ', a);
    } else {
      actions.classList.add('is-open');
    }
    const verify = el('button', 'alert-btn', 'Verify');
    verify.type = 'button';
    verify.addEventListener('click', () => {
      for (const x of card.querySelectorAll('button')) x.disabled = true;
      props.onVerifyLink?.(row);
    });
    const change = el('button', 'alert-btn', 'Change link');
    change.type = 'button';
    const changeRow = el('p', 'alert-change');
    const input = document.createElement('input');
    input.type = 'url';
    input.placeholder = 'paste the right link';
    const saveLink = el('button', 'alert-btn', 'Save link');
    saveLink.type = 'button';
    change.addEventListener('click', () => { changeRow.classList.add('is-open'); input.focus(); });
    const saveFixed = () => {
      const fixed = input.value.trim();
      if (!safeHref(fixed)) { input.classList.add('is-invalid'); return; }
      for (const x of card.querySelectorAll('button')) x.disabled = true;
      props.onVerifyLink?.(row, fixed);
    };
    saveLink.addEventListener('click', saveFixed);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') saveFixed(); });
    input.addEventListener('input', () => input.classList.remove('is-invalid'));
    actions.append(verify, ' ', change);
    changeRow.append(input, ' ', saveLink);
    alert.append(line, actions, changeRow);
    fileRow.append(alert);
  }

  if (fixOpen) {
    const fix = el('div', 'type-pick');
    fix.append(el('p', 'pick-label', mustFix ? 'Needs a type — tap one:' : 'Type — tap one:'));
    const typeChips = el('div', 'type-chips');
    const subWrap = el('div', 'sub-pick');
    const subChips = el('div', 'type-chips');
    const subLabel = el('p', 'pick-label');
    subWrap.append(subLabel, subChips);
    const saveBtn = el('button', 'save-type-btn', 'Save type');
    saveBtn.type = 'button';
    let pickedType = row.type || '';
    let pickedSub = row.subtype || '';
    const syncSave = () => saveBtn.classList.toggle('is-open', Boolean(pickedType && pickedSub));
    const renderSubs = () => {
      // Name the picked type so switching (Event -> Opportunity) reads clearly.
      subLabel.textContent = pickedType ? `${TYPE_LABELS[pickedType] ?? pickedType} — now the subtype:` : '';
      subChips.replaceChildren(...subtypesFor(pickedType).map(s => {
        const b = el('button', `type-chip${s === pickedSub ? ' is-picked' : ''}`, s);
        b.type = 'button';
        b.addEventListener('click', () => { pickedSub = s; renderSubs(); syncSave(); });
        return b;
      }));
      subWrap.classList.toggle('is-open', Boolean(pickedType));
    };
    const renderTypes = () => {
      typeChips.replaceChildren(...TYPE_ORDER.map(t => {
        const b = el('button', `type-chip${t === pickedType ? ' is-picked' : ''}`, TYPE_LABELS[t] ?? t);
        b.type = 'button';
        b.addEventListener('click', () => {
          if (pickedType !== t) { pickedType = t; pickedSub = ''; }
          renderTypes(); renderSubs(); syncSave();
        });
        return b;
      }));
    };
    renderTypes(); renderSubs(); syncSave();
    saveBtn.addEventListener('click', () => {
      for (const x of card.querySelectorAll('button')) x.disabled = true;
      fix.replaceChildren(el('p', 'pick-saved', '✓ Saved'));
      fixOpenId = null;
      props.onEditType?.(row, pickedType, pickedSub);
    });
    fix.append(typeChips, subWrap, saveBtn);
    fileRow.append(fix);
  }

  if (fileRow.childNodes.length) card.append(fileRow);

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
  card.append(el('p', 'keys-hint', 'K keep · C circle back · T trash · U undo · ← → browse'));
  if (lastDecision) {
    const undo = el('button', 'undo-link', 'Undo last (U)');
    undo.addEventListener('click', () => { undo.disabled = true; onUndo(); });
    card.append(undo);
  }
  // Carousel: arrows flank the card, dots below track the position. Browsing
  // never decides anything — the card only leaves via Keep / Circle / Trash.
  const carousel = el('div', 'sort-carousel');
  const prev = el('button', 'carousel-arrow', '‹');
  prev.type = 'button';
  prev.disabled = idx === 0;
  prev.setAttribute('aria-label', 'Previous card');
  prev.addEventListener('click', () => onBrowse?.(idx - 1));
  const next = el('button', 'carousel-arrow', '›');
  next.type = 'button';
  next.disabled = idx >= visible.length - 1;
  next.setAttribute('aria-label', 'Next card');
  next.addEventListener('click', () => onBrowse?.(idx + 1));
  carousel.append(prev, card, next);
  container.append(carousel);

  // Dots track the current section only — one dot per card in this group.
  const groupCards = visible.map((r, i) => i).filter(i => sectionOf(visible[i]) === groupKey);
  if (groupCards.length > 1 && groupCards.length <= 15) {
    const dots = el('div', 'carousel-dots');
    for (const i of groupCards) {
      const dot = el('button', `carousel-dot${i === idx ? ' is-current' : ''}`);
      dot.type = 'button';
      dot.setAttribute('aria-label', `${groupLabel} card ${groupCards.indexOf(i) + 1} of ${groupCards.length}`);
      dot.addEventListener('click', () => onBrowse?.(i));
      dots.append(dot);
    }
    container.append(dots);
  } else if (groupCards.length > 15) {
    container.append(el('p', 'browse-pos', `${groupCards.indexOf(idx) + 1} of ${groupCards.length} in ${groupLabel}`));
  }

  attachKeys({
    k: () => keepBtn.click(),
    c: () => circleBtn.click(),
    t: () => trashBtn.click(),
    u: () => { if (lastDecision) onUndo(); },
    arrowleft: () => { if (idx > 0) onBrowse?.(idx - 1); },
    arrowright: () => { if (idx < visible.length - 1) onBrowse?.(idx + 1); },
  });
}
