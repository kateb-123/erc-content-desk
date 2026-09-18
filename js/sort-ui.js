/**
 * Sort: one section at a time, drawn as a list and a card. The sections sit as
 * tabs on top; the screen lands on the first one that holds anything, Needs
 * a fix first. Down the left, the section's rows (title, source and date);
 * on the right, one card for the chosen row: its badges, a fix panel (the
 * type as radios, subtypes under the picked type; the link check), the
 * description, and Edit · Delete · Skip · Keep. A decision moves the card to
 * the next row; decided rows grey at the bottom of the list with Undo.
 */
import { linkNeedsCheck, reshareFlags, missingFields } from './workflow.js';
import { TYPE_ORDER, typeDisplay, subtypesFor, typeIsFlat } from './schema.js';
import { isoToShort } from './queue-view.js';
import { safeHref } from './links.js';
import { SECTION_ORDER, SECTION_LABELS, sortCounts, readerQueue, isNewToday, sectionRows, landingSection, needsType, fixReasons, dupeReason, fixContext, keepBlock, nextSelected, nextSectionWithRows, adjacentTab } from './sort-view.js';
import { buildEditForm, holdIfDirty } from './edit-form.js';
import { titleWithInfo } from './screen-info.js';
import { faIcon } from './icons.js';
import { el, button, focusKeyIn, restoreFocus, markOverflow } from './ui-aids.js';

// The section's view state: which row the card shows, where it stood (so a
// decision moves to the row now in its place), and which of the card's
// panels (edit form, type change) is open.
let selectedId = null;
let lastIndex = 0;
let listPanel = null;   // 'edit' | 'type' | null
let openForm = null;    // the card's open edit form, so every way out can hold its typing
let landOnTitle = false; // a decision was made: the next card's title takes focus and is read

let lastFilter = null;  // detects a section jump so the list slides like the screens do
let liveOrder = [];     // the section's live row ids in list order, for the arrow keys

// A decision moves no pixels: the decided row greys in place at
// the bottom of its section, with Undo. On a 95-item session even a 260ms
// animation is half a minute of watching.

/** The type as radios, the picked type's subtypes as indented radios under
 *  it. Picking the subtype IS the save; a flat type (ERC Event) saves on the
 *  type pick. */
function buildTypeRadios(row, onCommit) {
  const box = el('fieldset', 'type-radios');
  const legend = el('legend', 'sr-only', 'Type');
  const name = `sort-type-${row.id}`;
  let pickedType = row.type || '';
  const radioLine = (group, label, checked, onChange, key) => {
    const line = el('label', 'radio-line');
    const input = el('input');
    input.type = 'radio';
    input.name = group;
    input.dataset.focus = key;   // a pick redraws the card; the keyboard keeps its place
    input.checked = checked;
    input.addEventListener('change', onChange);
    line.append(input, ` ${label}`);
    return line;
  };
  const render = () => {
    box.replaceChildren(legend);
    for (const t of TYPE_ORDER) {
      box.append(radioLine(name, typeDisplay(t), t === pickedType, () => {
        pickedType = t;
        if (typeIsFlat(t)) { onCommit(t, ''); return; }
        render();
        box.querySelector(`input[name="${name}"]:checked`)?.focus();
      }, `type:${t}`));
      if (t !== pickedType || typeIsFlat(t)) continue;
      const subs = el('fieldset', 'sub-radios');
      subs.append(el('legend', 'sr-only', 'Subtype'));
      for (const sub of subtypesFor(t)) {
        subs.append(radioLine(`${name}-sub`, sub, row.type === t && row.subtype === sub, () => onCommit(t, sub), `sub:${sub}`));
      }
      box.append(subs);
    }
  };
  render();
  return box;
}

/** The card's Verify-link ask, inside the fix panel: open the source, then
 *  Confirm or Change. onVerify(newLink?) records the outcome. */
