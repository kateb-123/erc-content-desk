/**
 * app.js — ERC Newsletter Builder wizard shell
 *
 * Holds wizard state and step navigation. Later tasks import the
 * pure-logic modules (parser/serialize/template/model) as they wire up
 * each step.
 */

import { SECTION_REGISTRY, mergeIssueItems, createEmptyIssue, mergeIssues, deleteItem, insertItem, issueLinks, partitionPulled, countIssueItems } from './model.js';

// The builder lives INSIDE the desk's project (/builder/), so the desk's API
// is same-origin — relative fetches, no CORS. ?desk= still overrides for
// unusual dev setups.
const DESK_URL = new URLSearchParams(window.location.search).get('desk') || '';
let pullMessage = ''; // survives the Outline re-render after a pull
import { renderNewsletter, renderProse } from './template.js';
import { saveState, loadState, clearState } from './state.js';
import { getField, setField } from './editpath.js';
import { computePreviewScale } from './preview.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const STEPS = ['review', 'triage', 'edit', 'export'];

const state = {
  /** @type {object|null} Parsed newsletter issue model */
  issue: null,
  /** @type {object|null} Deep-clone of issue at parse/restore time — used by "Revert to original" */
  baseline: null,
  /** @type {string} Current wizard step key */
  step: 'review',
};

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
  if (state.issue) saveState(state.issue);
}, 400);

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const btnBack = document.getElementById('btn-back');
const btnNext = document.getElementById('btn-next');
const topBack = document.getElementById('top-back');
const topNext = document.getElementById('top-next');

/** @type {NodeListOf<HTMLElement>} */
const stepSections = document.querySelectorAll('[data-step]');

/** @type {NodeListOf<HTMLElement>} */
const stepIndicators = document.querySelectorAll('[data-nav-step]');

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

  // Show/hide step containers
  stepSections.forEach((section) => {
    if (section.dataset.step === step) {
      section.removeAttribute('hidden');
    } else {
      section.setAttribute('hidden', '');
    }
  });

  // Update step indicator highlights + completed check-pills.
  // A step reads as "completed" (green check) once an issue is loaded and it
  // sits before the current step in the flow.
  stepIndicators.forEach((indicator) => {
    const navStep = indicator.dataset.navStep;
    const isActive = navStep === step;
    const navIdx = STEPS.indexOf(navStep);
    indicator.classList.toggle('active', isActive);
    indicator.classList.toggle(
      'completed',
      Boolean(state.issue) && !isActive && navIdx > -1 && navIdx < idx,
    );
  });

  // Enable/disable nav controls (footer buttons + top links, kept in sync)
  const atStart = idx === 0;
  const atEnd = idx === STEPS.length - 1;
  btnBack.disabled = atStart;
  btnNext.disabled = atEnd;
  topBack.disabled = atStart;
  topNext.disabled = atEnd;

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
  if (idx < STEPS.length - 1) goTo(STEPS[idx + 1]);
}
btnBack.addEventListener('click', goBack);
btnNext.addEventListener('click', goNext);
topBack.addEventListener('click', goBack);
topNext.addEventListener('click', goNext);

// Step indicators are clickable — jump straight to any step. Review is
// always reachable; the later steps need a loaded issue.
stepIndicators.forEach((ind) => {
  ind.addEventListener('click', () => {
    const target = ind.dataset.navStep;
    if (!target || target === state.step) return;
    const builderSteps = ['triage', 'edit', 'export'];
    if (builderSteps.includes(target) && !state.issue) return;
    goTo(target);
  });
});

// __renderTriage exposed after function definition below


