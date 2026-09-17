/**
 * Finalize (Claude Design round two, Kate's pick Sep 16): a progress bar,
 * the kept rows as a list down the left in groups (Needs a rewrite or To
 * check, Done, No rewrite needed folded), and one card on the right for the
 * chosen row. A rewrite shows Before and After side by side with the changed
 * words marked; Keep or Use original moves to the next one; Keep all
 * remaining clears the rest. ERC leads the standing order. Nothing publishes
 * from this screen.
 */
import { readyToPublish, canRewrite, needsDescription } from './workflow.js';
import { isErc } from './sort-view.js';
import { TYPE_ORDER, TYPE_LABELS } from './schema.js';
import { isoToShort } from './queue-view.js';
import { dotsLoader, faIcon, forwardIcon } from './icons.js';
import { finalizeStage, finalizeGroups, finalizeProgress, pickSelection, editChanges } from './finalize-view.js';
import { buildImageControl } from './item-image.js';
import { titleWithInfo } from './screen-info.js';
import { focusKeyIn, restoreFocus, markOverflow } from './ui-aids.js';

const EDITABLE = ['headline', 'date', 'source', 'topic', 'blurb', 'deadline', 'authors', 'time', 'location'];

// View state only — resets on reload, never persisted.
let editingId = null;
let selectedId = null;      // the row the card shows
let noneOpen = false;       // the No rewrite needed group, folded by default
// Deleted from this screen since it opened, id -> the row as it was. They stay
// listed, greyed, with an Undo (design audit a3): a mis-click on the red word
// beside Edit is one click from repair, as on Sort and the queue.
const justDeleted = new Map();

/** Arriving at Finalize starts fresh: the first row that needs doing, the fold shut. */
export function resetFinalizeEntry() { selectedId = null; noneOpen = false; editingId = null; justDeleted.clear(); }

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The shared predicate lives in workflow.js so the /api/rewrite endpoint
 *  can never disagree with this screen about what needs rewriting. */
export const needsRewrite = canRewrite;

const oldestFirst = (a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at));

/** ERC spotlight leads, then type order, stragglers last — same standing as Sort. */
function standingOrder(keeps) {
  const erc = keeps.filter(isErc).sort(oldestFirst);
  const rest = keeps.filter(r => !isErc(r));
  const known = new Set([...TYPE_ORDER, '']);
  const grouped = [...TYPE_ORDER, ''].flatMap(type =>
    rest.filter(r => (r.type || '') === type).sort(oldestFirst));
  return [...erc, ...grouped, ...rest.filter(r => !known.has(r.type || '')).sort(oldestFirst)];
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

/** The facts that lead the expanded detail — events and opportunities only;
 *  research reads title/authors/source in the row and Abstract below. */
function factsFor(row, today) {
  const per = {
    event: [['Date', isoToShort(row.date, today)], ['Time', row.time], ['Location', row.location]],
    opportunity: [['Deadline', isoToShort(row.deadline, today)], ['Topic', row.topic]],
  };
  return (per[row.type] ?? []).filter(([, v]) => v);
}

/** Exchange layout: facts panel in a left column, blurb beside it. `extra`
 *  (the Edit fields action) rides under the blurb in the main column.
 *  Shared with Publish, which uses it read-only. */
export function detailBody(row, extra, today) {
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
  } else if (needsRewrite(row)) {
    main.append(el('p', 'rewrite-note', 'No description yet. Rewrite drafts one from the original text.'));
  } else if (needsDescription(row)) {
    main.append(el('p', 'rewrite-note', 'Needs a description. Add one in Edit fields.'));
  }
  if (extra) main.append(extra);
  wrap.append(main);
  return wrap;
}

const FIELD_TITLES = {
  headline: 'Title', date: 'Date', source: 'Source', topic: 'Topic',
  blurb: 'Description', deadline: 'Deadline', authors: 'Authors',
  time: 'Time', location: 'Location',
};

