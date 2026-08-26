/** Entry point. Owns all state; screens are pure renderers. */
import { fetchDesk, saveRows } from './sheet-client.js';
import { renderQueue } from './queue-ui.js';
import { renderSort, detachSortKeys } from './sort-ui.js';
import { renderFinalize } from './finalize-ui.js';
import { renderPublish } from './publish-ui.js';
import { renderBuild } from './build-ui.js';
import { keep, trash, circleback, undecide, markNewsletterIssue } from './workflow.js';
import { nextIssueDate } from './schedule.js';

const DRAFT_KEY = 'erc-content-desk-draft';

const state = {
  rows: [],
  schedule: [],
  screen: 'queue',
  busy: false,
  sortStack: '',            // '' = stack picker; else a type key
  lastDecision: null,       // { id, prevStatus }
  rewrites: null,           // null = not fetched; [] after; [{id, blurb}]
  publishPreview: null,
  picks: new Map(),         // id -> sectionKey (Build)
  draft: loadDraft(),       // { date, intro }
};

const screens = Object.fromEntries(['queue', 'sort', 'finalize', 'publish', 'build']
  .map(name => [name, document.querySelector(`#screen-${name}`)]));
const statusEl = document.querySelector('#desk-status');

function loadDraft() {
  try { return { date: '', intro: '', ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') }; }
  catch { return { date: '', intro: '' }; }
}

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
    setStatus('', 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  }
  render();
}

/** Persist changed rows, then merge the saved copies back in by _rowNumber. */
export async function persist(changed) {
  if (!changed.length) return;
  try {
    await saveRows(changed);
    const byRowNumber = new Map(changed.map(r => [r._rowNumber, r]));
    state.rows = state.rows.map(r => byRowNumber.get(r._rowNumber) ?? r);
    render();
  } catch (err) {
    // Set the error, reload to resync with the sheet (which overwrites
    // status), then set the error again so the user still sees what failed.
    setStatus(err.message, 'error');
    await reload();
    setStatus(err.message, 'error');
  }
}

async function decide(row, action, note = '') {
  state.lastDecision = { id: row.id, prevStatus: row.status };
  const next = action === 'keep' ? keep(row)
    : action === 'trash' ? trash(row)
    : circleback(row, note);
  await persist([next]);
}

async function undoLast() {
  const last = state.lastDecision;
  if (!last) return;
  const row = state.rows.find(r => r.id === last.id);
  if (!row) return;
  state.lastDecision = null;
  await persist([{ ...row, status: last.prevStatus }]);
}

async function editField(row, field, value) {
  await persist([{ ...row, [field]: value }]);
}

async function runRewrite() {
  state.busy = true;
  render();
  setStatus('Rewriting Events + Opportunities blurbs…');
  try {
    const res = await fetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    state.rewrites = data.rewrites;
    setStatus(data.warnings?.length ? data.warnings.join(' ') : `Got ${data.rewrites.length} rewrites — accept or keep the original.`, 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  }
  state.busy = false;
  render();
}

async function acceptRewrite(id, blurb) {
  const row = state.rows.find(r => r.id === id);
  if (!row) return;
  state.rewrites = state.rewrites.filter(r => r.id !== id);
  await editField(row, 'blurb', blurb);
}

function rejectRewrite(id) {
  state.rewrites = state.rewrites.filter(r => r.id !== id);
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
      '. The site updates in about a minute.';
    state.publishPreview = null;
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

function updateDraft(draft) {
  state.draft = { ...state.draft, ...draft };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state.draft));
}

function downloadFile(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

async function exportNewsletter(html, pickedIds, issueDate) {
  downloadFile('erc-newsletter.html', html, 'text/html');
  const stamped = state.rows
    .filter(r => pickedIds.includes(r.id))
    .map(r => markNewsletterIssue(r, issueDate));
  state.picks = new Map();
  await persist(stamped);
  setStatus(`Newsletter downloaded — ${stamped.length} item(s) stamped for the ${issueDate} issue.`, 'ok');
}

export function render() {
  if (state.screen !== 'sort') detachSortKeys();
  for (const [name, el] of Object.entries(screens)) el.hidden = name !== state.screen;
  for (const tab of document.querySelectorAll('.screen-tab[data-screen]')) {
    tab.classList.toggle('is-active', tab.dataset.screen === state.screen);
  }
  const today = new Date().toISOString().slice(0, 10);
  const common = { rows: state.rows, schedule: state.schedule, today };
  if (state.screen === 'queue') {
    renderQueue(screens.queue, { ...common, nextIssue: nextIssueDate(state.schedule, today), onRefresh: reload });
  } else if (state.screen === 'sort') {
    renderSort(screens.sort, {
      ...common, stack: state.sortStack, lastDecision: state.lastDecision,
      onPickStack: stack => { state.sortStack = stack; render(); },
      onDecide: decide, onUndo: undoLast,
      onEditType: (row, type, subtype) => editField(row, 'type', type)
        .then(() => subtype && editField(state.rows.find(r => r.id === row.id), 'subtype', subtype)),
    });
  } else if (state.screen === 'finalize') {
    renderFinalize(screens.finalize, {
      ...common, rewrites: state.rewrites, busy: state.busy,
      onEdit: editField, onRewrite: runRewrite,
      onAcceptRewrite: acceptRewrite, onRejectRewrite: rejectRewrite,
    });
  } else if (state.screen === 'publish') {
    renderPublish(screens.publish, {
      ...common, preview: state.publishPreview, busy: state.busy,
      onPreview: loadPublishPreview, onPublish: publishNow,
    });
  } else {
    renderBuild(screens.build, {
      ...common, draft: state.draft, picks: state.picks,
      onTogglePick: (id, sectionKey) => {
        if (state.picks.has(id)) state.picks.delete(id);
        else state.picks.set(id, sectionKey);
        render();
      },
      onMovePick: (id, sectionKey) => { state.picks.set(id, sectionKey); render(); },
      onDraftChange: updateDraft,
      onExport: exportNewsletter,
    });
  }
}

for (const tab of document.querySelectorAll('.screen-tab[data-screen]')) {
  tab.addEventListener('click', () => {
    state.screen = tab.dataset.screen;
    render();
  });
}

reload();
