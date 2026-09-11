/** Entry point. Owns all state; screens are pure renderers. */
import { fetchDesk, saveRows, readNewRows } from './sheet-client.js';
import { readAllWaiting } from './reader-client.js';
import { readerQueue } from './sort-view.js';
import { dotsLoader, loadingLabel } from './icons.js';
import { renderHome } from './home-ui.js';
import { renderSort } from './sort-ui.js';
import { renderFinalize, resetFinalizeEntry } from './finalize-ui.js';
import { renderPublish, downloadCsv } from './publish-ui.js';
import { renderNewsletter, resetNewsletterEntry } from './newsletter-ui.js';
import { keep, trash, circleback, undecide, markNewsletterIssue, clearNewsletterIssue, withoutAutoFilled, readyToPublish, canRewrite } from './workflow.js';


const state = {
  rows: [],
  schedule: [],
  screen: 'home',
  loaded: false,
  busy: false,
  sortFilter: '',           // '' = all; 'untyped' or a type key (view state)
  sortedThisVisit: 0,       // decisions made since page load (view state)
  undoStack: [],            // [{ id, prevStatus }] — every decision, newest last
  sortedIds: new Set(),     // decided since this page opened — they stay browsable (view state)
  lastDecision: null,       // the top of undoStack (what Undo would restore)
  rewriteReview: new Map(), // id -> the pre-rewrite description, until she checks it (view state)
  verifiedIds: new Set(),   // rewrites she has checked this visit (view state)
  reviewTotal: 0,           // size of the current check batch, for "2 of 4" (view state)
  justPublished: 0,         // count from the last publish, until she leaves the screen (view state)
  justSent: null,           // { count, issue, ids } from the last newsletter send (view state)
  publishPreview: null,
  publishedCsv: '',       // the CSV from the last publish, for the receipt's re-download
  hubUpdated: null,
  rewroteNote: null,
};

const screens = Object.fromEntries(['home', 'sort', 'finalize', 'publish', 'build']
  .map(name => [name, document.querySelector(`#screen-${name}`)]));
const statusEl = document.querySelector('#desk-status');

export function setStatus(message, kind = 'busy') {
  statusEl.className = `status status-${kind}`;
  // Anything in flight shows the dots loader, text underneath (Kate, Sep 1).
  if (kind === 'busy' && message) {
    statusEl.replaceChildren(dotsLoader(), loadingLabel(message));
  } else {
    statusEl.textContent = message;
  }
}

