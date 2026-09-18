/** Entry point. Owns all state; screens are pure renderers. */
import { fetchDesk, saveRows, readNewRows, readReply, postJson, plainError } from './sheet-client.js';
import { readAllWaiting } from './reader-client.js';
import { readerQueue, undoWords, withoutRow } from './sort-view.js';
import { dotsLoader, loadingLabel } from './icons.js';
import { renderHome } from './home-ui.js';
import { renderShell } from './shell-ui.js';
import { openedScreen, screenHash, pageTitle } from './shell-view.js';
import { renderIssue, resetIssueEntry } from './issue-ui.js';
import { nextIssueDate } from './schedule.js';
import { renderSort } from './sort-ui.js';
import { renderFinalize, resetFinalizeEntry } from './finalize-ui.js';
import { renderPublish, downloadCsv, resetPublishAsk } from './publish-ui.js';
import { renderNewsletter, resetNewsletterEntry } from './newsletter-ui.js';
import { keep, trash, circleback, markNewsletterIssue, clearNewsletterIssue, withoutAutoFilled, readyToPublish, canRewrite } from './workflow.js';


const state = {
  rows: [],
  schedule: [],
  screen: 'home',
  loaded: false,
  loadFailed: false,         // the first read failed: Home and Next newsletter offer Try again
  busy: false,
  sortFilter: '',           // '' = not picked yet (Sort lands where the work is); 'fix', 'erc', or a type key
  undoStack: [],            // [{ rows, decision, kind }]: every Sort change, newest last; its top is what Undo last would restore
  sortedIds: new Set(),     // decided since this page opened — they stay listed, greyed (view state)
  decidedFrom: new Map(),   // id -> status before this session's decision: where Undo takes it back, and a row kept from Skipped greys under Skipped (view state)
  rewriteReview: new Map(), // id -> the pre-rewrite description, until she checks it (view state)
  verifiedIds: new Set(),   // rewrites she has checked this visit (view state)
  reviewTotal: 0,           // size of the current check batch, for "2 of 4" (view state)
  justPublished: 0,         // count from the last publish, until she leaves the screen (view state)
  justSent: null,           // { issue, ids } from the last newsletter send (view state)
  publishPreview: null,
  publishedCsv: '',       // the CSV from the last publish, for the receipt's re-download
  rewroteNote: null,
  lastKeepAll: null,        // [{ id, old }] from the last Keep all remaining, until undone or left
};

const screens = Object.fromEntries(['home', 'issue', 'sort', 'finalize', 'publish', 'build']
  .map(name => [name, document.querySelector(`#screen-${name}`)]));
const statusEl = document.querySelector('#desk-status');

/** The status line. An error is an alert, so it is read at once (design
 *  audit b3); an action ({ label, onClick }) puts a quiet button after the words. */
function setStatus(message, kind = 'busy', action = null) {
  statusEl.className = `status status-${kind}`;
  statusEl.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  // Anything in flight shows the dots loader beside its words; with
  // a retry button, the sentence does not also say to try again.
  if (action) message = message.replace(/ Try again in a minute\.$/, '');
  if (kind === 'busy' && message) {
    // Inline, one line tall: a message never moves the page.
    statusEl.replaceChildren(dotsLoader(true), loadingLabel(message));
  } else {
    statusEl.textContent = message;
  }
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'linkish';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { btn.disabled = true; action.onClick(); });
    statusEl.append(' ', btn);
  }
}

async function reload() {
  // Home shows its own loader while empty — no second row in the bar.
  setStatus(state.screen === 'home' ? '' : 'Loading…');
  try {
    const { rows, schedule } = await fetchDesk();
    state.rows = rows;
    state.schedule = schedule;
    state.loaded = true;
    state.loadFailed = false;
    setStatus('', 'ok');
  } catch (err) {
    state.loadFailed = !state.loaded;
    // The way to try again sits on the line that says why, not inside a closed fold.
    setStatus(plainError(err), 'error', { label: 'Try again', onClick: reload });
  }
  render();
}

/** Persist changed rows, then merge the saved copies back in by _rowNumber.
 *  Returns true on success so callers can gate their confirmations — a
 *  failed write must never be reported as done. */
