/**
 * Finalize: a progress bar, the kept rows as a list down the left in groups
 * (Needs a rewrite or To check, Done, No rewrite needed folded), and one card
 * on the right for the chosen row. A rewrite shows Before and After side by side with the changed
 * words marked; Keep or Use original moves to the next one; Keep all
 * remaining clears the rest. ERC leads the standing order. Nothing publishes
 * from this screen.
 */
// canRewrite lives in workflow.js so this screen and /api/rewrite can never
// disagree about what needs rewriting.
import { readyToFinalize, canRewrite, needsDescription } from './workflow.js';
import { isErc, sortList } from './sort-view.js';
import { TYPE_ORDER, typeDisplay } from './schema.js';
import { isoToShort } from './queue-view.js';
import { dotsLoader, faIcon, loadingLabel } from './icons.js';
import { finalizeStage, finalizeGroups, finalizeProgress, pickSelection, finalizeWaiting } from './finalize-view.js';
import { buildEditForm, holdIfDirty } from './edit-form.js';
import { sortPageHead } from './page-head.js';
import { el, button, focusKeyIn, restoreFocus, markOverflow } from './ui-aids.js';


// View state only — resets on reload, never persisted.
let editingId = null;
let openForm = null;        // the open edit form, so every way out can hold its typing
let selectedId = null;      // the row the card shows
let noneOpen = false;       // the No rewrite needed group, folded by default
// Deleted from this screen since it opened, id -> the row as it was. They stay
// listed, greyed, with an Undo: a mis-click on the red word
// beside Edit is one click from repair, as on Sort and the queue.
const justDeleted = new Map();

/** Arriving at Finalize starts fresh: the first row that needs doing, the fold shut. */
export function resetFinalizeEntry() { selectedId = null; noneOpen = false; editingId = null; justDeleted.clear(); }

const oldestFirst = (a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at));

/** ERC spotlight leads, then type order, the untyped, then a type the schema
 *  does not know: the same standing as Sort. The sort is stable, so rows that
 *  rank the same keep the order they came in. */
const standing = row => (isErc(row) ? 0
  : TYPE_ORDER.includes(row.type || '') ? 1 + TYPE_ORDER.indexOf(row.type)
  : row.type ? TYPE_ORDER.length + 2 : TYPE_ORDER.length + 1);

function standingOrder(keeps) {
  return [...keeps].sort((a, b) => standing(a) - standing(b) || oldestFirst(a, b));
}

/** Word-level LCS diff so a rewrite check highlights only what changed. */
function diffWords(oldText, newText) {
  const a = String(oldText).split(/\s+/).filter(Boolean);
  const b = String(newText).split(/\s+/).filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const oldToks = [];
  const newToks = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { oldToks.push({ t: a[i++], ch: false }); newToks.push({ t: b[j++], ch: false }); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) oldToks.push({ t: a[i++], ch: true });
    else newToks.push({ t: b[j++], ch: true });
  }
  while (i < a.length) oldToks.push({ t: a[i++], ch: true });
  while (j < b.length) newToks.push({ t: b[j++], ch: true });
  return { oldToks, newToks };
}

/** Paragraph from diff tokens: changed runs wrapped in a span, the rest plain text. */
function diffPara(toks, baseClass, changeClass) {
  const p = el('p', baseClass);
  let run = [];
  let changed = false;
  const flush = () => {
    if (!run.length) return;
    if (changed) p.append(el('span', changeClass, run.join(' ')));
    else p.append(document.createTextNode(run.join(' ')));
    p.append(document.createTextNode(' '));
    run = [];
  };
  for (const tok of toks) {
    if (tok.ch !== changed) { flush(); changed = tok.ch; }
    run.push(tok.t);
  }
  flush();
  return p;
}

/** The facts that lead the detail body, events and opportunities only:
 *  research reads title/authors/source in the row and Abstract below. */
function factsFor(row, today) {
  const per = {
    event: [['Date', isoToShort(row.date, today)], ['Time', row.time], ['Location', row.location]],
    opportunity: [['Deadline', isoToShort(row.deadline, today)], ['Topic', row.topic]],
  };
  return (per[row.type] ?? []).filter(([, v]) => v);
}

/** Exchange layout: facts panel in a left column, blurb beside it. Shared
 *  with Publish, which uses it read-only. */
