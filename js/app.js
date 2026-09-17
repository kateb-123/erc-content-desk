/** Entry point. Owns all state; screens are pure renderers. */
import { fetchDesk, saveRows, readNewRows, readReply, plainError } from './sheet-client.js';
import { readAllWaiting } from './reader-client.js';
import { readerQueue } from './sort-view.js';
import { dotsLoader, loadingLabel } from './icons.js';
import { renderHome } from './home-ui.js';
import { renderSidebar } from './sidebar-ui.js';
import { renderIssue } from './issue-ui.js';
import { latestIssue, queueBadgeCount } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
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
  sortFilter: '',           // '' = not picked yet (Sort lands where the work is); 'fix', 'erc', or a type key
  sortedThisVisit: 0,       // decisions made since page load (view state)
  undoStack: [],            // [{ id, prevStatus }] — every decision, newest last
  sortedIds: new Set(),     // decided since this page opened — they stay listed, greyed (view state)
  decidedFrom: new Map(),   // id -> status before this session's decision: where Undo takes it back, and a row kept from Skipped greys under Skipped (view state)
  lastDecision: null,       // the top of undoStack (what Undo would restore)
  rewriteReview: new Map(), // id -> the pre-rewrite description, until she checks it (view state)
  verifiedIds: new Set(),   // rewrites she has checked this visit (view state)
  reviewTotal: 0,           // size of the current check batch, for "2 of 4" (view state)
  justPublished: 0,         // count from the last publish, until she leaves the screen (view state)
  justSent: null,           // { count, issue, ids } from the last newsletter send (view state)
  publishPreview: null,
  publishedCsv: '',       // the CSV from the last publish, for the receipt's re-download
  hubUpdated: null,
  lastIssue: null,          // newest archived issue date, for Home's strip
  rewroteNote: null,
};

const screens = Object.fromEntries(['home', 'issue', 'sort', 'finalize', 'publish', 'build']
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
    setStatus(plainError(err), 'error');
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

function decide(row, action, note = '') {
  // A decided row holds its place, greyed at the bottom of its section, so a
  // mistake stays in reach. Deciding never moves you.
  state.decidedFrom.set(row.id, row.status);
  if (!state.sortedIds.has(row.id)) {
    state.sortedThisVisit += 1;
    state.sortedIds.add(row.id);
  }
  const next = action === 'keep' ? keep(row)
    : action === 'trash' ? trash(row)
    : circleback(row, note);
  change([next], { decision: true });   // the list updates now; the write drains behind it
}

/** The headline list's one button: keep every row still standing, as one
 *  decision Undo last walks back as one. */
function keepAll(rows) {
  if (!rows.length) return;
  for (const r of rows) {
    state.decidedFrom.set(r.id, r.status);
    if (state.sortedIds.has(r.id)) continue;
    state.sortedThisVisit += 1;
    state.sortedIds.add(r.id);
  }
  change(rows.map(keep), { decision: true, step: false });
}

/** Undo on one greyed row of the headline list: back to the queue, in place. */
function undoRow(row) {
  // Back to what it was: a row kept from Skipped returns to Skipped, not to new.
  const back = state.decidedFrom.get(row.id) ?? 'new';
  state.sortedIds.delete(row.id);
  state.decidedFrom.delete(row.id);
  state.sortedThisVisit = Math.max(0, state.sortedThisVisit - 1);
  change([{ ...undecide(row), status: back }], { step: false });
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
    setStatus(plainError(err), 'error');
  }
}

/** Quick add on the Next issue page (Kate, Sep 15): the form has just put a
 *  new item in the queue; read it, then stamp it for the next issue, so it
 *  sits in the issue and in Sort at once ("everything is talking to each
 *  other"). The table marks it Not sorted yet until Sort has had it. */
async function stampSubmitted(data) {
  const today = new Date().toISOString().slice(0, 10);
  const issue = nextIssueDate(state.schedule, today);
  const id = data?.id;
  if (!issue || !id) { await reload(); return; }
  // The reader fills the title and description first, so the stamp's write
  // never lands under the reader's; a read that fails leaves the bare link,
  // which Sort will show and read again.
  try { await readAllWaiting([id], readNewRows); } catch { /* Sort catches up */ }
  await reload();
  const row = state.rows.find(r => r.id === id);
  if (!row) return;
  await whenSaved();
  const ok = await persist([markNewsletterIssue(row, issue)]);
  if (ok) setStatus('In the next newsletter, and in the queue for Sort.', 'ok');
}

