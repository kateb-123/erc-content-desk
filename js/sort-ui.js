/**
 * Sort: one stream, one card at a time — untyped last, otherwise the
 * newsletter's type order, oldest first within a group. Keep / Circle back /
 * Trash by click only (no keyboard shortcuts — Kate's call, Aug 31). The
 * section row is a jump point; the type pickers hide behind "change".
 */
import { duplicateFlags, linkCheckState, reshareFlags } from './workflow.js';
import { TYPE_ORDER, TYPE_LABELS, subtypesFor } from './schema.js';
import { isoToDisplay } from './rows-to-issue.js';
import { safeHref } from './links.js';
import { sortStream, sortCounts, streamFrom, sectionOf } from './sort-view.js';
import { titleWithInfo } from './screen-info.js';
import { faIcon, forwardIcon } from './icons.js';

const FILTER_LABELS = [
  ['', 'All'], ['untyped', 'To review'], ['erc', 'ERC'], ['research', 'Research'],
  ['event', 'Events'], ['opportunity', 'Opportunities'], ['headline', 'Headlines'],
];
const FILTER_KEYS = FILTER_LABELS.map(([k]) => k);

let fixOpenId = null;   // card id whose type pickers are open via "change"
let lastFilter = null;  // detects a section jump so the card area slides like the screens do

// "Settle": the decided card shrinks and fades in place as a floating copy
// while the next card renders instantly underneath. Purely cosmetic.
function settleOut(card) {
  const rect = card.getBoundingClientRect();
  const clone = card.cloneNode(true);
  clone.classList.add('sort-exit-clone');
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.setAttribute('aria-hidden', 'true');
  clone.addEventListener('animationend', () => clone.remove(), { once: true });
  setTimeout(() => clone.remove(), 600);
  document.body.append(clone);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderSort(container, props) {
  container.replaceChildren();
  const { rows, filter, sortedCount, lastDecision, onFilter, onDecide, onUndo, onGoTo, browse = 0, onBrowse } = props;
  const rerenderSelf = () => renderSort(container, props);

  const stream = sortStream(rows);
  const counts = sortCounts(rows);
  const visible = streamFrom(stream, filter);

  const head = el('div', 'screen-head');
  const info = titleWithInfo('Sort', 'sort',
    'Go card by card: Keep what belongs, Circle back on maybes, Delete the rest. The left menu jumps to a section; the arrows browse without deciding. A card with open work — no type, an unchecked link — locks Keep until you fix it (Delete works any time).');
  head.append(info.row);
  const door = el('button', 'primary head-action', 'Go to Finalize');
  door.append(forwardIcon());
  door.addEventListener('click', () => onGoTo?.('finalize'));
  head.append(door);
  container.append(head, info.panel);

  // Browsing: ← → walks a viewing position through the stream without
  // deciding anything. Deciding acts on the card in view; the position holds.
  const idx = Math.max(0, Math.min(browse, visible.length - 1));

  // Sections are jump points into one continuous stream. The underline marks
  // where you jumped in; the darker text tracks the group you're passing
  // through as the stream flows on.
  const currentGroup = visible.length ? sectionOf(visible[idx]) : null;
  const nav = el('nav', 'sort-nav');
  for (const [key, label] of FILTER_LABELS) {
    const count = key === '' ? counts.all : counts[key];
    let cls = 'sort-filter';
    if (filter === key) cls += ' is-active';
    if (key && key === currentGroup) cls += ' is-here';
    const btn = el('button', cls, `${label} (${count})`);
    btn.type = 'button';
    btn.addEventListener('click', () => onFilter(key));
    nav.append(btn);
  }
  const main = el('div', 'sort-main');
  const body = el('div', 'sort-body');
  body.append(nav, main);
  container.append(body);
  if (lastFilter !== null && lastFilter !== filter) {
    main.classList.add(FILTER_KEYS.indexOf(filter) > FILTER_KEYS.indexOf(lastFilter)
      ? 'slide-in-right' : 'slide-in-left');
  }
  lastFilter = filter;

  if (!visible.length) {
    main.append(el('p', 'empty', sortedCount ? 'All sorted.' : 'Nothing to sort.'));
    if (lastDecision) {
      const undo = el('button', 'undo-link', 'Undo last');
      undo.addEventListener('click', () => { undo.disabled = true; onUndo(); });
      main.append(undo);
    }
    return;
  }

  const row = visible[idx];
  const groupKey = sectionOf(row);
  const groupLabel = FILTER_LABELS.find(([k]) => k === groupKey)?.[1] ?? 'To review';
  // Dots track the current section only — and the heading names your spot in it.
  const groupCards = visible.map((r, i) => i).filter(i => sectionOf(visible[i]) === groupKey);
  const posInGroup = groupCards.indexOf(idx) + 1;

  main.append(el('p', 'sort-group', groupLabel));
  const card = el('div', 'sort-card');
  card.append(el('span', 'card-pos', `${posInGroup}/${groupCards.length}`));
  const dupes = duplicateFlags(rows);
  const reshare = reshareFlags(rows, props.today ?? '');
  const badges = el('div');
  if (row.spotlight_request) badges.append(el('span', 'badge badge-star', 'spotlight requested'));
  // One badge, most informative first: a past newsletter share beats the dupe tiers.
  if (reshare.has(row.id)) {
    badges.append(el('span', 'badge', 'In a past issue'));
  } else if (dupes.has(row.id)) {
    const prior = rows.find(r => r.id === dupes.get(row.id));
    badges.append(el('span', 'badge badge-dupe', prior?.published_at ? 'Already live' : 'Possible duplicate'));
  }
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
      flag.title = 'Filed by the desk from the link/description — check it.';
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
      settleOut(card);
      onDecide(row, action);
    });
    return b;
  };
  const keepBtn = mk('Keep', 'btn-keep', 'keep');
  const circleBtn = mk('Circle back', 'btn-circle', 'circleback');
  const trashBtn = mk(' Delete', 'btn-trash', 'trash');
  trashBtn.prepend(faIcon('trash-can'));
  actions.append(keepBtn, circleBtn, trashBtn);
  card.append(actions);

  // A card with open work can't be KEPT until it's fixed — but junk is junk:
  // Trash stays live no matter what (Kate, Sep 1).
  const blockers = [];
  if (mustFix) blockers.push('set a type');
  if (linkState === 'alert') blockers.push('check the link');
  if (blockers.length) {
    for (const b of [keepBtn, circleBtn]) b.disabled = true;
    card.append(el('p', 'decide-blocked', `Before keeping: ${blockers.join(' · ')}.`));
  }
  if (lastDecision) {
    const undo = el('button', 'undo-link', 'Undo last');
    undo.addEventListener('click', () => { undo.disabled = true; onUndo(); });
    card.append(undo);
  }
  // Carousel: arrows flank the card (the card's own 1/2 counter tracks the
  // position). Browsing never decides anything — the card only leaves via
  // Keep / Circle / Trash.
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
  main.append(carousel);

}
