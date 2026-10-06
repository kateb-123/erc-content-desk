/**
 * app.js: ERC Newsletter Builder wizard shell
 *
 * Holds wizard state and step navigation, and renders the four steps. The
 * pure logic lives in model.js, template.js, editpath.js and preview.js.
 */

import { SECTION_REGISTRY, createEmptyIssue, mergeIssues, partitionPulled, countIssueItems, bucketSectionItems, moveItemToGroup } from './model.js';

// The builder lives INSIDE the desk's project (/builder/), so the desk's API
// is same-origin: relative fetches, no CORS.
let pullMessage = ''; // survives the Review re-render after a pull
import { renderNewsletter, renderProse } from './template.js';
import { faIcon, busyWords } from '../../js/icons.js';
import { el, button } from '../../js/ui-aids.js';
import { buildImageControl } from '../../js/item-image.js';
import { readReply, postJson, plainError, fetchDesk, readNewRows, saveRows } from '../../js/sheet-client.js';
import { todayCentral } from '../../js/today.js';
import { saveState, loadState, clearState } from './state.js';
import { getField, setField } from './editpath.js';
import { computePreviewScale } from './preview.js';
import { takeOut, putBack, listedItems, listedSections } from './removals.js';
import { renderShell } from '../../js/shell-ui.js';
import { STEPS, canEnterStep, LOCKED_STEP_MESSAGE, restoreBannerMessage, stepState, archivedEntry, archiveAskMessage, isoToDisplayDate, displayDateToISO, issueDateChoices } from './wizard.js';
import { normalizeLinkUrl } from './editing.js';
// The per-issue layout options the Outline sets (Claude Design handoff, Oct 2026).
import { CALLOUT_CHOICES, PICTURE_CHOICES, setCallout, setNav, itemOptions, setPictureStyle, itemLayouts, resetOptions, hasCustomOptions } from './options.js';
import { layoutOf } from './template.js';
// Kept drafts, and hand-added items that go to the desk (Sep 23).
import { readAllWaiting } from '../../js/reader-client.js';
import { discardToDesk, draftIsOpen, replaceAskMessage, discardedTitle, discardedDetail, withEntry, withoutEntry, restoreOver } from './discarded.js';
import { deskSubmission, sendItemToDesk } from './send-to-desk.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  /** @type {object|null} The newsletter issue model */
  issue: null,
  /** @type {object|null} Deep clone of issue as pulled or restored, the text "Use original" puts back */
  baseline: null,
  /** @type {string} Current wizard step key */
  step: 'review',
  /** @type {number} The furthest step index visited, so checks survive going back */
  reached: 0,
};

/** True while the restore banner is asking; nothing writes storage or the issue until it is answered. */
let restorePending = false;

// ---------------------------------------------------------------------------
// Autosave helpers
// ---------------------------------------------------------------------------

/**
 * Tiny debounce: returns a function that delays `fn` by `wait` ms,
 * cancelling any pending call if invoked again before the delay fires.
 * @param {Function} fn
 * @param {number} wait - milliseconds
 * @returns {Function}
 */
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Schedule a debounced save of the current issue to localStorage. */
const scheduleSave = debounce(() => {
  if (state.issue && !restorePending) saveState(state.issue);
}, 400);

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const btnBack = document.getElementById('btn-back');
const btnNext = document.getElementById('btn-next');
/** The one-line status slot under the step row: what a locked step says.
    Always one line tall, so a message never moves the page. */
const wizardStatus = document.getElementById('wizard-status');
function setWizardStatus(msg) {
  wizardStatus.textContent = msg;
}

/** A note's icon: the glyph that goes with its --support-* colour, ahead of the words. */
function noteIcon(name) {
  const i = faIcon(name);
  i.classList.add('note-icon');
  return i;
}

/** One <option>: its value, its words, and whether it is the one picked. */
function option(value, text, selected = false) {
  const opt = el('option', '', text);
  opt.value = value;
  if (selected) opt.selected = true;
  return opt;
}

/** A quiet word in the link colour: the builder's ghost button. */
function ghostButton(label) {
  return button(label, 'ghost-btn');
}

/**
 * Carbon's inline notification: the tint, the bar, the icon, the words,
 * and a ghost Retry when there is something to try again. An error is an
 * alert; anything else is a polite status.
 * @param {'error'|'success'|'warning'} kind
 * @param {string} message
 * @param {(() => void)|null} [onRetry]
 */
