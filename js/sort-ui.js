/**
 * Sort: one section at a time (Kate, Sep 15), drawn as a list and a card
 * (Claude Design round two, Kate's pick C, Sep 16). The sections sit as
 * pills on top; the screen lands on the first one that holds anything, Needs
 * a fix first. Down the left, the section's rows (title, source and date);
 * on the right, one card for the chosen row: its badges, a fix panel (the
 * type as radios, subtypes under the picked type; the link check), the
 * description, and Edit · Delete · Skip · Keep. A decision moves the card to
 * the next row; decided rows grey at the bottom of the list with Undo.
 */
import { linkCheckState, reshareFlags, missingFields } from './workflow.js';
import { TYPE_ORDER, TYPE_LABELS, subtypesFor, typeIsFlat } from './schema.js';
import { isoToShort } from './queue-view.js';
import { safeHref, withScheme } from './links.js';
import { sortCounts, isErc, readerQueue, isNewToday, sectionRows, landingSection, needsType, fixReasons, fixContext, keepBlock, nextSelected, nextSectionWithRows } from './sort-view.js';
import { buildImageControl } from './item-image.js';
import { titleWithInfo } from './screen-info.js';
import { faIcon, forwardIcon } from './icons.js';

// The section's view state: which row the card shows, where it stood (so a
// decision moves to the row now in its place), and which of the card's
// panels (edit form, type change) is open.
let selectedId = null;
let lastIndex = 0;
let listPanel = null;   // 'edit' | 'type' | null

const FILTER_LABELS = [
  // 'Needs a fix' (Kate, Sep 15): the one amber thing on the screen. It gathers
  // every row that cannot be kept yet (no type, link not opened) and possible
  // duplicates, so the rows themselves carry no amber marks.
  ['fix', 'Needs a fix'], ['erc', 'ERC'], ['erc_event', 'ERC events'],
  ['research', 'Research'],
  ['event', 'Events'], ['opportunity', 'Opportunities'], ['headline', 'Headlines'],
  // Skipped (Kate, Sep 15, option B): every parked row, any type, with Keep and
  // Delete, so a Skip is never the end of the road. Last on the menu.
  ['skipped', 'Skipped'],
];
const FILTER_KEYS = FILTER_LABELS.map(([k]) => k);

let lastFilter = null;  // detects a section jump so the list slides like the screens do

// A decision moves no pixels (Kate, Sep 9): the decided row greys in place at
// the bottom of its section, with Undo. On a 95-item session even a 260ms
// animation is half a minute of watching.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The inline editor (Title, Description, Link, and Media on ERC items). Shared by
 *  the card and the section list, so a field never exists in only one place.
 *  `read` returns what is typed, for a decision to carry (Kate, Sep 9). */
