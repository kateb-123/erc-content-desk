/**
 * app.js: ERC Newsletter Builder wizard shell
 *
 * Holds wizard state and step navigation. Later tasks import the
 * pure-logic modules (parser/serialize/template/model) as they wire up
 * each step.
 */

import { SECTION_REGISTRY, mergeIssueItems, createEmptyIssue, mergeIssues, deleteItem, insertItem, issueLinks, issueItemIds, partitionPulled, countIssueItems, splitSections } from './model.js';

// The builder lives INSIDE the desk's project (/builder/), so the desk's API
// is same-origin: relative fetches, no CORS. ?desk= still overrides for
// unusual dev setups.
const DESK_URL = new URLSearchParams(window.location.search).get('desk') || '';
let pullMessage = ''; // survives the Outline re-render after a pull
import { renderNewsletter, renderProse } from './template.js';
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
  /** @type {object|null} Parsed newsletter issue model */
  issue: null,
  /** @type {object|null} Deep-clone of issue at parse/restore time, used by "Revert to original" */
  baseline: null,
  /** @type {string} Current wizard step key */
  step: 'review',
  /** @type {number} The furthest step index visited, so checks survive going back (e29) */
  reached: 0,
};

/** True while the restore banner is asking; nothing writes storage or the issue until it is answered (d8). */
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
/** The desk's sliding-dots loader; mini = inline-sized for status rows. */
function dotsLoader(mini = false) {
  const wrap = document.createElement('div');
  wrap.className = mini ? 'dots-loader dots-mini' : 'dots-loader';
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 6; i += 1) {
    wrap.append(Object.assign(document.createElement('span'), { className: 'dot' }));
  }
  return wrap;
}

/** "Pulling" + dots that type themselves, for busy status labels. */
function loadingLabel(message) {
  const frag = document.createDocumentFragment();
  frag.append(message.replace(/…$/, ''));
  const dots = document.createElement('span');
  dots.className = 'dots-text';
  dots.setAttribute('aria-hidden', 'true');
  frag.append(dots);
  return frag;
}

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
/** The footer's one-line status slot: what a locked step says (b23). */
const wizardStatus = document.getElementById('wizard-status');
function setWizardStatus(msg) {
  if (wizardStatus) wizardStatus.textContent = msg;
}

/** Small Font Awesome glyph, same convention as the desk's faIcon(). */
function faIcon(name) {
  const i = document.createElement('i');
  i.className = `fa-solid fa-${name}`;
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/** A note's icon (e33): the glyph that goes with its --support-* colour, ahead of the words. */
function noteIcon(name) {
  const i = faIcon(name);
  i.classList.add('note-icon');
  return i;
}

/** A quiet word in the link colour: the builder's ghost button. */
function ghostButton(label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ghost-btn';
  b.textContent = label;
  return b;
}

/**
 * Carbon's inline notification (e30): the tint, the bar, the icon, the words,
 * and a ghost Retry when there is something to try again. An error is an
 * alert; anything else is a polite status.
 * @param {'error'|'success'|'warning'} kind
 * @param {string} message
 * @param {(() => void)|null} [onRetry]
 */
function inlineNote(kind, message, onRetry = null) {
  const icons = { error: 'circle-exclamation', success: 'circle-check', warning: 'triangle-exclamation' };
  const note = document.createElement('div');
  note.className = `note note--${kind}`;
  if (kind === 'error') note.setAttribute('role', 'alert');
  else { note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite'); }
  const words = document.createElement('span');
  words.className = 'note-words';
  words.textContent = message;
  note.append(noteIcon(icons[kind]), words);
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
 * aria-disabled for a screen reader (b22). Runs on every goTo and again when
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
    if (!btn) return;
    if (shows === 'current') btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
    // A locked step is greyed, and its title says why (e29).
    if (shows === 'locked') { btn.setAttribute('aria-disabled', 'true'); btn.title = LOCKED_STEP_MESSAGE; }
    else { btn.removeAttribute('aria-disabled'); btn.removeAttribute('title'); }
  });
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Show the wizard section for `step`, hide all others.
 * Updates `state.step` and enables/disables Back/Next buttons.
 *
 * @param {string} step - One of STEPS
 */
function goTo(step) {
  const idx = STEPS.indexOf(step);
  if (idx === -1) {
    console.error(`goTo: unknown step "${step}"`);
    return;
  }

  state.step = step;
  state.reached = Math.max(state.reached, idx);

  // Show/hide step containers
  stepSections.forEach((section) => {
    if (section.dataset.step === step) {
      section.removeAttribute('hidden');
    } else {
      section.setAttribute('hidden', '');
    }
  });

  syncStepNav();
  setWizardStatus('');

  // The footer pair: Back sleeps on the first step; Next has nowhere to go on
  // the last, so it goes rather than greys (e31).
  btnBack.disabled = idx === 0;
  btnNext.hidden = idx === STEPS.length - 1;

  // Step-specific render hooks
  if (step === 'review') renderReview();
  if (step === 'triage') renderTriage();
  if (step === 'edit') renderEdit();
  if (step === 'export') renderExport();
}

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

function goBack() {
  const idx = STEPS.indexOf(state.step);
  if (idx > 0) goTo(STEPS[idx - 1]);
}
function goNext() {
  const idx = STEPS.indexOf(state.step);
  if (idx >= STEPS.length - 1) return;
  const next = STEPS[idx + 1];
  // The same gate as the step buttons (b23, d9): with nothing pulled, Next says why and stays.
  if (!canEnterStep(next, countIssueItems(state.issue))) { setWizardStatus(LOCKED_STEP_MESSAGE); return; }
  goTo(next);
}
btnBack.addEventListener('click', goBack);
btnNext.addEventListener('click', goNext);

// The step buttons jump straight to any step. Review is always reachable; the
// later steps need a loaded issue, and say so on the status line (b22, b23).
stepIndicators.forEach((ind) => {
  const btn = ind.querySelector('button');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const target = ind.dataset.navStep;
    if (!target || target === state.step) return;
    if (!canEnterStep(target, countIssueItems(state.issue))) { setWizardStatus(LOCKED_STEP_MESSAGE); return; }
    goTo(target);
  });
  // The whole step stays a click surface (its number circle included); the button is the control.
  ind.addEventListener('click', (e) => {
    if (e.target !== btn && !btn.contains(e.target)) btn.click();
  });
});

// __renderTriage exposed after function definition below


/** The desk's header pattern, mirrored: one lede line in the card title's
 *  place (the step row already names the step, e35) + "View info" toggle
 *  with a tinted instruction note. Open state survives re-renders per step. */
