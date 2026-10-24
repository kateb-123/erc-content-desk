/**
 * Sort content's Sort tab (Kate's wireframes, Sep 17, and her answers, Sep
 * 18), in her pick A of the looks (Oct 23, design/mockups/a-sort.html): the
 * head as a toolbar band; one list of what came in down the left, newest
 * first, the skipped under it with a tag; then the chosen item as one white
 * card where every field is edited in place, and beside it the decisions, a
 * column of their own: the type as a box of rows, ERC Newsletter only as a
 * switch, then Keep and next, Skip for now and Delete, each showing its key.
 * Keep and next stays locked, saying why under it, until the type and the
 * link are settled. The source shows unless it is the ERC. Rows kept or
 * deleted this visit gray at the bottom of the list with Undo.
 */
import { linkNeedsCheck, missingFields, reshareFlags, sendTo, sendToValue, sendToNote } from './workflow.js';
import { TYPE_ORDER, typeDisplay, subtypesFor, typeIsFlat } from './schema.js';
import { isoToShort } from './queue-view.js';
import { safeHref, withScheme } from './links.js';
import { sortList, oldestWait, readerQueue, isNewToday, needsType, fixReasons, dupeReason, fixContext, keepBlock, missingLine, nextSelected, rowLine, cardLines, FIELD_LABELS } from './sort-view.js';
import { fieldsForType, dateField, finalizeWaiting } from './finalize-view.js';
import { buildImageControl } from './item-image.js';
import { sortPageHead } from './page-head.js';
import { faIcon, lineIcon } from './icons.js';
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
let leavingId = null;     // the row just skipped: still live, so the next draw must let go of it (Kate, Oct 23)

const title = row => row.headline || row.link || '(untitled)';

/** The key a decision answers to, shown on its button (pick A, Oct 23). The
 *  button's name stays its words; its tooltip names the key. */
function keyChip(key) {
  const k = el('kbd', 'sc-key', key);
  k.setAttribute('aria-hidden', 'true');
  return k;
}

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
function savingField(row, field, props, { multiline = false, grow = false } = {}) {
  const input = el(multiline || grow ? 'textarea' : 'input');
  if (multiline) input.rows = 5;
  else if (grow) input.rows = 1;
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
  if (grow && !globalThis.CSS?.supports?.('field-sizing', 'content')) {
    // One line that grows with its words, so a long title wraps instead of being cut off (review, Oct 23).
    // The stylesheet's field-sizing does it where the browser has it; elsewhere, once laid out.
    const fit = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; };
    input.addEventListener('input', fit);
    setTimeout(fit, 0);
  }
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

/** The link, under the lines of the title (pick A, Oct 23): its domain on a
 *  quiet pill, opening the page, with Change beside it. A link that needs a
 *  check lives in its own question note instead (linkNote). */