function inlineNote(kind, message, onRetry = null) {
  const icons = { error: 'circle-exclamation', success: 'circle-check', warning: 'triangle-exclamation' };
  const note = el('div', `note note--${kind}`);
  if (kind === 'error') note.setAttribute('role', 'alert');
  else { note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite'); }
  note.append(noteIcon(icons[kind]), el('span', '', message));
  if (onRetry) {
    const retry = ghostButton('Retry');
    retry.addEventListener('click', onRetry);
    note.append(retry);
  }
  return note;
}

/** @type {NodeListOf<HTMLElement>} */
const stepSections = document.querySelectorAll('[data-step]');

/** @type {NodeListOf<HTMLElement>} */
const stepIndicators = document.querySelectorAll('[data-nav-step]');

/**
 * The step buttons' state: the lit one, the finished ones (a check once an
 * issue is loaded and the step sits before the current one), and which are
 * reachable. The button inside each step carries aria-current and
 * aria-disabled for a screen reader. Runs on every goTo and again when
 * an issue arrives on Review.
 */
function syncStepNav() {
  const at = { current: state.step, reached: state.reached, itemCount: countIssueItems(state.issue) };
  stepIndicators.forEach((indicator) => {
    const navStep = indicator.dataset.navStep;
    const shows = stepState(navStep, at);
    indicator.classList.toggle('active', shows === 'current');
    indicator.classList.toggle('completed', shows === 'complete');
    const btn = indicator.querySelector('button');
    if (shows === 'current') btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
    // A locked step is greyed, and its title says why.
    if (shows === 'locked') { btn.setAttribute('aria-disabled', 'true'); btn.title = LOCKED_STEP_MESSAGE; }
    else { btn.removeAttribute('aria-disabled'); btn.removeAttribute('title'); }
  });
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** Which renderer draws each step. */
const RENDER = { review: renderReview, triage: renderTriage, edit: renderEdit, export: renderExport };

/**
 * Show the wizard section for `step`, hide all others.
 * Updates `state.step` and enables/disables Back/Next buttons.
 *
 * @param {string} step - One of STEPS
 */
function goTo(step) {
  const idx = STEPS.indexOf(step);

  // Leaving a step makes its removals final: the greyed rows and their Undo go.
  if (step !== state.step) settleRemovals();
  state.step = step;
  state.reached = Math.max(state.reached, idx);

  stepSections.forEach((section) => { section.hidden = section.dataset.step !== step; });

  syncStepNav();
  setWizardStatus('');

  // The footer pair: Back sleeps on the first step; Next has nowhere to go on
  // the last, so it goes rather than greys.
  btnBack.disabled = idx === 0;
  btnNext.hidden = idx === STEPS.length - 1;

  RENDER[step]();
}

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

/** The one gate Next and the step buttons share: with nothing pulled, the later
 *  steps say why on the status line and stay put. */
function tryGo(step) {
  if (!canEnterStep(step, countIssueItems(state.issue))) { setWizardStatus(LOCKED_STEP_MESSAGE); return; }
  goTo(step);
}

function goBack() {
  const idx = STEPS.indexOf(state.step);
  if (idx > 0) goTo(STEPS[idx - 1]);
}
function goNext() {
  const idx = STEPS.indexOf(state.step);
  if (idx < STEPS.length - 1) tryGo(STEPS[idx + 1]);
}
btnBack.addEventListener('click', goBack);
btnNext.addEventListener('click', goNext);

// The step buttons jump straight to any step. Review is always reachable; the
// later steps need a loaded issue, and say so on the status line.
stepIndicators.forEach((ind) => {
  const btn = ind.querySelector('button');
  btn.addEventListener('click', () => {
    const target = ind.dataset.navStep;
    if (target !== state.step) tryGo(target);
  });
  // The whole step stays a click surface (its number circle included); the button is the control.
  ind.addEventListener('click', (e) => {
    if (e.target !== btn && !btn.contains(e.target)) btn.click();
  });
});


/** The desk's header pattern, mirrored: one lede line in the card title's
 *  place (the step row already names the step) + "View info" toggle
 *  with a tinted instruction note. Open state survives re-renders per step. */
const openStepInfo = new Set();
function attachStepInfo(container, key, lede, text) {
  const row = el('div', 'title-row');
  const ledeEl = el('p', 'step-lede', lede);
  const toggle = button('', 'info-toggle');
  const panel = el('div', 'info-panel');
  panel.append(noteIcon('circle-info'), document.createTextNode(text));
  const sync = () => {
    panel.hidden = !openStepInfo.has(key);
    toggle.textContent = openStepInfo.has(key) ? 'Hide info' : 'View info';
  };
  toggle.addEventListener('click', () => {
    if (openStepInfo.has(key)) openStepInfo.delete(key);
    else openStepInfo.add(key);
    sync();
  });
  sync();
  row.append(ledeEl, toggle);
  container.append(row, panel);
}

/** Every step opens the same way: its section, wiped back to the heading a
 *  screen reader reads (the step row's own words), then the lede and the
 *  View info note. Returns the section to fill. */
function openStep(key, lede, info) {
  const container = document.querySelector(`[data-step="${key}"]`);
  const heading = document.querySelector(`[data-nav-step="${key}"] .step-btn`).textContent;
  container.replaceChildren(el('h2', 'sr-only', heading));
  attachStepInfo(container, key, lede, info);
  return container;
}

/** A step with nothing to show says so in one line. */
function emptyLine(container, text) {
  container.appendChild(el('p', 'edit-empty-msg', text));
}

function renderReview() {
  const container = openStep('review', 'Pick the issue and pull what the desk staged.',
    'Pick the issue, pull what the desk staged, and look it over. Pull again any time. Only new items are added.');

  // ── Issue date: a dropdown of the desk's scheduled issues, with staged
  //    counts. The desk owns the schedule; the builder just picks from it. ──
  const metaSection = el('div', 'triage-meta');
  const dateLabel = el('label', 'triage-field-label', 'Issue');
  const dateSelect = el('select', 'triage-field-input');
  const currentIso = state.issue ? displayDateToISO(state.issue.date || '') : '';
  const placeholder = option(currentIso, currentIso ? isoToDisplayDate(currentIso) : 'Loading issues…');
  dateSelect.appendChild(placeholder);
  // While the restore banner asks, the issue cannot be changed under it.
  dateSelect.disabled = restorePending;
  dateSelect.addEventListener('change', () => {
    if (!dateSelect.value) return;
    if (!state.issue) state.issue = createEmptyIssue();
    // The issue keeps the display string the header renders ("July 1, 2026").
    state.issue.date = isoToDisplayDate(dateSelect.value);
    scheduleSave();
  });
  dateLabel.appendChild(dateSelect);
  // Where a failed schedule load speaks: an error note under the field, with Retry.
  const scheduleNote = el('div', 'note-slot');
  metaSection.append(dateLabel, scheduleNote);
  container.appendChild(metaSection);

  // Fill the dropdown from the desk: scheduled dates plus anything staged,
  // from College Station's today on. The draft's own date stays even once it
  // has passed, or dropped off the desk's schedule.
  async function loadSchedule() {
    scheduleNote.replaceChildren();
    if (!currentIso) placeholder.textContent = 'Loading issues…';
    try {
      const data = await readReply(await fetch('/api/newsletter-pull'), 'load the issues');
      const isos = issueDateChoices([...(data.schedule ?? []), ...Object.keys(data.staged ?? {})], todayCentral(), currentIso);
      if (!isos.length) { placeholder.textContent = 'No upcoming issues on the desk'; return; }
      dateSelect.replaceChildren(
        ...(currentIso ? [] : [option('', 'Pick an issue…')]),
        ...isos.map((iso) => option(iso, isoToDisplayDate(iso), iso === currentIso)),
      );
    } catch {
      // The select keeps a real first option; the error speaks beside it, with a way to try again.
      if (!currentIso) placeholder.textContent = 'Pick an issue…';
      scheduleNote.replaceChildren(inlineNote('error', "Couldn't load the desk's issues.", loadSchedule));
    }
  }
  loadSchedule();

  // Pull from the desk: the Content Desk's Newsletter screen stamps items for
  // an issue; this button fetches them, already builder-shaped. Re-pull adds
  // only what is new (matched by link, and by the stable desk id). The button
  // and its status share one row under the field.
  const pullRow = el('div', 'pull-row');
  // The step's one real action: a filled primary, like the desk's Rewrite/Publish.
  const pullBtn = button('Pull from the desk', 'btn btn-primary');
  pullBtn.disabled = restorePending;   // locked while the restore banner asks
  const pullStatus = el('span', 'pull-status', pullMessage);
  pullStatus.setAttribute('role', 'status');    // read aloud as it changes
  pullStatus.setAttribute('aria-live', 'polite');
  // A failed pull is an error note under the row, with Retry.
  const pullNote = el('div', 'note-slot');
  const setPull = (msg, busy = false) => {
    pullMessage = msg;
    pullNote.replaceChildren();
    if (busy && msg) pullStatus.replaceChildren(busyWords(msg));
    else pullStatus.textContent = msg;
  };
  pullBtn.addEventListener('click', async () => {
    const iso = displayDateToISO(state.issue?.date || '');
    if (!iso) return setPull('Pick the issue first.');
    pullBtn.hidden = true;   // gone while pulling; no double-clicks
    setPull('Pulling…', true);
    try {
      const data = await readReply(await fetch(`/api/newsletter-pull?issue=${iso}`), 'pull the issue');
      if (!countIssueItems(data.issue)) {
        const staged = Object.entries(data.staged ?? {}).sort(([a], [b]) => a.localeCompare(b));
        setPull(staged.length
          ? `Nothing staged for ${isoToDisplayDate(iso)}. The desk has ${staged[0][1]} staged for ${isoToDisplayDate(staged[0][0])}.`
          : `Nothing staged for ${isoToDisplayDate(iso)}.`);
        return;
      }
      if (!state.issue) state.issue = createEmptyIssue();
      const { pulled, already } = partitionPulled(data.issue, state.issue);
      const fresh = countIssueItems(pulled);
      if (fresh) {
        pulled.date = ''; // never clobber the issue's own date field
        mergeIssues(state.issue, pulled);
        state.baseline = structuredClone(state.issue);
        scheduleSave();
      }
      setPull(already ? `Pulled ${fresh} new · ${already} already here.` : `Pulled ${fresh} from the desk.`);
      if (fresh) { renderReview(); syncStepNav(); }
    } catch {
      setPull('');
      pullNote.replaceChildren(inlineNote('error', "Couldn't reach the desk.", () => pullBtn.click()));
    } finally {
      pullBtn.hidden = false;
    }
  });
  pullRow.append(pullBtn, pullStatus);
  container.append(pullRow, pullNote);
  renderDiscardedDrafts(container);   // Recently discarded (Sep 23): joins the step after the rest has drawn

  // ── What's in the issue ──────────────────────────────────────────────────
  const items = [];
  for (const sec of SECTION_REGISTRY) {
    for (const item of state.issue?.sections?.[sec.key]?.items ?? []) items.push([sec, item]);
  }
  if (!items.length) {
    emptyLine(container, 'Nothing here yet.');
    return;
  }
  const table = el('table', 'review-table');
  const thead = el('thead');
  const headRow = el('tr');
  headRow.append(...['Item', 'Section'].map((label) => el('th', '', label)));
  thead.appendChild(headRow);
  const tbody = el('tbody');
  for (const [sec, item] of items) {
    const tr = el('tr');
    const itemTd = el('td');
    itemTd.appendChild(el('strong', '', item.fields?.title || item.fields?.url || '(untitled)'));
    const source = String(item.fields?.source ?? '').trim();
    if (source) itemTd.appendChild(el('span', 'review-table-sub', source));
    const secTd = el('td', '', sec.label);
    const groupLabel = sec.groups.find((g) => g.key === item.group)?.label ?? '';
    if (groupLabel) secTd.appendChild(el('span', 'review-table-sub', groupLabel));
    tr.append(itemTd, secTd);
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  container.appendChild(table);
}

/**
 * What Remove took out on the step on screen (Kate, Sep 23: the desk's own
 * pattern). Each item has left the issue already, so the preview and the
 * saved draft never carry it; it stays listed where it stood, greyed with its
 * own Undo, until goTo leaves the step and settles it. Kept with the issue it
 * came out of, so a replaced issue never takes back another issue's item.
 */
let removals = { issue: null, waiting: [] };
function waitingRemovals() {
  if (removals.issue !== state.issue) removals = { issue: state.issue, waiting: [] };
  return removals.waiting;
}
function settleRemovals() {
  removals = { issue: null, waiting: [] };
}

/**
 * Take one item out of the issue: the Outline row's Remove and the Preview &
 * Edit card's Remove. `rerender` redraws the step on screen, with the item
 * greyed in place; `fromKeyboard` (a click with detail 0) hands focus to its Undo.
 */
let _undoToastTimer = null;
function deleteItemWithUndo(itemId, rerender, fromKeyboard = false) {
  if (!takeOut(state.issue, waitingRemovals(), itemId)) return;
  scheduleSave();
  rerender();
  syncStepNav();
  if (fromKeyboard) focusInStep(`[data-undo-item="${CSS.escape(itemId)}"]`);
}

/** A greyed row's Undo: the item goes back into the issue where its row sits.
 *  From the keyboard, focus goes to the row's Remove, or on Preview & Edit,
 *  where the card is closed, to the column's title. */
function undoRemove(itemId, rerender, fromKeyboard = false) {
  if (!putBack(state.issue, waitingRemovals(), itemId)) return;
  scheduleSave();
  rerender();
  syncStepNav();
  if (fromKeyboard) focusInStep(`[data-remove-item="${CSS.escape(itemId)}"]`, '.edit-column-title');
}

/** A removed item's greyed row, drawn as the desk draws Next issue's: its
 *  title, the word Removed, and its own Undo. */
function removedRow(item, rowClass, rerender) {
  const title = item.fields?.title || '(untitled)';
  const row = el('div', `${rowClass} is-removed`);
  const undo = ghostButton('Undo');
  undo.dataset.undoItem = item.id;
  undo.setAttribute('aria-label', `Undo removing "${title}"`);
  undo.addEventListener('click', (e) => undoRemove(item.id, rerender, e.detail === 0));
  // The title is user-derived: textContent only.
  row.append(el('span', 'removed-title', title), el('span', 'removed-word', 'Removed'), undo);
  return row;
}

/** Focus the first match in the step on screen; a visited step's DOM stays
 *  in the page, hidden, so a bare query could land there. */
function focusInStep(...selectors) {
  const step = document.querySelector(`[data-step="${state.step}"]`);
  const target = selectors.map((sel) => step?.querySelector(sel)).find(Boolean);
  if (target) target.focus();
}

/**
 * Bottom toast with an Undo button; auto-dismisses after a few seconds. A
 * live region, and it sits in the DOM right after the edit column (or the
 * wizard body) so it reads in place rather than at the end of the page; with
 * `focusUndo` the Undo button takes focus, for a removal made from the
 * keyboard.
 */
function showUndoToast(message, onUndo, { focusUndo = false } = {}) {
  clearTimeout(_undoToastTimer);
  const prior = document.querySelector('.undo-toast');
  if (prior) prior.remove();

  const toast = el('div', 'undo-toast');
  toast.setAttribute('role', 'status');
  const btn = button('Undo', 'undo-toast__btn', { onClick: () => {
    clearTimeout(_undoToastTimer);
    toast.remove();
    onUndo();
  } });
  // The message is a user-derived title: textContent only.
  toast.append(el('span', '', message), btn);
  // A visited Edit step leaves its .edit-column in the page, hidden; a bare
  // query would put the toast there, out of sight, on any later step.
  const visibleStep = document.querySelector('[data-step]:not([hidden])');
  const anchor = (visibleStep && visibleStep.querySelector('.edit-column')) || document.querySelector('.wizard-body');
  if (anchor) anchor.after(toast);
  else document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('undo-toast--visible'));
  if (focusUndo) btn.focus();
  _undoToastTimer = setTimeout(() => {
    toast.classList.remove('undo-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 6000);
}

/**
 * Render the triage step UI from `state.issue`.
 * Called each time the wizard navigates to the 'triage' step.
 */
/**
 * A small floating menu beside a control, closed by a click elsewhere or
 * Escape. One open at a time. `build(menu)` fills it.
 */
let openMenu = null;
function closeMenu() {
  if (!openMenu) return;
  openMenu.el.remove();
  openMenu.anchor.classList.remove('is-open');
  openMenu = null;
}
document.addEventListener('click', (e) => {
  if (openMenu && !openMenu.el.contains(e.target) && !openMenu.anchor.contains(e.target)) closeMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
function showMenu(anchor, className, build, rect = anchor.getBoundingClientRect()) {
  if (openMenu && openMenu.anchor === anchor) { closeMenu(); return null; }
  closeMenu();
  const menu = el('div', className);
  build(menu);
  document.body.appendChild(menu);
  const left = Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - menu.offsetWidth - 8));
  const below = rect.bottom + 6 + menu.offsetHeight <= window.innerHeight;
  menu.style.left = `${left}px`;
  menu.style.top = below ? `${rect.bottom + window.scrollY + 6}px` : `${Math.max(window.scrollY + 8, rect.top + window.scrollY - menu.offsetHeight - 6)}px`;
  anchor.classList.add('is-open');
  openMenu = { el: menu, anchor };
  return menu;
}

// ---------------------------------------------------------------------------
// Outline step: the issue as a table (Kate, Oct 5)
// ---------------------------------------------------------------------------

/** An item's one-line meta, as the Outline prints it under the title. */
function outlineMeta(sectionKey, f) {
  if (sectionKey === 'research') return f.authors || '';
  return f.meta || [f.date, f.time, f.location].filter(Boolean).join(' | ') || f.source || '';
}

/**
 * The Outline: what goes out, in the order it goes out. One row per item
 * under its section and group as the email prints them: the title as its
 * link with the meta line under it, Featured for events, the order arrows,
 * Remove with Undo, and Move to… on hover for an item the desk filed in the
 * wrong group. The look is chosen on Preview & Tweak, on the email itself.
 */
function renderTriage() {
  const container = openStep('triage', 'Put the issue in order.',
    'What goes out, in the order it goes out. Each section and group is as the email prints it. Hover a row for Move to…; the look is chosen on the next step, on the email itself.');

  const issue = state.issue;

  // Nothing pulled yet: one line, and no empty table to puzzle over.
  // Items removed on this visit still list, greyed, so the last one out is not lost.
  if (!issue || (!countIssueItems(issue) && !waitingRemovals().length)) {
    emptyLine(container, 'No issue loaded. Pull from the desk on the Review step first.');
    return;
  }

  // Only the populated sections are listed; the rest are named once at the
  // foot. A populated section is always included, an empty one auto-hides.
  const { populated, missing } = listedSections(issue, waitingRemovals());
  for (const reg of SECTION_REGISTRY) {
    const sec = issue.sections?.[reg.key];
    if (sec) sec.enabled = (sec.items?.length ?? 0) > 0;
  }

  const table = el('table', 'outline-table');
  const thead = el('thead');
  const hr = el('tr');
  for (const [text, cls] of [['Item', ''], ['Featured', ''], ['Order', 'r'], ['', 'r']]) {
    const th = el('th', cls, text);
    th.scope = 'col';
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el('tbody');
  table.appendChild(tbody);

  const waiting = waitingRemovals();
  const removed = new Set(waiting.map((w) => w.item));
  let inIssue = 0, listed = 0;

  for (const reg of populated) {
    const secData = issue.sections[reg.key];
    const items = secData.items;
    const rows = listedItems(issue, waiting, reg.key);
    const live = rows.filter((it) => !removed.has(it));
    listed += rows.length; inIssue += live.length;

    // The section row: its name and count.
    const sr = el('tr', 'outline-section');
    const std = el('td');
    std.colSpan = 4;
    std.appendChild(el('span', 'outline-section-name', reg.label));
    std.appendChild(el('span', 'outline-section-count', live.length === rows.length ? String(rows.length) : `${live.length} of ${rows.length}`));
    sr.appendChild(std);
    tbody.appendChild(sr);

    // Featured events pin under Featured Events, as the email prints them.
    const groupKeyOf = (it) => (reg.key === 'events' && it.featured ? 'featured' : it.group);
    const buckets = bucketSectionItems(reg, rows.map((it) => (reg.key === 'events' && it.featured ? { ...it, group: 'featured', __item: it } : it)))
      .map((b) => ({ ...b, items: b.items.map((it) => it.__item || it) }));

    for (const bucket of buckets) {
      if (bucket.label) {
        const gr = el('tr', 'outline-group');
        const gtd = el('td', '', bucket.label);
        gtd.colSpan = 4;
        gr.appendChild(gtd);
        tbody.appendChild(gr);
      }
      const bucketLive = bucket.items.filter((it) => !removed.has(it));
      for (const item of bucket.items) {
        const f = item.fields || {};
        const title = f.title || '(untitled)';
        const tr = el('tr', 'outline-item' + (removed.has(item) ? ' is-removed' : ''));
        tr.dataset.item = item.id;

        // Item: the title as its link, the meta line, and Move to… on hover.
        const td1 = el('td', 'outline-item-cell');
        const href = normalizeLinkUrl(f.url || '');
        const link = href ? el('a', 'outline-title', title) : el('span', 'outline-title', title);
        if (href) { link.href = href; link.target = '_blank'; link.rel = 'noopener'; }
        td1.appendChild(link);
        const meta = outlineMeta(reg.key, f);
        if (meta) td1.appendChild(el('span', 'outline-meta', meta));
        if (!removed.has(item)) {
          const mv = button('Move to…', 'ghost-btn outline-move');
          mv.setAttribute('aria-label', `Move "${title}" to another group`);
          mv.addEventListener('click', (e) => {
            e.stopPropagation();
            showMenu(mv, 'outline-menu', (menu) => {
              for (const r2 of SECTION_REGISTRY) {
                menu.appendChild(el('div', 'outline-menu-head', r2.label));
                for (const g2 of r2.groups) {
                  const here = r2.key === reg.key && g2.key === groupKeyOf(item);
                  const b = button(g2.label || '(no group)', 'outline-menu-item' + (here ? ' is-current' : ''));
                  if (here) b.disabled = true;
                  else b.addEventListener('click', () => {
                    moveItemToGroup(issue, item.id, r2.key, g2.key);
                    closeMenu();
                    scheduleSave();
                    renderTriage();
                    setWizardStatus(`Moved "${title}" to ${r2.label}${g2.label ? `, ${g2.label}` : ''}.`);
                  });
                  menu.appendChild(b);
                }
              }
            });
          });
          td1.appendChild(mv);
        }

        // Featured: events only, one radio across the section.
        const td2 = el('td');
        if (reg.key === 'events' && !removed.has(item)) {
          const lab = el('label', 'outline-featured' + (item.featured ? ' is-on' : ''));
          const rb = el('input');
          rb.type = 'radio';
          rb.name = 'outline-featured';
          rb.checked = !!item.featured;
          rb.setAttribute('aria-label', `Feature "${title}"`);
          rb.addEventListener('change', () => {
            items.forEach((ev) => { ev.featured = false; });
            item.featured = true;
            scheduleSave();
            renderTriage();
          });
          lab.append(rb, item.featured ? ' Featured' : ' Feature');
          td2.appendChild(lab);
        }

        // Order: the arrows, within the group.
        const td3 = el('td', 'r');
        if (!removed.has(item)) {
          const k = bucketLive.indexOf(item);
          const arrow = (dir, glyph, disabled, other) => {
            const btn = button('', 'triage-reorder-btn', { icon: glyph, onClick: () => {
              const a = items.indexOf(item), b = items.indexOf(other);
              if (a < 0 || b < 0) return;
              [items[a], items[b]] = [items[b], items[a]];
              scheduleSave();
              renderTriage();
              const again = document.querySelector(`[data-move-item="${CSS.escape(item.id)}"][data-move-dir="${dir}"]`);
              if (again && !again.disabled) again.focus();
            } });
            btn.setAttribute('aria-label', `Move "${title}" ${dir}`);
            btn.dataset.moveItem = item.id;
            btn.dataset.moveDir = dir;
            btn.disabled = disabled;
            return btn;
          };
          const group = el('div', 'triage-reorder-group');
          group.append(arrow('up', 'arrow-up', k === 0, bucketLive[k - 1]), arrow('down', 'arrow-down', k === bucketLive.length - 1, bucketLive[k + 1]));
          td3.appendChild(group);
        }

        // Remove, or Undo on a removed row (the desk's greyed row).
        const td4 = el('td', 'r');
        if (removed.has(item)) {
          const undo = button('Undo', 'ghost-btn outline-undo', { onClick: (e) => undoRemove(item.id, renderTriage, e.detail === 0) });
          undo.setAttribute('aria-label', `Put "${title}" back`);
          td4.appendChild(undo);
        } else {
          const delBtn = button(' Remove', 'ghost-btn ghost-btn--danger', {
            icon: 'trash-can',
            onClick: (e) => deleteItemWithUndo(item.id, renderTriage, e.detail === 0),
          });
          delBtn.dataset.removeItem = item.id;
          delBtn.setAttribute('aria-label', `Remove "${title}" from the issue`);
          delBtn.title = 'Removes this item from the issue';
          td4.appendChild(delBtn);
        }

        tr.append(td1, td2, td3, td4);
        tbody.appendChild(tr);
      }
    }
  }

  container.appendChild(table);
  const foot = el('p', 'triage-missing', `${inIssue} of ${listed} ${listed === 1 ? 'item' : 'items'} in the issue.` + (missing.length ? ` Not in this issue: ${missing.join(', ')}.` : ''));
  container.appendChild(foot);
}

// ---------------------------------------------------------------------------
// Edit step ("Preview & Tweak")
// ---------------------------------------------------------------------------

/**
 * CSS injected into the editable iframe to show hover affordance. Built when
 * the iframe loads so the colours come from the builder's own tokens: the
 * hover wash (--accent-10) while the pointer is over an item, the chosen
 * tint (--highlight) for the flash on click.
 */
function editHoverCss() {
  const tokens = getComputedStyle(document.documentElement);
  const wash = tokens.getPropertyValue('--accent-10').trim();   // the editable cue, plain enough to see
  const chosen = tokens.getPropertyValue('--highlight').trim();
  return `
[data-edit-field] {
  cursor: pointer;
}
/* Hovering any field highlights every field of that whole item (applied by JS),
   since clicking edits the whole item at once. A translucent fill, not a hard
   outline, so the item reads as one gentle highlight; the matching box-shadow
   pads the fill out a few px and bridges the gaps between fields. */
.ec-item-hover {
  background-color: ${wash};
  box-shadow: 0 0 0 6px ${wash};
}
.ec-item-open {
  background-color: ${wash};
  box-shadow: 0 0 0 6px ${wash}, 0 0 0 8px ${tokens.getPropertyValue('--button-primary').trim()};
}
.ec-edit-flash {
  background-color: ${chosen};
  box-shadow: 0 0 0 4px ${chosen};
}
`;
}


/** Counter behind the edit cards' field ids, so each label points at its own field. */
let editFieldSeq = 0;

/** A card's first field that can take focus: never the hidden link row's input or a file input. */
function firstField(card) {
  return [...card.querySelectorAll('input, textarea, [contenteditable]')]
    .find((el) => el.type !== 'file' && !el.closest('[hidden]')) || null;
}

/** True newsletter width (px). The preview is scaled down to fit narrower panes. */
const PREVIEW_WIDTH = 640;

/** Cap the preview at 95% of true size; scales down on narrow windows so the
    edit column always fits and there's never a horizontal scrollbar. */
const PREVIEW_MAX_SCALE = 0.95;

/**
 * Re-fits the Edit step's preview iframe to the current pane width. Reads
 * the layout fresh from the document on every call rather than closing over
 * one render's elements, so a single listener bound once (below) keeps
 * re-fitting the preview correctly across every future visit to the step.
 * Silently no-ops when `.edit-layout` isn't on screen: a different step is
 * showing, or Edit has never been rendered yet.
 */
/** Every two-pane stage on the page (Outline's and Preview & Edit's); a hidden one measures nothing and is left alone. */
function fitPreview() {
  document.querySelectorAll('.edit-layout').forEach(fitLayout);
}

function fitLayout(layout) {
  const iframe = layout.querySelector('.edit-preview-iframe');
  const wrap = layout.querySelector('.edit-preview-wrap');
  const doc = iframe && iframe.contentDocument;
  if (!doc || !doc.body) return;
  // Measure the whole two-column row; the sheet's share is computed by the
  // helper (which reserves the column, gap, and both sides of stage padding).
  const layoutWidth = layout.clientWidth;
  if (!layoutWidth) return; // hidden (another step showing) or not laid out yet
  // The column, the gap and the stage's padding are read from the page, not
  // copied from the stylesheet: a hand-copied number drifts the moment the
  // CSS changes, and the preview then scales by the wrong amount.
  const rowStyle = getComputedStyle(layout);
  const gap = parseFloat(rowStyle.columnGap || rowStyle.gap) || 0;
  const columnWidth = layout.querySelector('.edit-column')?.getBoundingClientRect().width ?? 0;
  const wrapStyle = getComputedStyle(wrap);
  const stagePad = ((parseFloat(wrapStyle.paddingLeft) || 0) + (parseFloat(wrapStyle.paddingRight) || 0)) / 2;
  iframe.style.zoom = '1';
  iframe.style.width = PREVIEW_WIDTH + 'px';
  const contentHeight = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
  iframe.style.height = contentHeight + 'px';
  const scale = computePreviewScale({
    layoutWidth, columnWidth, gap, stagePad,
    sheetWidth: PREVIEW_WIDTH, maxScale: PREVIEW_MAX_SCALE,
  });
  if (scale <= 0) return;
  iframe.style.zoom = String(scale);
  const note = layout.closest('.wizard-step')?.querySelector('.preview-note');
  const tail = layout.classList.contains('outline-layout') ? '' : ' Click any text to edit it.';
  if (note) note.textContent = `Preview at ${Math.round(scale * 100)} percent, as it lands in Outlook.${tail}`;
}

// Bound once: fitPreview finds the preview afresh on every call.
window.addEventListener('resize', debounce(fitPreview, 150));


/**
 * Re-render the editable iframe (after an edit) and re-attach listeners.
 * @param {HTMLIFrameElement} iframe
 */
function refreshEditIframe(iframe) {
  // Re-setting srcdoc triggers the 'load' event, which re-attaches the listener.
  iframe.srcdoc = renderNewsletter(state.issue, { editable: true });
}

/** One fold in the edit column's rail: its label, and the empty body to fill. */
function railPanel(title) {
  const details = el('details', 'reorder-panel');
  const body = el('div', 'reorder-panel-body');
  details.append(el('summary', 'reorder-panel-summary', title), body);
  return { details, body };
}

/**
 * The introduction's home in the edit column: a panel with the same rich
 * editor the cards use, bound to issue.intro. The preview refreshes as you
 * type (debounced); the editor lives outside the iframe, so focus holds.
 */
function buildIntroPanel(iframe) {
  const { details, body } = railPanel('Introduction');
  body.appendChild(el('p', 'addon-hint', 'Shows under the header, before the first section.'));
  const refresh = debounce(() => refreshEditIframe(iframe), 500);
  const editor = buildRichEditor(state.issue?.intro || '', (md) => {
    if (!state.issue) state.issue = createEmptyIssue();
    state.issue.intro = md;
    scheduleSave();
    refresh();
  });
  // Edits are live, so Save is a quiet word, not a second primary.
  const save = button('Save', 'ghost-btn intro-save-btn', { onClick: () => {
    if (state.issue) saveState(state.issue);
    refreshEditIframe(iframe);
    save.textContent = 'Saved';
    setTimeout(() => { save.textContent = 'Save'; }, 1500);
  } });
  body.append(editor.el, save);
  return details;
}

let miscItemSeq = 0;

/** The desk's four doors, as its own Quick add uses them: file a row, have
 *  the reader file it, read the rows back, save one. */
const DESK = {
  submit: (body) => postJson('/api/submit', body, 'add that to the queue'),
  read: (id) => readAllWaiting([id], readNewRows),
  rows: async () => (await fetchDesk()).rows,
  save: (rows) => saveRows(rows),
};

/**
 * The one-off door: add a single item by hand, something that never went
 * through the desk. Section and group pickers, the fields the templates
 * render, and an Add button. The item is a first-class citizen afterwards
 * (click-to-edit, reorder, delete). It goes to the desk too (Kate, Sep 23):
 * a row in Content Sort's queue, stamped for this issue, so it is checked
 * against the Policy Exchange like everything else. The item is in the draft
 * whatever the desk says; the status line says how far it got.
 */
function buildAddItemPanel(iframe) {
  const { details, body } = railPanel('Add an item');

  const field = (labelText, control) => {
    const label = el('label', 'addon-field');
    label.append(el('span', '', labelText), control);
    return label;
  };
  const textInput = () => {
    const input = el('input', 'triage-field-input');
    input.type = 'text';
    return input;
  };

  const sectionSelect = el('select', 'triage-field-input');
  sectionSelect.append(...SECTION_REGISTRY.map((reg) => option(reg.key, reg.label)));
  const groupSelect = el('select', 'triage-field-input');
  const groupField = field('Group', groupSelect);
  const syncGroups = () => {
    const reg = SECTION_REGISTRY.find((r) => r.key === sectionSelect.value);
    groupSelect.replaceChildren(...(reg?.groups ?? []).map((g) => option(g.key, g.label)));
    // A single unlabeled group (Miscellaneous) needs no picker.
    groupField.hidden = !(reg?.groups ?? []).some((g) => g.label);
  };
  sectionSelect.addEventListener('change', () => { syncGroups(); syncExtras(); });
  syncGroups();

  const titleInput = textInput();
  const linkInput = textInput();
  const summaryInput = el('textarea', 'triage-field-input');
  summaryInput.rows = 3;
  const dateInput = textInput();
  const timeInput = textInput();
  const locationInput = textInput();
  const deadlineInput = textInput();
  const imageCtl = buildImageControl('', () => {});

  const eventFields = [field('Date', dateInput), field('Time', timeInput), field('Location', locationInput)];
  const oppFields = [field('Deadline', deadlineInput)];
  const imageField = field('Media', imageCtl.el);
  const syncExtras = () => {
    const key = sectionSelect.value;
    const isEventy = key === 'events' || key === 'spotlight';
    for (const f of eventFields) f.hidden = !isEventy;
    for (const f of oppFields) f.hidden = key !== 'opportunities';
    imageField.hidden = !IMAGE_SECTIONS.has(key);
  };

  const status = el('p', 'addon-hint addon-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  // To the desk: Add is gone while it goes, and a failure keeps a Try again
  // that never files the item twice (the row's id stays on it as deskId).
  const toDesk = async (item, sectionKey, label) => {
    addBtn.hidden = true;
    status.replaceChildren(busyWords(`Added to ${label}. Sending it to the desk…`));
    try {
      await sendItemToDesk(item, { sectionKey, issueIso: displayDateToISO(state.issue?.date || ''), api: DESK });
      status.textContent = `Added to ${label} and to Content Sort's queue.`;
    } catch (err) {
      console.error('[add an item] the desk did not take it:', err);
      const again = ghostButton('Try again');
      again.addEventListener('click', () => toDesk(item, sectionKey, label));
      status.replaceChildren(item.deskId
        ? `Added to ${label}. It is in Content Sort's queue, not stamped for the issue. `
        : `Added to ${label}. It did not reach the desk. `, again);
    } finally {
      scheduleSave();   // the desk id rides with the draft, so a pull knows the row
      addBtn.hidden = false;
    }
  };

  const addBtn = button('Add to the issue', 'btn btn-secondary', { onClick: () => {
    const title = titleInput.value.trim();
    if (!title) { status.textContent = 'Give it a title first.'; return; }
    if (!state.issue) state.issue = createEmptyIssue();
    const fields = { title };
    if (linkInput.value.trim()) fields.url = linkInput.value.trim();
    if (summaryInput.value.trim()) fields.summary = summaryInput.value.trim();
    if (!eventFields[0].hidden) {
      if (dateInput.value.trim()) fields.date = dateInput.value.trim();
      if (timeInput.value.trim()) fields.time = timeInput.value.trim();
      if (locationInput.value.trim()) fields.location = locationInput.value.trim();
    }
    if (!oppFields[0].hidden && deadlineInput.value.trim()) {
      fields.meta = `Deadline: ${deadlineInput.value.trim()}`;
    }
    if (!imageField.hidden && imageCtl.get()) fields.image = imageCtl.get();
    miscItemSeq += 1;
    const section = state.issue.sections[sectionSelect.value];
    const item = { id: `misc_${Date.now().toString(36)}_${miscItemSeq}`, group: groupSelect.value, fields };
    section.items.push(item);
    section.enabled = true;
    // The as-added values are this item's "original" for Use original.
    const base = state.baseline.sections[sectionSelect.value];
    if (base) { base.items.push(structuredClone(item)); base.enabled = true; }
    scheduleSave();
    refreshEditIframe(iframe);
    for (const input of [titleInput, linkInput, summaryInput, dateInput, timeInput, locationInput, deadlineInput]) input.value = '';
    imageCtl.set('');
    const sectionKey = sectionSelect.value;
    const label = SECTION_REGISTRY.find((r) => r.key === sectionKey)?.label;
    // The desk takes nothing without a web link.
    if (!deskSubmission(sectionKey, item)) { status.textContent = `Added to ${label}. Not sent to the desk: it has no link.`; return; }
    toDesk(item, sectionKey, label);
  } });

  body.append(
    field('Section', sectionSelect), groupField,
    field('Title', titleInput), field('Link', linkInput), field('Summary', summaryInput),
    ...eventFields, ...oppFields, imageField, addBtn, status,
  );
  syncExtras();
  return details;
}

/**
 * Wire up the click-to-edit listener and hover CSS in the iframe's contentDocument.
 * Called on every iframe 'load' event (re-fires on each srcdoc set).
 * @param {HTMLIFrameElement} iframe
 */
function wireIframeEditing(iframe) {
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Inject hover affordance CSS
  const style = doc.createElement('style');
  style.textContent = editHoverCss();
  (doc.head || doc.documentElement).appendChild(style);

  // Hover lights the whole item (the cell that holds it), since the click
  // opens the whole item in the drawer.
  let hoveredBlock = null;
  const clearHover = () => { if (hoveredBlock) hoveredBlock.classList.remove('ec-item-hover'); hoveredBlock = null; };
  doc.addEventListener('mouseover', (e) => {
    const cell = itemCellOf(e.target);
    if (cell === hoveredBlock) return;
    clearHover();
    if (cell) { cell.classList.add('ec-item-hover'); hoveredBlock = cell; }
  });
  doc.addEventListener('mouseleave', clearHover);

  // Click listener: open an editor for the whole item the clicked field
  // belongs to (all of its fields at once), not just the one piece clicked.
  doc.addEventListener('click', (e) => {
    // The look, chosen on the email itself (Kate, Oct 5): the callout and
    // any picture open a popover of swatches instead of a card.
    const submit = e.target.closest('a[href*="forms.office.com"]');
    const calloutCell = submit && submit.closest('td[style*="padding:26px 48px 28px 24px"], td[style*="padding:22px 24px 24px 24px"], td[style*="padding:20px 22px 22px 22px"]');
    if (calloutCell) {
      e.preventDefault();
      e.stopPropagation();
      tweakPopover(iframe, calloutCell, 'Submit your research callout', CALLOUT_CHOICES, layoutOf(state.issue).callout, (key) => { setCallout(state.issue, key); afterTweak(iframe); });
      return;
    }
    const picture = e.target.closest('img[data-edit-field="image"]');
    if (picture) {
      e.preventDefault();
      e.stopPropagation();
      const item = state.issue.sections?.[picture.dataset.editSection]?.items?.find((i) => i.id === picture.dataset.editItem);
      if (item) {
        const o = itemOptions(picture.dataset.editSection, item);
        tweakPopover(iframe, picture.closest('a') || picture, 'Picture', PICTURE_CHOICES, o.pictureStyle, (key) => { setPictureStyle(item, key); afterTweak(iframe); });
      }
      return;
    }

    const cell = itemCellOf(e.target);
    if (!cell) { closeMenu(); return; }
    if (e.target.closest('a')) e.preventDefault();   // the title is a link; the click edits, never navigates
    const { editSection: section, editItem: item } = cell.querySelector('[data-edit-field]').dataset;
    const refs = collectItemFields(doc, section, item);
    if (!refs.length) return;
    closeMenu();
    openItemEditor(refs, iframe);
    doc.querySelectorAll('.ec-item-open').forEach((n) => n.classList.remove('ec-item-open'));
    cell.classList.add('ec-item-open');
    revealAboveDrawer(iframe, cell);
  });
}

/** The cell that holds the item (or the intro) under a node, if any: the
 *  click target and the hover highlight are the whole item. */
function itemCellOf(node) {
  const cell = node.closest ? node.closest('td') : null;
  if (!cell) return null;
  const field = cell.querySelector('[data-edit-field="title"], [data-edit-field="intro"]');
  return field ? cell : null;
}

/**
 * Every editable node belonging to one item (or to one section-level field
 * group, when there is no item), in document order.
 * @param {Document} doc - the preview iframe's document
 * @param {string} section
 * @param {string|undefined} item
 * @returns {Array<HTMLElement>}
 */
function collectItemNodes(doc, section, item) {
  return item
    ? [...doc.querySelectorAll(
        `[data-edit-section="${section}"][data-edit-item="${item}"][data-edit-field]`
      )]
    : [...doc.querySelectorAll(`[data-edit-section="${section}"][data-edit-field]`)]
        .filter((n) => !n.dataset.editItem);
}

/** Briefly highlight the clicked item so its editor card is easy to connect. */
function flashItem(doc, section, item) {
  const els = collectItemNodes(doc, section, item);
  els.forEach((el) => el.classList.add('ec-edit-flash'));
  setTimeout(() => els.forEach((el) => el.classList.remove('ec-edit-flash')), 600);
}

/** Sections whose templates render an item picture (bullet lists don't). */
const IMAGE_SECTIONS = new Set(['research', 'spotlight', 'events', 'opportunities']);

/**
 * Gather every editable field belonging to one item (or one section-level
 * field group, when there is no item), in document order, de-duplicated.
 * @param {Document} doc - the preview iframe's document
 * @param {string} section
 * @param {string|undefined} item
 * @returns {Array<{ section: string, item?: string, field: string }>}
 */
function collectItemFields(doc, section, item) {
  const nodes = collectItemNodes(doc, section, item);

  const seen = new Set();
  const refs = [];
  for (const n of nodes) {
    const field = n.dataset.editField;
    if (!field || seen.has(field)) continue;
    seen.add(field);
    refs.push({ section, item, field });
  }
  // Titles render as hyperlinks, so expose the link URL for editing too
  // (right under the title). The url isn't its own visible element, so it
  // won't be picked up above; add it explicitly. Also lets you ADD a link
  // to an item that doesn't have one yet.
  if (seen.has('title') && !seen.has('url')) {
    const ti = refs.findIndex((r) => r.field === 'title');
    refs.splice(ti + 1, 0, { section, item, field: 'url' });
  }
  // Same move for the description and the picture: sections that render
  // them get the fields even when the email is not showing them (a hidden
  // description, no photo yet), so the card can always edit or add them.
  if (seen.has('title') && IMAGE_SECTIONS.has(section)) {
    if (!seen.has('summary')) refs.push({ section, item, field: 'summary' });
    if (!seen.has('image')) refs.push({ section, item, field: 'image' });
  }
  return refs;
}

/** The sub-label for every field the template hooks: the ten data-edit-field
 *  names, plus url, which collectItemFields adds under the title. */
const FIELD_LABELS = {
  title: 'Title',
  url: 'Link',
  meta: 'Details',
  summary: 'Description',
  authors: 'Authors',
  intro: 'Introduction',
  date: 'Date',
  time: 'Time',
  location: 'Location',
  image: 'Media',
};

/**
 * Converts a contentEditable's HTML back into the markdown we store, the
 * inverse of renderProse for the constructs the toolbar can produce:
 * bold (**), italic (*), links ([text](url)), and line breaks.
 */
function htmlToMarkdown(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const walk = (node) => {
    let md = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        md += n.nodeValue;
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const tag = n.tagName.toLowerCase();
        const inner = walk(n);
        if (tag === 'b' || tag === 'strong') md += inner.trim() ? `**${inner}**` : inner;
        else if (tag === 'i' || tag === 'em') md += inner.trim() ? `*${inner}*` : inner;
        else if (tag === 'a') md += `[${inner}](${n.getAttribute('href') || ''})`;
        else if (tag === 'br') md += '\n';
        else if (tag === 'div' || tag === 'p') md += (md && !md.endsWith('\n') ? '\n' : '') + inner;
        else md += inner;
      }
    });
    return md;
  };
  return walk(tmp).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * A small WYSIWYG editor for prose fields: a Bold / Italic / Link toolbar over a
 * contentEditable region. Renders stored markdown via renderProse and reports
 * changes back as markdown (via htmlToMarkdown). Returns a uniform field handle.
 * `labelledBy` names the sublabel that is the editor's accessible name.
 */
function buildRichEditor(initialMd, onChange, { labelledBy = '' } = {}) {
  const wrap = el('div', 'rich-editor');

  const editable = el('div', 'rich-editable');
  editable.contentEditable = 'true';
  editable.setAttribute('role', 'textbox');
  editable.setAttribute('aria-multiline', 'true');
  if (labelledBy) editable.setAttribute('aria-labelledby', labelledBy);
  editable.innerHTML = renderProse(initialMd || '');

  const emit = () => onChange(htmlToMarkdown(editable.innerHTML));

  const toolbar = el('div', 'rich-toolbar');
  const mkBtn = (content, title, onClick) => {
    const b = button('', 'rich-btn', { onClick });
    b.title = title;
    b.append(content);
    // mousedown-preventDefault keeps the text selection while clicking the button.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    return b;
  };
  // B and I: run the command, put the caret back, report the new markdown.
  const styled = (command) => () => { document.execCommand(command); editable.focus(); emit(); };
  const italicBtn = mkBtn('I', 'Italic', styled('italic'));
  italicBtn.style.fontStyle = 'italic';
  toolbar.appendChild(mkBtn('B', 'Bold', styled('bold')));
  toolbar.appendChild(italicBtn);

  // The link ask is a row under the toolbar, not window.prompt: it keeps
  // the selection, pre-fills from a link the caret sits in, adds https:// when
  // the scheme is missing, and Escape or Cancel puts it away.
  const linkRow = el('div', 'rich-link-row');
  linkRow.hidden = true;
  const linkInput = el('input', 'edit-card-input rich-link-input');
  linkInput.type = 'text';
  linkInput.placeholder = 'https://';
  linkInput.setAttribute('aria-label', 'Link address');
  const applyBtn = button('Apply', 'btn btn-primary rich-link-apply');
  const cancelLinkBtn = button('Cancel', 'ghost-btn ghost-btn--muted');
  linkRow.append(linkInput, applyBtn, cancelLinkBtn);

  let savedRange = null;
  let savedAnchor = null;
  const closeLinkRow = () => {
    linkRow.hidden = true;
    savedRange = null;
    savedAnchor = null;
    editable.focus();
  };
  const openLinkRow = () => {
    const sel = window.getSelection();
    const inEditor = sel && sel.rangeCount > 0 && editable.contains(sel.anchorNode);
    savedRange = inEditor ? sel.getRangeAt(0).cloneRange() : null;
    const node = savedRange ? savedRange.commonAncestorContainer : null;
    const host = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    savedAnchor = host && host.closest ? host.closest('a') : null;
    if (savedAnchor && !editable.contains(savedAnchor)) savedAnchor = null;
    linkInput.value = savedAnchor ? savedAnchor.getAttribute('href') || '' : '';
    linkRow.hidden = false;
    linkInput.focus();
    linkInput.select();
  };
  const applyLink = () => {
    const url = normalizeLinkUrl(linkInput.value);
    if (!url) { closeLinkRow(); return; }
    if (savedAnchor) {
      savedAnchor.setAttribute('href', url);
    } else if (savedRange) {
      editable.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
      if (savedRange.collapsed) {
        // Nothing selected: the address becomes the link's own text.
        const a = el('a', '', url);
        a.href = url;
        savedRange.insertNode(a);
        savedRange.setStartAfter(a);
        savedRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } else {
        document.execCommand('createLink', false, url);
      }
    }
    closeLinkRow();
    emit();
  };
  applyBtn.addEventListener('click', applyLink);
  cancelLinkBtn.addEventListener('click', closeLinkRow);
  linkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
  });
  linkRow.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeLinkRow(); }
  });

  const linkBtn = mkBtn(faIcon('link'), 'Add link', () => { if (linkRow.hidden) openLinkRow(); else closeLinkRow(); });
  linkBtn.setAttribute('aria-label', 'Add link');
  toolbar.appendChild(linkBtn);

  editable.addEventListener('input', emit);

  wrap.append(toolbar, linkRow, editable);
  return {
    el: wrap,
    setMd: (md) => { editable.innerHTML = renderProse(md || ''); },
    focus: () => editable.focus(),
  };
}