export async function reload() {
  // Home shows its own loader while empty — no second row in the bar.
  setStatus(state.screen === 'home' ? '' : 'Loading…');
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
    state.publishPreview = null;   // data changed — the next Publish visit re-checks
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

/* ---- Background save queue -----------------------------------------------
 * Sort decisions and inline edits update memory + re-render INSTANTLY (no wait
 * on the ~4s Sheet write), then their write drains here: ONE PATCH in flight at
 * a time (never a concurrent burst — that was the old throttle bug), the latest
 * change per row wins, and a failed write RETRIES rather than resyncing (a
 * resync reshuffles the cards mid-sort — the other half of the old bug). The
 * desk is left exactly as she left it until the write catches up.
 * Confirmation-critical writes (send / un-send) still go through persist().
 */
const pendingWrites = new Map();   // _rowNumber -> latest row awaiting write
let flushing = false;
let writeErrored = false;

/** Apply changes to memory + re-render now; queue the Sheet write behind it. */
function noteChange(rows) {
  const byRowNumber = new Map(rows.map(r => [r._rowNumber, r]));
  state.rows = state.rows.map(r => byRowNumber.get(r._rowNumber) ?? r);
  state.publishPreview = null;   // data changed — the next Publish visit re-checks
  for (const r of rows) pendingWrites.set(r._rowNumber, r);
  render();
  drainWrites();
}

async function drainWrites() {
  if (flushing) return;
  flushing = true;
  while (pendingWrites.size) {
    const batch = new Map(pendingWrites);                    // snapshot
    for (const rn of batch.keys()) pendingWrites.delete(rn); // claim them
    try {
      await saveRows([...batch.values()]);                   // one PATCH; server serializes
    } catch {
      // Never resync (that reshuffles). Return the un-superseded rows to the
      // queue and retry after a pause; the UI stays exactly as-is.
      for (const [rn, row] of batch) if (!pendingWrites.has(rn)) pendingWrites.set(rn, row);
      flushing = false;
      writeErrored = true;
      setStatus('Saving your changes — reconnecting…', 'note');
      setTimeout(drainWrites, 4000);
      return;
    }
  }
  flushing = false;
  if (writeErrored) { writeErrored = false; setStatus('', 'ok'); }  // caught up
}

/** True while any decision is still on its way to the Sheet. */
function saveOutstanding() {
  return flushing || pendingWrites.size > 0;
}

// The one thing the queue cannot survive is the tab closing mid-drain: those
// decisions live only in memory until they land. The browser's own leave-site
// prompt is the only guard it will honour (the wording is the browser's).
window.addEventListener('beforeunload', event => {
  if (!saveOutstanding()) return;
  event.preventDefault();
  event.returnValue = '';   // Safari and older Chrome still need this to prompt
});

/** Resolves once the queue has fully drained — awaited before consequential,
 *  server-read actions (publish / send) so the Sheet reflects every decision. */
function whenSaved() {
  return new Promise(resolve => {
    const check = () => (!saveOutstanding()) ? resolve() : setTimeout(check, 150);
    check();
  });
}

/** Every Sort mutation goes through here: snapshot the rows as they are (for
 *  Undo), then apply + queue the save. Covers decisions, inline edits, the
 *  type picker and the link check — so Undo can walk back any of them. */
function change(rows, { decision = false, step = true } = {}) {
  const before = rows
    .map(r => state.rows.find(x => x._rowNumber === r._rowNumber))
    .filter(Boolean);
  if (before.length) {
    state.undoStack.push({ rows: before, decision, step });
    state.lastDecision = state.undoStack[state.undoStack.length - 1];
  }
  noteChange(rows);
}

function decide(row, action, note = '', { step = true } = {}) {
  // A decided card keeps its slot in the stream so ‹ scrolls back to it. First
  // decision on a card therefore has to step PAST it; changing your mind about a
  // card you already decided just restamps it where you are.
  const firstTime = !state.sortedIds.has(row.id);
  if (firstTime) {
    state.sortedThisVisit += 1;
    state.sortedIds.add(row.id);
    // The headline list decides in place (step: false); only the carousel steps past.
    if (step) { state.sortBrowse = (state.sortBrowse ?? 0) + 1; saveSortSpot(); }
  }
  const next = action === 'keep' ? keep(row)
    : action === 'trash' ? trash(row)
    : circleback(row, note);
  change([next], { decision: true, step });   // next card shows now; the write drains behind it
}

/** The headline list's one button: keep every row still standing, as one
 *  decision Undo last walks back as one. */
function keepAll(rows) {
  if (!rows.length) return;
  for (const r of rows) {
    if (state.sortedIds.has(r.id)) continue;
    state.sortedThisVisit += 1;
    state.sortedIds.add(r.id);
  }
  change(rows.map(keep), { decision: true, step: false });
}

/** Undo on one greyed row of the headline list: back to the queue, in place. */
function undoRow(row) {
  state.sortedIds.delete(row.id);
  state.sortedThisVisit = Math.max(0, state.sortedThisVisit - 1);
  change([undecide(row)], { step: false });
}

// Rows still waiting for the reader are read before Sort shows a card: the
// background read after submit is best-effort, this makes it certain. The
// screen switches at once; the status bar carries the wait.
async function readBeforeSort() {
  const ids = readerQueue(state.rows);
  if (!ids.length) return;
  setStatus(`Reading ${ids.length} new item${ids.length === 1 ? '' : 's'}…`);
  try {
    const { failed } = await readAllWaiting(ids, readNewRows);
    await reload();
    if (failed) setStatus(`${failed} new item${failed === 1 ? '' : 's'} couldn't be read yet. Reload to try again.`, 'error');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

function goTo(key) {
  if (key !== state.screen) setStatus('');   // last screen's message doesn't follow
  if (key === 'sort' && state.screen !== 'sort') readBeforeSort();
  if (key === 'finalize' && state.screen !== 'finalize') resetFinalizeEntry();
  if (key === 'build' && state.screen !== 'build') { resetNewsletterEntry(); state.justSent = null; }
  if (key === 'publish' && state.screen !== 'publish') {
    // The check is read-only and CACHED: it runs on first arrival and again
    // only after something changed (persist clears it) or via Re-check.
    state.justPublished = 0;
    state.publishedCsv = '';
    state.screen = key;
    if (!state.publishPreview) { loadPublishPreview(); return; }
  }
  state.screen = key;
  render();
}

async function undoLast() {
  const last = state.undoStack.pop();
  if (!last) return;
  state.lastDecision = state.undoStack[state.undoStack.length - 1] ?? null;
  if (last.decision) {
    state.sortedThisVisit = Math.max(0, state.sortedThisVisit - last.rows.length);
    // Deciding stepped past the card; undoing steps back onto it, so you land on
    // what you just walked back rather than staring at the card after it. A
    // headline-list decision never stepped, so it never steps back.
    for (const r of last.rows) state.sortedIds.delete(r.id);
    if (last.step !== false) {
      state.sortBrowse = Math.max(0, (state.sortBrowse ?? 0) - 1);
      saveSortSpot();
    }
  }
  noteChange(last.rows);   // restore the rows exactly as they were
}

async function runRewrite() {
  // Scope the request to exactly what Finalize is showing — the server
  // applies the same shared predicate, so the two can never disagree.
  const ids = readyToPublish(state.rows)
    .filter(r => canRewrite(r) && !state.rewriteReview.has(r.id))
    .map(r => r.id);
  if (!ids.length) return;
  state.busy = true;
  render();
  setStatus('');   // Finalize's own loader carries this — no second row in the bar
  try {
    const res = await fetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    // Nothing persists yet: the originals stay safe in the Sheet, the new
    // text lives in local rows, and each check decision saves its row —
    // /api/rewrite stays read-only, as its own header promises.
    // Only the ids we asked for count: an extra id in the response would
    // otherwise inflate the note and leave a zombie check that locks the
    // Rewrite and Go to Publish buttons.
    const wanted = new Set(ids);
    const byId = new Map(data.rewrites.filter(r => wanted.has(r.id)).map(r => [r.id, r.blurb]));
    for (const [id] of byId) {
      state.rewriteReview.set(id, state.rows.find(r => r.id === id)?.blurb ?? '');
    }
    state.reviewTotal = state.rewriteReview.size;
    state.rows = state.rows.map(r => byId.has(r.id) ? { ...r, blurb: byId.get(r.id) } : r);
    // One message, one place: a warning ("Nothing to rewrite") shows in
    // Finalize's lede beside the button, not the page header (F11).
    state.rewroteNote = byId.size
      ? `Rewrote ${byId.size} description${byId.size === 1 ? '' : 's'} — check them one by one.`
      : (data.warnings?.join(' ') || 'Nothing to rewrite.');
    setStatus('');
  } catch (err) {
    setStatus(err.message, 'error');
  }
  state.busy = false;
  render();
}

async function loadPublishPreview() {
  state.busy = true;
  render();
  await whenSaved();   // the server reads the Sheet — let queued decisions land first
  setStatus('');   // Publish's own loader carries this — no second row in the bar
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
  await whenSaved();   // every decision must be in the Sheet before the server reads it
  try {
    const res = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    state.publishPreview = null;
    state.justPublished = data.published;
    state.publishedCsv = data.csv ?? '';
    state.busy = false;
    // The spare copy saves itself — Kate, Sep 9: "when we publish, we need to
    // download that csv". Her browser drops it straight into Drive.
    if (state.publishedCsv) downloadCsv(state.publishedCsv);
    // reload() writes its own 'Loading…'/'' status; the confirmation message
    // has to be set after it finishes, or reload() overwrites it.
    await reload();
    setStatus(data.warning ? data.warning : '', data.warning ? 'note' : 'ok');   // the receipt card is the confirmation
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
  await whenSaved();   // no queued write may race the issue stamp
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

// A reload (or an accidental same-tab jump and Back) shouldn't lose Kate's
// place mid-sort — the spot rides sessionStorage, view state only.
const SORT_SPOT_KEY = 'desk-sort-spot';
function saveSortSpot() {
  try {
    sessionStorage.setItem(SORT_SPOT_KEY, JSON.stringify({ filter: state.sortFilter, browse: state.sortBrowse ?? 0 }));
  } catch { /* private mode etc. — losing the spot is fine */ }
}
try {
  const spot = JSON.parse(sessionStorage.getItem(SORT_SPOT_KEY) ?? 'null');
  if (spot && typeof spot.filter === 'string') {
    state.sortFilter = spot.filter;
    state.sortBrowse = Math.max(0, Number(spot.browse) || 0);
  }
} catch { /* ignore bad stashes */ }

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
      hubUpdated: state.hubUpdated,
      onSubmitted: reload,
      onRefresh: reload,
      // The queue's trash can, through the same queued write as Sort. Undo hands
      // back the status the row actually had — a deleted circle-back must come
      // back a circle-back, not a fresh submission.
      onDeleteFromQueue: (row, action) => change([
        action === 'trash' ? trash(row) : { ...row, status: action },
      ]),
    });
  } else if (state.screen === 'sort') {
    renderSort(screens.sort, {
      ...common, filter: state.sortFilter, sortedCount: state.sortedThisVisit,
      onGoTo: goTo,
      lastDecision: state.lastDecision, browse: state.sortBrowse ?? 0,
      sessionDecided: state.sortedIds,
      onBrowse: pos => { state.sortBrowse = Math.max(0, pos); saveSortSpot(); render(); },
      onFilter: key => { state.sortFilter = key; state.sortBrowse = 0; saveSortSpot(); render(); },
      onDecide: decide, onUndo: undoLast, onKeepAll: keepAll, onUndoRow: undoRow,
      onEditRow: (row, changes) => change([{ ...row, ...changes }]),
      // Type + subtype + provenance move together in one queued write.
      onEditType: (row, type, subtype) => change([{
        ...row, type, subtype: subtype || row.subtype,
        auto_filled: withoutAutoFilled(row.auto_filled, subtype ? ['type', 'subtype'] : ['type']),
      }]),
      onVerifyLink: (row, newLink) => change([{
        ...row, ...(newLink ? { link: newLink } : {}), link_checked: 'human',
      }]),
    });
  } else if (state.screen === 'finalize') {
    renderFinalize(screens.finalize, {
      ...common, review: state.rewriteReview, verified: state.verifiedIds,
      reviewTotal: state.reviewTotal, busy: state.busy, rewroteNote: state.rewroteNote,
      onEditRow: (row, changes) => noteChange([{ ...row, ...changes }]),
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
      onTrash: row => {
        // Junk spotted mid-finalize goes straight out (Kate, Sep 1) — and any
        // open check for it is dropped so the queue count stays honest.
        state.rewriteReview.delete(row.id);
        state.verifiedIds.delete(row.id);
        persist([trash(row)]);
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
      justPublished: state.justPublished, publishedCsv: state.publishedCsv,
      onPublish: publishNow, onGoTo: goTo,
      onRecheck: () => { state.publishPreview = null; loadPublishPreview(); },
    });
  } else {
    renderNewsletter(screens.build, {
      ...common, busy: state.busy, justSent: state.justSent,
      onSend: sendToNewsletter,
      onUnsend: unsendFromNewsletter,
      onTrash: row => persist([trash(row)]),
    });
  }
}

for (const tab of document.querySelectorAll('.screen-tab[data-screen]')) {
  tab.addEventListener('click', () => goTo(tab.dataset.screen));
}

// Home's "Exchange updated" fact: when news.csv last changed, not the date
// column (item dates can sit in the future). The Exchange repo is private,
// so the desk asks its own endpoint, which reads the live file's header.
// Fetched once per visit; a miss leaves the dash.
(async () => {
  try {
    const res = await fetch('/api/hub-updated');
    const stamp = (await res.json())?.lastModified;
    const d = new Date(stamp ?? NaN);
    state.hubUpdated = Number.isNaN(d.getTime()) ? ''
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { state.hubUpdated = ''; }
  render();
})();

render();   // the shell paints before the first fetch, not after it (usability run F19)
reload();