function goTo(key, filter) {
  if (key !== state.screen) setStatus('');   // last screen's message doesn't follow
  if (key === 'sort' && filter) { state.sortFilter = filter; saveSortSpot(); }   // Publish's "fix in Sort" lands on the pill it names
  if (key === 'sort' && state.screen !== 'sort') readBeforeSort();
  if (key === 'finalize' && state.screen !== 'finalize') resetFinalizeEntry();
  // The ticks survive a hop to another screen (Kate, Sep 15); only the receipt resets.
  if (key === 'build' && state.screen !== 'build') state.justSent = null;
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
    for (const r of last.rows) { state.sortedIds.delete(r.id); state.decidedFrom.delete(r.id); }
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
    const data = await readReply(await fetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }), 'rewrite the descriptions');
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
    const data = await readReply(await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), 'publish');
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
  state.justSent = { count: selectedRows.length, issue, ids: selectedRows.map(r => r.id) };
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
// The pipeline's screens can be opened straight from a hash (/#sort). The
// sidebar's Pipeline items open one in a NEW window from the front door (Kate,
// Sep 15: "a new section and a new set of activities is about to be done");
// that window keeps its hash in step so a reload stays put.
const SECTION_KEYS = ['sort', 'finalize', 'publish', 'build'];
const openedAt = location.hash.slice(1);
const isSectionWindow = SECTION_KEYS.includes(openedAt);
if (isSectionWindow) state.screen = openedAt;
const SCREEN_NAMES = { issue: 'Next newsletter', sort: 'Sort', finalize: 'Finalize', publish: 'Publish to Exchange', build: 'Send to Newsletter' };
let shownScreen = null;

/** A screen switch tells assistive tech where it landed: the incoming title
 *  takes focus (design audit 14, Sep 15). Nothing on the first paint. */
function focusHeading(section) {
  const h2 = section?.querySelector('h2');
  if (!h2) return;
  h2.tabIndex = -1;
  h2.focus({ preventScroll: true });
}

export function render() {
  for (const [name, el] of Object.entries(screens)) el.hidden = name !== state.screen;
  renderSidebar(document.querySelector('.side'), {
    screen: state.screen, isSectionWindow, onGo: goTo,
    queueCount: state.loaded ? queueBadgeCount(state.rows) : null,
  });
  document.title = state.screen === 'home' ? 'ERC Content Desk' : `${SCREEN_NAMES[state.screen]} · ERC Content Desk`;
  // One sidebar on every page (Kate, Sep 16). In the pipeline's own window
  // its items switch in place; from the front door they open that window.
  const hash = SECTION_KEYS.includes(state.screen) ? `#${state.screen}` : '';
  if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname);
  const switched = shownScreen !== null && shownScreen !== state.screen;
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
      lastIssue: state.lastIssue,
      onGoTo: goTo,
      onSubmitted: reload,
      onRefresh: reload,
      // The queue's trash can, through the same queued write as Sort. Undo hands
      // back the status the row actually had — a deleted circle-back must come
      // back a circle-back, not a fresh submission.
      onDeleteFromQueue: (row, action) => change([
        action === 'trash' ? trash(row) : { ...row, status: action },
      ]),
    });
  } else if (state.screen === 'issue') {
    renderIssue(screens.issue, {
      ...common, loaded: state.loaded,
      onQuickAdd: stampSubmitted,
      onRemove: row => unsendFromNewsletter([row.id]),
    });
  } else if (state.screen === 'sort') {
    renderSort(screens.sort, {
      ...common, filter: state.sortFilter, sortedCount: state.sortedThisVisit,
      onGoTo: goTo,
      lastDecision: state.lastDecision,
      sessionDecided: state.sortedIds,
      decidedFrom: state.decidedFrom,
      onFilter: key => { state.sortFilter = key; saveSortSpot(); render(); },
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
  if (switched) focusHeading(screens[state.screen]);
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

// Home's "Last issue" fact: the newest date in the builder's archive index.
// Fetched once per visit; a miss leaves the dash.
(async () => {
  try {
    const res = await fetch('/builder/newsletters/index.json');
    state.lastIssue = latestIssue(await res.json());
  } catch { state.lastIssue = ''; }
  render();
})();

render();   // the shell paints before the first fetch, not after it (usability run F19)
reload().then(() => {
  // A window opened at a section runs that screen's arrival step once the
  // rows are in, the way goTo would have.
  if (openedAt === 'sort') readBeforeSort();
  if (openedAt === 'publish' && !state.publishPreview) loadPublishPreview();
});
