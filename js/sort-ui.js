/**
 * Sort content's Sort tab (Kate's wireframes, Sep 17, and her answers, Sep
 * 18): one list of what came in, newest first, the skipped under it with a
 * tag; beside it a card for the chosen item where every field is edited in
 * place, the type is a segmented row, Send it to says where it goes, and
 * Delete, Skip for now and Keep and next decide it. Keep and next stays
 * locked until the type and the link are settled. Rows kept or deleted this
 * visit grey at the bottom of the list with Undo.
 */
import { linkNeedsCheck, reshareFlags, sendTo, sendToValue } from './workflow.js';
import { TYPE_ORDER, typeDisplay, subtypesFor, typeIsFlat } from './schema.js';
import { isoToShort } from './queue-view.js';
import { safeHref, withScheme } from './links.js';
import { sortList, oldestWait, readerQueue, isNewToday, needsType, fixReasons, dupeReason, fixContext, keepBlock, nextSelected } from './sort-view.js';
import { fieldsForType, dateField, finalizeWaiting } from './finalize-view.js';
import { buildImageControl } from './item-image.js';
import { sortPageHead } from './page-head.js';
import { faIcon } from './icons.js';
import { el, button, focusKeyIn, restoreFocus, markOverflow } from './ui-aids.js';

// View state: the row the card shows, where it stood (so a decision moves to
// the row now in its place), a type picked while its subtype is still to
// pick, and whether the link's Change field is open.
let selectedId = null;
let lastIndex = 0;
let pendingType = null;   // { id, type }
let linkOpen = false;
let landOnTitle = false;  // a decision was made: the next card's title takes focus and is read
let liveOrder = [];       // the live row ids in list order, for the arrow keys

const title = row => row.headline || row.link || '(untitled)';

// What each field is called on the card; medium is the outlet.
const FIELD_LABELS = {
  headline: 'Title', date: 'Date', source: 'Source', topic: 'Topic', deadline: 'Deadline',
  authors: 'Authors', time: 'Time', location: 'Location', medium: 'Outlet',
};

/** A list row's second line: where it is from, who added it, when. */
function rowMeta(row, today) {
  return [row.source || row.authors, row.submitter && `added by ${row.submitter}`, isoToShort(row.submitted_at, today)]
    .filter(Boolean).join(' · ');
}

/** The link as a reader sees it: no scheme, no www. */
const linkText = href => href.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

// ── Drafts: a redraw (a save landing, a status line) must never eat typing ──

/** The card's fields whose value differs from what they were drawn with. */
function readDrafts(container) {
  const drafts = new Map();
  for (const input of container.querySelectorAll('.sort-card [data-field]')) {
    if (input.value !== input.dataset.saved) {
      drafts.set(input.dataset.field, { value: input.value, start: input.selectionStart, end: input.selectionEnd });
    }
  }
  return { id: selectedId, drafts };
}

function applyDrafts(container, { id, drafts }) {
  if (id !== selectedId) return;
  for (const [field, draft] of drafts) {
    const input = container.querySelector(`.sort-card [data-field="${field}"]`);
    if (!input) continue;
    input.value = draft.value;
    if (document.activeElement === input && draft.start != null) input.setSelectionRange(draft.start, draft.end);
  }
}

/** A field that saves itself when you leave it (or press Enter in a line):
 *  the trimmed value, only when it changed. */
function savingField(row, field, props, { multiline = false } = {}) {
  const input = el(multiline ? 'textarea' : 'input');
  if (multiline) input.rows = 5;
  else input.type = dateField(field) ? 'date' : 'text';
  input.value = row[field] ?? '';
  input.dataset.saved = input.value;
  input.dataset.field = field;
  input.dataset.focus = `field:${field}`;
  const save = () => {
    const value = input.value.trim();
    if (value === String(row[field] ?? '').trim()) return;
    input.dataset.saved = input.value;
    // After the focus has moved on, so the redraw puts it where it went.
    setTimeout(() => props.onEditRow(row, { [field]: value }), 0);
  };
  input.addEventListener('blur', save);
  if (!multiline) input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  return input;
}

function labelled(text, control, cls = 'card-field') {
  const wrap = el('div', cls);
  const label = el('label', '', text);
  const id = `sort-${control.dataset.field ?? text.toLowerCase().replace(/\W+/g, '-')}`;
  control.id = id;
  label.htmlFor = id;
  wrap.append(label, control);
  return wrap;
}

// ── The card's parts ──

/** The link: open it, or change it. A link the desk could not read (or
 *  that opened a different item) is a warning note instead: open it, then
 *  Confirm it or Change it. */
