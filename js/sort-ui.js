/**
 * Sort: one table at a time (Kate, Sep 15). The menu on the left picks a
 * section; the screen lands on the first one that holds anything, Needs a
 * fix first. Rows carry Skip and Delete; the whole row opens its detail.
 */
import { linkCheckState, reshareFlags, missingFields } from './workflow.js';
import { TYPE_ORDER, TYPE_LABELS, subtypesFor, typeIsFlat } from './schema.js';
import { isoToDisplay } from './rows-to-issue.js';
import { safeHref, withScheme } from './links.js';
import { sortCounts, isErc, readerQueue, isNewToday, sectionRows, landingSection, needsType, fixReasons, fixContext } from './sort-view.js';
import { buildImageControl } from './item-image.js';
import { titleWithInfo } from './screen-info.js';
import { faIcon, forwardIcon } from './icons.js';

// The list's view state: which row is expanded, and which of its detail
// panels (edit form, type picker) is open.
let openListId = null;
let listPanel = null;   // 'edit' | 'type' | null

const FILTER_LABELS = [
  // 'Needs a fix' (Kate, Sep 15): the one amber thing on the screen. It gathers
  // every row that cannot be kept yet (no type, link not opened) and possible
  // duplicates, so the rows themselves carry no amber marks.
  ['fix', 'Needs a fix'], ['erc', 'ERC'], ['erc_event', 'ERC events'],
  ['research', 'Research'],
  ['event', 'Events'], ['opportunity', 'Opportunities'], ['headline', 'Headlines'],
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

/** The type and subtype chips. Tapping the subtype is the save; a flat type
 *  (ERC Event) saves on the type tap. Shared by the card and the section list. */
function buildTypePicker(row, onCommit) {
    const fix = el('div', 'type-pick');
  fix.append(el('p', 'pick-label', 'Select a type'));
  const typeChips = el('div', 'type-row');
  const subWrap = el('div', 'sub-pick');
  const subChips = el('div', 'type-row');
  const subLabel = el('p', 'pick-label');
  subWrap.append(subLabel, subChips);
  let pickedType = row.type || '';
  let pickedSub = row.subtype || '';
  // Tapping the subtype IS the save — no extra button (Kate, Sep 1).
  const commit = () => {
    fix.replaceChildren(el('p', 'pick-saved', '✓ Saved'));
    onCommit(pickedType, pickedSub);
  };
  const renderSubs = () => {
    // Name the picked type so switching (Event -> Opportunity) reads clearly.
    subLabel.textContent = pickedType ? `${TYPE_LABELS[pickedType] ?? pickedType} — now the subtype:` : '';
    subChips.replaceChildren(...subtypesFor(pickedType).map(s => {
      const b = el('button', `type-word${s === pickedSub ? ' is-picked' : ''}`, s);
      b.type = 'button';
      b.addEventListener('click', () => { pickedSub = s; commit(); });
      return b;
    }));
    subWrap.classList.toggle('is-open', Boolean(pickedType));
  };
  const renderTypes = () => {
    typeChips.replaceChildren(...TYPE_ORDER.map(t => {
      const b = el('button', `type-word${t === pickedType ? ' is-picked' : ''}`, TYPE_LABELS[t] ?? t);
      b.type = 'button';
      b.addEventListener('click', () => {
        if (pickedType !== t) { pickedType = t; pickedSub = ''; }
        // ERC Event has no subtype, so the type tap is the save; the card
        // used to wait for a subtype that does not exist (Kate, Sep 10).
        if (typeIsFlat(t)) { commit(); return; }
        renderTypes(); renderSubs();
      });
      return b;
    }));
  };
  renderTypes(); renderSubs();
  fix.append(typeChips, subWrap);
  return fix;
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

function sectionTable(props, group, rerender) {
  const ctx = fixContext(props.rows);
  const reshare = reshareFlags(props.rows, props.today ?? '');
  const table = el('table', 'queue-table sort-list');
  const body = el('tbody');
  for (const row of group.live) body.append(...listLiveRow(row, { props, rerender, ctx, reshare }));
  for (const row of group.done) body.append(listDoneRow(row, props.onUndoRow));
  table.append(body);
  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  return scroll;
}

const KEEP_HINT = 'Everything here is kept unless you drop it. Delete what does not belong, Skip what you are not sure about, then Keep the rest.';
const FIX_HINT = 'Set a type or check the link and the row moves to its section. A duplicate stays until you delete one copy, or keep it with the rest.';

function emptyLine(props) {
  const waiting = readerQueue(props.rows).length;
  return el('p', 'empty', waiting ? 'New items are being read.'
    : props.sortedCount ? 'All sorted.' : 'Nothing to sort.');
}

/** One section on its own, from its pill. */
function renderSectionList(main, props, section) {
  const rerender = () => renderSectionList(main, props, section);
  main.replaceChildren();
  const group = sectionRows(props.rows, section, props.sessionDecided ?? new Set());
  const keepable = keepableIn(group.live);
  main.append(sectionHead(props, section, keepable, main, true));
  if (!group.live.length && !group.done.length) {
    main.append(emptyLine(props));
    return;
  }
  main.append(el('p', 'hint list-hint',
    section === 'fix' ? FIX_HINT : group.live.length ? KEEP_HINT : 'All sorted.'));
  main.append(sectionTable(props, group, rerender));
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

function listLiveRow(row, { props, rerender, ctx, reshare }) {
  const open = openListId === row.id;
  const tr = el('tr', `list-row${open ? ' is-open' : ''}`);
  const disableRow = () => { for (const x of tr.querySelectorAll('button')) x.disabled = true; };

  const chevTd = el('td', 'list-chev');
  const chev = el('button', 'chevron-btn');
  chev.type = 'button';
  chev.setAttribute('aria-expanded', String(open));
  chev.setAttribute('aria-label', open ? 'Hide details' : 'Show details');
  chev.append(faIcon(open ? 'chevron-up' : 'chevron-down'));
  const toggle = () => { openListId = open ? null : row.id; listPanel = null; rerender(); };
  chev.addEventListener('click', toggle);
  chevTd.append(chev);
  // The whole row opens it, not just the chevron (Kate, Sep 15). Buttons and
  // links inside the row keep their own jobs.
  tr.addEventListener('click', e => { if (!e.target.closest('button, a, input, textarea, select, label')) toggle(); });

  const titleTd = el('td');
  const badges = listBadges(row, { rows: props.rows, dupes: ctx.dupes, reshare, today: props.today });
  if (badges.length) { const wrap = el('div', 'list-badges'); wrap.append(...badges); titleTd.append(wrap); }
  // One amber triangle leads the title of a row that needs a fix (Kate, Sep
  // 15, option B): the alert without the bubble. The reason stays grey.
  const reasons = fixReasons(row, ctx);
  if (reasons.length) {
    const mark = faIcon('triangle-exclamation');
    mark.classList.add('fix-mark');
    mark.title = reasons.join(' · ');
    titleTd.append(mark);
  }
  titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  const meta = listMeta(row);
  if (meta) titleTd.append(el('span', 'item-source', meta));
  // Title, source, date, nothing else (Kate, Sep 15, option B): the
  // description and the type column live in the open row.

  const actTd = el('td', 'queue-actions list-actions');
  const skip = el('button', 'linkish skip-link', 'Skip');
  skip.type = 'button';
  skip.addEventListener('click', () => { disableRow(); onDecideRow('circleback'); });
  const del = el('button', 'linkish trash-link', ' Delete');
  del.type = 'button';
  del.prepend(faIcon('trash-can'));
  del.addEventListener('click', () => { disableRow(); onDecideRow('trash'); });
  function onDecideRow(action) { props.onDecide?.(row, action); }
  actTd.append(skip, del);

  tr.append(chevTd, titleTd, actTd);
  if (!open) return [tr];
  const dtr = el('tr', 'list-detail-row');
  const dtd = el('td');
  dtd.colSpan = 3;
  dtd.append(listDetail(row, { props, rerender }));
  dtr.append(dtd);
  return [tr, dtr];
}

/** The expanded row: Finalize's white detail card, with the card's own
 *  edit form, type picker, and link alert inside it. */
function listDetail(row, { props, rerender }) {
  const box = el('div', 'f-detail list-detail');
  const lock = () => { for (const x of box.querySelectorAll('button')) x.disabled = true; };
  if (listPanel === 'edit') {
    const form = buildEditForm(row, {
      onSave: changes => { lock(); listPanel = null; props.onEditRow?.(row, changes); },
      onCancel: () => { listPanel = null; rerender(); },
    });
    box.append(form.el);
    return box;
  }
  box.append(row.blurb
    ? el('p', 'f-blurb-text', row.blurb)
    : el('p', 'f-blurb-text is-quiet', row.type === 'headline' ? 'No description. A headline can go without one.' : 'No description yet.'));
  if (row.note) box.append(el('p', 'item-note', `Note: ${row.note}`));
  for (const note of buildCardNotes(row)) box.append(note);
  const pickOpen = listPanel === 'type' || needsType(row);
  // One line: type · Change · Open source · from whom, separated only where
  // both sides exist (an untyped row has no leading dot).
  const line = el('p', 'type-line');
  const parts = [];
  if (row.type) parts.push(el('span', 'type-label', [TYPE_LABELS[row.type] ?? row.type, row.subtype].filter(Boolean).join(' · ')));
  if (!pickOpen) {
    const change = el('button', 'linkish', 'Change');
    change.type = 'button';
    change.addEventListener('click', () => { listPanel = 'type'; rerender(); });
    if (parts.length) { parts[parts.length - 1].append(' ', change); } else parts.push(change);
  }
  const href = safeHref(row.link);
  if (href && linkCheckState(row) !== 'alert') {
    const a = el('a', 'source-link', 'Open source ↗');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    parts.push(a);
  }
  const from = [row.submitter && `from ${row.submitter}`, row.submitted_at && isoToDisplay(String(row.submitted_at).slice(0, 10))]
    .filter(Boolean).join(', ');
  if (from) parts.push(el('span', 'item-source', from));
  parts.forEach((part, i) => { if (i) line.append(' · '); line.append(part); });
  if (parts.length) box.append(line);
  if (pickOpen) {
    box.append(buildTypePicker(row, (type, subtype) => { lock(); listPanel = null; props.onEditType?.(row, type, subtype); }));
  }
  if (linkCheckState(row) === 'alert') {
    box.append(buildLinkAlert(row, href, newLink => { lock(); props.onVerifyLink?.(row, newLink); }));
  }
  const acts = el('p', 'f-detail-actions');
  const edit = el('button', 'linkish edit-link', ' Edit');
  edit.type = 'button';
  edit.prepend(faIcon('pen'));
  edit.addEventListener('click', () => { listPanel = 'edit'; rerender(); });
  acts.append(edit);
  box.append(acts);
  return box;
}

const DONE_WORDS = { trashed: 'Deleted', circleback: 'Skipped', kept: 'Kept' };

/** Who wrote it or where it ran, and when: the card's meta line, one row wide. */
function listMeta(row) {
  return [
    row.authors || row.source,
    row.date && isoToDisplay(row.date),
    row.deadline && `due ${isoToDisplay(row.deadline)}`,
    row.time, row.location,
  ].filter(Boolean).join(' · ');
}

function listDoneRow(row, onUndoRow) {
  const tr = el('tr', `list-row is-done is-${row.status}`);
  tr.append(el('td', 'list-chev'));
  const titleTd = el('td');
  titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  const meta = listMeta(row);
  if (meta) titleTd.append(el('span', 'item-source', meta));
  tr.append(titleTd);
  const actTd = el('td', 'queue-actions list-actions');
  actTd.append(el('span', 'queue-gone', DONE_WORDS[row.status] ?? row.status));
  const undo = el('button', 'linkish', 'Undo');
  undo.type = 'button';
  undo.addEventListener('click', () => { undo.disabled = true; onUndoRow?.(row); });
  actTd.append(undo);
  tr.append(actTd);
  return tr;
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
    const why = row.link_checked === 'failed' ? " — the desk couldn't read the page" : '';
    note.append(` No ${words} yet${why}. Add ${them} in Finalize.`);
    notes.push(note);
  }
  if (String(row.needs_review ?? '').trim()) {
    const note = el('p', 'card-note');
    note.append(faIcon('circle-question'));
    const filled = String(row.auto_filled ?? '').split(',').map(f => f.trim()).filter(Boolean);
    note.append(filled.length
      ? ` The reader wasn't sure about this one — check what it filled in: ${filled.join(', ')}`
      : " The reader wasn't sure about this one — check its fields");
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
    'Each section is a list. Delete what does not belong, Skip what you are not sure about (it stays in the queue), then Keep the rest of a section in one press. The chevron opens a row to read it, edit it, set its type, or check its link. A row with no type or an unchecked link stays out of Keep the rest until you fix it (Delete works any time).');
  head.append(info.row);
  const door = el('button', 'primary head-action', 'Go to Finalize');
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

  renderSectionList(main, props, filter);
}