const openStepInfo = new Set();
function attachStepInfo(container, key, lede, text) {
  const row = document.createElement('div');
  row.className = 'title-row';
  const ledeEl = document.createElement('p');
  ledeEl.className = 'step-lede';
  ledeEl.textContent = lede;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'info-toggle';
  const panel = document.createElement('div');
  panel.className = 'info-panel';
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

function renderReview() {
  const container = document.querySelector('[data-step="review"]');
  if (!container) return;
  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);
  attachStepInfo(container, 'review', 'Pick the issue and pull what the desk staged.',
    'Pick the issue, pull what the desk staged, and look it over. Pull again any time. Only new items are added.');

  // ── Issue date: a dropdown of the desk's scheduled issues, with staged
  //    counts. The desk owns the schedule; the builder just picks from it. ──
  const metaSection = document.createElement('div');
  metaSection.className = 'triage-meta';
  const dateLabel = document.createElement('label');
  dateLabel.className = 'triage-field-label';
  dateLabel.textContent = 'Issue';
  const dateSelect = document.createElement('select');
  dateSelect.className = 'triage-field-input';
  const currentIso = state.issue ? displayDateToISO(state.issue.date || '') : '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = currentIso ? isoToDisplayDate(currentIso) : 'Loading issues…';
  if (currentIso) placeholder.value = currentIso;
  dateSelect.appendChild(placeholder);
  // While the restore banner asks, the issue cannot be changed under it (d8).
  dateSelect.disabled = restorePending;
  dateSelect.addEventListener('change', () => {
    if (!dateSelect.value) return;
    if (!state.issue) state.issue = createEmptyIssue();
    // The issue keeps the display string the header renders ("July 1, 2026").
    state.issue.date = isoToDisplayDate(dateSelect.value);
    scheduleSave();
    syncStepNav();
  });
  dateLabel.appendChild(dateSelect);
  metaSection.appendChild(dateLabel);
  // Where a failed schedule load speaks (e30): an error note under the field, with Retry.
  const scheduleNote = document.createElement('div');
  scheduleNote.className = 'note-slot';
  metaSection.appendChild(scheduleNote);
  container.appendChild(metaSection);

  // Fill the dropdown from the desk: scheduled dates plus anything staged.
  async function loadSchedule() {
    scheduleNote.replaceChildren();
    if (!currentIso) placeholder.textContent = 'Loading issues…';
    try {
      const res = await fetch(`${DESK_URL}/api/newsletter-pull`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'no schedule');
      const dates = [...new Set([...(data.schedule ?? []), ...Object.keys(data.staged ?? {})])].sort();
      if (!dates.length) { placeholder.textContent = currentIso ? isoToDisplayDate(currentIso) : 'No issues scheduled on the desk'; return; }
      dateSelect.replaceChildren();
      if (!currentIso) {
        const pick = document.createElement('option');
        pick.value = '';
        pick.textContent = 'Pick an issue…';
        dateSelect.appendChild(pick);
      }
      for (const iso of dates) {
        const opt = document.createElement('option');
        opt.value = iso;
        opt.textContent = isoToDisplayDate(iso);
        if (iso === currentIso) opt.selected = true;
        dateSelect.appendChild(opt);
      }
      if (currentIso && !dates.includes(currentIso)) {
        const opt = document.createElement('option');
        opt.value = currentIso;
        opt.textContent = isoToDisplayDate(currentIso);
        opt.selected = true;
        dateSelect.appendChild(opt);
      }
    } catch {
      // The select keeps a real first option; the error speaks beside it, with a way to try again.
      if (!currentIso) placeholder.textContent = 'Pick an issue…';
      scheduleNote.replaceChildren(inlineNote('error', "Couldn't load the desk's issues.", loadSchedule));
    }
  }
  loadSchedule();

  // ── Pull from the desk: the Content Desk's Newsletter screen stamps items
  //    for an issue; this button fetches them, already builder-shaped.
  //    Re-pull adds only what's new (matched by link). The button and its
  //    status share one row under the field (e35). ────────────────────────
  const pullRow = document.createElement('div');
  pullRow.className = 'pull-row';
  const pullBtn = document.createElement('button');
  pullBtn.type = 'button';
  // The step's one real action: a filled primary, like the desk's Rewrite/Publish.
  pullBtn.className = 'btn btn-primary md-sidedoor-btn';
  pullBtn.textContent = 'Pull from the desk';
  pullBtn.disabled = restorePending;   // locked while the restore banner asks (d8)
  const pullStatus = document.createElement('span');
  pullStatus.className = 'pull-status';
  pullStatus.setAttribute('role', 'status');    // read aloud as it changes (a7)
  pullStatus.setAttribute('aria-live', 'polite');
  pullStatus.textContent = pullMessage;
  // A failed pull is an error note under the row, with Retry (e30).
  const pullNote = document.createElement('div');
  pullNote.className = 'note-slot';
  const setPull = (msg, busy = false) => {
    pullMessage = msg;
    pullNote.replaceChildren();
    if (busy && msg) pullStatus.replaceChildren(dotsLoader(true), loadingLabel(msg));
    else pullStatus.textContent = msg;
  };
  pullBtn.addEventListener('click', async () => {
    const iso = displayDateToISO(state.issue?.date || '');
    if (!iso) return setPull('Pick the issue first.');
    pullBtn.disabled = true;
    pullBtn.hidden = true;   // gone while pulling; no double-clicks
    setPull('Pulling…', true);
    try {
      const res = await fetch(`${DESK_URL}/api/newsletter-pull?issue=${iso}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'pull failed');
      if (!countIssueItems(data.issue)) {
        const staged = Object.entries(data.staged ?? {}).sort(([a], [b]) => a.localeCompare(b));
        setPull(staged.length
          ? `Nothing staged for ${isoToDisplayDate(iso)}. The desk has ${staged[0][1]} staged for ${isoToDisplayDate(staged[0][0])}.`
          : `Nothing staged for ${isoToDisplayDate(iso)}.`);
        return;
      }
      if (!state.issue) state.issue = createEmptyIssue();
      const { pulled, already } = partitionPulled(data.issue, issueLinks(state.issue), issueItemIds(state.issue));
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
      pullBtn.disabled = false;
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
    const empty = document.createElement('p');
    empty.className = 'edit-empty-msg';
    empty.textContent = 'Nothing here yet.';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'review-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Item', 'Section']) {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const [sec, item] of items) {
    const tr = document.createElement('tr');
    const itemTd = document.createElement('td');
    const title = document.createElement('strong');
    title.textContent = item.fields?.title || item.fields?.url || '(untitled)';
    itemTd.appendChild(title);
    const source = String(item.fields?.source ?? '').trim();
    if (source) {
      const src = document.createElement('span');
      src.className = 'review-table-sub';
      src.textContent = source;
      itemTd.appendChild(src);
    }
    tr.appendChild(itemTd);
    const secTd = document.createElement('td');
    secTd.textContent = sec.label;
    const groupLabel = sec.groups.find((g) => g.key === item.group)?.label ?? '';
    if (groupLabel) {
      const grp = document.createElement('span');
      grp.className = 'review-table-sub';
      grp.textContent = groupLabel;
      secTd.appendChild(grp);
    }
    tr.appendChild(secTd);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

/**
 * Delete one item from the issue, with a transient Undo toast. Shared by the
 * Outline row's Remove and the Preview & Edit card's Remove. `rerender` rebuilds
 * whichever step is showing so the removal (and any undo) is reflected at once.
 * `fromKeyboard` (a click with detail 0) hands focus to the toast's Undo (b31).
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
 * keyboard (a7, b31).
 */
function showUndoToast(message, onUndo, { focusUndo = false } = {}) {
  clearTimeout(_undoToastTimer);
  const prior = document.querySelector('.undo-toast');
  if (prior) prior.remove();

  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.setAttribute('role', 'status');
  const msg = document.createElement('span');
  msg.className = 'undo-toast__msg';
  msg.textContent = message;              // user-derived title → textContent only
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'undo-toast__btn';
  btn.textContent = 'Undo';
  btn.addEventListener('click', () => {
    clearTimeout(_undoToastTimer);
    toast.remove();
    onUndo();
  });
  toast.appendChild(msg);
  toast.appendChild(btn);
  const anchor = document.querySelector('.edit-column') || document.querySelector('.wizard-body');
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
  const container = document.querySelector('[data-step="triage"]');
  if (!container) return;

  // Clear existing content, keeping the h2
  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);
  attachStepInfo(container, 'triage', 'Put the issue in order.',
    'Put the items in order with the arrows, mark one event Featured, and switch the Submit your research callout on or off. The issue builds in this order.');

  const issue = state.issue;

  // Nothing pulled yet: one line, and no empty section list to puzzle over (b24).
  if (!issue || !countIssueItems(issue)) {
    const msg = document.createElement('p');
    msg.className = 'edit-empty-msg';
    msg.textContent = 'No issue loaded. Pull from the desk on the Review step first.';
    container.appendChild(msg);
    return;
  }

  // ── Sections: only the populated ones are listed; the rest are named once
  //    at the foot (f15). No toggle: a populated section is always included,
  //    an empty one auto-hides. ───────────────────────────────────────────
  const { populated, missing } = splitSections(issue);
  for (const reg of SECTION_REGISTRY) {
    const sec = issue.sections?.[reg.key];
    if (sec) sec.enabled = (sec.items?.length ?? 0) > 0;
  }

  const sectionsList = document.createElement('div');
  sectionsList.className = 'triage-sections-list';

  for (const reg of populated) {
    const secData = issue.sections[reg.key];
    const items = secData.items;
    const row = document.createElement('div');
    row.className = 'triage-section-row';

    // Section name, with item count (e.g. "ERC Spotlight (2)")
    const nameSpan = document.createElement('span');
    nameSpan.className = 'triage-section-name';
    nameSpan.textContent = `${reg.label} (${items.length})`;
    row.appendChild(nameSpan);

    sectionsList.appendChild(row);

    // Every populated section lists its items with reorder controls: grouped
    // (under group labels) where the section defines groups, flat otherwise
    // (e.g. Featured Research). Only Events also shows the featured toggle.
    if (items.length > 0) {
      const sectionContainer = document.createElement('div');
      sectionContainer.className = 'triage-grouped-section';

      const renderSectionItems = () => {
        // Remember which arrow had focus, so the rebuild can hand it back (b27).
        const focused = document.activeElement;
        const memo = focused && sectionContainer.contains(focused) && focused.dataset.moveItem
          ? { item: focused.dataset.moveItem, dir: focused.dataset.moveDir } : null;
        sectionContainer.innerHTML = '';
        const secItems = (issue && issue.sections && issue.sections[reg.key] && issue.sections[reg.key].items) || [];
        const hasGroups = reg.groups && reg.groups.length > 0;

        // The one rule for Featured, printed once under the section's name (b30).
        if (reg.key === 'events') {
          const rule = document.createElement('div');
          rule.className = 'triage-section-note';
          rule.textContent = 'One event is featured; it pins to the top under a Featured heading.';
          sectionContainer.appendChild(rule);
        }

        // Bucket items for display: one bucket per non-empty group (labeled),
        // then a trailing unlabeled bucket for any items that didn't match a
        // group so nothing is silently dropped. Flat sections = one bucket.
        const buckets = [];
        if (hasGroups) {
          const claimed = new Set();
          for (const grp of reg.groups) {
            const grpItems = secItems.filter((it) => it.group === grp.key);
            if (grpItems.length === 0) continue;
            grpItems.forEach((it) => claimed.add(it));
            buckets.push({ label: grp.label, items: grpItems });
          }
          const leftover = secItems.filter((it) => !claimed.has(it));
          if (leftover.length > 0) buckets.push({ label: null, items: leftover });
        } else {
          buckets.push({ label: null, items: secItems.slice() });
        }

        for (const bucket of buckets) {
          if (bucket.label) {
            const grpLabel = document.createElement('div');
            grpLabel.className = 'triage-group-label';
            grpLabel.textContent = bucket.label; // registry constant, safe as textContent
            sectionContainer.appendChild(grpLabel);
          }

          const bucketItems = bucket.items;
          for (const item of bucketItems) {
            // Index within the full section array (for reorder swaps)
            const secIdx = secItems.indexOf(item);
            // Position within this bucket (for button enable/disable)
            const grpIdx = bucketItems.indexOf(item);
            const title = (item.fields && item.fields.title) || 'item';

            const evRow = document.createElement('div');
            evRow.className = 'triage-event-row';

            // Title (user-derived, textContent only)
            const titleSpan = document.createElement('span');
            titleSpan.className = 'triage-event-title';
            titleSpan.textContent = (item.fields && item.fields.title) || '(untitled)';

            // Up button
            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'triage-reorder-btn';
            upBtn.append(faIcon('arrow-up'));
            upBtn.setAttribute('aria-label', `Move "${title}" up`);
            upBtn.dataset.moveItem = item.id;
            upBtn.dataset.moveDir = 'up';
            upBtn.disabled = grpIdx === 0;
            upBtn.addEventListener('click', () => {
              const allItems = issue.sections[reg.key].items;
              if (secIdx > 0) {
                [allItems[secIdx - 1], allItems[secIdx]] = [allItems[secIdx], allItems[secIdx - 1]];
                renderSectionItems();
                scheduleSave();
              }
            });

            // Down button
            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'triage-reorder-btn';
            downBtn.append(faIcon('arrow-down'));
            downBtn.setAttribute('aria-label', `Move "${title}" down`);
            downBtn.dataset.moveItem = item.id;
            downBtn.dataset.moveDir = 'down';
            downBtn.disabled = grpIdx === bucketItems.length - 1;
            downBtn.addEventListener('click', () => {
              const allItems = issue.sections[reg.key].items;
              if (secIdx < allItems.length - 1) {
                [allItems[secIdx], allItems[secIdx + 1]] = [allItems[secIdx + 1], allItems[secIdx]];
                renderSectionItems();
                scheduleSave();
              }
            });

            evRow.appendChild(titleSpan);

            // Featured toggle, events section only. The rule sits once under
            // the section's name, not on every row (b30).
            if (reg.key === 'events') {
              const featLabel = document.createElement('label');
              featLabel.className = 'triage-featured-label';

              const featCb = document.createElement('input');
              featCb.type = 'checkbox';
              featCb.className = 'triage-featured-cb';
              featCb.setAttribute('aria-label', `Feature "${title}"`);
              featCb.checked = !!item.featured;
              featCb.addEventListener('change', () => {
                const evItems = issue.sections.events.items;
                const wasFeatured = item.featured;
                // Exclusive: clear all, then set if newly checked
                evItems.forEach((ev) => { ev.featured = false; });
                if (!wasFeatured) item.featured = true;
                renderSectionItems();
                scheduleSave();
              });

              featLabel.appendChild(featCb);
              featLabel.appendChild(document.createTextNode(' Featured'));
              evRow.appendChild(featLabel);
            }

            // Reorder arrows, grouped so they can reveal on row hover/focus.
            const reorderGroup = document.createElement('div');
            reorderGroup.className = 'triage-reorder-group';
            reorderGroup.appendChild(upBtn);
            reorderGroup.appendChild(downBtn);
            evRow.appendChild(reorderGroup);

            // Remove this item from the issue (with Undo), the desk's Remove:
            // red quiet link with the trash icon, never a bare ✕.
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'triage-delete-btn';
            delBtn.append(faIcon('trash-can'), ' Remove');
            delBtn.setAttribute('aria-label', `Remove "${title}" from the issue`);
            delBtn.title = 'Removes this item from the issue';
            delBtn.addEventListener('click', (e) => deleteItemWithUndo(item.id, renderTriage, e.detail === 0));
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
        const subRow = document.createElement('div');
        subRow.className = 'triage-switch-row';

        // The visible words are the switch's label, so a screen reader names it (a8).
        const subName = document.createElement('label');
        subName.className = 'triage-switch-label';
        subName.htmlFor = 'submit-callout-switch';
        subName.textContent = 'Submit your research callout';

        const switchLine = document.createElement('div');
        switchLine.className = 'triage-switch-line';

        const sw = document.createElement('label');
        sw.className = 'triage-switch';
        sw.title = 'Show this callout in the newsletter for this issue';
        const subCb = document.createElement('input');
        subCb.type = 'checkbox';
        subCb.id = 'submit-callout-switch';
        subCb.className = 'triage-switch-input';
        subCb.setAttribute('role', 'switch');
        subCb.checked = secData.showSubmit !== false;
        subCb.setAttribute('aria-checked', String(subCb.checked));
        const track = document.createElement('span');
        track.className = 'triage-switch-track';
        sw.appendChild(subCb);
        sw.appendChild(track);

        const stateLabel = document.createElement('span');
        stateLabel.className = 'triage-switch-state';
        stateLabel.textContent = subCb.checked ? 'On' : 'Off';

        subCb.addEventListener('change', () => {
          secData.showSubmit = subCb.checked;
          subCb.setAttribute('aria-checked', String(subCb.checked));
          stateLabel.textContent = subCb.checked ? 'On' : 'Off';
          scheduleSave();
        });

        switchLine.appendChild(sw);
        switchLine.appendChild(stateLabel);
        subRow.appendChild(subName);
        subRow.appendChild(switchLine);
        sectionsList.appendChild(subRow);
      }
    }
  }

  container.appendChild(sectionsList);

  if (missing.length) {
    const rest = document.createElement('p');
    rest.className = 'triage-missing';
    rest.textContent = `Not in this issue: ${missing.join(', ')}.`;
    container.appendChild(rest);
  }
}

// ---------------------------------------------------------------------------
// Edit step ("Preview & Edit")
// ---------------------------------------------------------------------------

/**
 * CSS injected into the editable iframe to show hover affordance. Built when
 * the iframe loads so the colours come from the builder's own tokens: the
 * hover wash (--accent-alpha) while the pointer is over an item, the chosen
 * tint (--highlight) for the flash on click (c11).
 */
function editHoverCss() {
  const tokens = getComputedStyle(document.documentElement);
  const wash = tokens.getPropertyValue('--accent-10').trim();   // the editable cue, plain enough to see (f18)
  const chosen = tokens.getPropertyValue('--highlight').trim();
  return `
[data-edit-field] {
  cursor: pointer;
  transition: outline 0.1s;
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
 * duplicating. @type {Map<string, { card: HTMLElement, refs: Array }>}
 */
const openCards = new Map();

/** Counter behind the edit cards' field ids, so each label points at its own field (a9). */
let editFieldSeq = 0;

/** Stable key for an item ref group. */
function refKey(section, item) {
  return `${section}::${item || ''}`;
}

/** A card's first field that can take focus: never the hidden link row's input or a file input. */
function firstField(card) {
  return [...card.querySelectorAll('input, textarea, [contenteditable]')]
    .find((el) => el.type !== 'file' && !el.closest('[hidden]')) || null;
}

/**
 * The window-resize listener that re-fits the preview to the pane width.
 * Tracked at module scope so re-entering the edit step removes the prior one
 * instead of stacking listeners.
 * @type {(() => void)|null}
 */
let previewResizeHandler = null;

/**
 * Re-fit the preview to the current pane width. Set by renderEdit so the field
 * editor (which changes the layout when it opens/closes) can trigger a refit.
 * @type {(() => void)|null}
 */
let refitPreview = null;

/** True newsletter width (px). The preview is scaled down to fit narrower panes. */
const PREVIEW_WIDTH = 705;

/** Cap the preview at 95% of true size; scales down on narrow windows so the
    edit column always fits and there's never a horizontal scrollbar. */
const PREVIEW_MAX_SCALE = 0.95;

/** Persistent edit-column width (px), matches .edit-column in styles.css. */
const COLUMN_W = 340;
/** Flex gap between preview and edit column, matches .edit-layout gap. */
const EDIT_GAP = 20;
/** Horizontal padding on ONE side of the gray stage, matches .edit-preview-wrap. */
const STAGE_PAD = 24;

/**
 * Re-render the editable iframe (after an edit) and re-attach listeners.
 * @param {HTMLIFrameElement} iframe
 */
function refreshEditIframe(iframe) {
  // Re-setting srcdoc triggers the 'load' event, which re-attaches the listener.
  iframe.srcdoc = renderNewsletter(state.issue, { editable: true });
}

/**
 * The introduction's home in the edit column: a panel with the same rich
 * editor the cards use, bound to issue.intro. The preview refreshes as you
 * type (debounced); the editor lives outside the iframe, so focus holds.
 */
function buildIntroPanel(iframe) {
  const details = document.createElement('details');
  details.className = 'reorder-panel';
  const summary = document.createElement('summary');
  summary.className = 'reorder-panel-summary';
  summary.textContent = 'Introduction';
  details.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'reorder-panel-body';
  const hint = document.createElement('p');
  hint.className = 'addon-hint';
  hint.textContent = 'Shows under the header, before the first section.';
  body.appendChild(hint);
  const refresh = debounce(() => refreshEditIframe(iframe), 500);
  const editor = buildRichEditor(state.issue?.intro || '', (md) => {
    if (!state.issue) state.issue = createEmptyIssue();
    state.issue.intro = md;
    scheduleSave();
    refresh();
  });
  body.appendChild(editor.el);
  // Edits are live, so Save is a quiet word, not a second primary (e32).
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'ghost-btn intro-save-btn';
  save.textContent = 'Save';
  save.addEventListener('click', () => {
    if (state.issue) saveState(state.issue);
    refreshEditIframe(iframe);
    save.textContent = 'Saved';
    setTimeout(() => { save.textContent = 'Save'; }, 1500);
  });
  body.appendChild(save);
  details.appendChild(body);
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
  const details = document.createElement('details');
  details.className = 'reorder-panel';
  const summary = document.createElement('summary');
  summary.className = 'reorder-panel-summary';
  summary.textContent = 'Add an item';
  details.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'reorder-panel-body';
  details.appendChild(body);

  const field = (labelText, el) => {
    const label = document.createElement('label');
    label.className = 'addon-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.appendChild(span);
    label.appendChild(el);
    return label;
  };
  const textInput = () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'triage-field-input';
    return input;
  };

  const sectionSelect = document.createElement('select');
  sectionSelect.className = 'triage-field-input';
  for (const reg of SECTION_REGISTRY) {
    const opt = document.createElement('option');
    opt.value = reg.key;
    opt.textContent = reg.label;
    sectionSelect.appendChild(opt);
  }
  const groupSelect = document.createElement('select');
  groupSelect.className = 'triage-field-input';
  const groupField = field('Group', groupSelect);
  const syncGroups = () => {
    const reg = SECTION_REGISTRY.find((r) => r.key === sectionSelect.value);
    groupSelect.replaceChildren();
    for (const g of reg?.groups ?? []) {
      const opt = document.createElement('option');
      opt.value = g.key;
      opt.textContent = g.label;
      groupSelect.appendChild(opt);
    }
    // A single unlabeled group (Miscellaneous) needs no picker.
    groupField.hidden = !(reg?.groups ?? []).some((g) => g.label);
  };
  sectionSelect.addEventListener('change', () => { syncGroups(); syncExtras(); });
  syncGroups();

  const titleInput = textInput();
  const linkInput = textInput();
  const summaryInput = document.createElement('textarea');
  summaryInput.className = 'triage-field-input';
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

  const status = document.createElement('p');
  status.className = 'addon-hint';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-secondary';
  addBtn.textContent = 'Add to the issue';
  addBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    if (!title) { status.textContent = 'Give it a title first.'; return; }
    if (!state.issue) state.issue = createEmptyIssue();
    const fields = { title };
    if (linkInput.value.trim()) fields.url = linkInput.value.trim();
    if (summaryInput.value.trim()) fields.summary = summaryInput.value.trim();
    if (!dateInput.parentElement.hidden) {
      if (dateInput.value.trim()) fields.date = dateInput.value.trim();
      if (timeInput.value.trim()) fields.time = timeInput.value.trim();
      if (locationInput.value.trim()) fields.location = locationInput.value.trim();
    }
    if (!deadlineInput.parentElement.hidden && deadlineInput.value.trim()) {
      fields.meta = `Deadline: ${deadlineInput.value.trim()}`;
    }
    if (!imageField.hidden && imageCtl.get()) fields.image = imageCtl.get();
    miscItemSeq += 1;
    const section = state.issue.sections[sectionSelect.value];
    const item = { id: `misc_${Date.now().toString(36)}_${miscItemSeq}`, group: groupSelect.value, fields };
    section.items.push(item);
    section.enabled = true;
    // The as-added values are this item's "original" for Revert.
    if (!state.baseline) state.baseline = structuredClone(state.issue);
    else {
      const base = state.baseline.sections[sectionSelect.value];
      if (base) { base.items.push(structuredClone(item)); base.enabled = true; }
    }
    scheduleSave();
    refreshEditIframe(iframe);
    for (const input of [titleInput, linkInput, summaryInput, dateInput, timeInput, locationInput, deadlineInput]) input.value = '';
    imageCtl.set('');
    status.textContent = `Added to ${SECTION_REGISTRY.find((r) => r.key === sectionSelect.value)?.label}.`;
  });

  body.appendChild(field('Section', sectionSelect));
  body.appendChild(groupField);
  body.appendChild(field('Title', titleInput));
  body.appendChild(field('Link', linkInput));
  body.appendChild(field('Summary', summaryInput));
  for (const f of eventFields) body.appendChild(f);
  for (const f of oppFields) body.appendChild(f);
  body.appendChild(imageField);
  syncExtras();
  body.appendChild(addBtn);
  body.appendChild(status);
  return details;
}

/**
 * Wire up the click-to-edit listener and hover CSS in the iframe's contentDocument.
 * Called on every iframe 'load' event (re-fires on each srcdoc set).
 * @param {HTMLIFrameElement} iframe
 * @param {HTMLElement} editStepContainer
 */
function wireIframeEditing(iframe, editStepContainer) {
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
 * Gather every editable field belonging to one item (or one section-level
 * field group, when there is no item), in document order, de-duplicated.
 * @param {Document} doc - the preview iframe's document
 * @param {string} section
 * @param {string|undefined} item
 * @returns {Array<{ section: string, item?: string, field: string }>}
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

/** PDF flyers become a PNG in the browser (first page) so email clients can
 *  show them; pdf.js loads lazily from the CDN only when a PDF arrives. */
async function pdfFirstPageToPng(file) {
  const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const scale = 1200 / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  // intent 'print' keeps the raster off requestAnimationFrame, which browsers
  // pause in a background tab; otherwise switching tabs mid-upload leaves the
  // conversion stuck on "Converting the PDF" until you come back.
  await page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise;
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't convert that PDF."))), 'image/png'));
}

const IMAGE_EXTS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** Upload one picture (PNG/JPG/GIF/WebP, or a PDF's first page) → public URL. */
async function uploadItemImage(file, onStatus) {
  let blob = file;
  let ext = IMAGE_EXTS[file.type];
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    onStatus('Converting the PDF…');
    blob = await pdfFirstPageToPng(file);
    ext = 'png';
  }
  if (!ext) throw new Error("Use a PNG, JPG, or PDF.");
  if (blob.size > 2.5 * 1024 * 1024) throw new Error('Too big. Keep it under 2.5 MB.');
  onStatus('Uploading…');
  const b64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(blob);
  });
  const res = await fetch(`${DESK_URL}/api/newsletter-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, type: ext, file: b64 }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'upload failed');
  return data.url;
}

/** The picture control: Add (or Replace) + Remove; the value is a URL the
 *  templates render. The button hides while a file is in flight. */
function buildImageControl(initial, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'img-upload';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.png,.jpg,.jpeg,.gif,.webp,.pdf';
  fileInput.hidden = true;
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'edit-saveall-btn media-add';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'edit-card-revert';
  removeBtn.textContent = 'Remove media';
  const status = document.createElement('span');
  status.className = 'pull-status';
  status.setAttribute('role', 'status');    // read aloud as it changes (a7)
  status.setAttribute('aria-live', 'polite');
  let value = initial || '';
  const sync = () => {
    pick.textContent = value ? 'Replace media' : 'Add media';
    removeBtn.hidden = !value;
  };
  const setStatus = (msg, busy = false) => {
    if (busy && msg) status.replaceChildren(dotsLoader(true), loadingLabel(msg));
    else status.textContent = msg;
  };
  pick.addEventListener('click', () => fileInput.click());
  removeBtn.addEventListener('click', () => {
    value = '';
    onChange('');
    setStatus('');
    sync();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    pick.hidden = true;   // gone while uploading; no double-clicks
    removeBtn.hidden = true;
    try {
      value = await uploadItemImage(file, msg => setStatus(msg, true));
      onChange(value);
      setStatus('Added.');
    } catch (err) {
      setStatus(err.message);
    }
    fileInput.value = '';
    pick.hidden = false;
    sync();
  });
  sync();
  wrap.append(pick, removeBtn, status, fileInput);
  return {
    el: wrap,
    get: () => value,
    set: (v) => { value = v || ''; setStatus(''); sync(); },
    focus: () => pick.focus(),
  };
}

/** Sections whose templates render an item picture (bullet lists don't). */
const IMAGE_SECTIONS = new Set(['research', 'spotlight', 'events', 'opportunities']);

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

/** Friendly sub-labels for known field keys (fallback: capitalized key). */
const FIELD_LABELS = {
  title: 'Title',
  url: 'Link',
  meta: 'Details',
  summary: 'Description',
  description: 'Description',
  author: 'Author',
  authors: 'Authors',
  intro: 'Introduction',
  date: 'Date',
  name: 'Name',
  eyebrow: 'Label',
  image: 'Media',
};

/** Title-case a section key for the panel header (e.g. "spotlight" → "Spotlight"). */
function humanize(key) {
  return String(key || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
 * `labelledBy` names the sublabel that is the editor's accessible name (a9).
 */
function buildRichEditor(initialMd, onChange, { labelledBy = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'rich-editor';

  const editable = document.createElement('div');
  editable.className = 'rich-editable';
  editable.contentEditable = 'true';
  editable.setAttribute('role', 'textbox');
  editable.setAttribute('aria-multiline', 'true');
  if (labelledBy) editable.setAttribute('aria-labelledby', labelledBy);
  editable.innerHTML = renderProse(initialMd || '');

  const emit = () => onChange(htmlToMarkdown(editable.innerHTML));

  const toolbar = document.createElement('div');
  toolbar.className = 'rich-toolbar';
  const mkBtn = (label, title, run, italic = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rich-btn';
    b.title = title;
    b.textContent = label;
    if (italic) b.style.fontStyle = 'italic';
    // mousedown-preventDefault keeps the text selection while clicking the button.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => { run(); editable.focus(); emit(); });
    return b;
  };
  toolbar.appendChild(mkBtn('B', 'Bold', () => document.execCommand('bold')));
  toolbar.appendChild(mkBtn('I', 'Italic', () => document.execCommand('italic'), true));

  // The link ask is a row under the toolbar, not window.prompt (c10): it keeps
  // the selection, pre-fills from a link the caret sits in, adds https:// when
  // the scheme is missing, and Escape or Cancel puts it away.
  const linkRow = document.createElement('div');
  linkRow.className = 'rich-link-row';
  linkRow.hidden = true;
  const linkInput = document.createElement('input');
  linkInput.type = 'text';
  linkInput.className = 'edit-card-input rich-link-input';
  linkInput.placeholder = 'https://';
  linkInput.setAttribute('aria-label', 'Link address');
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'btn btn-primary rich-link-apply';
  applyBtn.textContent = 'Apply';
  const cancelLinkBtn = document.createElement('button');
  cancelLinkBtn.type = 'button';
  cancelLinkBtn.className = 'edit-card-revert';
  cancelLinkBtn.textContent = 'Cancel';
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
    const el = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    savedAnchor = el && el.closest ? el.closest('a') : null;
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
        const a = document.createElement('a');
        a.href = url;
        a.textContent = url;
        savedRange.insertNode(a);
        savedRange.setStartAfter(a);
        savedRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } else {
        document.execCommand('createLink', false, url);
      }
    }
    linkRow.hidden = true;
    savedRange = null;
    savedAnchor = null;
    editable.focus();
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

  const linkBtn = document.createElement('button');
  linkBtn.type = 'button';
  linkBtn.className = 'rich-btn';
  linkBtn.title = 'Add link';
  linkBtn.setAttribute('aria-label', 'Add link');
  linkBtn.append(faIcon('link'));
  linkBtn.addEventListener('mousedown', (e) => e.preventDefault());
  linkBtn.addEventListener('click', () => { if (linkRow.hidden) openLinkRow(); else closeLinkRow(); });
  toolbar.appendChild(linkBtn);

  editable.addEventListener('input', emit);

  wrap.appendChild(toolbar);
  wrap.appendChild(linkRow);
  wrap.appendChild(editable);
  return {
    el: wrap,
    getMd: () => htmlToMarkdown(editable.innerHTML),
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
  if (!refs.length) return;
  const list = document.querySelector('.edit-card-list');
  if (!list) return;

  const key = refKey(refs[0].section, refs[0].item);

  // Already open → focus + scroll to the existing card, don't duplicate.
  const existing = openCards.get(key);
  if (existing) {
    existing.card.scrollIntoView({ block: 'nearest' });
    const first = firstField(existing.card);
    if (first) first.focus();
    return;
  }

  const card = document.createElement('div');
  card.className = 'edit-card';
  card.setAttribute('role', 'group');
  // The card's name for a screen reader: the item's title, else the field's (a9).
  const cardTitle = refs[0].item ? getField(state.issue, { ...refs[0], field: 'title' }) : '';
  card.setAttribute('aria-label', cardTitle || FIELD_LABELS[refs[0].field] || humanize(refs[0].section));

  // Header: just a close control (× behaves like Save; edits are live). No
  // title label; the fields below make it clear which item you're editing.
  const header = document.createElement('div');
  header.className = 'edit-card-header';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'edit-card-close';
  closeBtn.append(faIcon('xmark'));
  closeBtn.setAttribute('aria-label', 'Close editor');
  closeBtn.addEventListener('click', () => closeCard(key));
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Live preview re-render, debounced so typing doesn't thrash the iframe.
  const debouncedPreview = debounce(() => refreshEditIframe(iframe), 350);

  const fieldInputs = [];
  for (const ref of refs) {
    const group = document.createElement('div');
    group.className = 'edit-card-group';
    const isLong = ref.field === 'summary' || ref.field === 'intro' || ref.field === 'description';
    // Every field's sublabel names it for a screen reader (a9): a <label for>
    // on a text field, an id the editor or the media group points at otherwise.
    editFieldSeq += 1;
    const fieldId = `edit-field-${editFieldSeq}`;
    const sub = document.createElement(ref.field === 'image' || isLong ? 'span' : 'label');
    sub.className = 'edit-card-sublabel';
    sub.id = `${fieldId}-label`;
    sub.textContent = FIELD_LABELS[ref.field] || humanize(ref.field);
    group.appendChild(sub);

    const onEdit = (value) => {
      setField(state.issue, ref, value);
      scheduleSave();
      debouncedPreview();
    };

    if (ref.field === 'image') {
      const ctl = buildImageControl(getField(state.issue, ref) ?? '', onEdit);
      ctl.el.setAttribute('role', 'group');
      ctl.el.setAttribute('aria-labelledby', sub.id);
      group.appendChild(ctl.el);
      card.appendChild(group);
      fieldInputs.push({ ref, get: ctl.get, set: ctl.set, focus: ctl.focus });
    } else if (isLong) {
      // Prose fields get a WYSIWYG editor (bold / italic / link) that stores
      // markdown. Live-renders as the newsletter does (via renderProse).
      const rich = buildRichEditor(getField(state.issue, ref) ?? '', onEdit, { labelledBy: sub.id });
      group.appendChild(rich.el);
      card.appendChild(group);
      fieldInputs.push({ ref, get: rich.getMd, set: rich.setMd, focus: rich.focus });
    } else {
      const inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.id = fieldId;
      sub.htmlFor = fieldId;
      inputEl.className = 'edit-card-input';
      inputEl.value = getField(state.issue, ref) ?? '';
      inputEl.addEventListener('input', () => onEdit(inputEl.value));
      group.appendChild(inputEl);
      card.appendChild(group);
      fieldInputs.push({
        ref,
        get: () => inputEl.value,
        set: (v) => { inputEl.value = v; },
        focus: () => inputEl.focus(),
      });
    }
  }

  // What the fields held when the card opened, for Cancel (b29).
  const opened = fieldInputs.map((f) => ({ ref: f.ref, value: getField(state.issue, f.ref) ?? '' }));

  // Footer: quiet Use original and Cancel, then Save (commit & close this one card).
  const actions = document.createElement('div');
  actions.className = 'edit-card-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'edit-card-revert';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
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
  });
  const revertBtn = document.createElement('button');
  revertBtn.type = 'button';
  revertBtn.className = 'edit-card-revert';
  revertBtn.append(faIcon('rotate-left'), ' Use original');
  revertBtn.addEventListener('click', () => {
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
  });
  // Edits are live, so Save is a quiet word that closes the card (e32).
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'ghost-btn edit-card-save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => closeCard(key));
  // Remove this whole item from the issue (with Undo), only for real items,
  // not the intro. The desk's word for taking an item out of an issue (b26).
  const itemId = refs[0] && refs[0].item;
  if (itemId) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'edit-card-delete';
    delBtn.append(faIcon('trash-can'), ' Remove');
    delBtn.addEventListener('click', (e) => {
      closeCard(key);
      deleteItemWithUndo(itemId, renderEdit, e.detail === 0);
    });
    actions.appendChild(delBtn);
  }
  actions.appendChild(revertBtn);
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  card.appendChild(actions);

  list.appendChild(card);
  openCards.set(key, { card, refs });
  updateColumnChrome();

  card.scrollIntoView({ block: 'nearest' });
  requestAnimationFrame(() => fieldInputs[0] && fieldInputs[0].focus());
}

/**
 * Close one card (commit is implicit; edits are already live). Focus moves to
 * the next card's first field (the previous card's, failing that), else to the
 * column's title, so it never falls off the page (b31).
 */
function closeCard(key) {
  const entry = openCards.get(key);
  if (!entry) return;
  const neighbour = entry.card.nextElementSibling || entry.card.previousElementSibling;
  entry.card.remove();
  openCards.delete(key);
  updateColumnChrome();
  const field = neighbour && firstField(neighbour);
  if (field) { field.focus(); return; }
  const title = document.querySelector('.edit-column-title');
  if (title) title.focus();
}

/** Save all: close every open card. Does NOT navigate. */
function closeAllCards() {
  for (const { card } of openCards.values()) card.remove();
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
 * Render the edit step: large full-width editable-mode preview iframe.
 * The editable HTML has data-edit-* hooks for click-to-edit.
 * Called each time the wizard navigates to 'edit'.
 */
/**
 * Bucket a section's items for display: one bucket per non-empty group
 * (labeled), then a trailing unlabeled bucket for items that matched no
 * group. Flat sections = one bucket. (Same shape the Outline step renders.)
 * @param {object} reg - SECTION_REGISTRY entry
 * @param {Array<object>} secItems
 * @returns {Array<{label: string|null, items: Array<object>}>}
 */
function bucketSectionItems(reg, secItems) {
  const hasGroups = reg.groups && reg.groups.length > 0;
  const buckets = [];
  if (hasGroups) {
    const claimed = new Set();
    for (const grp of reg.groups) {
      const grpItems = secItems.filter((it) => it.group === grp.key);
      if (grpItems.length === 0) continue;
      grpItems.forEach((it) => claimed.add(it));
      buckets.push({ label: grp.label, items: grpItems });
    }
    const leftover = secItems.filter((it) => !claimed.has(it));
    if (leftover.length > 0) buckets.push({ label: null, items: leftover });
  } else {
    buckets.push({ label: null, items: secItems.slice() });
  }
  return buckets;
}

/**
 * Move one item within its display bucket and write the new order back into
 * the section's full item array (bucket members keep their original slots,
 * so items in other groups are untouched).
 * @param {Array<object>} allItems - the section's full items array (mutated)
 * @param {Array<object>} bucketItems - the bucket's items, display order
 * @param {number} fromIdx - index within the bucket being dragged
 * @param {number} toIdx - index within the bucket to land on
 */
function moveWithinBucket(allItems, bucketItems, fromIdx, toIdx) {
  if (fromIdx === toIdx) return;
  const positions = bucketItems.map((it) => allItems.indexOf(it));
  const newBucket = bucketItems.slice();
  const [moved] = newBucket.splice(fromIdx, 1);
  newBucket.splice(toIdx, 0, moved);
  positions.forEach((pos, i) => { allItems[pos] = newBucket[i]; });
}

/**
 * Build the collapsible drag-to-reorder panel for the edit column. Items are
 * grouped exactly like the Outline step; each row drags within its own group.
 * Dropping reorders the model, live-refreshes the preview, and autosaves.
 * @param {HTMLIFrameElement} iframe - the preview iframe to refresh
 * @returns {HTMLDetailsElement}
 */
function buildReorderPanel(iframe) {
  const details = document.createElement('details');
  details.className = 'reorder-panel';

  const summary = document.createElement('summary');
  summary.className = 'reorder-panel-summary';
  summary.textContent = 'Reorder items';
  details.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'reorder-panel-body';
  details.appendChild(body);

  // One polite region, outside the rebuilt body, says where a row landed (e34).
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  details.appendChild(live);

  const render = () => {
    body.innerHTML = '';
    const hint = document.createElement('p');
    hint.className = 'addon-hint';
    hint.id = 'reorder-hint';
    hint.textContent = 'Drag a row, or focus it and press the arrow keys.';
    body.appendChild(hint);
    for (const reg of SECTION_REGISTRY) {
      const sec = state.issue.sections[reg.key];
      const secItems = (sec && sec.items) || [];
      if (secItems.length < 1) continue;

      const secLabel = document.createElement('div');
      secLabel.className = 'reorder-section-label';
      secLabel.textContent = reg.label; // registry constant, safe as textContent
      body.appendChild(secLabel);

      for (const bucket of bucketSectionItems(reg, secItems)) {
        if (bucket.label) {
          const grpLabel = document.createElement('div');
          grpLabel.className = 'reorder-group-label';
          grpLabel.textContent = bucket.label;
          body.appendChild(grpLabel);
        }

        // Each bucket is a listbox of named options (e34).
        const listEl = document.createElement('div');
        listEl.className = 'reorder-list';
        listEl.setAttribute('role', 'listbox');
        listEl.setAttribute('aria-label', bucket.label ? `${reg.label}: ${bucket.label}` : reg.label);

        // One move for the drop and the arrow keys alike; the moved row keeps
        // focus across the rebuild (b27) and the live region says where it went.
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
          const rowEl = document.createElement('div');
          rowEl.className = 'reorder-row';
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

          const grip = document.createElement('span');
          grip.className = 'reorder-grip';
          grip.textContent = '⠿';
          grip.setAttribute('aria-hidden', 'true');
          rowEl.appendChild(grip);

          const titleSpan = document.createElement('span');
          titleSpan.className = 'reorder-title';
          // User-derived, textContent only.
          titleSpan.textContent = (item.fields && item.fields.title) || '(untitled)';
          rowEl.appendChild(titleSpan);

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

function renderEdit() {
  const container = document.querySelector('[data-step="edit"]');
  if (!container) return;

  // Drop any card registry from a previous visit (the DOM is rebuilt below).
  openCards.clear();

  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);
  attachStepInfo(container, 'edit', 'Check the issue and change anything in place.',
    'Click any text in the preview to edit it in a card on the right. The rail also holds the introduction, a one-off Add an item door, and reordering.');

  if (!state.issue) {
    const msg = document.createElement('p');
    msg.className = 'edit-empty-msg';
    msg.textContent = 'No issue loaded. Pull from the desk on the Review step first.';
    container.appendChild(msg);
    return;
  }

  // Drop any resize listener left over from a previous visit to this step.
  if (previewResizeHandler) {
    window.removeEventListener('resize', previewResizeHandler);
    previewResizeHandler = null;
  }

  // What the sheet is (f18): its scale, and that it is the editable one.
  const previewNote = document.createElement('p');
  previewNote.className = 'preview-note';
  const sayScale = (scale) => {
    previewNote.textContent = `Preview at ${Math.round(scale * 100)} percent, as it lands in Outlook. Click any text to edit it.`;
  };
  sayScale(PREVIEW_MAX_SCALE);
  container.appendChild(previewNote);

  const layout = document.createElement('div');
  layout.className = 'edit-layout';

  const wrap = document.createElement('div');
  wrap.className = 'edit-preview-wrap';

  const iframe = document.createElement('iframe');
  iframe.className = 'edit-preview-iframe';
  iframe.setAttribute('title', 'Newsletter preview: click fields to edit');
  // No inner scrollbar: the iframe is sized to the full content height and the
  // PAGE owns scrolling, so the only scrollbar is the browser's (outside the
  // sheet). Suppresses the faint phantom scrollbar the `zoom` transform would
  // otherwise leave on the newsletter from sub-pixel height rounding.
  iframe.setAttribute('scrolling', 'no');

  function fitPreview() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    // Measure the whole two-column row; the sheet's share is computed by the
    // helper (which reserves the column, gap, and both sides of stage padding).
    const layoutWidth = layout.clientWidth;
    if (!layoutWidth) return; // step not laid out yet; a later refit will run
    iframe.style.zoom = '1';
    iframe.style.width = PREVIEW_WIDTH + 'px';
    const contentHeight = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    iframe.style.height = contentHeight + 'px';
    const scale = computePreviewScale({
      layoutWidth, columnWidth: COLUMN_W, gap: EDIT_GAP, stagePad: STAGE_PAD,
      sheetWidth: PREVIEW_WIDTH, maxScale: PREVIEW_MAX_SCALE,
    });
    if (scale <= 0) return;
    iframe.style.zoom = String(scale);
    sayScale(scale);
  }
  refitPreview = fitPreview;

  // Wire click-to-edit and re-fit on every load (fires on each srcdoc set).
  // The rAF refit covers the case where the pane width isn't measurable at the
  // instant load fires (layout not yet flushed); the image listeners re-fit
  // once the (externally hosted) header banner finishes loading, so the iframe
  // height matches the final content height and no inner scrollbar appears.
  iframe.addEventListener('load', () => {
    wireIframeEditing(iframe, container);
    fitPreview();
    requestAnimationFrame(fitPreview);
    const doc = iframe.contentDocument;
    if (doc) {
      [...doc.images].forEach((img) => {
        if (!img.complete) img.addEventListener('load', fitPreview, { once: true });
      });
    }
  });

  previewResizeHandler = debounce(() => {
    fitPreview();
  }, 150);
  window.addEventListener('resize', previewResizeHandler);

  wrap.appendChild(iframe);
  layout.appendChild(wrap);

  // Persistent edit column (right). Always present so opening/closing cards
  // never reflows or rescales the sheet.
  const column = document.createElement('div');
  column.className = 'edit-column';

  const colHeader = document.createElement('div');
  colHeader.className = 'edit-column-header';
  const colTitle = document.createElement('span');
  colTitle.className = 'edit-column-title';
  colTitle.tabIndex = -1;   // where focus lands when the last card closes (b31)
  colTitle.textContent = 'Editing';
  const saveAllBtn = document.createElement('button');
  saveAllBtn.type = 'button';
  saveAllBtn.className = 'edit-saveall-btn';
  saveAllBtn.textContent = 'Save all';
  saveAllBtn.hidden = true;
  saveAllBtn.addEventListener('click', closeAllCards);
  colHeader.appendChild(colTitle);
  colHeader.appendChild(saveAllBtn);

  const cardList = document.createElement('div');
  cardList.className = 'edit-card-list';

  const emptyHint = document.createElement('div');
  emptyHint.className = 'edit-column-empty';
  emptyHint.textContent = 'Click any text in the preview on the left. It opens here to edit.';

  column.appendChild(colHeader);
  column.appendChild(cardList);
  column.appendChild(emptyHint);
  column.appendChild(buildIntroPanel(iframe));
  column.appendChild(buildAddItemPanel(iframe));
  column.appendChild(buildReorderPanel(iframe));
  layout.appendChild(column);

  container.appendChild(layout);
  iframe.srcdoc = renderNewsletter(state.issue, { editable: true });
}

// ---------------------------------------------------------------------------
// Export step
// ---------------------------------------------------------------------------

/**
 * Convert an issue date string to a URL-safe slug.
 * Lowercases, replaces non-alphanumeric runs with `-`, trims leading/trailing dashes.
 * Falls back to `"newsletter"` if the input is empty.
 * @param {string} date
 * @returns {string}
 */
function slugify(date) {
  if (!date || !date.trim()) return 'newsletter';
  return date
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Show a toast message in `container`. A success is a polite status that
 * fades after `duration` ms; an error is an alert that stays until the next
 * click on the export row or the next toast (a7).
 * @param {HTMLElement} container
 * @param {string} message
 * @param {'success'|'error'} [type='success']
 * @param {number} [duration=2800]
 */
function showExportToast(container, message, type = 'success', duration = 2800) {
  // Remove any existing toast
  const existing = container.querySelector('.export-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `export-toast export-toast--${type}`;
  if (type === 'error') toast.setAttribute('role', 'alert');
  else { toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); }
  // Use textContent, never innerHTML, for user-derived or code-derived messages
  const words = document.createElement('span');
  words.textContent = message;
  toast.append(noteIcon(type === 'error' ? 'circle-exclamation' : 'circle-check'), words);
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
 * Exposed as `window.__copyHtml` for testability.
 */
function copyHtml() {
  const container = document.querySelector('[data-step="export"]');
  if (!state.issue) {
    if (container) showExportToast(container, 'No issue loaded. Nothing to copy.', 'error');
    return;
  }

  const html = renderNewsletter(state.issue);

  const onSuccess = () => {
    if (container) showExportToast(container, 'Copied.', 'success');
  };
  const onError = (err) => {
    console.error('[export] copyHtml failed:', err);
    if (container) showExportToast(container, 'Copy failed. Check browser permissions.', 'error');
  };

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(html).then(onSuccess, (err) => {
      // Clipboard API rejected; try fallback
      try {
        fallbackCopy(html);
        onSuccess();
      } catch (e) {
        onError(err || e);
      }
    });
  } else {
    // No Clipboard API; use execCommand fallback
    try {
      fallbackCopy(html);
      onSuccess();
    } catch (e) {
      onError(e);
    }
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
 * Download the rendered newsletter as an .html file.
 * Exposed as `window.__downloadHtml` for testability.
 */
function downloadHtml() {
  if (!state.issue) return;
  const html = renderNewsletter(state.issue);
  const slug = slugify(state.issue.date);
  triggerDownload(
    new Blob([html], { type: 'text/html' }),
    `ERC_Newsletter_${slug}.html`
  );
  const container = document.querySelector('[data-step="export"]');
  if (container) showExportToast(container, 'Downloaded.', 'success');
}

/**
 * Create a temporary object URL, click a hidden <a download>, then revoke it.
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick to let the browser start the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Render the export step UI.
 * Called each time the wizard navigates to 'export'.
 */
function renderExport() {
  const container = document.querySelector('[data-step="export"]');
  if (!container) return;

  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);
  attachStepInfo(container, 'export', 'Copy the issue into Outlook, then archive it.',
    'Copy the finished HTML for Outlook, save the issue to the archive, or download the file. Copy HTML is the one Outlook needs.');

  // Nothing to export yet (d9): one plain sentence, no buttons.
  if (!state.issue || !countIssueItems(state.issue)) {
    const msg = document.createElement('p');
    msg.className = 'edit-empty-msg';
    msg.textContent = 'Nothing to export yet. Pull from the desk on the Review step first.';
    container.appendChild(msg);
    return;
  }

  // Button row. An error toast has no timeout; the next click on the row
  // clears it (in the capture phase, so a button's own new toast survives).
  const btnRow = document.createElement('div');
  btnRow.className = 'export-btn-row';
  btnRow.addEventListener('click', () => {
    const err = container.querySelector('.export-toast--error');
    if (err) err.remove();
  }, true);

  // Copy HTML: the step's one primary, with its icon in the slot (e32).
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-primary export-action-btn';
  copyBtn.append('Copy HTML', faIcon('copy'));
  copyBtn.addEventListener('click', copyHtml);

  // Download .html
  const dlHtmlBtn = document.createElement('button');
  dlHtmlBtn.type = 'button';
  dlHtmlBtn.className = 'btn btn-secondary export-action-btn';
  dlHtmlBtn.textContent = 'Download .html';
  dlHtmlBtn.addEventListener('click', downloadHtml);

  // Save to the archive: commits the issue's HTML through the desk, so it
  // shows up under Past newsletters for good. The archive write replaces an
  // earlier save, so the index is read on entry (d10): a date already there
  // gets one ask in the button's place before anything is written; a new
  // date saves on the click. An unreadable index falls back to the plain
  // button.
  const archiveSlot = document.createElement('span');
  archiveSlot.className = 'archive-slot';
  const archiveBtn = document.createElement('button');
  archiveBtn.type = 'button';
  archiveBtn.className = 'btn btn-secondary export-action-btn';
  archiveBtn.textContent = 'Save to the archive';
  archiveSlot.appendChild(archiveBtn);
  const indexReady = fetch(`${DESK_URL}/builder/newsletters/index.json`, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  let savedThisVisit = null;   // a save on this visit puts the date in the archive; the next click asks

  // After the save: a note that stays, with the way to the archive and the way on (e31).
  const after = document.createElement('div');
  after.className = 'export-after';

  const saveToArchive = async (iso) => {
    archiveSlot.replaceChildren();   // the button (or the ask) is gone while saving; no double-clicks
    const saveStatus = document.createElement('span');
    saveStatus.className = 'pull-status';
    saveStatus.append(dotsLoader(true), loadingLabel('Saving…'));
    archiveSlot.appendChild(saveStatus);
    try {
      const res = await fetch(`${DESK_URL}/api/newsletter-archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueDate: iso, html: renderNewsletter(state.issue) }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'save failed');
      // The issue went out: stamped, so a later visit's banner says so (e31).
      state.issue.sentAt = new Date().toISOString();
      saveState(state.issue);
      savedThisVisit = { date: iso, label: isoToDisplayDate(iso) };
      const note = inlineNote('success', data.replaced ? 'Saved to the archive, replacing the earlier save.' : 'Saved to the archive.');
      note.classList.add('save-note');
      const open = document.createElement('a');
      open.href = 'archive.html';
      open.textContent = 'Open Past newsletters';
      note.append(open);
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'btn btn-tertiary';
      next.append('Start the next issue', faIcon('arrow-right'));
      next.addEventListener('click', startNextIssue);
      after.replaceChildren(note, next);
    } catch (err) {
      showExportToast(container, err.message || "Couldn't save to the archive.", 'error');
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

  btnRow.appendChild(copyBtn);
  btnRow.appendChild(archiveSlot);
  btnRow.appendChild(dlHtmlBtn);

  container.appendChild(btnRow);
  container.appendChild(after);

  // Toast target: toasts are appended here
}

/** The way on after an issue is archived (e31): storage cleared, back to Review for the next one. */
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
 * removes it (d8); while it asks, nothing writes storage and the Issue select
 * and Pull are locked. Restore sets state.issue and moves on; Discard clears
 * storage with an Undo.
 * @param {object} saved - the issue loaded from storage
 */
function showRestoreBanner(saved) {
  const home = document.querySelector('.wizard-body');
  if (!home) return;
  document.getElementById('restore-banner')?.remove();
  restorePending = true;

  const banner = document.createElement('div');
  banner.id = 'restore-banner';
  banner.className = 'restore-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Restore in-progress newsletter');

  const msg = document.createElement('p');
  msg.className = 'restore-banner__msg';
  msg.append(noteIcon('triangle-exclamation'), restoreBannerMessage(saved));   // names the date and the count (a10)

  const btnRow = document.createElement('div');
  btnRow.className = 'restore-banner__btns';

  const settle = () => {
    restorePending = false;
    banner.remove();
  };

  const restoreBtn = document.createElement('button');
  restoreBtn.type = 'button';
  restoreBtn.className = 'btn btn-primary restore-banner__btn';
  restoreBtn.textContent = 'Restore';
  restoreBtn.addEventListener('click', () => {
    settle();
    state.issue = saved;
    state.baseline = structuredClone(saved);
    // An issue with items goes on to the Outline; one without stays on Review (d9).
    goTo(countIssueItems(saved) ? 'triage' : 'review');
  });

  const discardBtn = document.createElement('button');
  discardBtn.type = 'button';
  discardBtn.className = 'btn btn-secondary restore-banner__btn';
  discardBtn.textContent = 'Discard';
  discardBtn.addEventListener('click', (e) => {
    settle();
    clearState();
    if (state.step === 'review') renderReview();   // unlocks the Issue select and Pull
    // Gone from storage, not from memory: Undo writes it back and asks again (a10).
    showUndoToast('Discarded the saved issue', () => {
      saveState(saved);
      showRestoreBanner(saved);
      if (state.step === 'review') renderReview();   // locks them again while it asks
    }, { focusUndo: e.detail === 0 });
  });

  btnRow.appendChild(restoreBtn);
  btnRow.appendChild(discardBtn);
  banner.appendChild(msg);
  banner.appendChild(btnRow);
  home.insertBefore(banner, home.firstChild);
}

window.__state = state;
window.__renderTriage = renderTriage;
window.__renderEdit = renderEdit;
window.__renderExport = renderExport;
window.__copyHtml = copyHtml;
window.__downloadHtml = downloadHtml;
window.__slugify = slugify;
window.__saveState = saveState;
window.__loadState = loadState;
window.__clearState = clearState;
// The desk's sidebar, tucked behind the thin strip like Desk work (Kate, Sep 16).
renderSidebar(document.querySelector('.side'), { screen: 'builder', isSectionWindow: false, onGo: () => {}, queueCount: null });
// A saved issue locks Review before it is drawn, so the first render already knows (d8).
const savedIssue = loadState();
restorePending = Boolean(savedIssue);
goTo('review');
if (savedIssue) showRestoreBanner(savedIssue);