function linkBlock(row, props, rerender) {
  const href = safeHref(row.link);
  const needsCheck = linkNeedsCheck(row);
  const box = el('div', needsCheck ? 'card-note-box is-alert' : 'card-link');
  if (needsCheck) {
    const head = el('p', 'card-note-head');
    head.append(faIcon('triangle-exclamation'), 'Check the link');
    box.append(head);
  }
  const line = el('p', 'card-link-line');
  if (needsCheck) line.append(row.link_checked === 'mismatch' ? 'This link may open a different item. ' : "The desk couldn't open this page. ");
  const after = el('span');
  if (href) {
    const a = el('a', 'source-link', needsCheck ? 'Verify link' : linkText(href));
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    a.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
    if (needsCheck) {
      after.hidden = true;
      a.addEventListener('click', () => { after.hidden = false; });
    }
    line.append(a);
  } else {
    line.append(el('span', 'card-quiet', 'No link'));
  }
  if (needsCheck && href) {
    after.append(' · ', button('Confirm', 'linkish', { focus: 'link-confirm', onClick: () => props.onVerifyLink(row) }));
  }
  after.append(' · ', button('Change', 'linkish', { focus: 'link-change', onClick: () => { linkOpen = true; rerender(); } }));
  line.append(after);
  box.append(line);
  if (linkOpen) {
    const row2 = el('div', 'card-link-change');
    const input = el('input');
    input.type = 'url';
    input.placeholder = 'https://';
    input.dataset.focus = 'link-new';
    input.value = row.link ?? '';
    const bad = el('p', 'field-error', 'Paste a full http(s) link');
    bad.hidden = true;
    const saveLink = () => {
      const fixed = withScheme(input.value.trim());
      if (!safeHref(fixed)) { input.classList.add('is-invalid'); input.setAttribute('aria-invalid', 'true'); bad.hidden = false; return; }
      linkOpen = false;
      props.onVerifyLink(row, fixed);
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveLink(); } if (e.key === 'Escape') { linkOpen = false; rerender(); } });
    row2.append(labelled('New link', input, 'card-field'),
      button('Save', 'linkish', { focus: 'link-save', onClick: saveLink }),
      button('Cancel', 'linkish quiet-link', { focus: 'link-cancel', onClick: () => { linkOpen = false; rerender(); } }), bad);
    box.append(row2);
  }
  return box;
}

/** The type as a segmented row, the picked type's subtypes in a smaller row
 *  under it. The subtype pick is the save; a flat type saves on the type. */
function typeBlock(row, props, rerender) {
  const box = el('fieldset', `card-type${needsType(row) ? ' is-alert' : ''}`);
  const legend = el('legend');
  if (needsType(row)) legend.append(faIcon('triangle-exclamation'));
  legend.append('Type');
  box.append(legend);
  const shown = pendingType?.id === row.id ? pendingType.type : row.type;
  const segs = el('div', 'pill-row');
  for (const t of TYPE_ORDER) {
    const picked = t === shown;
    const b = button(typeDisplay(t), `type-word${picked ? ' is-picked' : ''}`, { focus: `type:${t}` });
    b.setAttribute('aria-pressed', String(picked));
    b.addEventListener('click', () => {
      if (typeIsFlat(t)) { pendingType = null; props.onEditType(row, t, ''); return; }
      if (t === row.type) { pendingType = null; rerender(); return; }
      pendingType = { id: row.id, type: t };
      rerender();
    });
    segs.append(b);
  }
  box.append(segs);
  if (shown && !typeIsFlat(shown)) {
    const subs = el('div', 'pill-row is-sub');
    subs.setAttribute('aria-label', 'Subtype');
    for (const sub of subtypesFor(shown)) {
      const picked = row.type === shown && row.subtype === sub;
      const b = button(sub, `type-word is-small${picked ? ' is-picked' : ''}`, { focus: `sub:${sub}` });
      b.setAttribute('aria-pressed', String(picked));
      b.addEventListener('click', () => { pendingType = null; props.onEditType(row, shown, sub); });
      subs.append(b);
    }
    box.append(subs);
  }
  return box;
}

