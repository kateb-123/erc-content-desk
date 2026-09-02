/**
 * Finalize: every unpublished keep in the queue's own slim table — Title,
 * Type, Date submitted, sortable — but rows expand in place like the
 * Exchange: facts above the blurb (Abstract for research), and Edit fields
 * with an explicit Save. ERC leads; rows still needing an ERC-voice blurb
 * are tinted, one button rewrites them all and the results land back in
 * the rows. Nothing publishes from this screen.
 */
import { readyToPublish, needsErcVoice } from './workflow.js';
import { isErc } from './sort-view.js';
import { TYPE_ORDER, TYPE_LABELS } from './schema.js';
import { isoToSlash } from './queue-view.js';
import { dotsLoader, forwardIcon } from './icons.js';
import { titleWithInfo } from './screen-info.js';

const EDITABLE = ['headline', 'date', 'source', 'topic', 'blurb', 'deadline', 'authors', 'time', 'location'];

// View state only — resets on reload, never persisted.
let sortState = { column: '', dir: 'asc' }; // '' = standing order (ERC first)
let expanded = new Set();
let editingId = null;
let showAll = false; // stage 1 (just the rewrites) until Rewrite runs or she skips ahead

/** Arriving at Finalize always starts at stage 1 — "Show all" is a one-visit peek. */
export function resetFinalizeEntry() { showAll = false; }

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The shared predicate lives in workflow.js so the /api/rewrite endpoint
 *  can never disagree with this screen about what needs rewriting. */
export const needsRewrite = needsErcVoice;

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

const SORT_KEYS = {
  title: r => r.headline,
  type: r => TYPE_LABELS[r.type] ?? r.type ?? '',
  submitted: r => r.submitted_at,
};

function sorted(keeps) {
  if (!sortState.column) return standingOrder(keeps);
  const key = SORT_KEYS[sortState.column];
  const flip = sortState.dir === 'desc' ? -1 : 1;
  return keeps.slice().sort((a, b) => {
    const left = String(key(a) ?? '').toLowerCase();
    const right = String(key(b) ?? '').toLowerCase();
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return flip * left.localeCompare(right);
  });
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

export function chevron() {
  const span = el('span', 'chevron');
  span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  return span;
}

/** The facts that lead the expanded detail — events and opportunities only;
 *  research reads title/authors/source in the row and Abstract below. */
function factsFor(row) {
  const per = {
    event: [['Date', isoToSlash(row.date)], ['Time', row.time], ['Location', row.location]],
    opportunity: [['Deadline', isoToSlash(row.deadline)], ['Topic', row.topic]],
  };
  return (per[row.type] ?? []).filter(([, v]) => v);
}

/** Exchange layout: facts panel in a left column, blurb beside it. `extra`
 *  (the Edit fields action) rides under the blurb in the main column.
 *  Shared with Publish, which uses it read-only. */
export function detailBody(row, extra) {
  const facts = factsFor(row);
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
    main.append(el('h4', 'f-detail-label', row.type === 'research' ? 'Abstract' : 'Description'));
    main.append(el('p', 'f-blurb-text', row.blurb));
  } else if (needsRewrite(row)) {
    main.append(el('p', 'rewrite-note', 'No description yet — Rewrite drafts one from the original text.'));
  }
  if (extra) main.append(extra);
  wrap.append(main);
  return wrap;
}

