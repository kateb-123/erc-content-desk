/**
 * Sort content's Sort tab (Kate's wireframes, Sep 17, and her answers, Sep
 * 18): one list of what came in, newest first, the skipped under it with a
 * tag; beside it a card for the chosen item where every field is edited in
 * place, the type is a segmented row, Send it to says where it goes, and
 * Delete, Skip for now and Keep and next decide it. Keep and next stays
 * locked, saying why under it, until the type and the link are settled. The
 * source shows unless it is the ERC. Rows kept or deleted this
 * visit grey at the bottom of the list with Undo.
 */
import { linkNeedsCheck, missingFields, reshareFlags, sendTo, sendToValue } from './workflow.js';
import { TYPE_ORDER, typeDisplay, subtypesFor, typeIsFlat } from './schema.js';
import { isoToShort } from './queue-view.js';
import { safeHref, withScheme } from './links.js';
import { sortList, oldestWait, readerQueue, isNewToday, needsType, fixReasons, dupeReason, fixContext, keepBlock, missingLine, nextSelected, shownSource, FIELD_LABELS } from './sort-view.js';
import { fieldsForType, dateField, finalizeWaiting } from './finalize-view.js';
import { buildImageControl } from './item-image.js';
import { sortPageHead } from './page-head.js';
import { faIcon } from './icons.js';
import { el, button, focusKeyIn, restoreFocus, revealTop } from './ui-aids.js';

// View state: the row the card shows, where it stood (so a decision moves to
// the row now in its place), a type picked while its subtype is still to
// pick, and whether the link's Change field is open.
let selectedId = null;
let lastIndex = 0;
let pendingType = null;   // { id, type }
let linkOpen = false;
let shownId = null;       // the row the card showed last draw: a new one is brought into view
let landOnTitle = false;  // a decision was made: the next card's title takes focus and is read
let askMissingId = null;  // the row whose Keep is waiting on the missing-fields ask
let editDesc = null;      // the row whose description is a field, not prose (the handoff, Sep 22)
let liveOrder = [];       // the live row ids in list order, for the arrow keys

const title = row => row.headline || row.link || '(untitled)';