/** Where the item goes once kept: the two ticks. */
function sendToBlock(row, props) {
  const box = el('fieldset', 'card-send');
  box.append(el('legend', '', 'Send it to'));
  const now = sendTo(row);
  const line = el('div', 'card-send-line');
  for (const [key, label] of [['newsletter', 'Newsletter'], ['exchange', 'Policy Exchange']]) {
    const wrap = el('label', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = now[key];
    input.dataset.focus = `send:${key}`;
    input.addEventListener('change', () => props.onEditRow(row, { send_to: sendToValue({ ...now, [key]: input.checked }) }));
    wrap.append(input, ` ${label}`);
    line.append(wrap);
  }
  box.append(line);
  return box;
}

/** The facts the card's top line carries. */
function cardTags(row, { props, ctx, reshare }) {
  const out = [];
  if (row.status === 'circleback') out.push(el('span', 'badge', 'Skipped'));
  else if (isNewToday(row, props.today)) out.push(el('span', 'badge badge-new', 'New'));
  if (row.spotlight_request) out.push(el('span', 'badge', 'Spotlight requested'));
  if (row.submitter_email) out.push(el('span', 'badge', 'External submission'));
  if (reshare.has(row.id)) out.push(el('span', 'badge', 'In a past issue'));
  else if (ctx.dupes.has(row.id)) {
    const prior = props.rows.find(r => r.id === ctx.dupes.get(row.id));
    if (prior?.published_at) out.push(el('span', 'badge', 'Already live'));
  }
  return out;
}

function sortCard(row, { props, rerender, ctx, reshare, position, total }) {
  const card = el('div', 'card sort-card');
  const lock = () => { for (const x of card.querySelectorAll('button, input, textarea')) x.disabled = true; };

  const top = el('div', 'sort-card-top');
  top.append(...cardTags(row, { props, ctx, reshare }), el('span', 'sort-card-pos', `${position} of ${total}`));
  card.append(top);

  const head = savingField(row, 'headline', props);
  head.classList.add('card-title');
  head.setAttribute('aria-label', 'Title');
  card.append(head);
  const meta = [isoToShort(row.submitted_at, props.today), row.submitter && `added by ${row.submitter}`].filter(Boolean).join(' · ');
  if (meta) card.append(el('p', 'sort-card-meta', meta));
  card.append(linkBlock(row, props, rerender));

  const dupe = dupeReason(row, ctx);
  if (dupe) {
    const note = el('div', 'card-note-box is-alert');
    const h = el('p', 'card-note-head');
    h.append(faIcon('triangle-exclamation'), 'Possible duplicate');
    note.append(h, el('p', 'card-link-line', dupe));
    card.append(note);
  }
  if (String(row.needs_review ?? '').trim()) {
    const filled = String(row.auto_filled ?? '').split(',').map(f => f.trim()).filter(Boolean);
    card.append(el('p', 'card-quiet', filled.length ? `The reader wasn't sure. Check: ${filled.join(', ')}.` : "The reader wasn't sure. Check the fields."));
  }
  if (row.note) card.append(el('p', 'card-quiet', `Note: ${row.note}`));

  card.append(labelled('Description', savingField(row, 'blurb', props, { multiline: true })));
  card.append(typeBlock(row, props, rerender));
  // The type decides the fields: none until it is picked.
  const grid = el('div', 'card-grid');
  for (const field of row.type ? fieldsForType(row.type).filter(f => f !== 'headline' && f !== 'blurb') : []) {
    grid.append(labelled(FIELD_LABELS[field] ?? field, savingField(row, field, props)));
  }
  if (grid.childNodes.length) card.append(grid);
  const media = el('div', 'card-field card-media');
  media.append(el('span', 'card-field-label', 'Media'));
  media.append(buildImageControl(row.infographic, value => props.onEditRow(row, { infographic: value })).el);
  card.append(media);
  card.append(sendToBlock(row, props));

  // Delete far left; Skip for now and the one filled Keep and next on the right.
  const acts = el('div', 'sort-card-acts');
  const del = button(' Delete', 'linkish trash-link', { focus: 'delete', icon: 'trash-can', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'trash'); } });
  del.title = 'Delete (D)';
  acts.append(del);
  const right = el('span', 'sort-card-right');
  if (row.status !== 'circleback') {
    const skip = button('Skip for now', 'linkish quiet-link', { focus: 'skip', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'circleback'); } });
    skip.title = 'Skip for now (S)';
    right.append(skip);
  }
  const keep = button(' Keep and next', 'primary', { focus: 'keep', icon: 'check', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'keep'); } });
  const blocked = keepBlock(row);
  keep.title = blocked || 'Keep and next (K)';
  if (blocked) keep.disabled = true;
  right.append(keep);
  acts.append(right);
  card.append(acts);
  return card;
}

// ── The list ──