function editBody(row, { onSave, onCancel }) {
  const wrap = el('div');
  const grid = el('div', 'f-edit-grid');
  const inputs = {};
  for (const field of EDITABLE) {
    const label = el('label', field === 'blurb' ? 'f-edit-blurb' : '', field === 'blurb' ? 'description' : field);
    const input = field === 'blurb' ? el('textarea') : el('input');
    if (field === 'blurb') input.rows = 3;
    input.value = row[field] ?? '';
    inputs[field] = input;
    label.append(input);
    grid.append(label);
  }
  wrap.append(grid);
  const actions = el('div', 'f-edit-actions');
  const save = el('button', 'primary', 'Save');
  save.type = 'button';
  save.addEventListener('click', () => {
    const changes = {};
    for (const field of EDITABLE) {
      const value = inputs[field].value.trim();
      if (value !== (row[field] ?? '')) changes[field] = value;
    }
    onSave(row, changes);
  });
  const cancel = el('button', '', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', onCancel);
  actions.append(save, cancel);
  wrap.append(actions);
  return wrap;
}

function itemRows(row, { tint, busy, rerender, onEditRow }) {
  const isOpen = expanded.has(row.id);
  const rowClass = ['f-item', isErc(row) && 'f-erc', tint && 'needs-rewrite',
    tint && busy && 'rewriting', isOpen && 'is-open'].filter(Boolean).join(' ');

  const tr = el('tr', rowClass);
  const titleTd = el('td');
  titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  if (row.type === 'research' && row.authors) titleTd.append(el('span', 'item-source', row.authors));
  if (row.source) titleTd.append(el('span', 'item-source', row.source));
  tr.append(titleTd);
  const typeTd = el('td');
  typeTd.append(el('span', '', row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'));
  if (row.subtype) typeTd.append(el('span', 'item-source', row.subtype));
  tr.append(typeTd);
  tr.append(el('td', '', isoToSlash(String(row.submitted_at ?? '').slice(0, 10)) || '—'));
  const caretTd = el('td', 'f-caret');
  const caret = el('button', 'chevron-btn');
  caret.type = 'button';
  caret.setAttribute('aria-expanded', String(isOpen));
  caret.setAttribute('aria-label', isOpen ? 'Hide details' : 'Show details');
  caret.append(chevron());
  caretTd.append(caret);
  tr.append(caretTd);
  tr.addEventListener('click', () => {
    if (expanded.has(row.id)) { expanded.delete(row.id); if (editingId === row.id) editingId = null; }
    else expanded.add(row.id);
    rerender();
  });

  if (!isOpen) return [tr];

  const detailTr = el('tr', `f-detail-row ${rowClass}`);
  const td = el('td');
  td.colSpan = 4;
  if (editingId === row.id) {
    td.append(editBody(row, {
      onSave: (r, changes) => {
        editingId = null;
        if (Object.keys(changes).length) onEditRow(r, changes);
        else rerender();
      },
      onCancel: () => { editingId = null; rerender(); },
    }));
  } else {
    const edit = el('button', 'linkish', 'Edit fields');
    edit.type = 'button';
    edit.addEventListener('click', () => { editingId = row.id; rerender(); });
    td.append(detailBody(row, edit));
  }
  detailTr.append(td);
  return [tr, detailTr];
}

/** One rewrite at a time: the item, the change, approve or keep the original.
 *  Saving an edit here counts as the decision (onCheckEdit stamps the row). */
function checkCard(row, { old, onVerify, onRevert, onCheckEdit, rerender }) {
  const card = el('div', 'card f-check-card');
  const typeLine = el('p', 'type-line');
  typeLine.append(el('span', 'type-label', row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'));
  if (row.subtype) typeLine.append(` — ${row.subtype}`);
  card.append(typeLine);
  card.append(el('h3', 'f-check-title', row.headline || row.link || '(untitled)'));
  if (row.source) card.append(el('p', 'f-check-source', row.source));

  if (editingId === row.id) {
    card.append(editBody(row, {
      onSave: (r, changes) => {
        editingId = null;
        if (Object.keys(changes).length) onCheckEdit(r, changes);
        else rerender();
      },
      onCancel: () => { editingId = null; rerender(); },
    }));
    return card;
  }

  if (old) {
    const { oldToks, newToks } = diffWords(old, row.blurb);
    card.append(el('p', 'f-diff-label', 'Before'));
    card.append(diffPara(oldToks, 'f-old', 'diff-del'));
    card.append(el('p', 'f-diff-label', 'After'));
    card.append(diffPara(newToks, 'f-blurb-text', 'diff-add'));
  } else {
    card.append(el('p', 'f-diff-label', 'New description — written from the original text'));
    card.append(el('p', 'f-blurb-text', row.blurb));
  }

  const actions = el('div', 'f-verify-actions');
  const lock = () => { for (const b of actions.querySelectorAll('button')) b.disabled = true; };
  const ok = el('button', 'primary', 'Looks good');
  ok.type = 'button';
  ok.addEventListener('click', () => { lock(); onVerify(row.id); });
  actions.append(ok);
  if (old) {
    const revert = el('button', '', 'Keep the original');
    revert.type = 'button';
    revert.addEventListener('click', () => { lock(); onRevert(row); });
    actions.append(revert);
  }
  card.append(actions);
  const edit = el('button', 'linkish', 'Edit fields');
  edit.type = 'button';
  edit.addEventListener('click', () => { editingId = row.id; rerender(); });
  card.append(edit);
  return card;
}

export function renderFinalize(container, props) {
  const { rows, review, verified, reviewTotal, busy, onEditRow, onCheckEdit, onRewrite, onVerifyRewrite, onRevertRewrite, onGoTo } = props;
  const rerender = () => renderFinalize(container, props);
  container.replaceChildren();
  const keeps = readyToPublish(rows);
  const handled = id => review?.has(id) || verified?.has(id);
  const pending = keeps.filter(r => needsRewrite(r) && !handled(r.id));
  const checks = review?.size ?? 0;

  // Stage 1: just the rows waiting on a description. Rewrite (or Show all) moves on.
  const stage1 = pending.length > 0 && !showAll;

  const head = el('div', 'screen-head finalize-head');
  const lead = el('div');
  const info = titleWithInfo('Finalize', 'finalize',
    'Rewrite pending descriptions into ERC voice, then check each one — Looks good saves it, Keep the original leaves the Sheet untouched. After the checks, look over the table (click a row for details) and go to Publish.');
  lead.append(info.row, info.panel);
  const lede = el('p', 'lede');
  if (!keeps.length) {
    lede.textContent = 'No unpublished keeps right now.';
  } else if (stage1) {
    lede.append('These need rewriting into ERC voice. ');
    const all = el('button', 'linkish', 'Show all');
    all.type = 'button';
    all.addEventListener('click', () => { showAll = true; rerender(); });
    lede.append(all);
  } else if (checks && !busy) {
    const done = Math.max(0, (reviewTotal ?? checks) - checks);
    lede.textContent = `Check the rewrites — ${done + 1} of ${reviewTotal ?? checks}`;
  }
  // (No standing lede for the plain table — the info panel explains it.)
  lead.append(lede);
  head.append(lead);
  // While rewriting the button is gone entirely — the dots loader below is the signal,
  // and nothing here can be clicked twice (Kate, Sep 1).
  if (!busy && pending.length && !checks) {
    // While a check queue is open, the queue is the only action — a second
    // Rewrite here would re-run rows mid-review.
    const btn = el('button', 'primary', `Rewrite ${pending.length} description${pending.length === 1 ? '' : 's'}`);
    btn.addEventListener('click', () => { btn.disabled = true; onRewrite(); });
    head.append(btn);
  } else if (!busy && keeps.length && !checks) {
    const btn = el('button', 'primary head-action', 'Go to Publish');
    btn.append(forwardIcon());
    btn.addEventListener('click', () => onGoTo('publish'));
    head.append(btn);
  }
  container.append(head);
  if (busy) {
    container.append(el('p', 'rewrite-status', `Writing ${pending.length} description${pending.length === 1 ? '' : 's'} in ERC voice…`));
    container.append(dotsLoader());
  }

  if (!keeps.length) return;

  // Check the rewrites one at a time; the table waits until every one is decided.
  if (checks && !busy) {
    const next = sorted(keeps).find(r => review.has(r.id));
    if (next) {
      container.append(checkCard(next, {
        old: review.get(next.id),
        onVerify: onVerifyRewrite, onRevert: onRevertRewrite, onCheckEdit, rerender,
      }));
      return;
    }
  }

  const table = el('table', 'queue-table finalize-table');
  const headRow = el('tr');
  for (const col of [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'submitted', label: 'Date' },
  ]) {
    const th = el('th');
    const active = sortState.column === col.key;
    if (active) th.setAttribute('aria-sort', sortState.dir === 'desc' ? 'descending' : 'ascending');
    const btn = el('button', 'sort-btn', `${col.label} ${active ? (sortState.dir === 'desc' ? '↓' : '↑') : '↕'}`);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      if (sortState.column === col.key) sortState.dir = sortState.dir === 'desc' ? 'asc' : 'desc';
      else sortState = { column: col.key, dir: 'asc' };
      rerender();
    });
    th.append(btn);
    headRow.append(th);
  }
  headRow.append(el('th', 'f-caret'));
  const thead = el('thead');
  thead.append(headRow);
  table.append(thead);

  const tbody = el('tbody');
  const listed = stage1 ? sorted(keeps).filter(r => pending.includes(r)) : sorted(keeps);
  for (const row of listed) {
    const tint = pending.includes(row);
    tbody.append(...itemRows(row, { tint, busy, rerender, onEditRow }));
  }
  table.append(tbody);

  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  container.append(scroll);
}