/** A list row's second line: where it is from (outside the ERC), who added it, when. */
function rowMeta(row, today) {
  return [shownSource(row), row.submitter && `added by ${row.submitter}`, isoToShort(row.submitted_at, today)]
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

/** The one meta line under the title (the handoff, Sep 22): when, who, then
 *  the link as its domain with Change beside it. A link that needs a check
 *  lives in its own question note instead (linkNote). */
function metaLine(row, props, rerender) {
  const line = el('p', 'sc-meta');
  const facts = [isoToShort(row.submitted_at, props.today), row.submitter && `added by ${row.submitter}`].filter(Boolean);
  line.append(facts.join(' · '));
  const href = safeHref(row.link);
  if (linkNeedsCheck(row)) return line;   // the note carries the link
  line.append(facts.length ? ' · ' : '');
  if (href) {
    const a = el('a', 'source-link', domainOf(href));
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    a.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
    line.append(a);
  } else {
    line.append(el('span', 'card-quiet', 'No link'));
  }
  line.append(' · ', button('Change', 'linkish', { focus: 'link-change', onClick: () => { linkOpen = true; rerender(); } }));
  return line;
}

/** The domain, the part a person recognises. */
const domainOf = href => href.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

/** The link question: the desk could not open the page, or it opened a
 *  different item. Open it, then Confirm it or Change it. */
function linkNote(row, props, rerender) {
  const href = safeHref(row.link);
  const box = el('div', 'card-note-box is-alert');
  const head = el('p', 'card-note-head');
  head.append(faIcon('triangle-exclamation'), 'Check the link');
  box.append(head);
  const line = el('p', 'card-link-line');
  line.append(row.link_checked === 'mismatch' ? 'This link may open a different item. ' : "The desk couldn't open this page. ");
  const after = el('span');
  if (href) {
    const a = el('a', 'source-link', 'Verify link');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    a.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
    after.hidden = true;
    a.addEventListener('click', () => { after.hidden = false; });
    line.append(a);
    after.append(' · ', button('Confirm', 'linkish', { focus: 'link-confirm', onClick: () => props.onVerifyLink(row) }));
  } else {
    line.append(el('span', 'card-quiet', 'No link'));
  }
  after.append(' · ', button('Change', 'linkish', { focus: 'link-change', onClick: () => { linkOpen = true; rerender(); } }));
  line.append(after);
  box.append(line);
  return box;
}

/** The new-link form, under the meta line or the note while Change is open. */
function linkChange(row, props, rerender) {
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
  return row2;
}

/** The description as prose (the handoff, Sep 22): click it or Edit to get
 *  the field, which saves as you leave it and turns back into prose. */
function descriptionBlock(row, props, rerender) {
  const box = el('div', 'sc-desc');
  box.append(el('span', 'card-field-label', 'Description'));
  const words = el('div', 'sc-words');
  if (editDesc === row.id) {
    const ta = savingField(row, 'blurb', props, { multiline: true });
    ta.classList.add('sc-desc-edit');
    ta.addEventListener('blur', () => { editDesc = null; setTimeout(rerender, 0); });
    box.append(ta);
    words.append(button('Done', 'linkish', { focus: 'desc-edit', onClick: () => ta.blur() }));
  } else {
    const prose = el('p', `sc-prose${row.blurb ? '' : ' is-empty'}`, row.blurb || 'No description yet.');
    const open = () => { editDesc = row.id; rerender(); document.querySelector('.sort-card .sc-desc-edit')?.focus(); };
    prose.addEventListener('click', open);
    box.append(prose);
    words.append(button('Edit', 'linkish', { focus: 'desc-edit', onClick: open }));
  }
  words.append(buildImageControl(row.infographic, value => props.onEditRow(row, { infographic: value })).el);
  box.append(words);
  return box;
}

/** The type as a vertical stack (the handoff, Sep 22), the picked type's
 *  subtypes as chips under it. The subtype pick is the save; a flat type
 *  saves on the type. */
function typeBlock(row, props, rerender) {
  const box = el('fieldset', `card-type${needsType(row) ? ' is-alert' : ''}`);
  box.append(el('legend', '', 'Type'));
  const shown = pendingType?.id === row.id ? pendingType.type : row.type;
  const stack = el('div', 'type-stack');
  for (const t of TYPE_ORDER) {
    const picked = t === shown;
    const b = button(typeDisplay(t), `type-opt${picked ? ' is-picked' : ''}`, { focus: `type:${t}` });
    b.setAttribute('aria-pressed', String(picked));
    b.addEventListener('click', () => {
      if (typeIsFlat(t)) { pendingType = null; props.onEditType(row, t, ''); return; }
      if (t === row.type) { pendingType = null; rerender(); return; }
      pendingType = { id: row.id, type: t };
      rerender();
    });
    stack.append(b);
  }
  box.append(stack);
  if (shown && !typeIsFlat(shown)) {
    box.append(el('span', 'card-field-label sc-sub-label', 'Subtype'));
    const chips = el('div', 'type-chips');
    chips.setAttribute('aria-label', 'Subtype');
    for (const sub of subtypesFor(shown)) {
      const picked = row.type === shown && row.subtype === sub;
      const b = button(sub, `type-chip${picked ? ' is-picked' : ''}`, { focus: `sub:${sub}` });
      b.setAttribute('aria-pressed', String(picked));
      b.addEventListener('click', () => { pendingType = null; props.onEditType(row, shown, sub); });
      chips.append(b);
    }
    box.append(chips);
  }
  return box;
}

/** Where the item goes once kept: the two ticks. */
function sendToBlock(row, props) {
  // One box (Kate, Sep 22): unticked, the item goes to the newsletter and the
  // Exchange both; ticked, the newsletter only, and it never reaches Publish.
  // A campus event (an Event with the A&M subtype) comes ticked (Kate, Sep 22).
  const box = el('fieldset', 'card-send');
  box.append(el('legend', '', 'Send it to'));
  const now = sendTo(row);
  const line = el('div', 'card-send-line');
  const wrap = el('label', 'check');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = now.newsletter && !now.exchange;
  input.dataset.focus = 'send:newsletter-only';
  input.addEventListener('change', () => props.onEditRow(row, {
    send_to: sendToValue({ newsletter: true, exchange: !input.checked }),
  }));
  const lines = el('span', 'check-lines');
  lines.append(el('span', 'check-name', 'ERC Newsletter only'), el('span', 'check-sub', 'Skips the Policy Exchange'));
  wrap.append(input, lines);
  line.append(wrap);
  box.append(line);
  return box;
}

/** The facts the card's top line carries. */
function cardTags(row, { props, ctx, reshare }) {
  const out = [];
  if (ctx.groupTag?.has(row.id)) out.push(el('span', 'badge', ctx.groupTag.get(row.id)));
  if (row.status === 'circleback') out.push(el('span', 'badge', 'Skipped'));
  else if (isNewToday(row, props.today)) out.push(el('span', 'badge badge-new', 'New'));
  if (row.submitter_email) out.push(el('span', 'badge', 'External submission'));
  if (reshare.has(row.id)) out.push(el('span', 'badge', 'In a past issue'));
  else if (ctx.dupes.has(row.id)) {
    const prior = props.rows.find(r => r.id === ctx.dupes.get(row.id));
    if (prior?.published_at && !ctx.groupTag?.has(row.id)) out.push(el('span', 'badge', 'Already live'));
  }
  return out;
}

function sortCard(row, { props, rerender, ctx, reshare, position, total }) {
  const card = el('div', 'card sort-card');
  const lock = () => { for (const x of card.querySelectorAll('button, input, textarea')) x.disabled = true; };
  const left = el('div', 'sc-left');
  const right = el('div', 'sc-right');

  // ── Left: the item as it reads ──
  const kicker = el('div', 'sc-kicker');
  const facts = el('span', 'sc-facts');
  const source = shownSource(row);
  if (source) facts.append(el('span', 'sc-source', source));
  facts.append(...cardTags(row, { props, ctx, reshare }));
  kicker.append(facts, el('span', 'sort-card-pos', `${position} of ${total}`));
  left.append(kicker);

  const head = savingField(row, 'headline', props);
  head.classList.add('card-title');
  head.setAttribute('aria-label', 'Title');
  left.append(head, metaLine(row, props, rerender));
  if (linkNeedsCheck(row)) left.append(linkNote(row, props, rerender));
  if (linkOpen) left.append(linkChange(row, props, rerender));

  const dupe = dupeReason(row, ctx);
  if (dupe) {
    const note = el('div', 'card-note-box is-alert');
    const h = el('p', 'card-note-head');
    h.append(faIcon('triangle-exclamation'), 'Possible duplicate');
    note.append(h, el('p', 'card-link-line', dupe));
    left.append(note);
  }
  if (String(row.needs_review ?? '').trim()) {
    const filled = String(row.auto_filled ?? '').split(',').map(f => f.trim()).filter(Boolean);
    left.append(el('p', 'card-quiet', filled.length ? `Filled in from the page. Check: ${filled.join(', ')}.` : 'Filled in from the page. Check the fields.'));
  }
  if (row.note) left.append(el('p', 'card-quiet', `Note: ${row.note}`));
  left.append(descriptionBlock(row, props, rerender));
  // The type decides the fields: none until it is picked.
  const grid = el('div', 'card-grid');
  for (const field of row.type ? fieldsForType(row.type, row.subtype).filter(f => f !== 'headline' && f !== 'blurb') : []) {
    grid.append(labelled(FIELD_LABELS[field] ?? field, savingField(row, field, props)));
  }
  if (grid.childNodes.length) left.append(grid);

  // ── Right: the decisions ──
  right.append(typeBlock(row, props, rerender), sendToBlock(row, props), el('div', 'sc-spacer'));
  const stack = el('div', 'sc-decide');
  const doKeep = () => { askMissingId = null; lock(); landOnTitle = true; props.onDecide(row, 'keep'); };
  const missing = missingLine(row);
  if (askMissingId === row.id && missing) {
    // The one ask before Keep (Kate, Sep 22): the fields the type still needs,
    // then Keep anyway or Fill it in. K keeps anyway, the same as on the button.
    const ask = el('div', 'card-note-box is-alert card-keep-ask');
    const h = el('p', 'card-note-head');
    h.append(faIcon('triangle-exclamation'), missing);
    const words = el('p', 'card-link-line');
    words.append(button('Keep anyway', 'linkish alert-word', { focus: 'keep', onClick: doKeep }), ' · ',
      button('Fill it in', 'linkish alert-word', { focus: 'fill', onClick: () => {
        askMissingId = null;
        rerender();
        const first = missingFields(row)[0];
        document.querySelector(`.sort-card [data-field="${first}"]`)?.focus();
      } }));
    ask.append(h, words);
    stack.append(ask);
  } else {
    const keep = button('Keep and next', 'primary sc-keep', { focus: 'keep', icon: 'check', onClick: () => {
      if (missing) { askMissingId = row.id; rerender(); return; }
      doKeep();
    } });
    const blocked = keepBlock(row);
    keep.title = blocked || 'Keep and next (K)';
    stack.append(keep);
    if (blocked) {
      // Locked, it says why in a line under it, not only in the tooltip (audit, Sep 23).
      keep.disabled = true;
      const why = el('p', 'sc-keep-why', blocked);
      why.id = 'sc-keep-why';
      keep.setAttribute('aria-describedby', why.id);
      stack.append(why);
    }
  }
  if (row.status !== 'circleback') {
    const skip = button('Skip for now', 'linkish quiet-link sc-skip', { focus: 'skip', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'circleback'); } });
    skip.title = 'Skip for now (S)';
    stack.append(skip);
  }
  right.append(stack);
  const tools = el('div', 'sc-tools');
  const del = button(' Delete', 'linkish trash-link', { focus: 'delete', icon: 'trash-can', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'trash'); } });
  del.title = 'Delete (D)';
  tools.append(del);
  right.append(tools);

  card.append(left, right);
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
  text.append(el('span', 'sort-row-title', title(row)));
  const meta = rowMeta(row, props.today);
  if (meta) text.append(el('span', 'sort-row-meta', meta));
  item.append(text);
  // The row's tag sits at its right (the handoff, Sep 22): a group's word, or Skipped.
  const tag = ctx.groupTag?.get(row.id) ?? (row.status === 'circleback' ? 'Skipped' : '');
  if (tag) item.append(el('span', 'badge sort-row-tag', tag));
  item.addEventListener('click', () => {
    if (row.id === selectedId) return;
    selectedId = row.id; lastIndex = index; pendingType = null; linkOpen = false; askMissingId = null; editDesc = null;
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

  const { live, past, onHub, done } = sortList(props.rows, props.sessionDecided, { today: props.today, liveLinks: props.liveLinks });
  const listed = [...live, ...past, ...onHub];   // the card and the keys reach the groups too
  liveOrder = listed.map(r => r.id);
  const before = selectedId;
  selectedId = nextSelected(liveOrder, selectedId, lastIndex);
  if (selectedId !== before) { pendingType = null; linkOpen = false; }
  if (selectedId) lastIndex = liveOrder.indexOf(selectedId);

  container.append(sortPageHead({
    active: 'sort',
    counts: { sort: listed.length, finalize: finalizeWaiting(props.rows, props.verified) },
    oldestDays: oldestWait(props.rows, props.today),
    onGoTo: props.onGoTo,
  }));

  const split = el('div', 'sort-split');
  const list = el('div', 'sort-list');
  const listHead = el('div', 'sort-list-head');
  listHead.append(el('span', 'sort-list-count', `${live.length} waiting`), el('span', 'sort-list-order', 'Newest first'));
  list.append(listHead);
  const ctx = fixContext(props.rows, props.today);
  // The two groups' tags (Kate, Sep 22), read by the row and the card.
  ctx.groupTag = new Map([...past.map(r => [r.id, 'Past']), ...onHub.map(r => [r.id, 'Already live'])]);
  live.forEach((row, index) => list.append(listRow(row, { props, rerender, ctx, index })));
  let index = live.length;
  for (const [key, label, rows] of [['past', 'Past', past], ['live', 'Already live', onHub]]) {
    if (!rows.length) continue;
    // A group's head names it and offers one sweep: Dismiss all deletes the lot, with Undo.
    const head = el('div', 'sort-list-head sort-group-head');
    head.append(el('span', 'sort-list-count', `${label} · ${rows.length}`));
    const sweep = button(' Dismiss all', 'linkish trash-link', { focus: `dismiss:${key}`, icon: 'trash-can', onClick: () => { sweep.disabled = true; props.onDismissAll(rows); } });
    head.append(sweep);
    list.append(head);
    for (const row of rows) list.append(listRow(row, { props, rerender, ctx, index: index++ }));
  }
  for (const row of done) list.append(doneRow(row, props));
  split.append(list);

  const row = listed.find(r => r.id === selectedId);
  const card = row
    ? sortCard(row, { props, rerender, ctx, reshare: reshareFlags(props.rows, props.today ?? ''), position: lastIndex + 1, total: listed.length })
    : el('div', 'sort-pane-empty', emptyWords(props));
  split.append(card);
  container.append(split);
  // One scrollbar, the page's (Kate, Sep 23): a card that changed while out of view comes back into it.
  if (row && row.id !== shownId) revealTop(card);
  shownId = row?.id ?? null;
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
