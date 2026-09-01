/** Entry point. Owns all state; screens are pure renderers. */
import { fetchDesk, saveRows } from './sheet-client.js';
import { renderHome } from './home-ui.js';
import { renderSort } from './sort-ui.js';
import { renderFinalize, resetFinalizeEntry } from './finalize-ui.js';
import { renderPublish } from './publish-ui.js';
import { renderNewsletter, resetNewsletterEntry } from './newsletter-ui.js';
import { keep, trash, circleback, undecide, markNewsletterIssue, clearNewsletterIssue, withoutAutoFilled, readyToPublish, needsErcVoice } from './workflow.js';


const state = {
  rows: [],
  schedule: [],
  screen: 'home',
  loaded: false,
  busy: false,
  sortFilter: '',           // '' = all; 'untyped' or a type key (view state)
  sortedThisVisit: 0,       // decisions made since page load (view state)
  lastDecision: null,       // { id, prevStatus }
  rewriteReview: new Map(), // id -> the pre-rewrite description, until she checks it (view state)
  verifiedIds: new Set(),   // rewrites she has checked this visit (view state)
  reviewTotal: 0,           // size of the current check batch, for "2 of 4" (view state)
  justPublished: 0,         // count from the last publish, until she leaves the screen (view state)
  justSent: null,           // { count, issue, ids } from the last newsletter send (view state)
  publishPreview: null,
};

const screens = Object.fromEntries(['home', 'sort', 'finalize', 'publish', 'build']
  .map(name => [name, document.querySelector(`#screen-${name}`)]));
const statusEl = document.querySelector('#desk-status');

export function setStatus(message, kind = 'busy') {
  statusEl.textContent = message;
  statusEl.className = `status status-${kind}`;
}