function linkLine(row, props, rerender) {
  const line = el('div', 'sc-link');
  const href = safeHref(row.link);
  if (href) {
    const a = el('a', 'sc-link-pill', domainOf(href));
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    a.append(faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
    line.append(a);
  } else {
    line.append(el('span', 'card-quiet', 'No link'));
  }
  line.append(button('Change', 'linkish sc-change', { focus: 'link-change', onClick: () => { linkOpen = true; rerender(); } }));
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
  line.append(row.link_checked === 'mismatch' ? 'May open a different item. ' : "Couldn't open the page. ");
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

/** The new-link form, under the link or the note while Change is open. */
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

/** The description as prose (the handoff, Sep 22; no label over it since
 *  pick A): click it or Edit to get the field, which saves as you leave it and
 *  turns back into prose. Edit and Add media are small outline buttons. */
function descriptionBlock(row, props, rerender) {
  const box = el('div', 'sc-desc');
  const words = el('div', 'sc-words');
  if (editDesc === row.id) {
    const ta = savingField(row, 'blurb', props, { multiline: true });
    ta.classList.add('sc-desc-edit');
    ta.setAttribute('aria-label', 'Description');
    ta.addEventListener('blur', () => { editDesc = null; setTimeout(rerender, 0); });
    box.append(ta);
    words.append(button('Done', 'sc-tool', { focus: 'desc-edit', onClick: () => ta.blur() }));
  } else {
    const prose = el('p', `sc-prose${row.blurb ? '' : ' is-empty'}`, row.blurb || 'No description yet.');
    const open = () => { editDesc = row.id; rerender(); document.querySelector('.sort-card .sc-desc-edit')?.focus(); };
    prose.addEventListener('click', open);
    box.append(prose);
    words.append(button(' Edit', 'sc-tool', { focus: 'desc-edit', icon: 'pen', onClick: open }));
  }
  words.append(buildImageControl(row.infographic, value => props.onEditRow(row, { infographic: value })).el);
  box.append(words);
  return box;
}

/** The picked type's subtypes, as pills. The pick is the save. */
function subtypeChips(row, type, props) {
  const chips = el('div', 'type-chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Subtype');
  for (const sub of subtypesFor(type)) {
    const picked = row.type === type && row.subtype === sub;
    const b = button(sub, `type-chip${picked ? ' is-picked' : ''}`, { focus: `sub:${sub}` });
    b.setAttribute('aria-pressed', String(picked));
    b.addEventListener('click', () => { pendingType = null; props.onEditType(row, type, sub); });
    chips.append(b);
  }
  return chips;
}

/** The type as a box of rows (the handoff, Sep 22; a box of its own since pick
 *  A): the picked one bold with a check, its subtypes as pills right under
 *  it. The subtype pick is the save; a flat type saves on the type. */
function typeBlock(row, props, rerender) {
  const box = el('fieldset', `card-type${needsType(row) ? ' is-alert' : ''}`);
  box.append(el('legend', '', 'Type'));
  const shown = pendingType?.id === row.id ? pendingType.type : row.type;
  const stack = el('div', 'type-stack');
  for (const t of TYPE_ORDER) {
    const picked = t === shown;
    const b = button(typeDisplay(t), `type-opt${picked ? ' is-picked' : ''}`, { focus: `type:${t}` });
    b.setAttribute('aria-pressed', String(picked));
    if (picked) b.append(lineIcon('check', 'type-check'));
    b.addEventListener('click', () => {
      if (typeIsFlat(t)) { pendingType = null; props.onEditType(row, t, ''); return; }
      if (t === row.type) { pendingType = null; rerender(); return; }
      pendingType = { id: row.id, type: t };
      rerender();
    });
    stack.append(b);
    if (picked && !typeIsFlat(t)) stack.append(subtypeChips(row, t, props));
  }
  box.append(stack);
  return box;
}

/** Where the item goes once kept: the two ticks. */
function sendToBlock(row, props) {
  // One box (Kate, Sep 22): unticked, the item goes to the newsletter and the
  // Exchange both; ticked, the newsletter only, and it never reaches Publish.
  // A campus event (an Event with the A&M subtype) comes ticked (Kate, Sep 22).
  // A switch since pick A (Oct 23): the same box, drawn as a Mac switch, its line under it.
  const box = el('fieldset', 'card-send');
  box.append(el('legend', 'sr-only', 'Send it to'));
  const now = sendTo(row);
  const line = el('div', 'card-send-line');
  const wrap = el('label', 'check');
  const input = el('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.checked = now.newsletter && !now.exchange;
  input.dataset.focus = 'send:newsletter-only';
  input.addEventListener('change', () => props.onEditRow(row, {
    send_to: sendToValue({ newsletter: true, exchange: !input.checked }),
  }));
  const lines = el('span', 'check-lines');
  lines.append(el('span', 'check-name', 'ERC Newsletter only'), el('span', 'check-sub', sendToNote(row)));
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
  if (row.submitter_email) out.push(el('span', 'badge', 'From outside'));
  if (reshare.has(row.id)) out.push(el('span', 'badge', 'In a past issue'));
  else if (ctx.dupes.has(row.id)) {
    const prior = props.rows.find(r => r.id === ctx.dupes.get(row.id));
    if (prior?.published_at && !ctx.groupTag?.has(row.id)) out.push(el('span', 'badge', 'Already live'));
  }
  return out;
}

function sortCard(row, { props, rerender, ctx, reshare, position, total }) {
  // The card and its decisions side by side (pick A, Oct 23): one white box for
  // the item, a column of boxes for the decisions. A press locks both.
  const card = el('div', 'sort-card');
  const lock = () => { for (const x of card.querySelectorAll('button, input, textarea')) x.disabled = true; };
  const lines = cardLines(row, props.today);
  const left = el('article', 'sc-left');
  const right = el('aside', 'sc-right');
  right.setAttribute('aria-label', 'Decision');

  // ── Left: the item as it reads: the type and its facts over the title, the
  // byline and where it is from under it, then the link, the questions, the
  // words, the fields, and who added it at the foot (her line rules, Oct 23) ──
  const kicker = el('div', 'sc-kicker');
  const facts = el('span', 'sc-facts');
  if (lines.type) facts.append(el('span', 'sc-type', lines.type));
  facts.append(...cardTags(row, { props, ctx, reshare }));
  kicker.append(facts, el('span', 'sort-card-pos', `${position} of ${total}`));
  left.append(kicker);

  const head = savingField(row, 'headline', props, { grow: true });
  head.classList.add('card-title');
  head.setAttribute('aria-label', 'Title');
  left.append(head);
  if (lines.byline) left.append(el('p', 'sc-byline', lines.byline));
  if (lines.where) left.append(el('p', 'sc-where', lines.where));
  if (!linkNeedsCheck(row)) left.append(linkLine(row, props, rerender));
  else left.append(linkNote(row, props, rerender));
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
  if (lines.added) left.append(el('p', 'sc-foot', lines.added));

  // ── Right: the decisions ──
  const typeBox = el('div', 'sc-box sc-type-box');
  typeBox.append(typeBlock(row, props, rerender));
  const sendBox = el('div', 'sc-box sc-send-box');
  sendBox.append(sendToBlock(row, props));
  right.append(typeBox, sendBox);
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
    const keep = button('Keep and next', 'primary sc-keep', { focus: 'keep', onClick: () => {
      if (missing) { askMissingId = row.id; rerender(); return; }
      doKeep();
    } });
    keep.append(keyChip('K'));
    const blocked = keepBlock(row, pendingType?.id === row.id ? pendingType.type : row.type);
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
    const skip = button('Skip for now', 'sc-skip', { focus: 'skip', onClick: () => { lock(); landOnTitle = true; leavingId = row.id; props.onDecide(row, 'circleback'); } });
    skip.append(keyChip('S'));
    skip.title = 'Skip for now (S)';
    stack.append(skip);
  }
  const del = button(' Delete', 'linkish trash-link sc-delete', { focus: 'delete', icon: 'trash-can', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'trash'); } });
  del.append(keyChip('D'));
  del.title = 'Delete (D)';
  stack.append(del);
  right.append(stack);

  card.append(left, right);
  return card;
}