export function detailBody(row, today) {
  const facts = factsFor(row, today);
  const wrap = el('div', facts.length ? 'f-detail-cols' : '');
  if (facts.length) {
    const dl = el('dl', 'f-facts');
    for (const [label, value] of facts) {
      const fact = el('div', 'f-fact');
      fact.append(el('dt', 'f-fact-label', label));
      fact.append(el('dd', 'f-fact-value', value));
      dl.append(fact);
    }
    wrap.append(dl);
  }
  const main = el('div', 'f-detail-main');
  if (row.blurb) {
    main.append(el('h3', 'f-detail-label', row.type === 'research' ? 'Abstract' : 'Description'));   // h3 under the screen's h2, no skipped level
    main.append(el('p', 'f-blurb-text', row.blurb));
  } else if (canRewrite(row)) {
    main.append(el('p', 'rewrite-note', 'No description yet. Rewrite drafts one from the original text.'));
  } else if (needsDescription(row)) {
    main.append(el('p', 'rewrite-note', 'Needs a description. Add one with Edit.'));
  }
  wrap.append(main);
  return wrap;
}

const typeText = row => [row.type ? typeDisplay(row.type) : '', row.subtype].filter(Boolean).join(' · ');

/** A list row's words: the title, with its type under it. */
function rowText(row) {
  const text = el('span', 'f-row-text');
  text.append(el('span', 'f-row-title', row.headline || row.link || '(untitled)'));
  if (row.type) text.append(el('span', 'f-row-type', typeText(row)));
  return text;
}

/** The head of every card: type line, title, source. */
function cardHead(card, row) {
  if (row.type) card.append(el('p', 'type-line', typeText(row)));
  card.append(el('h3', 'f-check-title', row.headline || row.link || '(untitled)'));
  if (row.source) card.append(el('p', 'f-check-source', row.source));
}

/** A press locks every button in the card: nothing is re-pushable. */
const lockButtons = card => () => { for (const b of card.querySelectorAll('button')) b.disabled = true; };

/** Edit and Delete, far left of the actions row. */
function toolLinks(actions, row, { rerender, onTrash, lock }) {
  const edit = button(' Edit', 'linkish edit-link', { focus: 'edit', icon: 'pen', onClick: () => { editingId = row.id; rerender(); } });
  const bin = button(' Delete', 'linkish trash-link sort-delete', { focus: 'delete', icon: 'trash-can', onClick: () => { lock(); justDeleted.set(row.id, row); onTrash(row); } });
  actions.append(edit, bin);
}

function editCard(row, { onSave, rerender }) {
  const card = el('div', 'card f-card');
  cardHead(card, row);
  // The one edit form, the same as Sort's.
  openForm = buildEditForm(row, {
    onSave: changes => {
      editingId = null;
      if (Object.keys(changes).length) onSave(row, changes);
      else rerender();
    },
    onCancel: () => { editingId = null; rerender(); },
  });
  card.append(openForm.el);
  return card;
}

/** A rewrite to check: Before and After side by side, the changed words marked.
 *  Saving an edit here counts as the decision (onCheckEdit stamps the row). */
function checkCard(row, { old, nextId, onVerify, onRevert, onCheckEdit, onTrash, rerender }) {
  if (editingId === row.id) {
    return editCard(row, { onSave: (r, changes) => { selectedId = nextId; onCheckEdit(r, changes); }, rerender });
  }
  const card = el('div', 'card f-card');
  cardHead(card, row);
  const pair = el('div', 'f-diff-pair');
  if (old) {
    const { oldToks, newToks } = diffWords(old, row.blurb);
    const before = el('div', 'f-diff-box');
    before.append(el('p', 'f-diff-label', 'Before'), diffPara(oldToks, 'f-old', 'diff-del'));
    const after = el('div', 'f-diff-box is-after');
    after.append(el('p', 'f-diff-label', 'After · ERC voice'), diffPara(newToks, 'f-blurb-text', 'diff-add'));
    pair.append(before, after);
  } else {
    const after = el('div', 'f-diff-box is-after');
    after.append(el('p', 'f-diff-label', 'New description, written from the original text'), el('p', 'f-blurb-text', row.blurb));
    pair.append(after);
  }
  card.append(pair);

  const actions = el('div', 'f-verify-actions');
  const lock = lockButtons(card);
  toolLinks(actions, row, { rerender, onTrash, lock });
  if (old) {
    actions.append(button(' Use original', 'linkish quiet-link',
      { focus: 'revert', icon: 'rotate-left', onClick: () => { lock(); selectedId = nextId; onRevert(row); } }));
  }
  actions.append(button(' Keep', 'primary',
    { focus: 'keep', icon: 'check', onClick: () => { lock(); selectedId = nextId; onVerify(row.id); } }));
  card.append(actions);
  return card;
}

/** A row still waiting for its rewrite: the original text in its own box. It
 *  always has text, since a row with none cannot be rewritten at all. */