function buildLinkAlert(row, href, onVerify) {
  // Opening the source IS the verification, so Confirm and Change only appear
  // once she has been there. The panel head above carries the warning triangle.
  const alert = el('div', 'link-alert');
  const line = el('p', 'alert-line');
  // Say why: the warning used to mean only "the desk couldn't read this", and
  // a link that opens a different item carried no warning at all.
  line.append(row.link_checked === 'mismatch' ? 'This link may open a different item.' : "The desk couldn't open this page.");
  const works = button('Confirm', 'linkish alert-word', { focus: 'link-confirm', onClick: () => onVerify() });
  const change = button('Change', 'linkish alert-word', { focus: 'link-change' });
  const changeRow = el('div', 'alert-change');
  const input = document.createElement('input');
  input.type = 'url';
  input.id = `new-link-${row.id}`;
  input.placeholder = 'https://';
  const fieldLabel = el('label', 'alert-field-label', 'New link');   // a visible name, not a placeholder
  fieldLabel.htmlFor = input.id;
  const bad = el('p', 'field-error', 'Paste a full http(s) link');
  bad.id = `link-error-${row.id}`;
  bad.hidden = true;
  const saveLink = button('Save', 'linkish alert-word', { focus: 'link-save' });
  change.addEventListener('click', () => { changeRow.classList.add('is-open'); input.focus(); });
  const saveFixed = () => {
    const fixed = input.value.trim();
    if (!safeHref(fixed)) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', bad.id);
      bad.hidden = false;
      return;
    }
    onVerify(fixed);
  };
  saveLink.addEventListener('click', saveFixed);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') saveFixed(); });
  input.addEventListener('input', () => { input.classList.remove('is-invalid'); input.removeAttribute('aria-invalid'); bad.hidden = true; });
  const after = el('span', '');
  after.append(' · ', works, ' · ', change);
  if (href) {
    after.hidden = true;
    const a = el('a', 'alert-word', 'Verify link ↗');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    a.append(el('span', 'sr-only', ' (opens in a new tab)'));   // every new tab is named for assistive tech
    a.addEventListener('click', () => { after.hidden = false; });
    line.append(' ', a);
  } else {
    // Nothing to verify — only Change makes sense.
    after.hidden = false;
    after.replaceChildren(' · ', change);
    line.append(' Missing link');
  }
  line.append(after);
  changeRow.append(fieldLabel, input, ' ', saveLink, bad);
  alert.append(line, changeRow);
  if (href) {
    // The whole amber box is the ask, not only the two words in it — the
    // boss clicked the box twice and nothing happened.
    alert.classList.add('is-clickable');
    alert.addEventListener('click', e => {
      if (e.target.closest('a, button, input')) return;
      window.open(href, '_blank', 'noreferrer');
      after.hidden = false;
    });
  }
  return alert;
}

const sectionLabel = section => SECTION_LABELS[section] ?? section;

// Out of Keep the rest for the reasons the card locks Keep on. Their rows say so.
const keepableIn = live => live.filter(r => !keepBlock(r));

/** Any way out of the card holds while its edit form has unsaved typing.
 *  The card is found from whatever the caller has to hand. */
const held = root => holdIfDirty(openForm, root?.querySelector('.sort-card'));