// ── The list ──

/** A list row (her line rules, Oct 23): the title with the day it came in at
 *  its right, then one line that never wraps, its first fact darker (a
 *  problem leads, in the warning words), and the row's tag at its end. */
function listRow(row, { props, rerender, ctx, index }) {
  const selected = row.id === selectedId;
  const item = el('button', `sort-row${selected ? ' is-selected' : ''}`);
  item.type = 'button';
  item.dataset.focus = `row:${row.id}`;
  if (selected) item.setAttribute('aria-current', 'true');
  const reasons = fixReasons(row, ctx);
  if (reasons.length) {
    const mark = el('span', 'fix-mark');
    mark.title = reasons.join(' · ');
    mark.append(lineIcon('warning'));
    item.classList.add('has-mark');
    item.append(mark);
  }
  const text = el('span', 'sort-row-text');
  const top = el('span', 'sort-row-top');
  top.append(el('span', 'sort-row-title', title(row)), el('span', 'sort-row-date', isoToShort(row.submitted_at, props.today)));
  text.append(top);
  const line = rowLine(row, ctx, props.today);
  const words = el('span', 'sort-row-line');
  const meta = el('span', 'sort-row-meta');
  if (line.lead) meta.append(el('span', `sort-row-lead${line.fix ? ' is-fix' : ''}`, line.lead));
  if (line.rest.length) meta.append(`${line.lead ? ' · ' : ''}${line.rest.join(' · ')}`);
  if (meta.textContent) meta.title = meta.textContent;   // a cut line shows itself in full on hover
  words.append(meta);
  // The row's tag sits at the end of its line (the handoff, Sep 22; pick A): a group's word, or Skipped.
  const tag = ctx.groupTag?.get(row.id) ?? (row.status === 'circleback' ? 'Skipped' : '');
  if (tag) words.append(el('span', 'badge sort-row-tag', tag));
  if (meta.textContent || tag) text.append(words);
  item.append(text);
  item.addEventListener('click', () => {
    if (row.id === selectedId) return;
    selectedId = row.id; lastIndex = index; pendingType = null; linkOpen = false; askMissingId = null; editDesc = null;
    rerender();
  });
  return item;
}