// ---------------------------------------------------------------------------
// The drawer (Kate, Oct 5): the one card, sliding up from the bottom
// ---------------------------------------------------------------------------

/** The floating box (Kate, Oct 5: "push to the right but in a smaller
 *  floating box"): one per visit to the step, in the column at the sheet's
 *  right, placed level with the item it edits. What it shows changes. */
function drawer() {
  const stage = document.querySelector('[data-step="edit"] .edit-layout--float');
  if (!stage) return null;
  let box = stage.querySelector('.edit-drawer');
  if (box) return box;
  box = el('div', 'edit-drawer');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Editing');
  box.appendChild(el('div', 'edit-drawer-inner'));
  stage.appendChild(box);
  return box;
}

/**
 * Puts a card in the box and shows it, level with `top` (px down the stage).
 * The box hovers over the sheet's right side, pushed outward so it covers
 * the margin more than the words (Kate, Oct 5: "hover above … but offskewed"),
 * and never past the window's edge.
 */
function openDrawer(card, top = 0) {
  const d = drawer();
  if (!d) return;
  d.querySelector('.edit-drawer-inner').replaceChildren(card);
  d.style.top = `${Math.max(0, Math.round(top))}px`;
  d.classList.add('is-open');
  const stage = d.parentElement;
  const sheet = stage.querySelector('.edit-preview-iframe')?.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  if (sheet) {
    const overlap = 200;   // how far the box reaches in over the sheet
    const wanted = sheet.right - sr.left - overlap;
    const most = window.innerWidth - 16 - d.offsetWidth - sr.left;
    d.style.left = `${Math.max(0, Math.round(Math.min(wanted, most)))}px`;
  }
}