async function persist(changed) {
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
    setStatus(plainError(err), 'error');
    await reload();
    setStatus(plainError(err), 'error');
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
const saveWaiters = [];            // resolve() for everyone awaiting an empty queue
let flushing = false;
let writeFailures = 0;             // failed drains in a row: the second one turns the note into an alert with Retry now
let retryTimer = null;

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
    const batch = new Map(pendingWrites);                    // snapshot, then claim
    pendingWrites.clear();
    try {
      await saveRows([...batch.values()]);                   // one PATCH; server serializes
    } catch {
      // Never resync (that reshuffles). Return the un-superseded rows to the
      // queue and retry after a pause; the UI stays exactly as-is.
      for (const [rn, row] of batch) if (!pendingWrites.has(rn)) pendingWrites.set(rn, row);
      flushing = false;
      writeFailures += 1;
      // The first miss is a quiet note; from the second on it is an alert with a way to act.
      if (writeFailures < 2) setStatus('Reconnecting to save your changes…', 'note');
      else setStatus(`${pendingWrites.size} change${pendingWrites.size === 1 ? '' : 's'} not saved yet. Still trying.`, 'error', { label: 'Retry now', onClick: () => { clearTimeout(retryTimer); drainWrites(); } });
      retryTimer = setTimeout(drainWrites, 4000);
      return;
    }
  }
  flushing = false;
  if (writeFailures) setStatus('', 'ok');   // caught up
  writeFailures = 0;
  for (const resolve of saveWaiters.splice(0)) resolve();
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
  return saveOutstanding() ? new Promise(resolve => saveWaiters.push(resolve)) : Promise.resolve();
}

/** Every Sort mutation goes through here: snapshot the rows as they are (for
 *  Undo), then apply + queue the save. Covers decisions, inline edits, the
 *  type picker and the link check — so Undo can walk back any of them. */
function change(rows, { decision = false, kind = 'edit' } = {}) {
  const before = rows
    .map(r => state.rows.find(x => x._rowNumber === r._rowNumber))
    .filter(Boolean);
  if (before.length) state.undoStack.push({ rows: before, decision, kind });
  noteChange(rows);
}

const DECIDED_WORDS = { keep: 'Kept', trash: 'Deleted', circleback: 'Skipped' };

function decide(row, action) {
  // A decided row holds its place, greyed at the bottom of its section, so a
  // mistake stays in reach. Deciding never moves you.
  state.decidedFrom.set(row.id, row.status);
  state.sortedIds.add(row.id);
  const next = action === 'keep' ? keep(row)
    : action === 'trash' ? trash(row)
    : circleback(row);
  change([next], { decision: true, kind: action });   // the list updates now; the write drains behind it
  // The decision in words, for everyone and for a screen reader.
  setStatus(`${DECIDED_WORDS[action] ?? 'Done'}: ${row.headline || row.link || 'this item'}`, 'ok');
}

/** Keep the rest: keep every row still standing in the section, as one
 *  decision Undo last walks back as one. */
function keepAll(rows) {
  if (!rows.length) return;
  for (const r of rows) {
    state.decidedFrom.set(r.id, r.status);
    state.sortedIds.add(r.id);
  }
  change(rows.map(keep), { decision: true, kind: 'keep-all' });
  setStatus(`Kept ${rows.length}`, 'ok');
}

/** Undo on one greyed row of a section's list: back to the queue, in place. */
function undoRow(row) {
  // Back to what it was: a row kept from Skipped returns to Skipped, not to new.
  const back = state.decidedFrom.get(row.id) ?? 'new';
  state.sortedIds.delete(row.id);
  state.decidedFrom.delete(row.id);
  // The row's own Undo leaves the stack, so Undo last cannot re-apply it.
  state.undoStack = withoutRow(state.undoStack, row.id);
  setStatus(undoWords({ kind: { kept: 'keep', trashed: 'trash', circleback: 'circleback' }[row.status], rows: [row] }), 'ok');
  noteChange([{ ...row, status: back }]);
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
    // A failed read offers its own retry; a reload would drop the greyed rows and Undo.
    if (failed) setStatus(`${failed} new item${failed === 1 ? '' : 's'} couldn't be read yet.`, 'error', { label: 'Try again', onClick: readBeforeSort });
  } catch (err) {
    setStatus(plainError(err), 'error', { label: 'Try again', onClick: readBeforeSort });
  }
}