function originalBox(row) {
  const box = el('div', 'f-original');
  box.append(el('p', 'f-diff-label', 'Original'));
  box.append(el('p', 'f-blurb-text', row.blurb || row.original_text));
  return box;
}

/** A kept row with nothing to check: its body between the head and Edit ·
 *  Delete. The rewrite group shows its original text, everyone else the
 *  facts and the description. */
function simpleCard(row, body, { rerender, onEditRow, onTrash }) {
  if (editingId === row.id) return editCard(row, { onSave: onEditRow, rerender });
  const card = el('div', 'card f-card');
  cardHead(card, row);
  card.append(body);
  const actions = el('div', 'f-verify-actions');
  toolLinks(actions, row, { rerender, onTrash, lock: lockButtons(card) });
  card.append(actions);
  return card;
}

export function renderFinalize(container, props) {
  const { rows, today, review, verified, reviewTotal, busy, rewroteNote, lastKeepAll, onEditRow, onCheckEdit, onRewrite, onVerifyRewrite, onVerifyAll, onUndoKeepAll, onRevertRewrite, onTrash, onRestore, onGoTo } = props;
  const rerender = () => renderFinalize(container, props);
  const focusKey = focusKeyIn(container);   // a redraw keeps the keyboard's place
  const held = () => holdIfDirty(openForm, container.querySelector('.f-card'));
  container.replaceChildren();
  openForm = null;
  const keeps = standingOrder(readyToFinalize(rows));
  const handled = id => review.has(id) || verified.has(id);
  const pending = keeps.filter(r => canRewrite(r) && !handled(r.id));
  const checks = review.size;
  const stage = finalizeStage({ pending: pending.length, checks });
  const groups = finalizeGroups(keeps, {
    pending: new Set(pending.map(r => r.id)),
    review,
    verified,
  });
  const toCheck = groups.find(g => g.key === 'check')?.rows ?? [];

  // ── The head: Sort content's title and tabs, then one line of progress and one action on the right. ──
  container.append(sortPageHead({
    active: 'finalize',
    counts: { sort: sortList(rows).live.length, finalize: finalizeWaiting(rows, verified) },
    onGoTo, canLeave: () => !held(),
  }));
  const head = el('div', 'screen-head finalize-head');
  const lede = el('p', 'lede');
  head.append(lede);
  const progress = stage === 'checking'
    ? finalizeProgress('checking', { total: Math.max(reviewTotal || 0, checks), left: checks })
    : finalizeProgress(stage, { pending: pending.length, keeps: keeps.length });
  if (lastKeepAll?.length) {
    // Keep the rest is one click; its way back sits where the count was.
    lede.append(`Kept ${lastKeepAll.length} rewrite${lastKeepAll.length === 1 ? '' : 's'}. `);
    const undo = button('Undo', 'linkish', { focus: 'undo-keep-all', onClick: () => { undo.disabled = true; onUndoKeepAll(); } });
    lede.append(undo);
  } else if (!keeps.length) lede.textContent = 'No unpublished keeps right now.';
  else if (stage !== 'checking' && rewroteNote && !busy) lede.textContent = rewroteNote;   // an empty rewrite's answer, next to the button
  else lede.textContent = progress.text;
  // While rewriting the button is gone entirely: the dots below are the signal.
  if (!busy && stage === 'before') {
    const btn = el('button', 'primary', `Rewrite ${pending.length} description${pending.length === 1 ? '' : 's'}`);
    btn.dataset.focus = 'rewrite';
    btn.addEventListener('click', () => { if (held()) return; btn.disabled = true; onRewrite(); });
    head.append(btn);
  } else if (!busy && stage === 'checking' && toCheck.length > 1) {
    // The bulk keep, named and drawn as on Sort.
    const all = button(` Keep the rest (${toCheck.length})`, 'primary list-keep', {
      focus: 'keep-all',
      icon: 'check',
      onClick: () => { if (held()) return; all.disabled = true; selectedId = null; onVerifyAll(toCheck.map(r => r.id)); },
    });
    head.append(all);
  } else if (!busy && stage === 'plain' && keeps.length) {
    const btn = el('button', 'door', 'Go to Publish');
    btn.dataset.focus = 'door';
    btn.append(faIcon('arrow-right'));
    btn.addEventListener('click', () => { if (!held()) onGoTo('publish'); });
    head.append(btn);
  }
  container.append(head);
  if (busy) {
    // The wait says what it is: the dots, and words a screen reader hears.
    container.append(dotsLoader());
    const line = el('p', 'load-line');
    line.setAttribute('role', 'status');
    line.append(loadingLabel(`Rewriting ${pending.length} description${pending.length === 1 ? '' : 's'}`));
    container.append(line);
    return;
  }
  // Rows deleted this visit are gone from the keeps; they stay listed under the groups with Undo.
  const deleted = [...justDeleted.values()].filter(r => rows.find(x => x.id === r.id)?.status === 'trashed');
  if (!keeps.length && !deleted.length) return;

  // The bar shows once there is progress to show (design critique, Sep 18: an empty track read as a divider).
  if (stage !== 'plain' && progress.pct > 0) {
    const bar = el('div', 'f-progress');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuenow', String(progress.pct));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    const fill = el('i');
    fill.style.width = `${progress.pct}%`;
    bar.append(fill);
    container.append(bar);
  }

  // ── The list on the left. ──
  selectedId = pickSelection(groups, selectedId);
  const onlyNone = groups.length === 1 && groups[0].key === 'none';

  const split = el('div', 'f-split');
  const side = el('div', 'f-side');
  const list = el('div', 'f-list');
  for (const group of groups) {
    const open = !group.fold || noneOpen || onlyNone || group.rows.some(r => r.id === selectedId);
    if (group.fold) {
      const toggle = el('button', 'f-group-head is-fold');
      toggle.type = 'button';
      toggle.dataset.focus = `group:${group.key}`;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.append(faIcon(open ? 'chevron-down' : 'chevron-right'), el('span', '', group.label), el('span', 'f-group-count', String(group.rows.length)));
      toggle.addEventListener('click', () => { if (held()) return; noneOpen = !open; rerender(); });
      list.append(toggle);
    } else {
      list.append(el('p', 'f-group-head', group.label));
    }
    if (!open) continue;
    for (const row of group.rows) {
      const item = el('button', `f-list-row${group.key === 'rewrite' ? ' is-rewrite' : ''}${row.id === selectedId ? ' is-selected' : ''}`);
      item.type = 'button';
      item.dataset.focus = `row:${row.id}`;
      if (row.id === selectedId) item.setAttribute('aria-current', 'true');
      if (group.key === 'rewrite') {
        // Colour is never the only signal: the triangle, as on Sort's rows.
        const mark = faIcon('triangle-exclamation');
        mark.classList.add('fix-mark');
        item.append(mark);
      }
      item.append(rowText(row));
      if (group.key === 'done') item.append(faIcon('check'));
      item.addEventListener('click', () => { if (row.id !== selectedId && held()) return; selectedId = row.id; editingId = null; rerender(); });
      list.append(item);
    }
  }
  if (deleted.length) {
    list.append(el('p', 'f-group-head', 'Deleted'));
    for (const row of deleted) {
      const item = el('div', 'f-list-row is-deleted');
      item.append(rowText(row));
      const undo = button('Undo', 'linkish', { focus: `undo:${row.id}`, onClick: () => { undo.disabled = true; justDeleted.delete(row.id); onRestore(row); } });
      item.append(undo);
      list.append(item);
    }
  }
  side.append(list);
  split.append(side);

  // ── The card on the right. ──
  const row = keeps.find(r => r.id === selectedId);
  const group = row && groups.find(g => g.rows.includes(row));
  if (!row && !keeps.length) {
    split.append(el('div', 'f-pane-empty', 'Nothing left here.'));
  } else if (!row) {
    const empty = el('div', 'f-pane-empty');
    empty.append(verified.size ? 'Every rewrite is checked. ' : 'Nothing needs a rewrite. ');
    const go = button('Go to Publish', 'linkish', { focus: 'door-empty', onClick: () => onGoTo('publish') });
    go.append(' ', faIcon('arrow-right'));
    empty.append(go);
    split.append(empty);
  } else if (group.key === 'check') {
    const at = toCheck.indexOf(row);
    const nextId = toCheck[at + 1]?.id ?? toCheck[at - 1]?.id ?? null;
    split.append(checkCard(row, { old: review.get(row.id), nextId, onVerify: onVerifyRewrite, onRevert: onRevertRewrite, onCheckEdit, onTrash, rerender }));
  } else if (group.key === 'rewrite') {
    split.append(simpleCard(row, originalBox(row), { rerender, onEditRow, onTrash }));
  } else {
    split.append(simpleCard(row, detailBody(row, today), { rerender, onEditRow, onTrash }));
  }
  container.append(split);
  const card = split.querySelector('.f-card');
  if (card) markOverflow(card);
  restoreFocus(container, focusKey, card?.querySelector('h3') ?? split.querySelector('.f-pane-empty button'));
}