/** Hides the box. Focus goes back to the stage so it never falls off the page. */
function closeDrawer() {
  const drawerEl = document.querySelector('[data-step="edit"] .edit-drawer');
  if (!drawerEl) return;
  drawerEl.classList.remove('is-open');
  drawerEl.querySelector('.edit-drawer-inner').replaceChildren();
  document.querySelectorAll('.edit-preview-iframe').forEach((f) => {
    f.contentDocument?.querySelectorAll('.ec-item-open').forEach((n) => n.classList.remove('ec-item-open'));
  });
  const note = document.querySelector('[data-step="edit"] .preview-note');
  if (note && !note.closest('[hidden]')) note.focus();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

/**
 * The card's shell: its name across the top with a close, the body the
 * caller fills, and the actions along the foot.
 * @returns {{ card: HTMLElement, body: HTMLElement, actions: HTMLElement }}
 */
function drawerCard(name) {
  const card = el('div', 'drawer-card');
  const head = el('div', 'drawer-card-head');
  head.appendChild(el('span', 'drawer-card-name', name));
  const closeBtn = button('', 'edit-card-close', { icon: 'xmark', onClick: closeDrawer });
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  const body = el('div', 'drawer-card-body');
  const actions = el('div', 'edit-card-actions drawer-card-actions');
  card.append(head, body, actions);
  return { card, body, actions };
}

/**
 * One wireframe: the item drawn small in one of its layouts. A title bar, a
 * meta line, text lines, and the picture as a block where the layout has one
 * (dashed when the item has no photo yet).
 */
function wireframeEl(key, hasPic) {
  const w = el('span', 'wire-draw');
  const col = (...kids) => { const c = el('span', 'wire-col'); c.append(...kids); return c; };
  const bar = (cls, width) => { const b = el('span', cls); b.style.width = width; return b; };
  const lines = (n) => Array.from({ length: n }, () => bar('wire-l', '100%'));
  const pic = (wpx, hpx) => { const p = el('span', 'wire-pic' + (hasPic ? '' : ' is-empty')); p.style.width = `${wpx}px`; p.style.height = `${hpx}px`; return p; };
  if (key === 'bare') w.append(col(bar('wire-t', '80%'), bar('wire-m', '55%')));
  else if (key === 'text') w.append(col(bar('wire-t', '80%'), bar('wire-m', '55%'), ...lines(3)));
  else if (key === 'stamp') {
    const beside = el('span', 'wire-beside');
    beside.append(pic(18, 22), col(...lines(3)));
    w.append(col(bar('wire-t', '80%'), bar('wire-m', '55%'), beside));
  } else w.append(pic(28, 36), col(bar('wire-t', '90%'), bar('wire-m', '60%'), ...lines(2)));
  return w;
}

/** The row of wireframes for an item: pick one and the email redraws. */
function wireframeRow(sectionKey, item, onPick) {
  const row = el('div', 'wires');
  row.setAttribute('role', 'radiogroup');
  row.setAttribute('aria-label', 'How it is laid out');
  const hasPic = !!String(item.fields?.image ?? '').trim();
  for (const l of itemLayouts(sectionKey, item)) {
    const b = button('', 'wire' + (l.on ? ' is-on' : '') + (l.dim ? ' is-dim' : ''));
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(l.on));
    if (l.dim) b.title = 'A placeholder until a photo is added, under Media';
    b.append(wireframeEl(l.key, hasPic), el('span', 'wire-label', l.label));
    b.addEventListener('click', () => {
      l.apply();
      onPick();
      if (l.dim) setWizardStatus('The email shows a placeholder until a photo is added, under Media.');
    });
    row.appendChild(b);
  }
  return row;
}