/** Quick add on the Next issue page: the form has just put a
 *  new item in the queue; read it, then stamp it for the next issue, so it
 *  sits in the issue and in Sort at once ("everything is talking to each
 *  other"). The table marks it Not sorted yet until Sort has had it. */
async function stampSubmitted(data) {
  const today = new Date().toISOString().slice(0, 10);
  const issue = nextIssueDate(state.schedule, today);
  const id = data?.id;
  if (!id) { await reload(); return; }   // nothing came back to stamp; the reload shows what landed
  if (!issue) { await reload(); throw new Error('No issue date is scheduled, so it is in the queue only.'); }
  // The reader fills the title and description first, so the stamp's write
  // never lands under the reader's; a read that fails leaves the bare link,
  // which Sort will show and read again.
  try { await readAllWaiting([id], readNewRows); } catch { /* Sort catches up */ }
  await reload();
  const row = state.rows.find(r => r.id === id);
  if (!row) throw new Error("It is in the queue, but the desk couldn't find it to stamp it for the newsletter.");
  await whenSaved();
  // The outcome goes back to the panel that asked, which resolves to "In the
  // Sep 22 newsletter" or shows the error with Try again; nothing lands at the
  // top of the page. A failed stamp leaves the row
  // unstamped in memory and in the sheet alike, so there is nothing to resync.
  const stamped = markNewsletterIssue(row, issue);
  try {
    await saveRows([stamped]);
  } catch (err) {
    throw new Error(plainError(err));
  }
  state.rows = state.rows.map(r => r._rowNumber === stamped._rowNumber ? stamped : r);
  state.publishPreview = null;   // data changed: the next Publish visit re-checks
  render();
}

function goTo(key, filter) {
  if (key !== state.screen) setStatus('');   // last screen's message doesn't follow
  if (key === 'sort' && filter) { state.sortFilter = filter; saveSortSpot(); }   // Publish's "fix in Sort" lands on the tab it names
  if (key === 'sort' && state.screen !== 'sort') readBeforeSort();
  if (key === 'issue' && state.screen !== 'issue') resetIssueEntry();
  if (key === 'finalize' && state.screen !== 'finalize') { resetFinalizeEntry(); state.lastKeepAll = null; }
  // The ticks survive a hop to another screen; only the receipt resets.
  if (key === 'build' && state.screen !== 'build') state.justSent = null;
  if (key === 'publish' && state.screen !== 'publish') {
    // The check is read-only and CACHED: it runs on first arrival and again
    // only after something changed (persist clears it) or via Re-check.
    state.justPublished = 0;
    state.publishedCsv = '';
    resetPublishAsk();
    state.screen = key;
    if (!state.publishPreview) { loadPublishPreview(); return; }
  }
  state.screen = key;
  render();
}