function editBody(row, { onSave, onCancel }) {
  const wrap = el('div', 'f-edit-card');
  const grid = el('div', 'f-edit-grid');
  const inputs = {};
  for (const field of EDITABLE) {
    const label = el('label', field === 'blurb' ? 'f-edit-blurb' : '', FIELD_TITLES[field] ?? field);
    const input = field === 'blurb' ? el('textarea') : el('input');
    if (field === 'blurb') input.rows = 3;
    input.value = row[field] ?? '';
    inputs[field] = input;
    label.append(input);
    grid.append(label);
  }
  // Media on every item (Kate, Sep 17): a small Add media under the fields;
  // the picture rides the row's infographic column into the hub and the newsletter.
  const media = el('div', 'f-edit-media', 'Media');
  const imgCtl = buildImageControl(row.infographic, () => {});
  media.append(imgCtl.el);
  grid.append(media);
  wrap.append(grid);
  const actions = el('div', 'f-edit-actions');
  const save = el('button', 'primary', 'Save');
  save.type = 'button';
  save.addEventListener('click', () => {
    const values = Object.fromEntries(EDITABLE.map(field => [field, inputs[field].value]));
    onSave(row, editChanges(row, { ...values, infographic: imgCtl.get() }));
  });
  const cancel = el('button', 'btn-outline', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', onCancel);
  actions.append(save, cancel);
  wrap.append(actions);
  return wrap;
}

const typeText = row => [row.type ? (TYPE_LABELS[row.type] ?? row.type) : '', row.subtype].filter(Boolean).join(' · ');

/** The head of every card: type line, title, source. */
function cardHead(card, row) {
  if (row.type) card.append(el('p', 'type-line', typeText(row)));
  card.append(el('h3', 'f-check-title', row.headline || row.link || '(untitled)'));
  if (row.source) card.append(el('p', 'f-check-source', row.source));
}

/** Edit and Delete, far left of the actions row. */
function toolLinks(actions, row, { rerender, onTrash, lock }) {
  const edit = el('button', 'linkish edit-link', ' Edit');
  edit.type = 'button';
  edit.dataset.focus = 'edit';
  edit.prepend(faIcon('pen'));
  edit.addEventListener('click', () => { editingId = row.id; rerender(); });
  const bin = el('button', 'linkish trash-link sort-delete', ' Delete');
  bin.type = 'button';
  bin.dataset.focus = 'delete';
  bin.prepend(faIcon('trash-can'));
  bin.addEventListener('click', () => { lock(); justDeleted.set(row.id, row); onTrash(row); });
  actions.append(edit, bin);
}

function editCard(row, { onSave, rerender }) {
  const card = el('div', 'card f-card');
  cardHead(card, row);
  card.append(editBody(row, {
    onSave: (r, changes) => {
      editingId = null;
      if (Object.keys(changes).length) onSave(r, changes);
      else rerender();
    },
    onCancel: () => { editingId = null; rerender(); },
  }));
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
  const lock = () => { for (const b of card.querySelectorAll('button')) b.disabled = true; };
  toolLinks(actions, row, { rerender, onTrash, lock });
  if (old) {
    const revert = el('button', 'linkish skip-link', ' Use original');
    revert.type = 'button';
    revert.dataset.focus = 'revert';
    revert.prepend(faIcon('rotate-left'));
    revert.addEventListener('click', () => { lock(); selectedId = nextId; onRevert(row); });
    actions.append(revert);
  }
  const ok = el('button', 'primary', ' Keep');
  ok.type = 'button';
  ok.dataset.focus = 'keep';
  ok.prepend(faIcon('check'));
  ok.addEventListener('click', () => { lock(); selectedId = nextId; onVerify(row.id); });
  actions.append(ok);
  card.append(actions);
  return card;
}

/** A row still waiting for its rewrite: the original text in the amber box. */
function rewriteCard(row, { rerender, onEditRow, onTrash }) {
  if (editingId === row.id) return editCard(row, { onSave: onEditRow, rerender });
  const card = el('div', 'card f-card');
  cardHead(card, row);
  const box = el('div', 'f-original');
  box.append(el('p', 'f-diff-label', 'Original'));
  const text = row.blurb || row.original_text || '';
  box.append(el('p', 'f-blurb-text', text || 'No description yet. Rewrite drafts one from the original text.'));
  card.append(box);
  const actions = el('div', 'f-verify-actions');
  toolLinks(actions, row, { rerender, onTrash, lock: () => { for (const b of card.querySelectorAll('button')) b.disabled = true; } });
  card.append(actions);
  return card;
}

/** Any other kept row: its facts and description, with Edit and Delete. */
function plainCard(row, { rerender, onEditRow, onTrash, today }) {
  if (editingId === row.id) return editCard(row, { onSave: onEditRow, rerender });
  const card = el('div', 'card f-card');
  cardHead(card, row);
  card.append(detailBody(row, null, today));
  const actions = el('div', 'f-verify-actions');
  toolLinks(actions, row, { rerender, onTrash, lock: () => { for (const b of card.querySelectorAll('button')) b.disabled = true; } });
  card.append(actions);
  return card;
}

export function renderFinalize(container, props) {
  const { rows, today, review, verified, reviewTotal, busy, rewroteNote, lastKeepAll, onEditRow, onCheckEdit, onRewrite, onVerifyRewrite, onVerifyAll, onUndoKeepAll, onRevertRewrite, onTrash, onRestore, onGoTo } = props;
  const rerender = () => renderFinalize(container, props);
  const focusKey = focusKeyIn(container);   // a redraw keeps the keyboard's place (design audit a1)
  container.replaceChildren();
  const keeps = standingOrder(readyToPublish(rows));
  const handled = id => review?.has(id) || verified?.has(id);
  const pending = keeps.filter(r => needsRewrite(r) && !handled(r.id));
  const checks = review?.size ?? 0;
  const stage = finalizeStage({ pending: pending.length, checks });

  // ── The head: title, one line of progress, one action on the right. ──
  const head = el('div', 'screen-head finalize-head');
  const lead = el('div');
  const info = titleWithInfo('Finalize', 'finalize',
    'Rewrite the descriptions that need an ERC voice, then check each one: Keep saves the rewrite, Use original leaves the text as it was. Click any row on the left to see it, edit it, or delete it. Then go to Publish.');
  lead.append(info.row, info.panel);
  const progress = stage === 'checking'
    ? finalizeProgress('checking', { total: Math.max(reviewTotal || 0, checks), left: checks })
    : finalizeProgress(stage, { pending: pending.length, keeps: keeps.length });
  const lede = el('p', 'lede');
  if (lastKeepAll?.length && onUndoKeepAll) {
    // Keep all remaining is one click; its way back sits where the count was (design audit b5).
    lede.append(`Kept ${lastKeepAll.length} rewrite${lastKeepAll.length === 1 ? '' : 's'}. `);
    const undo = el('button', 'linkish', 'Undo');
    undo.type = 'button';
    undo.dataset.focus = 'undo-keep-all';
    undo.addEventListener('click', () => { undo.disabled = true; onUndoKeepAll(); });
    lede.append(undo);
  } else if (!keeps.length) lede.textContent = 'No unpublished keeps right now.';
  else if (stage !== 'checking' && rewroteNote && !busy) lede.textContent = rewroteNote;   // an empty rewrite's answer, next to the button (F11)
  else lede.textContent = progress.text;
  lead.append(lede);
  head.append(lead);
  // While rewriting the button is gone entirely: the dots below are the signal.
  if (!busy && stage === 'before') {
    const btn = el('button', 'primary', `Rewrite ${pending.length} description${pending.length === 1 ? '' : 's'}`);
    btn.dataset.focus = 'rewrite';
    btn.addEventListener('click', () => { btn.disabled = true; onRewrite(); });
    head.append(btn);
  } else if (!busy && stage === 'plain' && keeps.length) {
    const btn = el('button', 'door head-action', 'Go to Publish');
    btn.dataset.focus = 'door';
    btn.append(forwardIcon());
    btn.addEventListener('click', () => onGoTo('publish'));
    head.append(btn);
  }
  container.append(head);
  if (busy) {
    container.append(dotsLoader());
    return;
  }
  // Rows deleted this visit are gone from the keeps; they stay listed under the groups with Undo.
  const deleted = [...justDeleted.values()].filter(r => rows.find(x => x.id === r.id)?.status === 'trashed');
  if (!keeps.length && !deleted.length) return;

  if (stage !== 'plain') {
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
  const groups = finalizeGroups(keeps, {
    pending: new Set(pending.map(r => r.id)),
    review: new Set(review?.keys?.() ?? []),
    verified: verified ?? new Set(),
  });
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
      toggle.append(el('span', '', group.label), el('span', 'f-group-count', String(group.rows.length)), faIcon(open ? 'chevron-up' : 'chevron-right'));
      toggle.addEventListener('click', () => { noneOpen = !open; rerender(); });
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
      const text = el('span', 'f-row-text');
      text.append(el('span', 'f-row-title', row.headline || row.link || '(untitled)'));
      if (row.type) text.append(el('span', 'f-row-type', typeText(row)));
      item.append(text);
      if (group.key === 'done') item.append(faIcon('check'));
      item.addEventListener('click', () => { selectedId = row.id; editingId = null; rerender(); });
      list.append(item);
    }
  }
  if (deleted.length) {
    list.append(el('p', 'f-group-head', 'Deleted'));
    for (const row of deleted) {
      const item = el('div', 'f-list-row is-deleted');
      const text = el('span', 'f-row-text');
      text.append(el('span', 'f-row-title', row.headline || row.link || '(untitled)'));
      if (row.type) text.append(el('span', 'f-row-type', typeText(row)));
      item.append(text);
      const undo = el('button', 'linkish', 'Undo');
      undo.type = 'button';
      undo.dataset.focus = `undo:${row.id}`;
      undo.addEventListener('click', () => { undo.disabled = true; justDeleted.delete(row.id); onRestore?.(row); });
      item.append(undo);
      list.append(item);
    }
  }
  side.append(list);
  const toCheck = groups.find(g => g.key === 'check')?.rows ?? [];
  if (toCheck.length > 1 && onVerifyAll) {
    const all = el('button', 'linkish f-keep-all', ` Keep all remaining (${toCheck.length})`);
    all.type = 'button';
    all.dataset.focus = 'keep-all';
    all.prepend(faIcon('check'));
    all.addEventListener('click', () => { all.disabled = true; selectedId = null; onVerifyAll(toCheck.map(r => r.id)); });
    side.append(all);
  }
  split.append(side);

  // ── The card on the right. ──
  const row = keeps.find(r => r.id === selectedId);
  const group = row && groups.find(g => g.rows.includes(row));
  if (!row && !keeps.length) {
    split.append(el('div', 'f-pane-empty', 'Nothing left here.'));
  } else if (!row) {
    const empty = el('div', 'f-pane-empty');
    empty.append(verified?.size ? 'Every rewrite is checked. ' : 'Nothing needs a rewrite. ');
    const go = el('button', 'linkish', 'Go to Publish');
    go.type = 'button';
    go.append(' ', forwardIcon());
    go.addEventListener('click', () => onGoTo('publish'));
    empty.append(go);
    split.append(empty);
  } else if (group.key === 'check') {
    const at = toCheck.indexOf(row);
    const nextId = toCheck[at + 1]?.id ?? toCheck[at - 1]?.id ?? null;
    split.append(checkCard(row, { old: review.get(row.id), nextId, onVerify: onVerifyRewrite, onRevert: onRevertRewrite, onCheckEdit, onTrash, rerender }));
  } else if (group.key === 'rewrite') {
    split.append(rewriteCard(row, { rerender, onEditRow, onTrash }));
  } else {
    split.append(plainCard(row, { rerender, onEditRow, onTrash, today }));
  }
  container.append(split);
  const card = split.querySelector('.f-card');
  if (card) markOverflow(card);
  restoreFocus(container, focusKey, card?.querySelector('h3') ?? card);
}