const DONE_WORDS = { trashed: 'Deleted', kept: 'Kept' };

/** A row kept or deleted this visit, grayed at the bottom with its word and Undo. */
function doneRow(row, { props, ctx }) {
  const item = el('div', `sort-done is-${row.status}`);
  const text = el('span', 'sort-row-text');
  text.append(el('span', 'sort-row-title', title(row)));
  const { lead, rest, fix } = rowLine(row, ctx, props.today);
  const meta = (fix ? rest : [lead, ...rest]).filter(Boolean).join(' · ');   // decided, it asks nothing
  if (meta) text.append(el('span', 'sort-row-meta', meta));
  const acts = el('span', 'sort-done-acts');
  acts.append(el('span', 'queue-gone', DONE_WORDS[row.status] ?? row.status));
  const undo = button('Undo', 'linkish', { focus: `undo:${row.id}`, onClick: () => { undo.disabled = true; props.onUndoRow(row); } });
  acts.append(undo);
  item.append(text, acts);
  return item;
}

function emptyWords(props) {
  if (readerQueue(props.rows).length) return 'Reading new items.';
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
  selectedId = nextSelected(liveOrder, selectedId, lastIndex, leavingId);
  leavingId = null;   // one draw: the decision's own
  if (selectedId !== before) { pendingType = null; linkOpen = false; }
  if (selectedId) lastIndex = liveOrder.indexOf(selectedId);

  // The head as a toolbar band (pick A, Oct 23): the title, the tabs as a segmented control, the wait at its right.
  const bar = sortPageHead({
    active: 'sort',
    counts: { sort: listed.length, finalize: finalizeWaiting(props.rows, props.verified) },
    oldestDays: oldestWait(props.rows, props.today),
    onGoTo: props.onGoTo,
  });
  bar.classList.add('sort-bar');
  container.append(bar);

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
    head.append(el('span', 'sort-list-count', label));
    head.lastChild.append(' ', el('span', 'sort-group-count', String(rows.length)));
    const sweep = button(' Dismiss all', 'linkish trash-link', { focus: `dismiss:${key}`, icon: 'trash-can', onClick: () => { sweep.disabled = true; props.onDismissAll(rows); } });
    head.append(sweep);
    list.append(head);
    for (const row of rows) list.append(listRow(row, { props, rerender, ctx, index: index++ }));
  }
  for (const row of done) list.append(doneRow(row, { props, ctx }));
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
