/**
 * Newsletter's Next issue tab (Kate's wireframes, Sep 17, and her answers,
 * Sep 18). On the left, what is in the issue, by section the way the email
 * will read, with Remove and Quick add; under it, what is ready to add, with
 * Add. On the right, the issue: its date, how far off it is, the builder
 * door, and the last issue sent. Order, the opening note and the preview stay
 * in the builder. Merges the old Next newsletter and Send to Newsletter.
 */
import { dotsLoader, faIcon } from './icons.js';
import { isoToShort } from './queue-view.js';
import { issueSections, readyToAdd, sendsIn, lastIssue } from './issue-view.js';
import { reshareFlags } from './workflow.js';
import { typeDisplay } from './schema.js';
import { renderSubmitForm } from './submit-form.js';
import { newsletterPageHead } from './page-head.js';
import { buildEditForm, holdIfDirty } from './edit-form.js';
import { el, button, focusKeyIn, restoreFocus, tryAgain, inFlight } from './ui-aids.js';

// View state, for as long as the page is open: the issue picked (''= the
// next one), the quick add form, rows taken out or deleted this visit (they
// stay listed, greyed, with Undo), and a later event asking "Send early?".
let issuePick = '';
let quickOpen = false;
let quickJustOpened = false;
const justRemoved = new Map();
const justDeleted = new Map();
let askId = null;
let editingId = null;   // the row whose edit form is open (Kate, Sep 22: an edit button on each part of the pipeline)
let openForm = null;

/** Arriving at Next issue starts fresh. */
export function resetIssueEntry() {
  issuePick = '';
  quickOpen = false;
  quickJustOpened = false;
  justRemoved.clear();
  justDeleted.clear();
  askId = null;
}

const title = row => row.headline || row.link || '(untitled)';
const typeLine = row => [row.type ? typeDisplay(row.type) : 'No type', row.source].filter(Boolean).join(' · ');