function renderReview() {
  const container = document.querySelector('[data-step="review"]');
  if (!container) return;
  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);

  const intro = document.createElement('p');
  intro.textContent = 'Set the issue date, pull what the desk staged, and look it over. Pull again any time — only new items are added.';
  container.appendChild(intro);

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
  dateSelect.addEventListener('change', () => {
    if (!dateSelect.value) return;
    if (!state.issue) state.issue = createEmptyIssue();
    // The issue keeps the display string the header renders ("July 01, 2026").
    state.issue.date = isoToDisplayDate(dateSelect.value);
    scheduleSave();
  });
  dateLabel.appendChild(dateSelect);
  metaSection.appendChild(dateLabel);
  container.appendChild(metaSection);

  // Fill the dropdown from the desk: scheduled dates plus anything staged.
  (async () => {
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
      placeholder.textContent = currentIso ? isoToDisplayDate(currentIso) : "Couldn't reach the desk";
    }
  })();

  // ── Pull from the desk: the Content Desk's Newsletter screen stamps items
  //    for an issue; this button fetches them, already builder-shaped.
  //    Re-pull adds only what's new (matched by link). ────────────────────
  const sideDoor = document.createElement('div');
  sideDoor.className = 'template-help';
  const pullBtn = document.createElement('button');
  pullBtn.type = 'button';
  pullBtn.className = 'btn btn-secondary md-sidedoor-btn';
  pullBtn.textContent = 'Pull from the desk';
  const pullStatus = document.createElement('span');
  pullStatus.className = 'pull-status';
  pullStatus.textContent = pullMessage;
  const setPull = (msg) => { pullMessage = msg; pullStatus.textContent = msg; };
  pullBtn.addEventListener('click', async () => {
    const iso = displayDateToISO(state.issue?.date || '');
    if (!iso) return setPull('Set the issue date first.');
    pullBtn.disabled = true;
    setPull('Pulling…');
    try {
      const res = await fetch(`${DESK_URL}/api/newsletter-pull?issue=${iso}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'pull failed');
      if (!countIssueItems(data.issue)) {
        const staged = Object.entries(data.staged ?? {}).sort(([a], [b]) => a.localeCompare(b));
        setPull(staged.length
          ? `Nothing staged for ${isoToDisplayDate(iso)} — the desk has ${staged[0][1]} staged for ${isoToDisplayDate(staged[0][0])}.`
          : `Nothing staged for ${isoToDisplayDate(iso)}.`);
        return;
      }
      if (!state.issue) state.issue = createEmptyIssue();
      const { pulled, already } = partitionPulled(data.issue, issueLinks(state.issue));
      const fresh = countIssueItems(pulled);
      if (fresh) {
        pulled.date = ''; // never clobber the issue's own date field
        mergeIssues(state.issue, pulled);
        state.baseline = structuredClone(state.issue);
        scheduleSave();
      }
      setPull(already ? `Pulled ${fresh} new · ${already} already here.` : `Pulled ${fresh} from the desk.`);
      if (fresh) renderReview();
    } catch {
      setPull("Couldn't reach the desk — try again.");
    } finally {
      pullBtn.disabled = false;
    }
  });
  sideDoor.appendChild(pullBtn);
  sideDoor.appendChild(document.createTextNode(' '));
  sideDoor.appendChild(pullStatus);
  container.appendChild(sideDoor);

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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** "July 01, 2026" → "2026-07-01" for a date input ('' when unparseable). */
function displayDateToISO(str) {
  const t = Date.parse(str);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-07-01" → "July 01, 2026" (component-wise — no timezone drift). */
function isoToDisplayDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${MONTH_NAMES[m - 1]} ${String(d).padStart(2, '0')}, ${y}`;
}

/**
 * Delete one item from the issue, with a transient Undo toast. Shared by the
 * Outline row ✕ and the Preview & Edit card's Delete button. `rerender` rebuilds
 * whichever step is showing so the removal (and any undo) is reflected at once.
 */
let _undoToastTimer = null;
function deleteItemWithUndo(itemId, rerender) {
  const removed = deleteItem(state.issue, itemId);
  if (!removed) return;
  scheduleSave();
  rerender();
  const title = (removed.item.fields && removed.item.fields.title) || 'item';
  showUndoToast(`Removed “${title}”`, () => {
    insertItem(state.issue, removed.sectionKey, removed.index, removed.item);
    scheduleSave();
    rerender();
  });
}

/** Bottom toast with an Undo button; auto-dismisses after a few seconds. */
function showUndoToast(message, onUndo) {
  clearTimeout(_undoToastTimer);
  const prior = document.querySelector('.undo-toast');
  if (prior) prior.remove();

  const toast = document.createElement('div');
  toast.className = 'undo-toast';
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
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('undo-toast--visible'));
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

  const issue = state.issue;

  // ── Sections ─────────────────────────────────────────────────────────────
  const sectionsHeading = document.createElement('h3');
  sectionsHeading.className = 'triage-sections-heading';
  sectionsHeading.textContent = 'Sections';
  container.appendChild(sectionsHeading);

  const sectionsList = document.createElement('div');
  sectionsList.className = 'triage-sections-list';

  for (const reg of SECTION_REGISTRY) {
    const secData = issue && issue.sections && issue.sections[reg.key];
    const items = (secData && secData.items) || [];
    const isEmpty = items.length === 0;
    const row = document.createElement('div');
    row.className = 'triage-section-row';

    // No toggle: every populated section is always included; empty sections
    // auto-hide (nothing to render).
    if (secData) secData.enabled = !isEmpty;

    // Section name — with item count (e.g. "ERC Spotlight (2)") when non-empty
    const nameSpan = document.createElement('span');
    nameSpan.className = 'triage-section-name';
    nameSpan.textContent = isEmpty ? reg.label : `${reg.label} (${items.length})`;
    if (isEmpty) nameSpan.classList.add('triage-section-name--empty');
    row.appendChild(nameSpan);

    // Note for empty sections
    if (isEmpty) {
      const note = document.createElement('span');
      note.className = 'triage-section-note';
      note.textContent = '(empty in your file — nothing to show)';
      row.appendChild(note);
    }

    sectionsList.appendChild(row);

    // Every populated section lists its items with reorder controls: grouped
    // (under group labels) where the section defines groups, flat otherwise
    // (e.g. Featured Research). Only Events also shows the featured toggle.
    if (items.length > 0) {
      const sectionContainer = document.createElement('div');
      sectionContainer.className = 'triage-grouped-section';

      const renderSectionItems = () => {
        sectionContainer.innerHTML = '';
        const secItems = (issue && issue.sections && issue.sections[reg.key] && issue.sections[reg.key].items) || [];
        const hasGroups = reg.groups && reg.groups.length > 0;

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
            grpLabel.textContent = bucket.label; // registry constant — safe as textContent
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

            // Title (user-derived — textContent only)
            const titleSpan = document.createElement('span');
            titleSpan.className = 'triage-event-title';
            titleSpan.textContent = (item.fields && item.fields.title) || '(untitled)';

            // Up button
            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'triage-reorder-btn';
            upBtn.textContent = '↑';
            upBtn.setAttribute('aria-label', `Move "${title}" up`);
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
            downBtn.textContent = '↓';
            downBtn.setAttribute('aria-label', `Move "${title}" down`);
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

            // Featured toggle — events section only. Compact; the "what it does"
            // note is a hover tooltip so it doesn't repeat on every row.
            if (reg.key === 'events') {
              const featLabel = document.createElement('label');
              featLabel.className = 'triage-featured-label';
              featLabel.title = 'Pins this event to the top under a Featured heading — choose one.';

              const featCb = document.createElement('input');
              featCb.type = 'checkbox';
              featCb.className = 'triage-featured-cb';
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

            // Reorder arrows — grouped so they can reveal on row hover/focus.
            const reorderGroup = document.createElement('div');
            reorderGroup.className = 'triage-reorder-group';
            reorderGroup.appendChild(upBtn);
            reorderGroup.appendChild(downBtn);
            evRow.appendChild(reorderGroup);

            // Delete this item from the issue (with Undo). Trims overflow without
            // going back to the source .md.
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'triage-delete-btn';
            delBtn.textContent = '✕';
            delBtn.setAttribute('aria-label', `Delete "${title}"`);
            delBtn.title = 'Remove this item from the newsletter';
            delBtn.addEventListener('click', () => deleteItemWithUndo(item.id, renderTriage));
            evRow.appendChild(delBtn);

            sectionContainer.appendChild(evRow);
          }
        }
      };

      renderSectionItems();
      sectionsList.appendChild(sectionContainer);

      // ERC Research: optional "Submit your research" callout — a trailing
      // on/off switch beneath the research items.
      if (reg.key === 'research') {
        const subRow = document.createElement('div');
        subRow.className = 'triage-switch-row';

        const subName = document.createElement('span');
        subName.className = 'triage-switch-label';
        subName.textContent = 'Submit your research callout';

        const switchLine = document.createElement('div');
        switchLine.className = 'triage-switch-line';

        const sw = document.createElement('label');
        sw.className = 'triage-switch';
        sw.title = 'Show this callout in the newsletter for this issue';
        const subCb = document.createElement('input');
        subCb.type = 'checkbox';
        subCb.className = 'triage-switch-input';
        subCb.checked = secData.showSubmit !== false;
        const track = document.createElement('span');
        track.className = 'triage-switch-track';
        sw.appendChild(subCb);
        sw.appendChild(track);

        const stateLabel = document.createElement('span');
        stateLabel.className = 'triage-switch-state';
        stateLabel.textContent = subCb.checked ? 'On' : 'Off';

        subCb.addEventListener('change', () => {
          secData.showSubmit = subCb.checked;
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
}

// ---------------------------------------------------------------------------
// Edit step ("Preview & Edit")
// ---------------------------------------------------------------------------

/** CSS injected into the editable iframe to show hover affordance. */
const EDIT_HOVER_CSS = `
[data-edit-field] {
  cursor: pointer;
  border-radius: 2px;
  transition: outline 0.1s;
}
/* Hovering any field highlights every field of that whole item (applied by JS),
   since clicking edits the whole item at once. Soft translucent fill (not a
   hard outline) so the item reads as one gentle highlight. The matching
   box-shadow pads the fill out a few px and bridges the gaps between fields. */
.ec-edit-hover {
  background-color: rgba(254, 200, 102, 0.35);
  box-shadow: 0 0 0 4px rgba(254, 200, 102, 0.35);
  border-radius: 2px;
}
`;

/**
 * Open editor cards, keyed by item ref ("section::item"). Lets several items
 * be edited at once; re-clicking an open item focuses its card instead of
 * duplicating. @type {Map<string, { card: HTMLElement, refs: Array }>}
 */
const openCards = new Map();

/** Stable key for an item ref group. */
function refKey(section, item) {
  return `${section}::${item || ''}`;
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

/** Persistent edit-column width (px) — matches .edit-column in styles.css. */
const COLUMN_W = 340;
/** Flex gap between preview and edit column — matches .edit-layout gap. */
const EDIT_GAP = 20;
/** Horizontal padding on ONE side of the gray stage — matches .edit-preview-wrap. */
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
 * type (debounced) — the editor lives outside the iframe, so focus holds.
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
  details.appendChild(body);
  return details;
}

let miscItemSeq = 0;

/**
 * The one-off door: add a single item by hand — something that never went
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

  const eventFields = [field('Date', dateInput), field('Time', timeInput), field('Location', locationInput)];
  const oppFields = [field('Deadline', deadlineInput)];
  const syncExtras = () => {
    const key = sectionSelect.value;
    const isEventy = key === 'events' || key === 'spotlight';
    for (const f of eventFields) f.hidden = !isEventy;
    for (const f of oppFields) f.hidden = key !== 'opportunities';
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
    miscItemSeq += 1;
    const section = state.issue.sections[sectionSelect.value];
    section.items.push({ id: `misc_${Date.now().toString(36)}_${miscItemSeq}`, group: groupSelect.value, fields });
    section.enabled = true;
    scheduleSave();
    refreshEditIframe(iframe);
    for (const input of [titleInput, linkInput, summaryInput, dateInput, timeInput, locationInput, deadlineInput]) input.value = '';
    status.textContent = `Added to ${SECTION_REGISTRY.find((r) => r.key === sectionSelect.value)?.label}.`;
  });

  body.appendChild(field('Section', sectionSelect));
  body.appendChild(groupField);
  body.appendChild(field('Title', titleInput));
  body.appendChild(field('Link', linkInput));
  body.appendChild(field('Summary', summaryInput));
  for (const f of eventFields) body.appendChild(f);
  for (const f of oppFields) body.appendChild(f);
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
  style.textContent = EDIT_HOVER_CSS;
  (doc.head || doc.documentElement).appendChild(style);

  // Hover affordance — highlight EVERY field of the item under the cursor, so
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

  // Click listener — open an editor for the whole item the clicked field
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
  els.forEach((el) => el.classList.add('ec-edit-hover'));
  setTimeout(() => els.forEach((el) => el.classList.remove('ec-edit-hover')), 600);
}

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
  // won't be picked up above — add it explicitly. Also lets you ADD a link
  // to an item that doesn't have one yet.
  if (seen.has('title') && !seen.has('url')) {
    const ti = refs.findIndex((r) => r.field === 'title');
    refs.splice(ti + 1, 0, { section, item, field: 'url' });
  }
  return refs;
}

/** Friendly sub-labels for known field keys (fallback: capitalized key). */
const FIELD_LABELS = {
  title: 'Title',
  url: 'Link URL',
  meta: 'Details',
  summary: 'Summary',
  description: 'Description',
  author: 'Author',
  authors: 'Authors',
  intro: 'Intro',
  date: 'Date',
  name: 'Name',
  eyebrow: 'Label',
};

/** Title-case a section key for the panel header (e.g. "spotlight" → "Spotlight"). */
function humanize(key) {
  return String(key || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Converts a contentEditable's HTML back into the markdown we store — the
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
 */
function buildRichEditor(initialMd, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'rich-editor';

  const editable = document.createElement('div');
  editable.className = 'rich-editable';
  editable.contentEditable = 'true';
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
  toolbar.appendChild(mkBtn('🔗', 'Add link', () => {
    const url = window.prompt('Link URL:');
    if (url) document.execCommand('createLink', false, url);
  }));

  editable.addEventListener('input', emit);

  wrap.appendChild(toolbar);
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
    const first = existing.card.querySelector('input, textarea, [contenteditable]');
    if (first) first.focus();
    return;
  }

  const card = document.createElement('div');
  card.className = 'edit-card';
  card.setAttribute('role', 'group');

  // Header: just a close control (× behaves like Save — edits are live). No
  // title label — the fields below make it clear which item you're editing.
  const header = document.createElement('div');
  header.className = 'edit-card-header';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'edit-card-close';
  closeBtn.textContent = '✕';
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
    const sub = document.createElement('span');
    sub.className = 'edit-card-sublabel';
    sub.textContent = FIELD_LABELS[ref.field] || humanize(ref.field);
    group.appendChild(sub);

    const isLong = ref.field === 'summary' || ref.field === 'intro' || ref.field === 'description';
    const onEdit = (value) => {
      setField(state.issue, ref, value);
      scheduleSave();
      debouncedPreview();
    };

    if (isLong) {
      // Prose fields get a WYSIWYG editor (bold / italic / link) that stores
      // markdown. Live-renders as the newsletter does (via renderProse).
      const rich = buildRichEditor(getField(state.issue, ref) ?? '', onEdit);
      group.appendChild(rich.el);
      card.appendChild(group);
      fieldInputs.push({ ref, get: rich.getMd, set: rich.setMd, focus: rich.focus });
    } else {
      const inputEl = document.createElement('input');
      inputEl.type = 'text';
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

  // Footer: quiet Revert + Save (commit & close this one card).
  const actions = document.createElement('div');
  actions.className = 'edit-card-actions';
  const revertBtn = document.createElement('button');
  revertBtn.type = 'button';
  revertBtn.className = 'edit-card-revert';
  revertBtn.textContent = 'Revert to original';
  revertBtn.addEventListener('click', () => {
    for (const f of fieldInputs) {
      const original = getField(state.baseline, f.ref) ?? '';
      f.set(original);
      setField(state.issue, f.ref, original);
    }
    scheduleSave();
    refreshEditIframe(iframe);
  });
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary edit-card-save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => closeCard(key));
  // Delete this whole item (with Undo) — only for real items, not the intro.
  const itemId = refs[0] && refs[0].item;
  if (itemId) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'edit-card-delete';
    delBtn.textContent = 'Delete item';
    delBtn.addEventListener('click', () => {
      closeCard(key);
      deleteItemWithUndo(itemId, renderEdit);
    });
    actions.appendChild(delBtn);
  }
  actions.appendChild(revertBtn);
  actions.appendChild(saveBtn);
  card.appendChild(actions);

  list.appendChild(card);
  openCards.set(key, { card, refs });
  updateColumnChrome();

  card.scrollIntoView({ block: 'nearest' });
  requestAnimationFrame(() => fieldInputs[0] && fieldInputs[0].focus());
}

/** Close one card (commit is implicit — edits are already live). */
function closeCard(key) {
  const entry = openCards.get(key);
  if (!entry) return;
  entry.card.remove();
  openCards.delete(key);
  updateColumnChrome();
}

/** Save all — close every open card. Does NOT navigate. */
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

  const render = () => {
    body.innerHTML = '';
    for (const reg of SECTION_REGISTRY) {
      const sec = state.issue.sections[reg.key];
      const secItems = (sec && sec.items) || [];
      if (secItems.length < 1) continue;

      const secLabel = document.createElement('div');
      secLabel.className = 'reorder-section-label';
      secLabel.textContent = reg.label; // registry constant — safe as textContent
      body.appendChild(secLabel);

      for (const bucket of bucketSectionItems(reg, secItems)) {
        if (bucket.label) {
          const grpLabel = document.createElement('div');
          grpLabel.className = 'reorder-group-label';
          grpLabel.textContent = bucket.label;
          body.appendChild(grpLabel);
        }

        const listEl = document.createElement('div');
        listEl.className = 'reorder-list';

        bucket.items.forEach((item, idx) => {
          const rowEl = document.createElement('div');
          rowEl.className = 'reorder-row';
          rowEl.draggable = bucket.items.length > 1;

          const grip = document.createElement('span');
          grip.className = 'reorder-grip';
          grip.textContent = '⠿';
          grip.setAttribute('aria-hidden', 'true');
          rowEl.appendChild(grip);

          const titleSpan = document.createElement('span');
          titleSpan.className = 'reorder-title';
          // User-derived — textContent only.
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
            moveWithinBucket(state.issue.sections[reg.key].items, bucket.items, fromIdx, idx);
            render();
            refreshEditIframe(iframe);
            scheduleSave();
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

  if (!state.issue) {
    const msg = document.createElement('p');
    msg.className = 'edit-empty-msg';
    msg.textContent = 'No issue loaded — pull from the desk on the Review step first.';
    container.appendChild(msg);
    return;
  }

  // Drop any resize listener left over from a previous visit to this step.
  if (previewResizeHandler) {
    window.removeEventListener('resize', previewResizeHandler);
    previewResizeHandler = null;
  }

  const layout = document.createElement('div');
  layout.className = 'edit-layout';

  const wrap = document.createElement('div');
  wrap.className = 'edit-preview-wrap';

  const iframe = document.createElement('iframe');
  iframe.className = 'edit-preview-iframe';
  iframe.setAttribute('title', 'Newsletter preview — click fields to edit');
  // No inner scrollbar — the iframe is sized to the full content height and the
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
  emptyHint.textContent = 'Click any part of the newsletter to edit it.';

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
 * Show a temporary toast message in `container`.
 * Auto-dismisses after `duration` ms.
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
  // Use textContent — never innerHTML — for user-derived or code-derived messages
  toast.textContent = message;
  container.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => toast.classList.add('export-toast--visible'));

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
    if (container) showExportToast(container, 'No issue loaded — nothing to copy.', 'error');
    return;
  }

  const html = renderNewsletter(state.issue);

  const onSuccess = () => {
    if (container) showExportToast(container, 'HTML copied to clipboard!', 'success');
  };
  const onError = (err) => {
    console.error('[export] copyHtml failed:', err);
    if (container) showExportToast(container, 'Copy failed — check browser permissions.', 'error');
  };

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(html).then(onSuccess, (err) => {
      // Clipboard API rejected — try fallback
      try {
        fallbackCopy(html);
        onSuccess();
      } catch (e) {
        onError(err || e);
      }
    });
  } else {
    // No Clipboard API — use execCommand fallback
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

  if (!state.issue) {
    const msg = document.createElement('p');
    msg.className = 'edit-empty-msg';
    msg.textContent = 'No issue loaded. Build one from Review, or add content from a .md on the Outline step.';
    container.appendChild(msg);
    return;
  }

  // Description paragraph
  const desc = document.createElement('p');
  desc.className = 'export-desc';
  desc.textContent = 'Your newsletter is ready. Copy the HTML to paste directly into Outlook Web App, or download the file.';
  container.appendChild(desc);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.className = 'export-btn-row';

  // Copy HTML
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-primary export-action-btn';
  copyBtn.textContent = 'Copy HTML';
  copyBtn.addEventListener('click', copyHtml);

  // Download .html
  const dlHtmlBtn = document.createElement('button');
  dlHtmlBtn.type = 'button';
  dlHtmlBtn.className = 'btn btn-secondary export-action-btn';
  dlHtmlBtn.textContent = 'Download .html';
  dlHtmlBtn.addEventListener('click', downloadHtml);

  // Save to the archive — commits the issue's HTML through the desk, so it
  // shows up under "View past newsletters" for good.
  const archiveBtn = document.createElement('button');
  archiveBtn.type = 'button';
  archiveBtn.className = 'btn btn-secondary export-action-btn';
  archiveBtn.textContent = 'Save to the archive';
  archiveBtn.addEventListener('click', async () => {
    const iso = displayDateToISO(state.issue?.date || '');
    if (!iso) { showExportToast(container, 'Set the issue date on Review first.', 'error'); return; }
    archiveBtn.disabled = true;
    archiveBtn.textContent = 'Saving…';
    try {
      const res = await fetch(`${DESK_URL}/api/newsletter-archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueDate: iso, html: renderNewsletter(state.issue) }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'save failed');
      showExportToast(container, data.replaced
        ? 'Saved to the archive (replaced the earlier save).' : 'Saved to the archive.', 'success');
    } catch (err) {
      showExportToast(container, err.message || "Couldn't save to the archive.", 'error');
    } finally {
      archiveBtn.disabled = false;
      archiveBtn.textContent = 'Save to the archive';
    }
  });

  btnRow.appendChild(copyBtn);
  btnRow.appendChild(archiveBtn);
  btnRow.appendChild(dlHtmlBtn);

  container.appendChild(btnRow);

  // Toast target — toasts are appended here
}

// ---------------------------------------------------------------------------
// Boot — restore prompt
// ---------------------------------------------------------------------------

/**
 * Show a restore-session banner inside the review step if a saved issue
 * exists in localStorage. Restore → set state.issue and advance to triage.
 * Discard → clear storage and hide the banner.
 */
function maybeShowRestoreBanner() {
  const saved = loadState();
  if (!saved) return;

  const activeSection = document.querySelector(`[data-step="${state.step}"]`);
  if (!activeSection) return;

  const banner = document.createElement('div');
  banner.id = 'restore-banner';
  banner.className = 'restore-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Restore in-progress newsletter');

  const msg = document.createElement('p');
  msg.className = 'restore-banner__msg';
  msg.textContent = 'Restore your in-progress newsletter?';

  const btnRow = document.createElement('div');
  btnRow.className = 'restore-banner__btns';

  const restoreBtn = document.createElement('button');
  restoreBtn.type = 'button';
  restoreBtn.className = 'btn btn-primary restore-banner__btn';
  restoreBtn.textContent = 'Restore';
  restoreBtn.addEventListener('click', () => {
    state.issue = saved;
    state.baseline = structuredClone(saved);
    banner.remove();
    goTo('triage');
  });

  const discardBtn = document.createElement('button');
  discardBtn.type = 'button';
  discardBtn.className = 'btn btn-secondary restore-banner__btn';
  discardBtn.textContent = 'Discard';
  discardBtn.addEventListener('click', () => {
    clearState();
    banner.remove();
  });

  btnRow.appendChild(restoreBtn);
  btnRow.appendChild(discardBtn);
  banner.appendChild(msg);
  banner.appendChild(btnRow);

  // Insert at the top of the active step section
  activeSection.insertBefore(banner, activeSection.firstChild);
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
goTo('review');
maybeShowRestoreBanner();