function buildEditForm(row, { onSave, onCancel }) {
    const form = el('div', 'sort-edit');
  const mkField = (label, value, rows) => {
    const wrap = el('label', 'sort-edit-field', label);
    const input = rows ? el('textarea') : el('input');
    if (rows) input.rows = rows; else input.type = 'text';
    input.value = value ?? '';
    wrap.append(input);
    form.append(wrap);
    return input;
  };
  const titleIn = mkField('Title', row.headline);
  const blurbIn = mkField('Description', row.blurb, 4);
  const linkIn = mkField('Link', row.link);
  // ERC items can carry a picture (flyer, cover) — it rides the row's
  // infographic column into the newsletter. A div, not a label: a label
  // would forward stray clicks to the upload button.
  let imgCtl = null;
  if (isErc(row)) {
    const wrap = el('div', 'sort-edit-field', 'Media');
    imgCtl = buildImageControl(row.infographic, () => {});
    wrap.append(imgCtl.el);
    form.append(wrap);
  }
  const read = () => ({
    headline: titleIn.value.trim(), blurb: blurbIn.value, link: withScheme(linkIn.value.trim()),
    ...(imgCtl ? { infographic: imgCtl.get() } : {}),
  });
  const rowBtns = el('div', 'sort-edit-actions');
  const save = el('button', 'primary', 'Save');
  save.type = 'button';
  save.addEventListener('click', () => {
    onSave(read());
  });
  const cancel = el('button', 'btn-outline', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', () => onCancel());
  rowBtns.append(save, cancel);
  form.append(rowBtns);
  return { el: form, read };
}

/** The type as radios, the picked type's subtypes as indented radios under it
 *  (Claude Design round two, Sep 16). Picking the subtype IS the save (Kate,
 *  Sep 1); a flat type (ERC Event) saves on the type pick (Sep 10). */
function buildTypeRadios(row, onCommit) {
  const box = el('div', 'type-radios');
  const name = `sort-type-${row.id}`;
  let pickedType = row.type || '';
  const radioLine = (group, label, checked, onChange) => {
    const line = el('label', 'radio-line');
    const input = el('input');
    input.type = 'radio';
    input.name = group;
    input.checked = checked;
    input.addEventListener('change', onChange);
    line.append(input, ` ${label}`);
    return line;
  };
  const render = () => {
    box.replaceChildren();
    for (const t of TYPE_ORDER) {
      box.append(radioLine(name, TYPE_LABELS[t] ?? t, t === pickedType, () => {
        pickedType = t;
        if (typeIsFlat(t)) { onCommit(t, ''); return; }
        render();
        box.querySelector(`input[name="${name}"]:checked`)?.focus();
      }));
      if (t !== pickedType || typeIsFlat(t)) continue;
      const subs = el('div', 'sub-radios');
      for (const sub of subtypesFor(t)) {
        subs.append(radioLine(`${name}-sub`, sub, row.type === t && row.subtype === sub, () => onCommit(t, sub)));
      }
      box.append(subs);
    }
  };
  render();
  return box;
}

/** The amber Verify-link ask: open the source, then Confirm or Change. Shared by
 *  the card and the section list. onVerify(newLink?) records the outcome. */
function buildLinkAlert(row, href, onVerify) {
    // One amber line. "check it" opens the source; only after she's been
  // there does "it works" appear — opening IS the verification (Kate, Sep 1).
  const alert = el('div', 'link-alert');
  const line = el('p', 'alert-line');
  const mark = el('i', 'fa-solid fa-triangle-exclamation alert-mark');
  mark.setAttribute('aria-hidden', 'true');
  line.append(mark);
  // Say why: the warning used to mean only "the desk couldn't read this",
  // and the one truly wrong link in the data carried none (F12, F20).
  line.append(' ', row.link_checked === 'mismatch' ? 'This link may open a different item.' : "The desk couldn't open this page.");
  const works = el('button', 'linkish alert-word', 'Confirm');
  works.type = 'button';
  works.addEventListener('click', () => onVerify());
  const change = el('button', 'linkish alert-word', 'Change');
  change.type = 'button';
  const changeRow = el('p', 'alert-change');
  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'paste the right link';
  const saveLink = el('button', 'linkish alert-word', 'Save');
  saveLink.type = 'button';
  change.addEventListener('click', () => { changeRow.classList.add('is-open'); input.focus(); });
  const saveFixed = () => {
    const fixed = input.value.trim();
    if (!safeHref(fixed)) { input.classList.add('is-invalid'); return; }
    onVerify(fixed);
  };
  saveLink.addEventListener('click', saveFixed);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') saveFixed(); });
  input.addEventListener('input', () => input.classList.remove('is-invalid'));
  // One ask: "Verify link" opens the source. The two outcomes — It works /
  // Change — only appear once she's been there (Kate, Sep 1).
  const after = el('span', '');
  after.append(' · ', works, ' · ', change);
  if (href) {
    after.hidden = true;
    const a = el('a', 'alert-word', 'Verify link ↗');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    a.addEventListener('click', () => { after.hidden = false; });
    line.append(' ', a);
  } else {
    // Nothing to verify — only Change makes sense.
    after.hidden = false;
    after.replaceChildren(' · ', change);
    line.append(' Missing link');
  }
  line.append(after);
  changeRow.append(input, ' ', saveLink);
  alert.append(line, changeRow);
  if (href) {
    // The whole amber box is the ask, not only the two words in it — the
    // boss clicked the box twice and nothing happened (usability run F5).
    alert.classList.add('is-clickable');
    alert.addEventListener('click', e => {
      if (e.target.closest('a, button, input')) return;
      window.open(href, '_blank', 'noreferrer');
      after.hidden = false;
    });
  }
  return alert;
}

const sectionLabel = section => FILTER_LABELS.find(([k]) => k === section)?.[1] ?? section;

// Out of Keep the rest for the reasons the card used to lock Keep: an
// unchecked link, or no real type yet. Their rows say so.
const keepableIn = live => live.filter(r => linkCheckState(r) !== 'alert' && !needsType(r));

function sectionHead(props, section, keepable, main, withUndo) {
  const head = el('div', 'list-head');
  head.append(el('p', 'sort-group', sectionLabel(section)));
  if (withUndo) {
    const undo = el('button', 'undo-link', 'Undo last');
    undo.type = 'button';
    undo.disabled = !props.lastDecision;
    undo.addEventListener('click', () => props.onUndo());
    head.append(undo);
  }
  if (keepable.length) {
    const keepBtn = el('button', 'primary list-keep', ` Keep the rest (${keepable.length})`);
    keepBtn.type = 'button';
    keepBtn.prepend(faIcon('check'));
    keepBtn.addEventListener('click', () => {
      for (const x of main.querySelectorAll('button')) x.disabled = true;
      props.onKeepAll?.(keepable);
    });
    head.append(keepBtn);
  }
  return head;
}

const KEEP_HINT = 'Everything here is kept unless you drop it. Delete what does not belong, Skip what you are not sure about, then Keep the rest.';
const FIX_HINT = 'Set a type or check the link and the row moves to its section. A duplicate stays until you delete one copy, or keep it with the rest.';
const SKIPPED_HINT = 'You parked these. Keep what is ready now, Delete what is not, or leave it here.';

function emptyLine(props) {
  const waiting = readerQueue(props.rows).length;
  return el('p', 'empty', waiting ? 'New items are being read.'
    : props.sortedCount ? 'All sorted.' : 'Nothing to sort.');
}

/** The card's stand-in when the section has nothing live: say so, and point
 *  at the next section that holds anything, or on to Finalize. */
function emptyPane(props, section, words = 'Nothing left in this section. ') {
  const pane = el('div', 'sort-pane-empty');
  pane.append(words);
  const next = nextSectionWithRows(sortCounts(props.rows), section);
  const go = el('button', 'linkish', next ? `Next: ${sectionLabel(next)}` : 'Go to Finalize');
  go.type = 'button';
  go.append(' ', forwardIcon());
  go.addEventListener('click', () => (next ? props.onFilter(next) : props.onGoTo?.('finalize')));
  pane.append(go);
  return pane;
}

/** One section on its own, from its pill: the head, the hint, then the list
 *  and the card side by side. */
function renderSectionList(main, props, section) {
  const rerender = () => renderSectionList(main, props, section);
  main.replaceChildren();
  const ctx = fixContext(props.rows, props.today);
  const group = sectionRows(props.rows, section, props.sessionDecided ?? new Set(), ctx, props.decidedFrom ?? new Map());
  const keepable = keepableIn(group.live);
  main.append(sectionHead(props, section, keepable, main, true));
  if (!group.live.length && !group.done.length) {
    // An empty pill points at the work that is left; only an empty queue
    // says why it is empty.
    main.append(nextSectionWithRows(sortCounts(props.rows), section)
      ? emptyPane(props, section, 'Nothing in this section. ') : emptyLine(props));
    return;
  }
  if (group.live.length) {
    main.append(el('p', 'hint list-hint', section === 'fix' ? FIX_HINT : section === 'skipped' ? SKIPPED_HINT : KEEP_HINT));
  }

  const liveIds = group.live.map(r => r.id);
  const before = selectedId;
  selectedId = nextSelected(liveIds, selectedId, lastIndex);
  if (selectedId !== before) listPanel = null;
  if (selectedId) lastIndex = liveIds.indexOf(selectedId);

  const reshare = reshareFlags(props.rows, props.today ?? '');
  const split = el('div', 'sort-split');
  const list = el('div', 'sort-rows');
  group.live.forEach((row, index) => list.append(sortRowItem(row, { props, rerender, ctx, section, index })));
  for (const row of group.done) list.append(doneRowItem(row, props.onUndoRow, props.today));
  split.append(list);
  const row = group.live.find(r => r.id === selectedId);
  split.append(row ? sortCard(row, { props, rerender, ctx, reshare, section }) : emptyPane(props, section));
  main.append(split);
}

function listBadges(row, { rows, dupes, reshare, today }) {
  const out = [];
  if (isNewToday(row, today)) out.push(el('span', 'badge badge-new', 'New'));
  if (row.spotlight_request) out.push(el('span', 'badge', 'Spotlight requested'));
  if (row.submitter_email) out.push(el('span', 'badge', 'External submission'));
  if (reshare.has(row.id)) out.push(el('span', 'badge', 'In a past issue'));
  else if (dupes.has(row.id)) {
    const prior = rows.find(r => r.id === dupes.get(row.id));
    if (prior?.published_at) out.push(el('span', 'badge', 'Already live'));
  }
  return out;
}

/** A live row in the list: the amber triangle when it needs a fix, the title,
 *  who or where and when. Skipped mixes types, so its rows name their own. */
function sortRowItem(row, { props, rerender, ctx, section, index }) {
  const selected = row.id === selectedId;
  const item = el('button', `sort-row${selected ? ' is-selected' : ''}`);
  item.type = 'button';
  if (selected) item.setAttribute('aria-current', 'true');
  const reasons = fixReasons(row, ctx);
  if (reasons.length) {
    const mark = faIcon('triangle-exclamation');
    mark.classList.add('fix-mark');
    mark.title = reasons.join(' · ');
    item.append(mark);
  }
  const text = el('span', 'sort-row-text');
  const badges = [];
  if (isNewToday(row, props.today)) badges.push(el('span', 'badge badge-new', 'New'));
  if (section === 'skipped' && row.type) badges.push(el('span', 'badge', TYPE_LABELS[row.type] ?? row.type));
  if (badges.length) { const wrap = el('span', 'sort-row-badges'); wrap.append(...badges); text.append(wrap); }
  text.append(el('span', 'sort-row-title', row.headline || row.link || '(untitled)'));
  const meta = listMeta(row, props.today);
  if (meta) text.append(el('span', 'sort-row-meta', meta));
  item.append(text);
  if (selected) item.append(faIcon('chevron-right'));
  item.addEventListener('click', () => { selectedId = row.id; lastIndex = index; listPanel = null; rerender(); });
  return item;
}

/** The card for the chosen row. */
function sortCard(row, { props, rerender, ctx, reshare, section }) {
  const card = el('div', 'card sort-card');
  const lock = () => { for (const x of card.querySelectorAll('button, input')) x.disabled = true; };
  if (listPanel === 'edit') {
    const form = buildEditForm(row, {
      onSave: changes => { lock(); listPanel = null; props.onEditRow?.(row, changes); },
      onCancel: () => { listPanel = null; rerender(); },
    });
    card.append(form.el);
    return card;
  }
  // The top line, as on Finalize's card: the type with Change, then the badges.
  // No type yet: the fix panel below asks for one instead.
  const typeMissing = needsType(row);
  const top = el('div', 'sort-card-top');
  if (!typeMissing && listPanel !== 'type') {
    const line = el('p', 'type-line');
    line.append(el('span', 'type-label', [TYPE_LABELS[row.type] ?? row.type, row.subtype].filter(Boolean).join(' · ')), ' · ');
    const change = el('button', 'linkish', 'Change');
    change.type = 'button';
    change.addEventListener('click', () => { listPanel = 'type'; rerender(); });
    line.append(change);
    top.append(line);
  }
  top.append(...listBadges(row, { rows: props.rows, dupes: ctx.dupes, reshare, today: props.today }));
  if (top.childNodes.length) card.append(top);
  card.append(el('h3', '', row.headline || row.link || '(untitled)'));
  const meta = listMeta(row, props.today);
  if (meta) card.append(el('p', 'sort-card-meta', meta));

  // The fix panel (amber) holds every reason the row sits under Needs a fix:
  // no type, an unchecked link, a possible duplicate. Change on the type line
  // opens the same radios in a plain panel.
  const linkAlert = linkCheckState(row) === 'alert';
  const dupe = fixReasons(row, ctx).find(r => r !== 'No type' && r !== 'Link not opened');
  const href = safeHref(row.link);
  const panelHead = (words, alert) => {
    const h = el('p', `fix-head${alert ? ' is-alert' : ''}`);
    if (alert) h.append(faIcon('triangle-exclamation'));
    h.append(words);
    return h;
  };
  const commitType = (type, subtype) => { lock(); listPanel = null; props.onEditType?.(row, type, subtype); };
  if (typeMissing || linkAlert || dupe || listPanel === 'type') {
    const panel = el('div', `fix-panel${typeMissing || linkAlert || dupe ? ' is-alert' : ''}`);
    if (typeMissing) {
      panel.append(panelHead('Needs a type', true), buildTypeRadios(row, commitType));
    } else if (listPanel === 'type') {
      panel.append(panelHead('Type', false), buildTypeRadios(row, commitType));
      const cancel = el('button', 'linkish skip-link', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', () => { listPanel = null; rerender(); });
      panel.append(cancel);
    }
    if (linkAlert) {
      panel.append(panelHead('Check the link', true));
      panel.append(buildLinkAlert(row, href, newLink => { lock(); props.onVerifyLink?.(row, newLink); }));
    }
    if (dupe) panel.append(panelHead('Possible duplicate', true), el('p', 'fix-line', dupe));
    card.append(panel);
  }

  card.append(row.blurb
    ? el('p', 'f-blurb-text', row.blurb)
    : el('p', 'f-blurb-text is-quiet', row.type === 'headline' ? 'No description. A headline can go without one.' : 'No description yet.'));
  if (row.note) card.append(el('p', 'item-note', `Note: ${row.note}`));
  for (const note of buildCardNotes(row)) card.append(note);
  const source = el('p', 'sort-card-source');
  const parts = [];
  if (href && !linkAlert) {
    const a = el('a', 'source-link', 'Open source ↗');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    parts.push(a);
  }
  const from = [row.submitter && `from ${row.submitter}`, row.submitted_at && isoToShort(row.submitted_at, props.today)].filter(Boolean).join(', ');
  if (from) parts.push(el('span', '', from));
  parts.forEach((part, i) => { if (i) source.append(' · '); source.append(part); });
  if (parts.length) card.append(source);

  // Edit and Delete far left; Skip and the one filled Keep on the right.
  const acts = el('div', 'sort-card-acts');
  const edit = el('button', 'linkish edit-link', ' Edit');
  edit.type = 'button';
  edit.prepend(faIcon('pen'));
  edit.addEventListener('click', () => { listPanel = 'edit'; rerender(); });
  const del = el('button', 'linkish trash-link', ' Delete');
  del.type = 'button';
  del.prepend(faIcon('trash-can'));
  del.addEventListener('click', () => { lock(); props.onDecide?.(row, 'trash'); });
  acts.append(edit, del);
  const right = el('span', 'sort-card-right');
  if (section !== 'skipped') {
    const skip = el('button', 'linkish skip-link', 'Skip');
    skip.type = 'button';
    skip.addEventListener('click', () => { lock(); props.onDecide?.(row, 'circleback'); });
    right.append(skip);
  }
  const keep = el('button', 'primary', ' Keep');
  keep.type = 'button';
  keep.prepend(faIcon('check'));
  const blocked = keepBlock(row);
  if (blocked) { keep.disabled = true; keep.title = blocked; }
  keep.addEventListener('click', () => { lock(); props.onDecide?.(row, 'keep'); });
  right.append(keep);
  acts.append(right);
  card.append(acts);
  return card;
}

const DONE_WORDS = { trashed: 'Deleted', circleback: 'Skipped', kept: 'Kept' };

/** Who wrote it or where it ran, and when: the card's meta line, one row wide. */
function listMeta(row, today) {
  return [
    row.authors || row.source,
    row.date && isoToShort(row.date, today),
    row.deadline && `due ${isoToShort(row.deadline, today)}`,
    row.time, row.location,
  ].filter(Boolean).join(' · ');
}

/** A decided row, greyed at the bottom of the list with its word and Undo. */
function doneRowItem(row, onUndoRow, today) {
  const item = el('div', `sort-done is-${row.status}`);
  const text = el('span', 'sort-row-text');
  text.append(el('span', 'sort-row-title', row.headline || row.link || '(untitled)'));
  const meta = listMeta(row, today);
  if (meta) text.append(el('span', 'sort-row-meta', meta));
  const acts = el('span', 'sort-done-acts');
  acts.append(el('span', 'queue-gone', DONE_WORDS[row.status] ?? row.status));
  const undo = el('button', 'linkish', 'Undo');
  undo.type = 'button';
  undo.addEventListener('click', () => { undo.disabled = true; onUndoRow?.(row); });
  acts.append(undo);
  item.append(text, acts);
  return item;
}

/** Two quiet notes, only when the reader came up short: missing fields, and the
 *  not-sure flag. Neither blocks Keep (Kate, Sep 9). */
function buildCardNotes(row) {
  const notes = [];
  // Two quiet notes, only when the reader came up short. Neither blocks Keep —
  // Kate decides whether to go find the detail or bin the item (Sep 9).
  const FIELD_WORDS = { date: 'date', time: 'time', location: 'location', deadline: 'deadline', authors: 'authors', medium: 'outlet' };
  const missing = missingFields(row);
  if (missing.length) {
    const note = el('p', 'card-note');
    note.append(faIcon('circle-question'));
    // Says what to do and, when the page could not be read, why (F7).
    const words = missing.map(f => FIELD_WORDS[f] ?? f).join(', ');
    const them = missing.length === 1 && missing[0] !== 'authors' ? 'it' : 'them';
    const why = row.link_checked === 'failed' ? ". The desk couldn't read the page" : '';
    note.append(` No ${words} yet${why}. Add ${them} in Finalize.`);
    notes.push(note);
  }
  if (String(row.needs_review ?? '').trim()) {
    const note = el('p', 'card-note');
    note.append(faIcon('circle-question'));
    const filled = String(row.auto_filled ?? '').split(',').map(f => f.trim()).filter(Boolean);
    note.append(filled.length
      ? ` The reader wasn't sure about this one. Check what it filled in: ${filled.join(', ')}`
      : " The reader wasn't sure about this one. Check its fields.");
    notes.push(note);
  }

  return notes;
}

export function renderSort(container, props) {
  container.replaceChildren();
  const { rows, onFilter, onGoTo } = props;
  const counts = sortCounts(rows);
  // No pill picked yet (or a key from before a rename): land where the work is.
  const filter = FILTER_KEYS.includes(props.filter) ? props.filter : landingSection(counts);


  const head = el('div', 'screen-head');
  const info = titleWithInfo('Sort', 'sort',
    'Each section is a list. Click a row to see it in the card: set its type, check its link, edit it, then Keep, Skip or Delete it (Skip waits under Skipped). Keep the rest keeps a whole section in one press. A row with no type or an unchecked link cannot be kept until you fix it; Delete works any time.');
  head.append(info.row);
  const door = el('button', 'door head-action', 'Go to Finalize');
  door.append(forwardIcon());
  door.addEventListener('click', () => onGoTo?.('finalize'));
  head.append(door);
  container.append(head, info.panel);

  const nav = el('nav', 'sort-nav');
  for (const [key, label] of FILTER_LABELS) {
    const count = counts[key];
    let cls = 'sort-filter';
    if (filter === key) cls += ' is-active';
    if (key === 'fix' && count > 0) cls += ' is-alert';   // the one notification on the screen
    const btn = el('button', cls, `${label} (${count})`);
    btn.type = 'button';
    if (filter === key) btn.setAttribute('aria-current', 'true');
    btn.addEventListener('click', () => onFilter(key));
    nav.append(btn);
  }
  const main = el('div', 'sort-main');
  const body = el('div', 'sort-body');
  body.append(nav, main);
  container.append(body);
  if (lastFilter !== filter) { selectedId = null; lastIndex = 0; listPanel = null; }
  if (lastFilter !== null && lastFilter !== filter) {
    main.classList.add(FILTER_KEYS.indexOf(filter) > FILTER_KEYS.indexOf(lastFilter)
      ? 'slide-in-right' : 'slide-in-left');
  }
  lastFilter = filter;

  renderSectionList(main, props, filter);
}