function sectionHead(props, section, keepable, main) {
  const head = el('div', 'list-head');
  head.append(el('p', 'sort-group', sectionLabel(section)));
  const undo = button('Undo last', 'undo-link', { focus: 'undo', onClick: () => props.onUndo() });
  undo.disabled = !props.lastDecision;
  head.append(undo);
  if (keepable.length) {
    const keepBtn = button(` Keep the rest (${keepable.length})`, 'primary list-keep', {
      focus: 'keep-rest',
      icon: 'check',
      onClick: () => {
        if (held(main)) return;
        for (const x of main.querySelectorAll('button')) x.disabled = true;
        props.onKeepAll(keepable);
      },
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
function emptyPane(props, section, counts, words = 'Nothing left in this section. ') {
  const pane = el('div', 'sort-pane-empty');
  pane.append(words);
  const next = nextSectionWithRows(counts, section);
  const go = button(next ? `Next: ${sectionLabel(next)}` : 'Go to Finalize', 'linkish',
    { focus: 'next', onClick: () => (next ? props.onFilter(next) : props.onGoTo('finalize')) });
  go.append(' ', faIcon('arrow-right'));
  pane.append(go);
  return pane;
}

/** One section on its own, from its tab: the head, the hint, then the list
 *  and the card side by side. */
function renderSectionList(main, props, section, counts) {
  const rerender = () => renderSectionList(main, props, section, counts);
  const focusKey = focusKeyIn(main);   // a redraw keeps the keyboard's place
  main.replaceChildren();
  openForm = null;
  const ctx = fixContext(props.rows, props.today);
  const group = sectionRows(props.rows, section, props.sessionDecided, ctx, props.decidedFrom);
  const keepable = keepableIn(group.live);
  main.append(sectionHead(props, section, keepable, main));
  liveOrder = group.live.map(r => r.id);
  if (!group.live.length && !group.done.length) {
    // An empty tab points at the work that is left; only an empty queue
    // says why it is empty.
    main.append(nextSectionWithRows(counts, section)
      ? emptyPane(props, section, counts, 'Nothing in this section. ') : emptyLine(props));
    return;
  }
  if (group.live.length) {
    main.append(el('p', 'hint list-hint', section === 'fix' ? FIX_HINT : section === 'skipped' ? SKIPPED_HINT : KEEP_HINT));
  }

  const before = selectedId;
  selectedId = nextSelected(liveOrder, selectedId, lastIndex);
  if (selectedId !== before) listPanel = null;
  if (selectedId) lastIndex = liveOrder.indexOf(selectedId);

  const reshare = reshareFlags(props.rows, props.today ?? '');
  const split = el('div', 'sort-split');
  const list = el('div', 'sort-rows');
  group.live.forEach((row, index) => list.append(sortRowItem(row, { props, rerender, ctx, section, index })));
  for (const row of group.done) list.append(doneRowItem(row, props.onUndoRow, props.today));
  split.append(list);
  const row = group.live.find(r => r.id === selectedId);
  const card = row ? sortCard(row, { props, rerender, ctx, reshare, section }) : emptyPane(props, section, counts);
  split.append(card);
  main.append(split);
  if (row) markOverflow(card);
  restoreFocus(main, focusKey, card.querySelector('h3') ?? card);
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
  const badges = [];
  if (isNewToday(row, props.today)) badges.push(el('span', 'badge badge-new', 'New'));
  if (section === 'skipped' && row.type) badges.push(el('span', 'badge', typeDisplay(row.type)));
  if (badges.length) { const wrap = el('span', 'sort-row-badges'); wrap.append(...badges); text.append(wrap); }
  text.append(el('span', 'sort-row-title', row.headline || row.link || '(untitled)'));
  const meta = listMeta(row, props.today);
  if (meta) text.append(el('span', 'sort-row-meta', meta));
  item.append(text);
  item.addEventListener('click', () => {
    // Unsaved typing in the card is not thrown away by a row click.
    if (row.id !== selectedId && held(item.closest('.sort-main'))) return;
    selectedId = row.id; lastIndex = index; listPanel = null; rerender();
  });
  return item;
}

/** The card for the chosen row. */
function sortCard(row, { props, rerender, ctx, reshare, section }) {
  const card = el('div', 'card sort-card');
  const lock = () => { for (const x of card.querySelectorAll('button, input')) x.disabled = true; };
  if (listPanel === 'edit') {
    card.append(el('h3', '', row.headline || row.link || '(untitled)'));
    openForm = buildEditForm(row, {
      onSave: changes => {
        listPanel = null;
        if (!Object.keys(changes).length) { rerender(); return; }
        lock();
        props.onEditRow(row, changes);
      },
      onCancel: () => { listPanel = null; rerender(); },
    });
    card.append(openForm.el);
    return card;
  }
  // The top line, as on Finalize's card: the type with Change, then the badges.
  // No type yet: the fix panel below asks for one instead.
  const typeMissing = needsType(row);
  const top = el('div', 'sort-card-top');
  if (!typeMissing && listPanel !== 'type') {
    const line = el('p', 'type-line');
    line.append(el('span', 'type-label', [typeDisplay(row.type), row.subtype].filter(Boolean).join(' · ')), ' · ');
    const change = button('Change', 'linkish', { focus: 'change', onClick: () => { listPanel = 'type'; rerender(); } });
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
  const linkAlert = linkNeedsCheck(row);
  const dupe = dupeReason(row, ctx);
  const href = safeHref(row.link);
  const panelHead = (words, alert) => {
    const h = el('p', `fix-head${alert ? ' is-alert' : ''}`);
    if (alert) h.append(faIcon('triangle-exclamation'));
    h.append(words);
    return h;
  };
  const commitType = (type, subtype) => { lock(); listPanel = null; props.onEditType(row, type, subtype); };
  if (typeMissing || linkAlert || dupe || listPanel === 'type') {
    const panel = el('div', `fix-panel${typeMissing || linkAlert || dupe ? ' is-alert' : ''}`);
    if (typeMissing) {
      panel.append(panelHead('Needs a type', true), buildTypeRadios(row, commitType));
    } else if (listPanel === 'type') {
      panel.append(panelHead('Type', false), buildTypeRadios(row, commitType));
      // Back on Change, where the panel was opened.
      const cancel = button('Cancel', 'linkish quiet-link', { focus: 'change', onClick: () => { listPanel = null; rerender(); } });
      panel.append(cancel);
    }
    if (linkAlert) {
      panel.append(panelHead('Check the link', true));
      panel.append(buildLinkAlert(row, href, newLink => { lock(); props.onVerifyLink(row, newLink); }));
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
    a.append(el('span', 'sr-only', ' (opens in a new tab)'));
    parts.push(a);
  }
  const from = [row.submitter && `from ${row.submitter}`, row.submitted_at && isoToShort(row.submitted_at, props.today)].filter(Boolean).join(', ');
  if (from) parts.push(el('span', '', from));
  parts.forEach((part, i) => { if (i) source.append(' · '); source.append(part); });
  if (parts.length) card.append(source);

  // Edit and Delete far left; Skip and the one filled Keep on the right.
  const acts = el('div', 'sort-card-acts');
  const edit = button(' Edit', 'linkish edit-link', { focus: 'edit', icon: 'pen', onClick: () => { listPanel = 'edit'; rerender(); } });
  const del = button(' Delete', 'linkish trash-link', { focus: 'delete', icon: 'trash-can', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'trash'); } });
  acts.append(edit, del);
  const right = el('span', 'sort-card-right');
  if (section !== 'skipped') {
    right.append(button('Skip', 'linkish quiet-link', { focus: 'skip', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'circleback'); } }));
  }
  const keep = button(' Keep', 'primary', { focus: 'keep', icon: 'check', onClick: () => { lock(); landOnTitle = true; props.onDecide(row, 'keep'); } });
  const blocked = keepBlock(row);
  if (blocked) { keep.disabled = true; keep.title = blocked; }
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
  const undo = button('Undo', 'linkish', { focus: `undo:${row.id}`, onClick: () => { undo.disabled = true; onUndoRow(row); } });
  acts.append(undo);
  item.append(text, acts);
  return item;
}

// The one field whose column name is not what the card calls it; the rest
// read as themselves.
const FIELD_WORDS = { medium: 'outlet' };

/** Two quiet notes, only when the reader came up short: missing fields, and the
 * not-sure flag. Neither blocks Keep. */
function buildCardNotes(row) {
  const notes = [];
  const missing = missingFields(row);
  if (missing.length) {
    const note = el('p', 'card-note');
    note.append(faIcon('circle-question'));
    // Says what to do and, when the page could not be read, why.
    const words = missing.map(f => FIELD_WORDS[f] ?? f).join(', ');
    const them = missing.length === 1 && missing[0] !== 'authors' ? 'it' : 'them';
    const why = row.link_checked === 'failed' ? ". The desk couldn't read the page" : '';
    note.append(` No ${words} yet${why}. Add ${them} with Edit.`);   // Edit is one form on both cards now
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
  const focusKey = focusKeyIn(container);
  container.replaceChildren();
  const { rows, onFilter, onGoTo } = props;
  const counts = sortCounts(rows);
  // No tab picked yet (or a key from before a rename): land where the work is.
  const filter = SECTION_ORDER.includes(props.filter) ? props.filter : landingSection(counts);


  const head = el('div', 'screen-head');
  const info = titleWithInfo('Sort', 'sort',
    'Each section is a list. Click a row to see it in the card: set its type, check its link, edit it, then Keep, Skip or Delete it (Skip waits under Skipped). Keep the rest keeps a whole section in one press. A row with no type or an unchecked link cannot be kept until you fix it; Delete works any time. Keys: up and down move through the list, K keeps, S skips, D deletes, U undoes the last decision.');
  head.append(info.row);
  const door = el('button', 'door', 'Go to Finalize');
  door.append(faIcon('arrow-right'));
  door.addEventListener('click', () => { if (!held(container)) onGoTo('finalize'); });
  head.append(door);
  container.append(head, info.panel);

  // Carbon's tabs, read as tabs: one tab stop, Left and Right between them.
  const nav = el('nav', 'sort-nav');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Sections');
  const leave = key => { if (!held(container)) onFilter(key); };
  for (const key of SECTION_ORDER) {
    const count = counts[key];
    let cls = 'sort-filter';
    if (filter === key) cls += ' is-active';
    if (key === 'fix' && count > 0) cls += ' is-alert';   // the one notification on the screen
    const btn = el('button', cls, `${sectionLabel(key)} (${count})`);
    btn.type = 'button';
    btn.id = `sort-tab-${key}`;
    btn.dataset.focus = `tab:${key}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(filter === key));
    btn.setAttribute('aria-controls', 'sort-panel');
    btn.tabIndex = filter === key ? 0 : -1;
    btn.addEventListener('click', () => leave(key));
    nav.append(btn);
  }
  nav.addEventListener('keydown', event => {
    const next = adjacentTab(SECTION_ORDER, filter, event.key);
    if (!next) return;
    event.preventDefault();
    nav.querySelector(`[data-focus="tab:${next}"]`)?.focus();
    leave(next);
  });
  const main = el('div', 'sort-main');
  main.id = 'sort-panel';
  main.setAttribute('role', 'tabpanel');
  main.setAttribute('aria-labelledby', `sort-tab-${filter}`);
  const body = el('div', 'sort-body');
  body.append(nav, main);
  container.append(body);
  if (lastFilter !== filter) { selectedId = null; lastIndex = 0; listPanel = null; }
  if (lastFilter !== null && lastFilter !== filter) {
    main.classList.add(SECTION_ORDER.indexOf(filter) > SECTION_ORDER.indexOf(lastFilter)
      ? 'slide-in-right' : 'slide-in-left');
  }
  lastFilter = filter;

  renderSectionList(main, props, filter, counts);
  const title = container.querySelector('.sort-card h3');
  if (landOnTitle && title) {
    // After Keep, Skip or Delete the next item's title is read, and the keys still work from it.
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  } else {
    restoreFocus(container, focusKey, title ?? container.querySelector('.sort-pane-empty button'));
  }
  landOnTitle = false;
  bindShortcuts(container);
}

/** The keys: arrows move through the list, K keeps, S
 *  skips, D deletes, U undoes. Each one presses the button it names, so the
 *  rules (a locked Keep, no Skip under Skipped) hold. Not while typing. */
function bindShortcuts(container) {
  if (container.dataset.keys) return;
  container.dataset.keys = '1';
  container.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    // Focus first, then press: the redraw that follows keeps the keyboard on the pressed control's successor.
    const press = key => { const b = container.querySelector(`[data-focus="${key}"]`); if (b && !b.disabled) { event.preventDefault(); b.focus({ preventScroll: true }); b.click(); } };
    const k = event.key.toLowerCase();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const at = liveOrder.indexOf(selectedId);
      const next = liveOrder[at + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) press(`row:${next}`);
      else event.preventDefault();
    } else if (k === 'k') press('keep');
    else if (k === 's') press('skip');
    else if (k === 'd') press('delete');
    else if (k === 'u') press('undo');
  });
}