/**
 * Open the card for a whole item (or the introduction) in the drawer: how it
 * is laid out, then its words. Typing updates the email live; Save closes.
 * @param {Array<{section:string,item?:string,field:string}>} refs
 * @param {HTMLIFrameElement} iframe
 */
function openItemEditor(refs, iframe) {
  const first = refs[0];
  const cardItem = first.item ? state.issue.sections?.[first.section]?.items?.find((i) => i.id === first.item) : null;
  const name = cardItem ? (cardItem.fields?.title || '(untitled)') : FIELD_LABELS[first.field];
  const { card, body, actions } = drawerCard(name);
  card.setAttribute('aria-label', name);

  // Live preview re-render, debounced so typing doesn't thrash the iframe.
  const debouncedPreview = debounce(() => refreshEditIframe(iframe), 350);

  // The look, first: the item drawn in each layout it can take.
  let lookCol = null;
  const drawLook = () => {
    if (!cardItem || !lookCol) return;
    lookCol.replaceChildren(el('h4', 'drawer-h4', 'How it is laid out'));
    lookCol.appendChild(wireframeRow(first.section, cardItem, () => { scheduleSave(); refreshEditIframe(iframe); drawLook(); }));
  };
  if (cardItem && IMAGE_SECTIONS.has(first.section)) {
    lookCol = el('div', 'drawer-look');
    body.appendChild(lookCol);
    drawLook();
  }

  const fieldsCol = el('div', 'drawer-fields');
  fieldsCol.appendChild(el('h4', 'drawer-h4', cardItem ? 'Its words' : 'The words'));
  body.appendChild(fieldsCol);

  const fieldInputs = [];
  for (const ref of refs) {
    const group = el('div', 'edit-card-group');
    const isLong = ref.field === 'summary' || ref.field === 'intro';
    editFieldSeq += 1;
    const fieldId = `edit-field-${editFieldSeq}`;
    const sub = el(ref.field === 'image' || isLong ? 'span' : 'label', 'edit-card-sublabel', FIELD_LABELS[ref.field]);
    sub.id = `${fieldId}-label`;
    group.appendChild(sub);

    const onEdit = (value) => {
      setField(state.issue, ref, value);
      scheduleSave();
      debouncedPreview();
    };

    let ctl;
    if (ref.field === 'image') {
      // A photo added here lights the picture wireframes.
      ctl = buildImageControl(getField(state.issue, ref) ?? '', (value) => { onEdit(value); drawLook(); });
      ctl.el.setAttribute('role', 'group');
      ctl.el.setAttribute('aria-labelledby', sub.id);
    } else if (isLong) {
      const rich = buildRichEditor(getField(state.issue, ref) ?? '', onEdit, { labelledBy: sub.id });
      ctl = { el: rich.el, set: rich.setMd, focus: rich.focus };
    } else {
      const inputEl = el('input', 'edit-card-input');
      inputEl.type = 'text';
      inputEl.id = fieldId;
      sub.htmlFor = fieldId;
      inputEl.value = getField(state.issue, ref) ?? '';
      inputEl.addEventListener('input', () => onEdit(inputEl.value));
      ctl = { el: inputEl, set: (v) => { inputEl.value = v; }, focus: () => inputEl.focus() };
    }
    group.appendChild(ctl.el);
    fieldsCol.appendChild(group);
    fieldInputs.push({ ref, set: ctl.set, focus: ctl.focus });
  }

  // What the fields held when the card opened, for Cancel.
  const opened = fieldInputs.map((f) => ({ ref: f.ref, value: getField(state.issue, f.ref) ?? '' }));

  const itemId = first.item;
  if (itemId) {
    actions.appendChild(button(' Remove', 'ghost-btn ghost-btn--danger edit-card-delete', { icon: 'trash-can', onClick: (e) => {
      closeDrawer();
      deleteItemWithUndo(itemId, renderEdit, e.detail === 0);
    } }));
  }
  const revertBtn = button(' Use original', 'ghost-btn ghost-btn--muted', { icon: 'rotate-left', onClick: () => {
    let reverted = 0;
    for (const f of fieldInputs) {
      const original = getField(state.baseline, f.ref);
      if (original === undefined || original === null) continue;
      f.set(original);
      setField(state.issue, f.ref, original);
      reverted += 1;
    }
    if (!reverted) return;
    scheduleSave();
    refreshEditIframe(iframe);
    drawLook();
  } });
  const cancelBtn = button('Cancel', 'ghost-btn ghost-btn--muted', { onClick: () => {
    let changed = false;
    opened.forEach(({ ref, value }, i) => {
      if ((getField(state.issue, ref) ?? '') === value) return;
      setField(state.issue, ref, value);
      fieldInputs[i].set(value);
      changed = true;
    });
    if (changed) { scheduleSave(); refreshEditIframe(iframe); }
    closeDrawer();
  } });
  // Edits are live, so Save is the word that closes the drawer.
  const saveBtn = button('Save', 'btn btn-primary edit-card-save', { onClick: closeDrawer });
  actions.append(revertBtn, cancelBtn, saveBtn);

  openDrawer(card);
  requestAnimationFrame(() => fieldInputs[0] && fieldInputs[0].focus());
}