export async function reload() {
  setStatus('Loading…');
  try {
    const { rows, schedule } = await fetchDesk();
    state.rows = rows;
    state.schedule = schedule;
    state.loaded = true;
    setStatus('', 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  }
  render();
}

/** Persist changed rows, then merge the saved copies back in by _rowNumber.
 *  Returns true on success so callers can gate their confirmations — a
 *  failed write must never be reported as done. */
export async function persist(changed) {
  if (!changed.length) return true;
  try {
    await saveRows(changed);
    const byRowNumber = new Map(changed.map(r => [r._rowNumber, r]));
    state.rows = state.rows.map(r => byRowNumber.get(r._rowNumber) ?? r);
    render();
    return true;
  } catch (err) {
    // Set the error, reload to resync with the sheet (which overwrites
    // status), then set the error again so the user still sees what failed.
    setStatus(err.message, 'error');
    await reload();
    setStatus(err.message, 'error');
    return false;
  }
}

async function decide(row, action, note = '') {
  state.lastDecision = { id: row.id, prevStatus: row.status };
  state.sortedThisVisit += 1;
  const next = action === 'keep' ? keep(row)
    : action === 'trash' ? trash(row)
    : circleback(row, note);
  await persist([next]);
}

function goTo(key) {
  if (key === 'finalize' && state.screen !== 'finalize') resetFinalizeEntry();
  if (key === 'build' && state.screen !== 'build') { resetNewsletterEntry(); state.justSent = null; }
  if (key === 'publish' && state.screen !== 'publish') {
    // The check is read-only, so arriving runs it — the report is the page.
    state.publishPreview = null;
    state.justPublished = 0;
    state.screen = key;
    loadPublishPreview();
    return;
  }
  state.screen = key;
  render();
}

async function undoLast() {
  const last = state.lastDecision;
  if (!last) return;
  const row = state.rows.find(r => r.id === last.id);
  if (!row) return;
  state.lastDecision = null;
  state.sortedThisVisit = Math.max(0, state.sortedThisVisit - 1);
  await persist([{ ...row, status: last.prevStatus }]);
}

async function runRewrite() {
  // Scope the request to exactly what Finalize is showing — the server
  // applies the same shared predicate, so the two can never disagree.
  const ids = readyToPublish(state.rows)
    .filter(r => needsErcVoice(r) && !state.rewriteReview.has(r.id))
    .map(r => r.id);
  if (!ids.length) return;
  state.busy = true;
  render();
  setStatus('Rewriting descriptions…');
  try {
    const res = await fetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    // Nothing persists yet: the originals stay safe in the Sheet, the new
    // text lives in local rows, and each check decision saves its row —
    // /api/rewrite stays read-only, as its own header promises.
    const byId = new Map(data.rewrites.map(r => [r.id, r.blurb]));
    for (const [id] of byId) {
      state.rewriteReview.set(id, state.rows.find(r => r.id === id)?.blurb ?? '');
    }
    state.reviewTotal = state.rewriteReview.size;
    state.rows = state.rows.map(r => byId.has(r.id) ? { ...r, blurb: byId.get(r.id) } : r);
    setStatus(data.warnings?.length ? data.warnings.join(' ')
      : `Rewrote ${byId.size} description${byId.size === 1 ? '' : 's'} — check them one by one.`, 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  }
  state.busy = false;
  render();
}

async function loadPublishPreview() {
  state.busy = true;
  render();
  setStatus('Checking against the live Exchange…');
  try {
    const res = await fetch('/api/publish');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    state.publishPreview = data;
    setStatus('', 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  }
  state.busy = false;
  render();
}

async function publishNow() {
  state.busy = true;
  render();
  setStatus('Publishing to the Exchange…');
  try {
    const res = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const message = `Published ${data.published} new item(s)` +
      (data.skipped ? ` — ${data.skipped} already on the Exchange` : '') +
      '. The site updates in about a minute.' +
      (data.warning ? ` ${data.warning}` : '');
    state.publishPreview = null;
    state.justPublished = data.published;
    state.busy = false;
    // reload() writes its own 'Loading…'/'' status; the confirmation message
    // has to be set after it finishes, or reload() overwrites it.
    await reload();
    setStatus(message, 'ok');
    return;
  } catch (err) {
    setStatus(err.message, 'error');
  }
  state.busy = false;
  render();
}

async function sendToNewsletter(selectedRows, issue) {
  state.busy = true;
  render();
  setStatus(`Sending ${selectedRows.length} to the newsletter…`);
  const ok = await persist(selectedRows.map(r => markNewsletterIssue(r, issue)));
  state.busy = false;
  if (!ok) { render(); return; } // persist already showed the error
  state.justSent = { count: selectedRows.length, issue, ids: selectedRows.map(r => r.id) };
  setStatus(`Sent ${selectedRows.length} to the newsletter builder.`, 'ok');
  render();
}

/** The un-send: clear the stamps and the rows rejoin the pool. */
async function unsendFromNewsletter(ids) {
  const targets = state.rows.filter(r => ids.includes(r.id));
  if (!targets.length) return;
  const ok = await persist(targets.map(clearNewsletterIssue));
  if (!ok) return; // persist already showed the error; the stamps stand
  state.justSent = null;
  setStatus(`Pulled ${targets.length} back from the newsletter.`, 'ok');
  render();
}

const SCREEN_ORDER = ['home', 'sort', 'finalize', 'publish', 'build'];
let shownScreen = null;

export function render() {
  for (const [name, el] of Object.entries(screens)) el.hidden = name !== state.screen;
  for (const tab of document.querySelectorAll('.screen-tab[data-screen]')) {
    tab.classList.toggle('is-active', tab.dataset.screen === state.screen);
  }
  if (shownScreen !== state.screen) {
    const from = SCREEN_ORDER.indexOf(shownScreen);
    const to = SCREEN_ORDER.indexOf(state.screen);
    const incoming = screens[state.screen];
    if (from !== -1 && incoming) {
      incoming.classList.remove('slide-in-left', 'slide-in-right');
      void incoming.offsetWidth;
      incoming.classList.add(to > from ? 'slide-in-right' : 'slide-in-left');
      incoming.addEventListener('animationend',
        () => incoming.classList.remove('slide-in-left', 'slide-in-right'), { once: true });
    }
    shownScreen = state.screen;
  }
  const today = new Date().toISOString().slice(0, 10);
  const common = { rows: state.rows, schedule: state.schedule, today };
  if (state.screen === 'home') {
    renderHome(screens.home, {
      ...common, loaded: state.loaded,
      onGoTo: goTo,
      onSubmitted: reload,
      onRefresh: reload,
    });
  } else if (state.screen === 'sort') {
    renderSort(screens.sort, {
      ...common, filter: state.sortFilter, sortedCount: state.sortedThisVisit,
      lastDecision: state.lastDecision, browse: state.sortBrowse ?? 0,
      onBrowse: pos => { state.sortBrowse = Math.max(0, pos); render(); },
      onFilter: key => { state.sortFilter = key; state.sortBrowse = 0; render(); },
      onDecide: decide, onUndo: undoLast,
      // One PATCH for type + subtype + provenance together — sequential
      // round-trips re-render mid-save and reopen the picker.
      onEditType: (row, type, subtype) => persist([{
        ...row, type, subtype: subtype || row.subtype,
        auto_filled: withoutAutoFilled(row.auto_filled, subtype ? ['type', 'subtype'] : ['type']),
      }]),
      onVerifyLink: (row, newLink) => persist([{
        ...row, ...(newLink ? { link: newLink } : {}), link_checked: 'human',
      }]),
    });
  } else if (state.screen === 'finalize') {
    renderFinalize(screens.finalize, {
      ...common, review: state.rewriteReview, verified: state.verifiedIds,
      reviewTotal: state.reviewTotal, busy: state.busy,
      onEditRow: (row, changes) => persist([{ ...row, ...changes }]),
      onRewrite: runRewrite,
      // Every check decision stamps rewrite_checked so the state survives reload
      // (and the endpoint never rewrites a checked row again).
      onVerifyRewrite: id => {
        const row = state.rows.find(r => r.id === id);
        state.rewriteReview.delete(id);
        state.verifiedIds.add(id);
        if (row) persist([{ ...row, rewrite_checked: new Date().toISOString() }]);
        else render();
      },
      onRevertRewrite: row => {
        const old = state.rewriteReview.get(row.id) ?? '';
        state.rewriteReview.delete(row.id);
        state.verifiedIds.add(row.id);
        persist([{ ...row, blurb: old, rewrite_checked: new Date().toISOString() }]);
      },
      onCheckEdit: (row, changes) => {
        state.rewriteReview.delete(row.id);
        state.verifiedIds.add(row.id);
        persist([{ ...row, ...changes, rewrite_checked: new Date().toISOString() }]);
      },
      onGoTo: goTo,
    });
  } else if (state.screen === 'publish') {
    renderPublish(screens.publish, {
      ...common, preview: state.publishPreview, busy: state.busy,
      justPublished: state.justPublished,
      onPublish: publishNow, onGoTo: goTo,
    });
  } else {
    renderNewsletter(screens.build, {
      ...common, busy: state.busy, justSent: state.justSent,
      onSend: sendToNewsletter,
      onUnsend: unsendFromNewsletter,
    });
  }
}

for (const tab of document.querySelectorAll('.screen-tab[data-screen]')) {
  tab.addEventListener('click', () => goTo(tab.dataset.screen));
}

reload();