async function undoLast() {
  const last = state.undoStack.pop();
  if (!last) return;
  if (last.decision) {
    for (const r of last.rows) { state.sortedIds.delete(r.id); state.decidedFrom.delete(r.id); }
  }
  setStatus(undoWords(last), 'ok');   // says what came back, so the effect is never a guess
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
    const data = await postJson('/api/rewrite', { ids }, 'rewrite the descriptions');
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
    // Finalize's lede beside the button, not the page header.
    // A rewrite that came back is carried by Finalize's progress line
    // ("0 of 2 rewrites checked"); only an empty answer needs words here.
    state.rewroteNote = byId.size ? null : (data.warnings?.join(' ') || 'Nothing to rewrite.');
    setStatus('');
  } catch (err) {
    setStatus(plainError(err), 'error');
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
    const data = await readReply(await fetch('/api/publish'), 'check the Exchange');
    state.publishPreview = data;
    setStatus('', 'ok');
  } catch (err) {
    setStatus(plainError(err), 'error');
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
    const data = await postJson('/api/publish', {}, 'publish');
    state.publishPreview = null;
    state.justPublished = data.published;
    state.publishedCsv = data.csv ?? '';
    state.busy = false;
    // The spare copy saves itself on publish: her browser drops it straight
    // into Drive, so there is no Drive API and nothing to redeploy.
    if (state.publishedCsv) downloadCsv(state.publishedCsv);
    // reload() writes its own 'Loading…'/'' status; the confirmation message
    // has to be set after it finishes, or reload() overwrites it.
    await reload();
    setStatus(data.warning ? data.warning : '', data.warning ? 'note' : 'ok');   // the receipt card is the confirmation
    return;
  } catch (err) {
    setStatus(plainError(err), 'error');
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
  state.justSent = { issue, ids: selectedRows.map(r => r.id) };
  resetNewsletterEntry();   // sent: the next pick starts clean
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
    sessionStorage.setItem(SORT_SPOT_KEY, JSON.stringify({ filter: state.sortFilter }));
  } catch { /* private mode etc. — losing the spot is fine */ }
}
try {
  const spot = JSON.parse(sessionStorage.getItem(SORT_SPOT_KEY) ?? 'null');
  if (spot && typeof spot.filter === 'string') {
    state.sortFilter = spot.filter;
  }
} catch { /* ignore bad stashes */ }

const SCREEN_ORDER = ['home', 'issue', 'sort', 'finalize', 'publish', 'build'];
// Every screen but the front page has an address (/#sort, /#newsletter,
// /#exchange, and the old screens' own until they fold into the lanes), so a
// typed or bookmarked one opens there and a reload stays put.
const openedAt = openedScreen(location.hash);
state.screen = openedAt;
let shownScreen = null;

/** A screen switch tells assistive tech where it landed: the incoming title
 * takes focus. Nothing on the first paint. */
function focusHeading(section) {
  const h2 = section?.querySelector('h2');
  if (!h2) return;
  h2.tabIndex = -1;
  h2.focus({ preventScroll: true });
}