/**
 * The item's block in the preview: the cell that holds its title (or the
 * intro's cell). Hover and the open state light the whole block, since the
 * click opens the whole item.
 */
function blockOf(doc, section, item) {
  const node = item
    ? doc.querySelector(`[data-edit-section="${section}"][data-edit-item="${item}"][data-edit-field="title"]`)
    : doc.querySelector(`[data-edit-section="${section}"][data-edit-field="intro"]`);
  return node ? node.closest('td') : null;
}

/** Where a box should sit to be level with `pageTop` (px from the page top): its offset down the stage. */
function columnOffset(pageTop) {
  const stage = document.querySelector('[data-step="edit"] .edit-layout--float');
  if (!stage) return 0;
  return pageTop - (stage.getBoundingClientRect().top + window.scrollY);
}

/** Puts the box level with the item's block, and brings the item on screen if it is not. */
function revealAboveDrawer(iframe, block) {
  if (!block) return;
  const zoom = parseFloat(iframe.style.zoom) || 1;
  const outer = iframe.getBoundingClientRect();
  const r = block.getBoundingClientRect();
  const top = outer.top + r.top * zoom;
  const box = document.querySelector('[data-step="edit"] .edit-drawer');
  if (box) box.style.top = `${Math.max(0, Math.round(columnOffset(top + window.scrollY)))}px`;
  if (top < 72 || top > window.innerHeight - 160) window.scrollBy({ top: top - 96, behavior: 'smooth' });
}

/**
 * The drawer's other cards: the introduction, the layout, and Add an item,
 * from the buttons over the stage. Each reuses its fold, opened flat.
 */
function openPanelInDrawer(title, details) {
  const { card, body, actions } = drawerCard(title);
  details.open = true;
  body.appendChild(details);
  actions.appendChild(button('Done', 'btn btn-primary', { onClick: closeDrawer }));
  // Level with the top of the window, wherever the page is scrolled to.
  openDrawer(card, columnOffset(window.scrollY + 72));
  requestAnimationFrame(() => firstField(card)?.focus());
}

/**
 * Render the edit step: large full-width editable-mode preview iframe.
 * The editable HTML has data-edit-* hooks for click-to-edit.
 * Called each time the wizard navigates to 'edit'.
 */
/**
 * A row of swatches, one on: each is a small drawing of the result, with its
 * word under it. `choices` are {key, label}; `swKey` maps a key to its drawing.
 */
function swatchRow(choices, current, onPick) {
  const row = el('div', 'swatch-row');
  row.setAttribute('role', 'radiogroup');
  for (const c of choices) {
    const drawing = c.key === 'none' && choices === PICTURE_CHOICES ? 'nopic' : c.key;
    const b = button('', `swatch sw-${drawing}` + (c.key === current ? ' is-on' : ''));
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(c.key === current));
    b.append(el('span', 'pic'), el('span', '', c.label));
    b.addEventListener('click', () => onPick(c.key));
    row.appendChild(b);
  }
  return row;
}

