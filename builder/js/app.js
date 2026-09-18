/**
 * app.js: ERC Newsletter Builder wizard shell
 *
 * Holds wizard state and step navigation, and renders the four steps. The
 * pure logic lives in model.js, template.js, editpath.js and preview.js.
 */

import { SECTION_REGISTRY, createEmptyIssue, mergeIssues, deleteItem, insertItem, partitionPulled, countIssueItems, splitSections, bucketSectionItems, moveWithinBucket } from './model.js';

// The builder lives INSIDE the desk's project (/builder/), so the desk's API
// is same-origin: relative fetches, no CORS.
let pullMessage = ''; // survives the Review re-render after a pull
import { renderNewsletter, renderProse } from './template.js';
import { faIcon, dotsLoader, loadingLabel } from '../../js/icons.js';
import { el, button } from '../../js/ui-aids.js';
import { buildImageControl } from '../../js/item-image.js';
import { readReply, postJson, plainError } from '../../js/sheet-client.js';
import { saveState, loadState, clearState } from './state.js';
import { getField, setField } from './editpath.js';
import { computePreviewScale } from './preview.js';
import { renderSidebar } from '../../js/sidebar-ui.js';
import { STEPS, canEnterStep, LOCKED_STEP_MESSAGE, restoreBannerMessage, stepState, archivedEntry, archiveAskMessage, isoToDisplayDate, displayDateToISO } from './wizard.js';
import { arrowKeyTarget, normalizeLinkUrl, reorderRowName, movedAnnouncement } from './editing.js';

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

  // Fill the dropdown from the desk: scheduled dates plus anything staged.
  async function loadSchedule() {
    scheduleNote.replaceChildren();
    if (!currentIso) placeholder.textContent = 'Loading issues…';
    try {
      const data = await readReply(await fetch('/api/newsletter-pull'), 'load the issues');
      const dates = [...new Set([...(data.schedule ?? []), ...Object.keys(data.staged ?? {})])].sort();
      if (!dates.length) { placeholder.textContent = currentIso ? isoToDisplayDate(currentIso) : 'No issues scheduled on the desk'; return; }
      // The saved issue may have dropped off the desk's schedule; it still belongs in the list.
      const isos = currentIso && !dates.includes(currentIso) ? [...dates, currentIso] : dates;
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
    if (busy && msg) pullStatus.replaceChildren(dotsLoader(true), loadingLabel(msg));
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
 * Delete one item from the issue, with a transient Undo toast. Shared by the
 * Outline row's Remove and the Preview & Edit card's Remove. `rerender` rebuilds
 * whichever step is showing so the removal (and any undo) is reflected at once.
 * `fromKeyboard` (a click with detail 0) hands focus to the toast's Undo.
 */
let _undoToastTimer = null;
function deleteItemWithUndo(itemId, rerender, fromKeyboard = false) {
  const removed = deleteItem(state.issue, itemId);
  if (!removed) return;
  scheduleSave();
  rerender();
  const title = (removed.item.fields && removed.item.fields.title) || 'item';
  showUndoToast(`Removed “${title}”`, () => {
    insertItem(state.issue, removed.sectionKey, removed.index, removed.item);
    scheduleSave();
    rerender();
  }, { focusUndo: fromKeyboard });
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
function renderTriage() {
  const container = openStep('triage', 'Put the issue in order.',
    'Put the items in order with the arrows, mark one event Featured, and switch the Submit your research callout on or off. The issue builds in this order.');

  const issue = state.issue;

  // Nothing pulled yet: one line, and no empty section list to puzzle over.
  if (!issue || !countIssueItems(issue)) {
    emptyLine(container, 'No issue loaded. Pull from the desk on the Review step first.');
    return;
  }

  // ── Sections: only the populated ones are listed; the rest are named once
  //    at the foot. No toggle: a populated section is always included,
  //    an empty one auto-hides. ───────────────────────────────────────────
  const { populated, missing } = splitSections(issue);
  for (const reg of SECTION_REGISTRY) {
    const sec = issue.sections?.[reg.key];
    if (sec) sec.enabled = (sec.items?.length ?? 0) > 0;
  }

  const sectionsList = el('div', 'triage-sections-list');

  for (const reg of populated) {
    const secData = issue.sections[reg.key];
    const items = secData.items;
    // Section name, with item count (e.g. "ERC Spotlight (2)")
    const row = el('div', 'triage-section-row');
    row.appendChild(el('span', 'triage-section-name', `${reg.label} (${items.length})`));
    sectionsList.appendChild(row);

    // Every populated section lists its items with reorder controls: grouped
    // (under group labels) where the section defines groups, flat otherwise
    // (e.g. Featured Research). Only Events also shows the featured toggle.
    const sectionContainer = el('div', 'triage-grouped-section');

    const renderSectionItems = () => {
      // Remember which arrow had focus, so the rebuild can hand it back.
      const focused = document.activeElement;
      const memo = focused && sectionContainer.contains(focused) && focused.dataset.moveItem
        ? { item: focused.dataset.moveItem, dir: focused.dataset.moveDir } : null;
      sectionContainer.innerHTML = '';

      // The one rule for Featured, printed once under the section's name.
      if (reg.key === 'events') {
        sectionContainer.appendChild(el('div', 'triage-section-note',
          'One event is featured; it pins to the top under a Featured heading.'));
      }

      const buckets = bucketSectionItems(reg, items);

      for (const bucket of buckets) {
        // The label is a registry constant, safe as textContent.
        if (bucket.label) sectionContainer.appendChild(el('div', 'triage-group-label', bucket.label));

        const bucketItems = bucket.items;
        for (const item of bucketItems) {
          // Index within the full section array (for reorder swaps)
          const secIdx = items.indexOf(item);
          // Position within this bucket (for button enable/disable)
          const grpIdx = bucketItems.indexOf(item);
          const title = (item.fields && item.fields.title) || 'item';

          const evRow = el('div', 'triage-event-row');

          // Title (user-derived, textContent only)
          const titleSpan = el('span', 'triage-event-title', (item.fields && item.fields.title) || '(untitled)');

          // The two arrows differ only in their word, glyph and move.
          const arrow = (dir, glyph, disabled, onClick) => {
            const btn = button('', 'triage-reorder-btn', { icon: glyph, onClick });
            btn.setAttribute('aria-label', `Move "${title}" ${dir}`);
            btn.dataset.moveItem = item.id;
            btn.dataset.moveDir = dir;
            btn.disabled = disabled;
            return btn;
          };
          const upBtn = arrow('up', 'arrow-up', grpIdx === 0, () => {
            if (secIdx > 0) {
              [items[secIdx - 1], items[secIdx]] = [items[secIdx], items[secIdx - 1]];
              renderSectionItems();
              scheduleSave();
            }
          });
          const downBtn = arrow('down', 'arrow-down', grpIdx === bucketItems.length - 1, () => {
            if (secIdx < items.length - 1) {
              [items[secIdx], items[secIdx + 1]] = [items[secIdx + 1], items[secIdx]];
              renderSectionItems();
              scheduleSave();
            }
          });

          evRow.appendChild(titleSpan);

          // Featured toggle, events section only. The rule sits once under
          // the section's name, not on every row.
          if (reg.key === 'events') {
            const featLabel = el('label', 'triage-featured-label');

            const featCb = el('input', 'triage-featured-cb');
            featCb.type = 'checkbox';
            featCb.setAttribute('aria-label', `Feature "${title}"`);
            featCb.checked = !!item.featured;
            featCb.addEventListener('change', () => {
              const wasFeatured = item.featured;
              // Exclusive: clear all, then set if newly checked
              items.forEach((ev) => { ev.featured = false; });
              if (!wasFeatured) item.featured = true;
              renderSectionItems();
              scheduleSave();
            });

            featLabel.append(featCb, ' Featured');
            evRow.appendChild(featLabel);
          }

          // Reorder arrows, grouped so the pair stays together at the row's right.
          const reorderGroup = el('div', 'triage-reorder-group');
          reorderGroup.append(upBtn, downBtn);
          evRow.appendChild(reorderGroup);

          // Remove this item from the issue (with Undo), the desk's Remove:
          // red quiet link with the trash icon, never a bare ✕.
          const delBtn = button(' Remove', 'ghost-btn ghost-btn--danger', {
            icon: 'trash-can',
            onClick: (e) => deleteItemWithUndo(item.id, renderTriage, e.detail === 0),
          });
          delBtn.setAttribute('aria-label', `Remove "${title}" from the issue`);
          delBtn.title = 'Removes this item from the issue';
          evRow.appendChild(delBtn);

          sectionContainer.appendChild(evRow);
        }
      }

      if (memo) {
        const same = sectionContainer.querySelector(`[data-move-item="${CSS.escape(memo.item)}"][data-move-dir="${memo.dir}"]`);
        const other = sectionContainer.querySelector(`[data-move-item="${CSS.escape(memo.item)}"]:not([data-move-dir="${memo.dir}"])`);
        const target = same && !same.disabled ? same : other;
        if (target && !target.disabled) target.focus();
      }
    };

    renderSectionItems();
    sectionsList.appendChild(sectionContainer);

    // ERC Research: optional "Submit your research" callout, a trailing
    // on/off switch beneath the research items.
    if (reg.key === 'research') {
      const subRow = el('div', 'triage-switch-row');

      // The visible words are the switch's label, so a screen reader names it.
      const subName = el('label', 'triage-switch-label', 'Submit your research callout');
      subName.htmlFor = 'submit-callout-switch';

      const switchLine = el('div', 'triage-switch-line');

      const sw = el('label', 'triage-switch');
      sw.title = 'Show this callout in the newsletter for this issue';
      const subCb = el('input', 'triage-switch-input');
      subCb.type = 'checkbox';
      subCb.id = 'submit-callout-switch';
      subCb.setAttribute('role', 'switch');
      subCb.checked = secData.showSubmit !== false;
      subCb.setAttribute('aria-checked', String(subCb.checked));
      sw.append(subCb, el('span', 'triage-switch-track'));

      const stateLabel = el('span', 'triage-switch-state', subCb.checked ? 'On' : 'Off');

      subCb.addEventListener('change', () => {
        secData.showSubmit = subCb.checked;
        subCb.setAttribute('aria-checked', String(subCb.checked));
        stateLabel.textContent = subCb.checked ? 'On' : 'Off';
        scheduleSave();
      });

      switchLine.append(sw, stateLabel);
      subRow.append(subName, switchLine);
      sectionsList.appendChild(subRow);
    }
  }

  container.appendChild(sectionsList);

  if (missing.length) {
    container.appendChild(el('p', 'triage-missing', `Not in this issue: ${missing.join(', ')}.`));
  }
}

// ---------------------------------------------------------------------------
// Edit step ("Preview & Edit")
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
.ec-edit-hover {
  background-color: ${wash};
  box-shadow: 0 0 0 4px ${wash};
}
.ec-edit-flash {
  background-color: ${chosen};
  box-shadow: 0 0 0 4px ${chosen};
}
`;
}

/**
 * Open editor cards, keyed by item ref ("section::item"). Lets several items
 * be edited at once; re-clicking an open item focuses its card instead of
 * duplicating. @type {Map<string, HTMLElement>}
 */
const openCards = new Map();

/** Counter behind the edit cards' field ids, so each label points at its own field. */
let editFieldSeq = 0;

/** A card's first field that can take focus: never the hidden link row's input or a file input. */
function firstField(card) {
  return [...card.querySelectorAll('input, textarea, [contenteditable]')]
    .find((el) => el.type !== 'file' && !el.closest('[hidden]')) || null;
}

/** True newsletter width (px). The preview is scaled down to fit narrower panes. */
const PREVIEW_WIDTH = 705;

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
function fitPreview() {
  const layout = document.querySelector('.edit-layout');
  if (!layout) return;
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
  const note = document.querySelector('.preview-note');
  if (note) note.textContent = `Preview at ${Math.round(scale * 100)} percent, as it lands in Outlook. Click any text to edit it.`;
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

/**
 * The one-off door: add a single item by hand, something that never went
 * through the desk. Section and group pickers, the fields the templates
 * render, and an Add button. The item is a first-class citizen afterwards
 * (click-to-edit, reorder, delete).
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

  const status = el('p', 'addon-hint');
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
    status.textContent = `Added to ${SECTION_REGISTRY.find((r) => r.key === sectionSelect.value)?.label}.`;
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

  // Hover affordance: highlight EVERY field of the item under the cursor, so
  // it's clear the click edits the whole item, not just the piece hovered.
  let hovered = [];
  const clearHover = () => {
    hovered.forEach((el) => el.classList.remove('ec-edit-hover'));
    hovered = [];
  };
  doc.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-edit-field]');
    if (!t) {
      clearHover();
      return;
    }
    const { editSection: section, editItem: item } = t.dataset;
    const els = collectItemNodes(doc, section, item);
    if (els[0] === hovered[0] && els.length === hovered.length) return; // same group
    clearHover();
    els.forEach((el) => el.classList.add('ec-edit-hover'));
    hovered = els;
  });
  doc.addEventListener('mouseout', (e) => {
    const to = e.relatedTarget && e.relatedTarget.closest
      ? e.relatedTarget.closest('[data-edit-field]')
      : null;
    if (!to) clearHover();
  });

  // Click listener: open an editor for the whole item the clicked field
  // belongs to (all of its fields at once), not just the one piece clicked.
  doc.addEventListener('click', (e) => {
    const target = e.target.closest('[data-edit-field]');
    if (!target) return;

    // Prevent link navigation from firing
    if (e.target.closest('a')) {
      e.preventDefault();
    }

    const { editSection: section, editItem: item } = target.dataset;
    if (!section) return;

    const refs = collectItemFields(doc, section, item);
    if (refs.length) {
      openItemEditor(refs, iframe);
      flashItem(doc, section, item);
    }
  });
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
  // Same move for an optional picture: sections that render one get the
  // field even when it's empty, so a URL can be added from the card.
  if (seen.has('title') && !seen.has('image') && IMAGE_SECTIONS.has(section)) {
    refs.push({ section, item, field: 'image' });
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

/**
 * Open (or focus) an editor card for a whole item in the persistent edit
 * column. Multiple cards may be open at once; they stack in open-order. Typing
 * updates the preview live; Save commits + closes the card.
 * @param {Array<{section:string,item?:string,field:string}>} refs
 * @param {HTMLIFrameElement} iframe
 */
function openItemEditor(refs, iframe) {
  const list = document.querySelector('.edit-card-list');
  if (!list) return;

  const key = `${refs[0].section}::${refs[0].item || ''}`;

  // Already open → focus + scroll to the existing card, don't duplicate.
  const existing = openCards.get(key);
  if (existing) {
    existing.scrollIntoView({ block: 'nearest' });
    const first = firstField(existing);
    if (first) first.focus();
    return;
  }

  const card = el('div', 'edit-card');
  card.setAttribute('role', 'group');
  // The card's name for a screen reader: the item's title, else the field's.
  const cardTitle = refs[0].item ? getField(state.issue, { ...refs[0], field: 'title' }) : '';
  card.setAttribute('aria-label', cardTitle || FIELD_LABELS[refs[0].field]);

  // Header: just a close control (× behaves like Save; edits are live). No
  // title label; the fields below make it clear which item you're editing.
  const header = el('div', 'edit-card-header');
  const closeBtn = button('', 'edit-card-close', { icon: 'xmark', onClick: () => closeCard(key) });
  closeBtn.setAttribute('aria-label', 'Close editor');
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Live preview re-render, debounced so typing doesn't thrash the iframe.
  const debouncedPreview = debounce(() => refreshEditIframe(iframe), 350);

  const fieldInputs = [];
  for (const ref of refs) {
    const group = el('div', 'edit-card-group');
    const isLong = ref.field === 'summary' || ref.field === 'intro';
    // Every field's sublabel names it for a screen reader: a <label for>
    // on a text field, an id the editor or the media group points at otherwise.
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

    // Each kind of field hands back the same handle, so the card wires them alike.
    let ctl;
    if (ref.field === 'image') {
      ctl = buildImageControl(getField(state.issue, ref) ?? '', onEdit);
      ctl.el.setAttribute('role', 'group');
      ctl.el.setAttribute('aria-labelledby', sub.id);
    } else if (isLong) {
      // Prose fields get a WYSIWYG editor (bold / italic / link) that stores
      // markdown. Live-renders as the newsletter does (via renderProse).
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
    card.appendChild(group);
    fieldInputs.push({ ref, set: ctl.set, focus: ctl.focus });
  }

  // What the fields held when the card opened, for Cancel.
  const opened = fieldInputs.map((f) => ({ ref: f.ref, value: getField(state.issue, f.ref) ?? '' }));

  // Footer: quiet Use original and Cancel, then Save (commit & close this one card).
  const actions = el('div', 'edit-card-actions');
  const cancelBtn = button('Cancel', 'ghost-btn ghost-btn--muted', { onClick: () => {
    let changed = false;
    opened.forEach(({ ref, value }, i) => {
      if ((getField(state.issue, ref) ?? '') === value) return;
      setField(state.issue, ref, value);
      fieldInputs[i].set(value);
      changed = true;
    });
    if (changed) {
      scheduleSave();
      refreshEditIframe(iframe);
    }
    closeCard(key);
  } });
  const revertBtn = button(' Use original', 'ghost-btn ghost-btn--muted', { icon: 'rotate-left', onClick: () => {
    let reverted = 0;
    for (const f of fieldInputs) {
      // No baseline entry (item added after the snapshot, or no snapshot
      // yet) means there is no original; leave the field alone rather
      // than blanking it.
      const original = getField(state.baseline, f.ref);
      if (original === undefined || original === null) continue;
      f.set(original);
      setField(state.issue, f.ref, original);
      reverted += 1;
    }
    if (!reverted) return;
    scheduleSave();
    refreshEditIframe(iframe);
  } });
  // Edits are live, so Save is a quiet word that closes the card.
  const saveBtn = button('Save', 'ghost-btn edit-card-save', { onClick: () => closeCard(key) });
  // Remove this whole item from the issue (with Undo), only for real items,
  // not the intro. The desk's word for taking an item out of an issue.
  const itemId = refs[0] && refs[0].item;
  if (itemId) {
    actions.appendChild(button(' Remove', 'ghost-btn ghost-btn--danger edit-card-delete', { icon: 'trash-can', onClick: (e) => {
      closeCard(key);
      deleteItemWithUndo(itemId, renderEdit, e.detail === 0);
    } }));
  }
  actions.append(revertBtn, cancelBtn, saveBtn);
  card.appendChild(actions);

  list.appendChild(card);
  openCards.set(key, card);
  updateColumnChrome();

  card.scrollIntoView({ block: 'nearest' });
  requestAnimationFrame(() => fieldInputs[0] && fieldInputs[0].focus());
}

/**
 * Close one card (commit is implicit; edits are already live). Focus moves to
 * the next card's first field (the previous card's, failing that), else to the
 * column's title, so it never falls off the page.
 */
function closeCard(key) {
  const card = openCards.get(key);
  if (!card) return;
  const neighbour = card.nextElementSibling || card.previousElementSibling;
  card.remove();
  openCards.delete(key);
  updateColumnChrome();
  const field = neighbour && firstField(neighbour);
  if (field) { field.focus(); return; }
  const title = document.querySelector('.edit-column-title');
  if (title) title.focus();
}

/** Save all: close every open card. Does NOT navigate. */
function closeAllCards() {
  for (const card of openCards.values()) card.remove();
  openCards.clear();
  updateColumnChrome();
}

/** Show the empty hint when no cards are open; show Save-all when ≥1. */
function updateColumnChrome() {
  const empty = document.querySelector('.edit-column-empty');
  const saveAll = document.querySelector('.edit-saveall-btn');
  const has = openCards.size > 0;
  if (empty) empty.hidden = has;
  if (saveAll) saveAll.hidden = !has;
}

/**
 * Build the collapsible drag-to-reorder panel for the edit column. Items are
 * grouped exactly like the Outline step; each row drags within its own group.
 * Dropping reorders the model, live-refreshes the preview, and autosaves.
 * @param {HTMLIFrameElement} iframe - the preview iframe to refresh
 * @returns {HTMLDetailsElement}
 */
function buildReorderPanel(iframe) {
  const { details, body } = railPanel('Reorder items');

  // One polite region, outside the rebuilt body, says where a row landed.
  const live = el('div', 'sr-only');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  details.appendChild(live);

  const render = () => {
    body.innerHTML = '';
    const hint = el('p', 'addon-hint', 'Drag a row, or focus it and press the arrow keys.');
    hint.id = 'reorder-hint';
    body.appendChild(hint);
    for (const reg of SECTION_REGISTRY) {
      const sec = state.issue.sections[reg.key];
      const secItems = (sec && sec.items) || [];
      if (secItems.length < 1) continue;

      // The section and group labels are registry constants, safe as textContent.
      body.appendChild(el('div', 'reorder-section-label', reg.label));

      for (const bucket of bucketSectionItems(reg, secItems)) {
        if (bucket.label) body.appendChild(el('div', 'reorder-group-label', bucket.label));

        // Each bucket is a listbox of named options.
        const listEl = el('div', 'reorder-list');
        listEl.setAttribute('role', 'listbox');
        listEl.setAttribute('aria-label', bucket.label ? `${reg.label}: ${bucket.label}` : reg.label);

        // One move for the drop and the arrow keys alike; the moved row keeps
        // focus across the rebuild and the live region says where it went.
        const move = (fromIdx, toIdx, focusId) => {
          const moved = bucket.items[fromIdx];
          moveWithinBucket(state.issue.sections[reg.key].items, bucket.items, fromIdx, toIdx);
          render();
          refreshEditIframe(iframe);
          scheduleSave();
          live.textContent = movedAnnouncement(moved?.fields?.title, toIdx, bucket.items.length);
          if (!focusId) return;
          const again = body.querySelector(`.reorder-row[data-item-id="${CSS.escape(focusId)}"]`);
          if (again) again.focus();
        };

        bucket.items.forEach((item, idx) => {
          const rowEl = el('div', 'reorder-row');
          rowEl.draggable = bucket.items.length > 1;
          rowEl.dataset.itemId = item.id;
          rowEl.setAttribute('role', 'option');
          rowEl.setAttribute('aria-label', reorderRowName(item.fields?.title, idx, bucket.items.length));
          rowEl.setAttribute('aria-describedby', hint.id);
          rowEl.tabIndex = 0;
          if (rowEl.draggable) {
            rowEl.addEventListener('keydown', (e) => {
              const to = arrowKeyTarget(e.key, idx, bucket.items.length);
              if (to === null) return;
              e.preventDefault();
              move(idx, to, item.id);
            });
          }

          const grip = el('span', 'reorder-grip', '⠿');
          grip.setAttribute('aria-hidden', 'true');
          // The title is user-derived: textContent only.
          rowEl.append(grip, el('span', 'reorder-title', (item.fields && item.fields.title) || '(untitled)'));

          rowEl.addEventListener('dragstart', (e) => {
            listEl.dataset.dragIdx = String(idx);
            rowEl.classList.add('reorder-row--dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Firefox needs data set for the drag to start at all.
            e.dataTransfer.setData('text/plain', String(idx));
          });
          rowEl.addEventListener('dragend', () => {
            delete listEl.dataset.dragIdx;
            listEl.querySelectorAll('.reorder-row--over, .reorder-row--dragging')
              .forEach((el) => el.classList.remove('reorder-row--over', 'reorder-row--dragging'));
          });
          rowEl.addEventListener('dragover', (e) => {
            // Only rows in the SAME list are valid targets (drag within group).
            if (listEl.dataset.dragIdx == null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (String(idx) !== listEl.dataset.dragIdx) rowEl.classList.add('reorder-row--over');
          });
          rowEl.addEventListener('dragleave', () => {
            rowEl.classList.remove('reorder-row--over');
          });
          rowEl.addEventListener('drop', (e) => {
            const fromIdx = Number(listEl.dataset.dragIdx);
            if (!Number.isInteger(fromIdx)) return;
            e.preventDefault();
            move(fromIdx, idx);
          });

          listEl.appendChild(rowEl);
        });

        body.appendChild(listEl);
      }
    }
  };

  render();
  return details;
}

/**
 * Render the edit step: large full-width editable-mode preview iframe.
 * The editable HTML has data-edit-* hooks for click-to-edit.
 * Called each time the wizard navigates to 'edit'.
 */
function renderEdit() {
  // Drop any card registry from a previous visit (the DOM is rebuilt below).
  openCards.clear();
  const container = openStep('edit', 'Check the issue and change anything in place.',
    'Click any text in the preview to edit it in a card on the right. The rail also holds the introduction, a one-off Add an item door, and reordering.');

  if (!state.issue) {
    emptyLine(container, 'No issue loaded. Pull from the desk on the Review step first.');
    return;
  }

  // What the sheet is: its scale, and that it is the editable one. This is
  // the pre-layout guess; fitPreview corrects it once the iframe loads and
  // the real width is known.
  const previewNote = el('p', 'preview-note');
  previewNote.textContent = `Preview at ${Math.round(PREVIEW_MAX_SCALE * 100)} percent, as it lands in Outlook. Click any text to edit it.`;
  container.appendChild(previewNote);

  const layout = el('div', 'edit-layout');

  const wrap = el('div', 'edit-preview-wrap');

  const iframe = el('iframe', 'edit-preview-iframe');
  iframe.setAttribute('title', 'Newsletter preview: click fields to edit');
  // No inner scrollbar: the iframe is sized to the full content height and the
  // PAGE owns scrolling, so the only scrollbar is the browser's (outside the
  // sheet). Suppresses the faint phantom scrollbar the `zoom` transform would
  // otherwise leave on the newsletter from sub-pixel height rounding.
  iframe.setAttribute('scrolling', 'no');

  // Wire click-to-edit and re-fit on every load (fires on each srcdoc set).
  // The rAF refit covers the case where the pane width isn't measurable at the
  // instant load fires (layout not yet flushed); the image listeners re-fit
  // once the (externally hosted) header banner finishes loading, so the iframe
  // height matches the final content height and no inner scrollbar appears.
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

  wrap.appendChild(iframe);
  layout.appendChild(wrap);

  // Persistent edit column (right). Always present so opening/closing cards
  // never reflows or rescales the sheet.
  const column = el('div', 'edit-column');

  const colHeader = el('div', 'edit-column-header');
  const colTitle = el('span', 'edit-column-title', 'Editing');
  colTitle.tabIndex = -1;   // where focus lands when the last card closes
  const saveAllBtn = button('Save all', 'ghost-btn edit-saveall-btn', { onClick: closeAllCards });
  saveAllBtn.hidden = true;
  colHeader.append(colTitle, saveAllBtn);

  column.append(
    colHeader,
    el('div', 'edit-card-list'),
    el('div', 'edit-column-empty', 'Click any text in the preview on the left. It opens here to edit.'),
    buildIntroPanel(iframe),
    buildAddItemPanel(iframe),
    buildReorderPanel(iframe),
  );
  layout.appendChild(column);

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
    'Copy the finished HTML for Outlook, save the issue to the archive, or download the file. Copy HTML is the one Outlook needs.');

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
    saveStatus.append(dotsLoader(true), loadingLabel('Saving…'));
    archiveSlot.appendChild(saveStatus);
    try {
      const data = await postJson('/api/newsletter-archive',
        { issueDate: iso, html: renderNewsletter(state.issue) }, 'save to the archive');
      // The issue went out: stamped, so a later visit's banner says so.
      state.issue.sentAt = new Date().toISOString();
      saveState(state.issue);
      savedThisVisit = { date: iso, label: isoToDisplayDate(iso) };
      const note = inlineNote('success', data.replaced ? 'Saved to the archive, replacing the earlier save.' : 'Saved to the archive.');
      const open = el('a', '', 'Open Past newsletters');
      open.href = 'archive.html';
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
 * The restore banner: shown when a saved issue exists in localStorage. It
 * sits above the step sections, not inside one, so a redraw of Review never
 * removes it; while it asks, nothing writes storage and the Issue select
 * and Pull are locked. Restore sets state.issue and moves on; Discard clears
 * storage with an Undo.
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
    state.issue = saved;
    state.baseline = structuredClone(saved);
    // An issue with items goes on to the Outline; one without stays on Review.
    goTo(countIssueItems(saved) ? 'triage' : 'review');
  } });

  const discardBtn = button('Discard', 'btn btn-secondary restore-banner__btn', { onClick: (e) => {
    settle();
    clearState();
    if (state.step === 'review') renderReview();   // unlocks the Issue select and Pull
    // Gone from storage, not from memory: Undo writes it back and asks again.
    showUndoToast('Discarded the saved issue', () => {
      saveState(saved);
      showRestoreBanner(saved);
      if (state.step === 'review') renderReview();   // locks them again while it asks
    }, { focusUndo: e.detail === 0 });
  } });

  btnRow.append(restoreBtn, discardBtn);
  banner.append(msg, btnRow);
  home.insertBefore(banner, home.firstChild);
}

// The desk's sidebar, tucked behind the thin strip like Desk work.
renderSidebar(document.querySelector('.side'), { screen: 'builder', isSectionWindow: false, onGo: () => {}, queueCount: null });
// A saved issue locks Review before it is drawn, so the first render already knows.
const savedIssue = loadState();
restorePending = Boolean(savedIssue);
goTo('review');
if (savedIssue) showRestoreBanner(savedIssue);