function listRow(row, { props, rerender, ctx, index }) {
  const selected = row.id === selectedId;
  const item = el('button', `sort-row${selected ? ' is-selected' : ''}`);
  item.type = 'button';
  item.dataset.focus = `row:${row.id}`;
  if (selected) item.setAttribute('aria-current', 'true');
  const reasons = fixReasons(row, ctx);
  if (reasons.length) {
    const mark = faIcon('triangle-exclamation');
    mark.classList.add('fix-mark');
    mark.title = reasons.join(' · ');
    item.append(mark);
  }
  const text = el('span', 'sort-row-text');
  const titleLine = el('span', 'sort-row-title', title(row));
  if (row.status === 'circleback') titleLine.prepend(el('span', 'badge', 'Skipped'), ' ');
  text.append(titleLine);
  const meta = rowMeta(row, props.today);
  if (meta) text.append(el('span', 'sort-row-meta', meta));
  item.append(text);
  item.addEventListener('click', () => {
    if (row.id === selectedId) return;
    selectedId = row.id; lastIndex = index; pendingType = null; linkOpen = false;
    rerender();
  });
  return item;
}

const DONE_WORDS = { trashed: 'Deleted', kept: 'Kept' };

/** A row kept or deleted this visit, greyed at the bottom with its word and Undo. */
function doneRow(row, props) {
  const item = el('div', `sort-done is-${row.status}`);
  const text = el('span', 'sort-row-text');
  text.append(el('span', 'sort-row-title', title(row)));
  const meta = rowMeta(row, props.today);
  if (meta) text.append(el('span', 'sort-row-meta', meta));
  const acts = el('span', 'sort-done-acts');
  acts.append(el('span', 'queue-gone', DONE_WORDS[row.status] ?? row.status));
  const undo = button('Undo', 'linkish', { focus: `undo:${row.id}`, onClick: () => { undo.disabled = true; props.onUndoRow(row); } });
  acts.append(undo);
  item.append(text, acts);
  return item;
}

function emptyWords(props) {
  if (readerQueue(props.rows).length) return 'New items are being read.';
  return props.sortedCount ? 'All sorted.' : 'Nothing to sort.';
}

export function renderSort(container, props) {
  const rerender = () => renderSort(container, props);
  const focusKey = focusKeyIn(container);
  const drafts = readDrafts(container);
  container.replaceChildren();

  const { live, done } = sortList(props.rows, props.sessionDecided);
  liveOrder = live.map(r => r.id);
  const before = selectedId;
  selectedId = nextSelected(liveOrder, selectedId, lastIndex);
  if (selectedId !== before) { pendingType = null; linkOpen = false; }
  if (selectedId) lastIndex = liveOrder.indexOf(selectedId);

  container.append(sortPageHead({
    active: 'sort',
    counts: { sort: live.length, finalize: finalizeWaiting(props.rows, props.verified) },
    oldestDays: oldestWait(props.rows, props.today),
    onGoTo: props.onGoTo,
  }));

  const split = el('div', 'sort-split');
  const list = el('div', 'sort-list');
  const listHead = el('div', 'sort-list-head');
  listHead.append(el('span', 'sort-list-count', `${live.length} waiting`), el('span', 'sort-list-order', 'Newest first'));
  list.append(listHead);
  const ctx = fixContext(props.rows, props.today);
  live.forEach((row, index) => list.append(listRow(row, { props, rerender, ctx, index })));
  for (const row of done) list.append(doneRow(row, props));
  split.append(list);

  const row = live.find(r => r.id === selectedId);
  const card = row
    ? sortCard(row, { props, rerender, ctx, reshare: reshareFlags(props.rows, props.today ?? ''), position: lastIndex + 1, total: live.length })
    : el('div', 'sort-pane-empty', emptyWords(props));
  split.append(card);
  container.append(split);
  if (row) markOverflow(card);
  applyDrafts(container, drafts);

  const titleField = container.querySelector('.card-title');
  if (landOnTitle && titleField) {
    // After a decision the next item's title is read, and the keys still work from the card.
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  } else {
    restoreFocus(container, focusKey, card);
    applyDrafts(container, drafts);
  }
  landOnTitle = false;
  bindShortcuts(container, props);
}

/** The keys: arrows move through the list, K keeps, S skips, D deletes, U
 *  undoes. Each presses the button it names, so a locked Keep stays locked.
 *  Not while typing. */
function bindShortcuts(container, props) {
  container.onkeydown = event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    const press = key => { const b = container.querySelector(`[data-focus="${key}"]`); if (b && !b.disabled) { event.preventDefault(); b.focus({ preventScroll: true }); b.click(); } };
    const k = event.key.toLowerCase();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (event.target.closest('[role="tablist"]')) return;
      const at = liveOrder.indexOf(selectedId);
      const next = liveOrder[at + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) press(`row:${next}`);
      else event.preventDefault();
    } else if (k === 'k') press('keep');
    else if (k === 's') press('skip');
    else if (k === 'd') press('delete');
    else if (k === 'u') { event.preventDefault(); props.onUndo(); }
  };
}