/** '2026-09-22' -> 'September 22', the way the desk names an issue on screen. */
function issueName(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function blockHead(label, count, extra) {
  const head = el('div', 'nl-block-head');
  head.append(el('span', 'block-label', label));
  if (extra) head.append(extra);
  if (count != null) head.append(el('span', 'nl-block-count', count));
  return head;
}

/** The row with its edit form open: the title line, then the one edit form, the same as Finalize's. */
function editingRow(row, n, { onEditRow, rerender }) {
  const item = el('div', 'nl-row is-editing');
  const head = el('div', 'nl-row-head');
  if (n) head.append(el('span', 'nl-num', String(n).padStart(2, '0')));
  head.append(el('span', 'nl-title', title(row)));
  item.append(head);
  openForm = buildEditForm(row, {
    onSave: changes => { editingId = null; openForm = null; if (Object.keys(changes).length) onEditRow(row, changes); else rerender(); },
    onCancel: () => { editingId = null; openForm = null; rerender(); },
  });
  item.append(openForm.el);
  return item;
}

/** The Edit word before a row's own action. */
function editWord(row, rerender) {
  return button(' Edit', 'linkish edit-link', { focus: `edit:${row.id}`, icon: 'pen', onClick: () => { editingId = row.id; rerender(); } });
}

/** One item in the issue: its number, the title and what it is, Edit, Remove. */
function issueRow(row, n, { onRemove, onEditRow, rerender }) {
  if (editingId === row.id) return editingRow(row, n, { onEditRow, rerender });
  const item = el('div', 'nl-row');
  item.append(el('span', 'nl-num', String(n).padStart(2, '0')));
  const text = el('span', 'nl-text');
  const t = el('span', 'nl-title', title(row));
  // Straight from quick add, the item is in the issue and still in Sort's queue.
  if (row.status === 'new') t.append(' ', el('span', 'badge', 'Not sorted yet'));
  else if (row.status === 'circleback') t.append(' ', el('span', 'badge', 'Skipped'));
  text.append(t, el('span', 'nl-meta', typeLine(row)));
  item.append(text);
  const remove = button(' Remove', 'linkish trash-link', {
    focus: `remove:${row.id}`, icon: 'trash-can',
    onClick: () => { inFlight(remove, `remove:${row.id}`, 'Removing'); justRemoved.set(row.id, row); onRemove(row); },
  });
  item.append(editWord(row, rerender), remove);
  return item;
}

/** A row taken out (or deleted) this visit: greyed, with its word and Undo. */
function goneRow(row, word, onUndo, key) {
  const item = el('div', 'nl-row is-gone');
  const text = el('span', 'nl-text');
  text.append(el('span', 'nl-title', title(row)), el('span', 'nl-meta', typeLine(row)));
  item.append(el('span', 'nl-num'), text, el('span', 'queue-gone', word));
  const undo = button('Undo', 'linkish', { focus: `undo:${key}`, onClick: () => { inFlight(undo, `undo:${key}`, 'Putting it back'); onUndo(); } });
  item.append(undo);
  return item;
}

/** One item ready to add: the title, what it is and anything timely, Add. An
 *  event that belongs to a later issue asks "Send early?" first. */
function readyRow({ row, laterIssue }, { issue, busy, reshare, today, onAdd, onEditRow, rerender }) {
  if (editingId === row.id) return editingRow(row, 0, { onEditRow, rerender });
  const item = el('div', `nl-row${laterIssue ? ' is-later' : ''}`);
  const text = el('span', 'nl-text');
  text.append(el('span', 'nl-title', title(row)));
  const facts = [typeLine(row)];
  if (row.type === 'event' && row.date) facts.push([isoToShort(row.date, today), row.location].filter(Boolean).join(' · '));
  if (row.type === 'opportunity' && row.deadline) facts.push(`closes ${isoToShort(row.deadline, today)}`);
  text.append(el('span', 'nl-meta', facts.join(' · ')));
  if (laterIssue) text.append(el('span', 'nl-meta', `For the ${issueName(laterIssue)} issue`));
  if (reshare.has(row.id)) text.append(el('span', 'nl-meta', `Was in the ${issueName(reshare.get(row.id))} issue`));
  item.append(text);
  if (askId === row.id) {
    const ask = el('div', 'nl-ask');
    ask.append(faIcon('clock'), ' Send early? ');
    ask.append(button('Confirm', 'linkish alert-word', { focus: `add:${row.id}`, onClick: () => { askId = null; onAdd([row], issue); } }), ' · ',
      button('Cancel', 'linkish alert-word', { focus: `add:${row.id}`, onClick: () => { askId = null; rerender(); } }));
    text.append(ask);
  } else {
    const add = button('Add', 'mini-btn', { focus: `add:${row.id}`, onClick: () => {
      if (laterIssue) { askId = row.id; rerender(); return; }
      add.disabled = true;
      onAdd([row], issue);
    } });
    add.disabled = busy;
    item.append(editWord(row, rerender), add);
  }
  return item;
}

export function renderIssue(container, props) {
  const { rows, schedule, today, loaded, loadFailed, busy, archive, onGoTo, onAdd, onRemove, onRestore, onTrash, onRestoreTrashed, onQuickAdd, onRefresh, knownLinks, onEditRow } = props;
  const rerender = () => renderIssue(container, props);
  // An open, edited form holds any way out (the same rule as Finalize).
  const held = () => holdIfDirty(openForm, container.querySelector('.nl-row.is-editing'));
  const parts = [newsletterPageHead({ active: 'issue', onGoTo, canLeave: () => !held() })];

  if (!loaded) { container.replaceChildren(...parts, loadFailed ? tryAgain(onRefresh) : dotsLoader()); return; }
  const upcoming = (schedule ?? []).filter(d => !today || d >= today);
  const issue = upcoming.includes(issuePick) ? issuePick : (upcoming[0] ?? '');
  if (!issue) {
    const empty = el('p', 'nl-empty', 'No issue date is scheduled yet. Add a date to the Schedule sheet, then refresh. ');
    const again = button('Refresh', '', { onClick: () => { again.disabled = true; onRefresh?.(); } });
    empty.append(again);
    container.replaceChildren(...parts, empty);
    return;
  }
  const when = isoToShort(issue, today);
  const sections = issueSections(rows, issue);
  const inIds = new Set(sections.flatMap(s => s.rows.map(r => r.id)));
  const removed = [...justRemoved.values()].filter(r => !inIds.has(r.id));
  const { ready, past } = readyToAdd(rows, schedule, issue, today);
  const deleted = [...justDeleted.values()].filter(r => rows.find(x => x.id === r.id)?.status === 'trashed');
  const reshare = reshareFlags(rows, today ?? '');

  const page = el('div', 'nl-page');
  const main = el('div', 'nl-main');

  // ── In this issue, by section, with Quick add beside the label. ──
  const quick = el('button', 'mini-btn', quickOpen ? 'Close quick add' : 'Quick add');
  quick.type = 'button';
  quick.dataset.focus = 'quick';
  quick.setAttribute('aria-expanded', String(quickOpen));
  quick.addEventListener('click', () => { quickOpen = !quickOpen; quickJustOpened = quickOpen; rerender(); });
  const count = sections.reduce((n, s) => n + s.rows.length, 0);
  main.append(blockHead('In this issue', `${count} item${count === 1 ? '' : 's'}`, quick));
  let panel = null;
  if (quickOpen) {
    // Mounted once per opening and kept across redraws, so typing survives.
    panel = container.querySelector('.quick-panel');
    if (!panel) {
      panel = el('section', 'quick-panel');
      panel.id = 'issue-quick';
      const mount = el('div');
      panel.append(mount);
      renderSubmitForm(mount, {
        bulk: false,
        onSubmitted: data => onQuickAdd(data),
        knownLinks,
        pendingLine: `Adding it to the ${when} issue`,
        doneLine: `In the ${when} issue, and in the queue for Sort.`,
      });
    }
    main.append(panel);
  }
  if (!count && !removed.length) main.append(el('p', 'nl-empty', 'Nothing in yet.'));
  let n = 0;
  for (const section of sections) {
    main.append(el('p', 'nl-section', section.label));
    const box = el('div', 'nl-list');
    for (const row of section.rows) box.append(issueRow(row, ++n, { onRemove, onEditRow, rerender }));
    main.append(box);
  }
  if (removed.length) {
    const box = el('div', 'nl-list');
    for (const row of removed) box.append(goneRow(row, 'Removed', () => { justRemoved.delete(row.id); onRestore(row); }, row.id));
    main.append(box);
  }

  // ── Ready to add. ──
  main.append(blockHead('Ready to add', String(ready.length)));
  if (!ready.length) main.append(el('p', 'nl-empty', 'Nothing waiting.'));
  else {
    const box = el('div', 'nl-list is-ready');
    for (const entry of ready) box.append(readyRow(entry, { issue, busy, reshare, today, onAdd, onEditRow, rerender }));
    main.append(box);
  }
  // What the issue has outrun: not addable; the move left is Delete.
  if (past.length || deleted.length) {
    const fold = el('details', 'nl-past');
    const summary = el('summary');
    summary.append(faIcon('chevron-right'), el('span', '', `Past items (${past.length})`));
    fold.append(summary);
    const box = el('div', 'nl-list');
    for (const { row, why, when: at } of past) {
      const item = el('div', 'nl-row');
      const text = el('span', 'nl-text');
      text.append(el('span', 'nl-title', title(row)), el('span', 'nl-meta', [why, at].filter(Boolean).join(' · ')));
      const del = button(' Delete', 'linkish trash-link', { focus: `delete:${row.id}`, icon: 'trash-can', onClick: () => { del.disabled = true; justDeleted.set(row.id, row); onTrash(row); } });
      item.append(el('span', 'nl-num'), text, del);
      box.append(item);
    }
    for (const row of deleted) box.append(goneRow(row, 'Deleted', () => { justDeleted.delete(row.id); onRestoreTrashed(row); }, `del:${row.id}`));
    fold.append(box);
    if (deleted.length) fold.open = true;
    main.append(fold);
  }

  // ── The issue: its date, how far off, the builder, the last one sent. ──
  const side = el('aside', 'nl-side');
  const box = el('section', 'nl-issue');
  box.append(el('p', 'block-label', 'This issue'));
  box.append(el('p', 'nl-date', when), el('p', 'nl-sends', sendsIn(issue, today)));
  // The other scheduled issues, to stage ahead (an event for its own issue).
  const others = upcoming.filter(d => d !== issue);
  if (others.length) {
    const line = el('p', 'nl-others');
    line.append(issue === upcoming[0] ? 'Later: ' : 'Also: ');
    others.forEach((d, i) => {
      if (i) line.append(' · ');
      line.append(button(isoToShort(d, today), 'linkish', { focus: `issue:${d}`, onClick: () => { issuePick = d; askId = null; rerender(); } }));
    });
    box.append(line);
  }
  side.append(box);
  const door = el('a', 'nl-door', 'Open the builder');
  door.href = '/builder/';
  door.append(faIcon('arrow-right'));
  side.append(door);
  const last = lastIssue(archive, rows);
  if (last) {
    const lastBox = el('section', 'nl-last');
    lastBox.append(el('p', 'block-label', 'Last issue'), el('p', 'nl-last-date', isoToShort(last.date, today)));
    if (last.items) lastBox.append(el('p', 'nl-meta', `${last.items} item${last.items === 1 ? '' : 's'}`));
    side.append(lastBox);
  }

  page.append(main, side);
  parts.push(page);

  // A redraw keeps the keyboard's place; focus inside the quick add stays put.
  const active = document.activeElement;
  const inPanel = Boolean(panel?.contains(active));
  const focusKey = inPanel ? null : focusKeyIn(container);
  container.replaceChildren(...parts);
  if (panel && quickJustOpened) {
    quickJustOpened = false;
    panel.querySelector('#sf-link')?.focus({ preventScroll: true });
  } else if (inPanel) {
    active.focus({ preventScroll: true });
  } else if (focusKey !== null) {
    restoreFocus(container, focusKey, container.querySelector('.page-title'));
  }
}