/**
 * The popover of swatches beside something clicked in the preview: its
 * rectangle is read inside the iframe and mapped out through the iframe's
 * zoom, so the card lands next to the thing on the page.
 */
function tweakPopover(iframe, target, title, choices, current, onPick) {
  const zoom = parseFloat(iframe.style.zoom) || 1;
  const outer = iframe.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const rect = { left: outer.left + r.left * zoom, right: outer.left + r.right * zoom, top: outer.top + r.top * zoom, bottom: outer.top + r.bottom * zoom };
  target.classList.add('ec-edit-flash');
  setTimeout(() => target.classList.remove('ec-edit-flash'), 600);
  showMenu(target, 'tweak-pop', (menu) => {
    menu.appendChild(el('span', 'tweak-pop-title', title));
    menu.appendChild(swatchRow(choices, current, (key) => { onPick(key); closeMenu(); }));
  }, rect);
}

/** After a choice made on the email: save, redraw, and keep the rail's Layout fold in step. */
function afterTweak(iframe) {
  scheduleSave();
  refreshEditIframe(iframe);
  document.querySelector('.layout-panel-body')?.dispatchEvent(new CustomEvent('layout-changed'));
}

/**
 * The rail's Layout fold: the callout's style as swatches (also reachable by
 * clicking the callout in the email), the contents strip, and Reset. Here
 * because a callout set to None cannot be clicked back on the email.
 */
function buildLayoutPanel(iframe) {
  const { details, body } = railPanel('Layout');
  body.classList.add('layout-panel-body');
  const draw = () => {
    body.replaceChildren();
    const issue = state.issue;
    const callout = el('div', 'layout-row');
    callout.appendChild(el('span', 'layout-row-label', 'Submit your research callout'));
    callout.appendChild(swatchRow(CALLOUT_CHOICES, layoutOf(issue).callout, (key) => { setCallout(issue, key); scheduleSave(); refreshEditIframe(iframe); draw(); }));
    body.appendChild(callout);
    const nav = el('label', 'layout-check');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = layoutOf(issue).nav;
    cb.addEventListener('change', () => { setNav(issue, cb.checked); scheduleSave(); refreshEditIframe(iframe); draw(); });
    nav.append(cb, ' Contents strip under the masthead');
    body.appendChild(nav);
    body.appendChild(el('p', 'triage-section-note', 'Click the callout or any picture in the email to change it there. Descriptions show or hide from their card.'));
    if (hasCustomOptions(issue)) {
      const reset = button(' Reset layout options', 'ghost-btn ghost-btn--muted layout-reset', { icon: 'rotate-left', onClick: () => { resetOptions(issue); scheduleSave(); refreshEditIframe(iframe); draw(); } });
      reset.title = 'Every layout option back to its default';
      body.appendChild(reset);
    }
  };
  body.addEventListener('layout-changed', draw);
  draw();
  return details;
}

function renderEdit() {
  closeDrawer();
  const container = openStep('edit', 'Check the issue and tweak anything in place.',
    'Click any item in the email and its card opens beside it: how it is laid out, then its words. Click the Submit callout or a picture to change it on the spot. The introduction, the layout and Add an item open from the buttons over the email.');

  if (!state.issue) {
    emptyLine(container, 'No issue loaded. Pull from the desk on the Review step first.');
    return;
  }

  const iframe = el('iframe', 'edit-preview-iframe');
  iframe.setAttribute('title', 'Newsletter preview: click an item to edit it');
  iframe.setAttribute('scrolling', 'no');
  iframe.addEventListener('load', () => {
    wireIframeEditing(iframe);
    fitPreview();
    requestAnimationFrame(fitPreview);
    const doc = iframe.contentDocument;
    if (doc) {
      [...doc.images].forEach((img) => {
        if (!img.complete) img.addEventListener('load', fitPreview, { once: true });
      });
    }
  });

  // Over the stage: what the sheet is, and the three doors that are not an item.
  const toolbar = el('div', 'edit-toolbar');
  const previewNote = el('p', 'preview-note');
  previewNote.tabIndex = -1;   // where focus lands when the drawer closes
  previewNote.textContent = `Preview at ${Math.round(PREVIEW_MAX_SCALE * 100)} percent, as it lands in Outlook. Click any item to edit it.`;
  const doors = el('div', 'edit-doors');
  doors.append(
    button(' Introduction', 'ghost-btn', { icon: 'align-left', onClick: () => openPanelInDrawer('Introduction', buildIntroPanel(iframe)) }),
    button(' Layout', 'ghost-btn', { icon: 'table-columns', onClick: () => openPanelInDrawer('Layout', buildLayoutPanel(iframe)) }),
    button(' Add an item', 'ghost-btn', { icon: 'plus', onClick: () => openPanelInDrawer('Add an item', buildAddItemPanel(iframe)) }),
  );
  toolbar.append(previewNote, doors);
  container.appendChild(toolbar);

  // What Remove took out on this visit waits here, greyed with its own Undo,
  // until the step is left; the preview already goes without it.
  const waiting = waitingRemovals();
  if (waiting.length) {
    const bar = el('div', 'edit-removed-bar');
    bar.append(...waiting.map((w) => removedRow(w.item, 'edit-removed-row', renderEdit)));
    container.appendChild(bar);
  }

  const layout = el('div', 'edit-layout edit-layout--float');
  const wrap = el('div', 'edit-preview-wrap');
  wrap.appendChild(iframe);
  // The box hovers over the stage, level with the item it edits; see openDrawer.
  layout.appendChild(wrap);
  container.appendChild(layout);
  iframe.srcdoc = renderNewsletter(state.issue, { editable: true });
}

// ---------------------------------------------------------------------------
// Export step
// ---------------------------------------------------------------------------

/**
 * Show a toast message in `container`. A success is a polite status that
 * fades after `duration` ms; an error is an alert that stays until the next
 * click on the export row or the next toast.
 * @param {HTMLElement} container
 * @param {string} message
 * @param {'success'|'error'} [type='success']
 * @param {number} [duration=2800]
 */