function render() {
  for (const [name, el] of Object.entries(screens)) el.hidden = name !== state.screen;
  renderShell(document.querySelector('.topbar'), { screen: state.screen, onGo: goTo });
  document.title = pageTitle(state.screen);
  // The top bar's links switch screens in place. Every screen but the front
  // page keeps an address, as a history entry, so Back and a reload land
  // where the reader was. The skip link moves focus without touching the
  // address.
  const hash = screenHash(state.screen);
  if (location.hash !== hash) {
    if (shownScreen === null) history.replaceState(null, '', hash || location.pathname);
    else history.pushState(null, '', hash || location.pathname);
  }
  const switched = shownScreen !== null && shownScreen !== state.screen;
  if (shownScreen !== state.screen) {
    const incoming = screens[state.screen];
    if (switched) {
      incoming.classList.remove('slide-in-left', 'slide-in-right');
      void incoming.offsetWidth;
      incoming.classList.add(SCREEN_ORDER.indexOf(state.screen) > SCREEN_ORDER.indexOf(shownScreen)
        ? 'slide-in-right' : 'slide-in-left');
      incoming.addEventListener('animationend',
        () => incoming.classList.remove('slide-in-left', 'slide-in-right'), { once: true });
    }
    shownScreen = state.screen;
  }
  const today = new Date().toISOString().slice(0, 10);
  const common = { rows: state.rows, schedule: state.schedule, today };
  if (state.screen === 'home') {
    renderHome(screens.home, {
      ...common, loaded: state.loaded, loadFailed: state.loadFailed,
      onGoTo: goTo,
      onSubmitted: reload,
      onRefresh: reload,
      knownLinks: () => state.rows,   // the form is mounted once: it asks for the rows instead of holding a copy
    });
  } else if (state.screen === 'issue') {
    renderIssue(screens.issue, {
      ...common, loaded: state.loaded, loadFailed: state.loadFailed,
      onQuickAdd: stampSubmitted,
      onRefresh: reload,
      knownLinks: () => state.rows,
      onRemove: row => unsendFromNewsletter([row.id]),
      onRestore: row => persist([row]),   // Undo on Remove: the row as it was, stamp included
    });
  } else if (state.screen === 'sort') {
    renderSort(screens.sort, {
      ...common, filter: state.sortFilter, sortedCount: state.sortedIds.size,
      onGoTo: goTo,
      lastDecision: state.undoStack.at(-1) ?? null,
      sessionDecided: state.sortedIds,
      decidedFrom: state.decidedFrom,
      onFilter: key => { state.sortFilter = key; saveSortSpot(); render(); },
      onDecide: decide, onUndo: undoLast, onKeepAll: keepAll, onUndoRow: undoRow,
      onEditRow: (row, changes) => change([{ ...row, ...changes }], { kind: 'edit' }),
      // Type + subtype + provenance move together in one queued write.
      onEditType: (row, type, subtype) => change([{
        ...row, type, subtype: subtype || row.subtype,
        auto_filled: withoutAutoFilled(row.auto_filled, subtype ? ['type', 'subtype'] : ['type']),
      }], { kind: 'type' }),
      onVerifyLink: (row, newLink) => change([{
        ...row, ...(newLink ? { link: newLink } : {}), link_checked: 'human',
      }], { kind: 'link' }),
    });
  } else if (state.screen === 'finalize') {
    renderFinalize(screens.finalize, {
      ...common, review: state.rewriteReview, verified: state.verifiedIds,
      reviewTotal: state.reviewTotal, busy: state.busy, rewroteNote: state.rewroteNote, lastKeepAll: state.lastKeepAll,
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
      // Keep all remaining: every rewrite
      // still waiting is kept, stamped in one write.
      onVerifyAll: ids => {
        const stamp = new Date().toISOString();
        const changed = [];
        const before = [];
        for (const id of ids) {
          const row = state.rows.find(r => r.id === id);
          before.push({ id, old: state.rewriteReview.get(id) ?? '' });
          state.rewriteReview.delete(id);
          state.verifiedIds.add(id);
          if (row) changed.push({ ...row, rewrite_checked: stamp });
        }
        state.lastKeepAll = before;
        if (changed.length) persist(changed); else render();
      },
      // The way back from Keep all remaining: the originals return and the checks reopen.
      onUndoKeepAll: () => {
        const back = state.lastKeepAll ?? [];
        state.lastKeepAll = null;
        const changed = [];
        for (const { id, old } of back) {
          const row = state.rows.find(r => r.id === id);
          if (!row) continue;
          state.rewriteReview.set(id, old);
          state.verifiedIds.delete(id);
          changed.push({ ...row, blurb: old, rewrite_checked: '' });
        }
        state.reviewTotal = state.rewriteReview.size;
        if (changed.length) persist(changed); else render();
      },
      onTrash: row => {
        // Junk spotted mid-finalize goes out at once, its open check dropped so
        // the count stays honest; the screen keeps it listed with Undo.
        state.rewriteReview.delete(row.id);
        state.verifiedIds.delete(row.id);
        persist([trash(row)]);
      },
      onRestore: row => persist([row]),
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
      onRestore: row => persist([row]),
      onPickMore: () => { state.justSent = null; render(); },   // back to the pool after a send
    });
  }
  if (switched) focusHeading(screens[state.screen]);
}

// Back, Forward and a typed address switch screens like a menu pick would.
window.addEventListener('hashchange', () => {
  const target = openedScreen(location.hash);
  if (target !== state.screen) goTo(target);
});

// The skip link focuses the page's main without a #main in the address, so
// the per-screen addresses and Back keep working after it.
document.querySelector('.skip-to-main')?.addEventListener('click', event => {
  event.preventDefault();
  const main = document.querySelector('#main');
  main.tabIndex = -1;
  main.focus();
});

render();   // the shell paints before the first fetch, not after it
reload().then(() => {
  // A page opened at a screen's address runs that screen's arrival step once
  // the rows are in, the way goTo would have.
  if (openedAt === 'sort') readBeforeSort();
  if (openedAt === 'publish' && !state.publishPreview) loadPublishPreview();
});