function showExportToast(container, message, type = 'success', duration = 2800) {
  // Remove any existing toast
  const existing = container.querySelector('.export-toast');
  if (existing) existing.remove();

  const toast = el('div', `export-toast export-toast--${type}`);
  if (type === 'error') toast.setAttribute('role', 'alert');
  else { toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); }
  // Use textContent, never innerHTML, for user-derived or code-derived messages
  toast.append(noteIcon(type === 'error' ? 'circle-exclamation' : 'circle-check'), el('span', '', message));
  container.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => toast.classList.add('export-toast--visible'));

  if (type === 'error') return;
  setTimeout(() => {
    toast.classList.remove('export-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

/**
 * Copy the rendered newsletter HTML to the clipboard.
 * Falls back to a hidden textarea + execCommand if the Clipboard API is unavailable.
 * @param {HTMLElement} container - the export step, where the toast lands
 */
function copyHtml(container) {
  const html = renderNewsletter(state.issue);

  const onSuccess = () => showExportToast(container, 'Copied.', 'success');
  const onError = (err) => {
    console.error('[export] copyHtml failed:', err);
    showExportToast(container, 'Copy failed. Check browser permissions.', 'error');
  };
  // The old way: for a browser with no Clipboard API, and for one that refused.
  const legacy = (err) => {
    try { fallbackCopy(html); onSuccess(); } catch (e) { onError(err || e); }
  };

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(html).then(onSuccess, legacy);
  } else {
    legacy();
  }
}

/**
 * Fallback copy using a hidden textarea + document.execCommand('copy').
 * @param {string} text
 */
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('execCommand copy returned false');
}

/**
 * Download the rendered newsletter as an .html file: a temporary object URL
 * behind a hidden <a download>, revoked once the browser has the file.
 * @param {HTMLElement} container - the export step, where the toast lands
 */
function downloadHtml(container) {
  const date = String(state.issue.date ?? '').trim();
  const slug = date ? date.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'newsletter';
  const url = URL.createObjectURL(new Blob([renderNewsletter(state.issue)], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `ERC_Newsletter_${slug}.html`;
  a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick to let the browser start the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
  showExportToast(container, 'Downloaded.', 'success');
}

/**
 * Render the export step UI.
 * Called each time the wizard navigates to 'export'.
 */
function renderExport() {
  const container = openStep('export', 'Copy the issue into Outlook, then archive it.',
    'Copy the HTML for Outlook, save the issue to the archive, or download the file.');

  // Nothing to export yet: one plain sentence, no buttons.
  if (!state.issue || !countIssueItems(state.issue)) {
    emptyLine(container, 'Nothing to export yet. Pull from the desk on the Review step first.');
    return;
  }

  // Button row. An error toast has no timeout; the next click on the row
  // clears it (in the capture phase, so a button's own new toast survives).
  const btnRow = el('div', 'export-btn-row');
  btnRow.addEventListener('click', () => {
    const err = container.querySelector('.export-toast--error');
    if (err) err.remove();
  }, true);

  // Copy HTML: the step's one primary, with its icon in the slot.
  const copyBtn = button('Copy HTML', 'btn btn-primary export-action-btn', { onClick: () => copyHtml(container) });
  copyBtn.append(faIcon('copy'));

  // Download .html
  const dlHtmlBtn = button('Download .html', 'btn btn-secondary export-action-btn', { onClick: () => downloadHtml(container) });

  // Save to the archive: commits the issue's HTML through the desk, so it
  // shows up under Past newsletters for good. The archive write replaces an
  // earlier save, so the index is read on entry: a date already there
  // gets one ask in the button's place before anything is written; a new
  // date saves on the click. An unreadable index falls back to the plain
  // button.
  const archiveSlot = el('span', 'archive-slot');
  const archiveBtn = button('Save to the archive', 'btn btn-secondary export-action-btn');
  archiveSlot.appendChild(archiveBtn);
  const indexReady = fetch('/builder/newsletters/index.json', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  let savedThisVisit = null;   // a save on this visit puts the date in the archive; the next click asks

  // After the save: a note that stays, with the way to the archive and the way on.
  const after = el('div', 'export-after');

  const saveToArchive = async (iso) => {
    archiveSlot.replaceChildren();   // the button (or the ask) is gone while saving; no double-clicks
    const saveStatus = el('span', 'pull-status');
    saveStatus.append(busyWords('Saving…'));
    archiveSlot.appendChild(saveStatus);
    try {
      const data = await postJson('/api/newsletter-archive',
        { issueDate: iso, html: renderNewsletter(state.issue) }, 'save to the archive');
      // The issue went out: stamped, so a later visit's banner says so.
      state.issue.sentAt = new Date().toISOString();
      saveState(state.issue);
      savedThisVisit = { date: iso, label: isoToDisplayDate(iso) };
      const note = inlineNote('success', data.replaced ? 'Saved to the archive, replacing the earlier save.' : 'Saved to the archive.');
      const open = el('a', '', 'Open Past issues');
      open.href = '/#past';
      note.append(open);
      const next = button('Start the next issue', 'btn btn-tertiary', { onClick: startNextIssue });
      next.append(faIcon('arrow-right'));
      after.replaceChildren(note, next);
    } catch (err) {
      showExportToast(container, plainError(err), 'error');
    } finally {
      archiveSlot.replaceChildren(archiveBtn);
    }
  };

  archiveBtn.addEventListener('click', async () => {
    const iso = displayDateToISO(state.issue?.date || '');
    if (!iso) { showExportToast(container, 'Pick the issue on Review first.', 'error'); return; }
    const entry = archivedEntry(await indexReady, iso) ?? (savedThisVisit?.date === iso ? savedThisVisit : null);
    if (!entry) { saveToArchive(iso); return; }
    // First click asks; the ask's Confirm does the work (the desk's Publish shape).
    const ask = inlineNote('warning', archiveAskMessage(entry));
    ask.classList.add('archive-ask');
    ask.removeAttribute('aria-live');
    const ok = ghostButton('Confirm');
    ok.classList.add('ask-confirm');
    ok.addEventListener('click', () => saveToArchive(iso));
    const no = ghostButton('Cancel');
    no.addEventListener('click', () => { archiveSlot.replaceChildren(archiveBtn); archiveBtn.focus(); });
    ask.append(ok, ' · ', no);
    archiveSlot.replaceChildren(ask);
    queueMicrotask(() => ok.focus({ preventScroll: true }));
  });

  btnRow.append(copyBtn, archiveSlot, dlHtmlBtn);
  container.append(btnRow, after);
}

/** The way on after an issue is archived: storage cleared, back to Review for the next one. */
function startNextIssue() {
  clearState();
  state.issue = null;
  state.baseline = null;
  state.reached = 0;
  pullMessage = '';
  goTo('review');
}

// ---------------------------------------------------------------------------
// Boot: restore prompt
// ---------------------------------------------------------------------------

/**
 * Make a saved draft the builder's current issue: the banner's Restore and
 * Recently discarded's alike. Kept in storage, and on to the Outline when it
 * holds items; one without stays on Review.
 * @param {object} issue
 */
function openDraft(issue) {
  state.issue = issue;
  state.baseline = structuredClone(issue);
  state.reached = 0;
  pullMessage = '';
  saveState(issue);
  goTo(countIssueItems(issue) ? 'triage' : 'review');
}

/** A failure's own words, without the "try again" a Try again or Retry button beside them already says. */
function reasonOf(err) {
  return plainError(err).replace(/\s*Try again in a (minute|moment)\.$/, '');
}

/**
 * The restore banner: shown when a saved issue exists in localStorage. It
 * sits above the step sections, not inside one, so a redraw of Review never
 * removes it; while it asks, nothing writes storage and the Issue select,
 * Pull and Recently discarded's Restore are locked. Restore sets state.issue
 * and moves on; Discard keeps the draft on the desk (Sep 23), then clears it.
 * @param {object} saved - the issue loaded from storage
 */
function showRestoreBanner(saved) {
  const home = document.querySelector('.wizard-body');
  if (!home) return;
  document.getElementById('restore-banner')?.remove();
  restorePending = true;

  const banner = el('div', 'restore-banner');
  banner.id = 'restore-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Restore in-progress newsletter');

  const msg = el('p', 'restore-banner__msg');
  msg.append(noteIcon('triangle-exclamation'), restoreBannerMessage(saved));   // names the date and the count

  const btnRow = el('div', 'restore-banner__btns');

  const settle = () => {
    restorePending = false;
    banner.remove();
  };

  const restoreBtn = button('Restore', 'btn btn-primary restore-banner__btn', { onClick: () => {
    settle();
    openDraft(saved);
  } });

  // Discard sends the draft to the desk, which keeps it 90 days, and only then
  // clears it here (Kate, Sep 23); Review's Recently discarded is the way back.
  // A send that fails discards nothing and says so here, with Try again.
  const discard = async (fromKeyboard) => {
    restoreBtn.hidden = true;   // in flight: the banner's buttons go, nothing to press twice
    discardBtn.hidden = true;
    msg.classList.remove('restore-banner__msg--error');
    msg.removeAttribute('role');
    msg.replaceChildren(noteIcon('triangle-exclamation'), busyWords('Discarding…'));
    try {
      const reply = await discardToDesk(saved, {
        send: (body) => postJson('/api/drafts', body, 'keep the draft'),
        clear: clearState,
      });
      settle();
      discarded = withEntry(discarded, reply.draft);
      focusDiscarded = fromKeyboard ? reply.draft.id : null;
      if (state.step === 'review') renderReview();   // unlocks the Issue select and Pull; the list leads with it
      setWizardStatus('Discarded. Recently discarded keeps it for 90 days.');
    } catch (err) {
      const retry = ghostButton('Try again');
      retry.addEventListener('click', (e) => discard(e.detail === 0));
      msg.classList.add('restore-banner__msg--error');
      msg.setAttribute('role', 'alert');
      msg.replaceChildren(noteIcon('circle-exclamation'), `Not discarded. ${reasonOf(err)} `, retry);
      restoreBtn.hidden = false;   // the draft is still here to restore
      if (fromKeyboard) retry.focus();
    }
  };
  const discardBtn = button('Discard', 'btn btn-secondary restore-banner__btn', { onClick: (e) => discard(e.detail === 0) });

  btnRow.append(restoreBtn, discardBtn);
  banner.append(msg, btnRow);
  home.insertBefore(banner, home.firstChild);
}

// ---------------------------------------------------------------------------
// Review: Recently discarded (Kate, Sep 23)
// ---------------------------------------------------------------------------

/** The list as the desk last gave it, newest first: null until it has loaded once. */
let discarded = null;
/** Counts Review's draws, so an answer that comes back late never draws into a page that has moved on. */
let discardedDraw = 0;
/** A draft just discarded from the keyboard: its Restore takes focus when the list draws. */
let focusDiscarded = null;

/** The desk's /api/drafts: one draft, or its removal. */
const draftUrl = (id) => `/api/drafts?id=${encodeURIComponent(id)}`;

/** A quiet line for what didn't load or go through: the error's icon, its words, Retry. Never an alert. */
function quietError(words, onRetry) {
  const line = el('p', 'discarded-error');
  line.setAttribute('role', 'status');
  const retry = ghostButton('Retry');
  retry.addEventListener('click', onRetry);
  line.append(noteIcon('circle-exclamation'), `${words} `, retry);
  return line;
}

/**
 * One kept draft: its issue, what it holds and when it went, and Restore.
 * Restore asks first, in one line, when a draft is open here; then takes the
 * draft off the desk and opens it the way the banner's Restore does.
 */
function discardedRow(entry) {
  const row = el('li', 'discarded-row');
  const what = el('div', 'discarded-what');
  what.id = `discarded-${entry.id}`;
  what.append(el('span', 'discarded-title', discardedTitle(entry)), el('span', 'discarded-sub', discardedDetail(entry)));
  // Restore, the ask, or the wait, one at a time in the same place.
  const slot = el('div', 'discarded-act');
  const restore = ghostButton('Restore');
  restore.dataset.draft = entry.id;
  restore.setAttribute('aria-describedby', what.id);
  restore.disabled = restorePending;   // the banner asks first
  slot.append(restore);
  row.append(what, slot);

  const back = () => { slot.replaceChildren(restore); };
  const go = async () => {
    row.querySelector('.discarded-error')?.remove();
    const wait = el('span', 'pull-status');
    wait.append(busyWords('Restoring…'));
    slot.replaceChildren(wait);
    try {
      // The open draft, if any, is kept like a Discard before it is replaced (Kate, Sep 23).
      const { body, kept } = await restoreOver(draftIsOpen(state.issue) ? state.issue : null, entry.id, {
        fetchDraft: async (id) => (await readReply(await fetch(draftUrl(id)), 'restore that draft')).draft,
        keep: (issue) => discardToDesk(issue, { send: (b) => postJson('/api/drafts', b, 'keep the open draft'), clear: clearState }),
        remove: async (id) => readReply(await fetch(draftUrl(id), { method: 'DELETE' }), 'restore that draft'),
      });
      discarded = withoutEntry(discarded, entry.id);
      if (kept?.draft) discarded = withEntry(discarded, kept.draft);
      openDraft(body);
    } catch (err) {
      back();
      row.append(quietError(`Couldn't restore it. ${reasonOf(err)}`, go));
      restore.focus({ preventScroll: true });
    }
  };
  restore.addEventListener('click', () => {
    if (!draftIsOpen(state.issue)) { go(); return; }
    // The archive ask's shape: a warning note in the button's place, Confirm or Cancel.
    const ask = inlineNote('warning', replaceAskMessage(state.issue));
    ask.classList.add('discarded-ask');
    ask.removeAttribute('aria-live');
    const ok = ghostButton('Confirm');
    ok.classList.add('ask-confirm');
    ok.addEventListener('click', go);
    const no = ghostButton('Cancel');
    no.addEventListener('click', () => { back(); restore.focus(); });
    ask.append(ok, ' · ', no);
    slot.replaceChildren(ask);
    queueMicrotask(() => ok.focus({ preventScroll: true }));
  });
  return row;
}

/**
 * Review's Recently discarded list: what Discard kept on the desk, newest
 * first, each with Restore. Called once from renderReview, before its last
 * part draws; the list joins the step after everything else. Nothing at all
 * while it is empty; the last list known shows at once and the desk's answer
 * replaces it; a list that can't load is a quiet line with Retry that holds
 * nothing else up.
 * @param {HTMLElement} container - the Review step
 */
function renderDiscardedDrafts(container) {
  const draw = ++discardedDraw;
  const current = () => draw === discardedDraw;
  const slot = el('div', 'discarded-slot');
  queueMicrotask(() => { if (current()) container.append(slot); });

  const show = () => {
    const list = discarded ?? [];
    const was = slot.querySelector('.discarded');
    // A redraw keeps the keyboard on the same draft's Restore.
    const keep = was?.contains(document.activeElement) ? document.activeElement.dataset.draft : null;
    was?.remove();
    if (!list.length) return;
    const box = el('section', 'discarded');
    box.setAttribute('aria-labelledby', 'discarded-head');
    const head = el('h3', 'discarded-head', 'Recently discarded');
    head.id = 'discarded-head';
    const rows = el('ul', 'discarded-list');
    rows.append(...list.map(discardedRow));
    box.append(head, rows);
    slot.prepend(box);
    const focusId = focusDiscarded ?? keep;
    focusDiscarded = null;
    if (focusId) {
      const target = box.querySelector(`[data-draft="${CSS.escape(focusId)}"]`);
      queueMicrotask(() => target?.focus());
    }
  };
  const load = async () => {
    slot.querySelector('.discarded-error')?.remove();
    try {
      const data = await readReply(await fetch('/api/drafts'), 'load the discarded drafts');
      const fresh = data.drafts ?? [];
      // The list drawn from memory stays when the desk agrees, so an open ask survives the answer.
      const same = JSON.stringify(fresh) === JSON.stringify(discarded);
      discarded = fresh;
      if (current() && !(same && slot.querySelector('.discarded'))) show();
    } catch (err) {
      if (current()) slot.append(quietError(`Recently discarded: ${reasonOf(err)}`, load));
    }
  };
  if (discarded) show();
  load();
}

// The desk's top bar: the builder crumbs under Newsletter.
renderShell(document.querySelector('.topbar'), { screen: 'builder' });
// A saved issue locks Review before it is drawn, so the first render already knows.
const savedIssue = loadState();
restorePending = Boolean(savedIssue);
goTo('review');
if (savedIssue) showRestoreBanner(savedIssue);
