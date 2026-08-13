/**
 * Desk entry point. Owns the row list, the current screen, and the save cycle.
 * Every screen module is a pure render function that takes a container and
 * callbacks — screens never fetch or mutate state themselves.
 */

import { fetchRows, saveRows } from './sheet-client.js';
import { renderQueue } from './queue-ui.js';
import { renderSort } from './sort-ui.js';
import { renderBuild } from './build-ui.js';
import { renderDownloads } from './downloads-ui.js';
import { keep, trash, undecide, readyFor, markUsed } from './workflow.js';
import { mappedNewsletterRows } from './rows-to-issue.js';
import { getDeskPassword, clearDeskPassword } from './desk-auth.js';

const DRAFT_KEY = 'erc-content-desk-draft';

function loadDraft() {
  try {
    return { date: '', intro: '', ...JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') };
  } catch (err) {
    return { date: '', intro: '' };
  }
}

const state = { rows: [], screen: 'queue', processing: false, draft: loadDraft() };

const statusEl = document.getElementById('desk-status');
const screens = {
  queue: document.getElementById('screen-queue'),
  sort: document.getElementById('screen-sort'),
  build: document.getElementById('screen-build'),
  downloads: document.getElementById('screen-downloads'),
};

export function setStatus(message, kind = 'busy') {
  statusEl.textContent = message;
  statusEl.className = `status status-${kind}`;
}

export async function reload() {
  setStatus('Loading the sheet…');
  try {
    state.rows = await fetchRows();
    setStatus('');
  } catch (err) {
    setStatus(err.message, 'error');
  }
  render();
}

/** Save changed rows, then merge them back into local state without a full reload. */
export async function persist(changed) {
  if (!changed.length) return;
  setStatus(`Saving ${changed.length} row${changed.length === 1 ? '' : 's'}…`);
  try {
    await saveRows(changed);
    const byNumber = new Map(changed.map(r => [r._rowNumber, r]));
    state.rows = state.rows.map(r => byNumber.get(r._rowNumber) || r);
    setStatus('Saved.', 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  }
  render();
}

async function addToQueue({ content, submitter }) {
  setStatus('Adding…');
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, submitter, note: '' }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.errors.join(' '));
  } catch (err) {
    setStatus(err.message, 'error');
    return;
  }
  await reload();
}

async function decide(row, { newsletter = false, hub = false, trashed = false }) {
  const next = trashed ? trash(row) : keep(row, { newsletter, hub });
  await persist([next]);
}

async function reverseDecision(row) {
  await persist([undecide(row)]);
}

async function processKeepers() {
  state.processing = true;
  setStatus('Claude is reading the keepers — this takes a moment per item…');
  render();
  try {
    const res = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-desk-password': getDeskPassword() },
      body: JSON.stringify({}),
    });
    if (res.status === 401) {
      clearDeskPassword();
      throw new Error('Wrong password. Reload the page and try again.');
    }
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    const notes = [`Processed ${data.processed} item${data.processed === 1 ? '' : 's'}.`];
    if (data.failures.length) notes.push(`${data.failures.length} failed — check the Queue and try again.`);
    if (data.warnings.length) notes.push(data.warnings.join(' '));
    setStatus(notes.join(' '), data.failures.length ? 'error' : 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    state.processing = false;
  }
  await reload();
}

function downloadFile(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function updateDraft(draft) {
  state.draft = draft;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

async function exportNewsletter(html) {
  downloadFile('erc-newsletter.html', html, 'text/html');
  const stamp = new Date().toISOString();
  // Only the rows that actually rendered — an uncategorised row stays in the
  // draft rather than being retired without ever appearing in an issue.
  await persist(mappedNewsletterRows(state.rows).map(r => markUsed(r, 'newsletter', stamp)));
}

async function exportHubCsv(csv) {
  downloadFile('news.csv', csv, 'text/csv');
  const stamp = new Date().toISOString();
  await persist(readyFor(state.rows, 'hub').map(r => markUsed(r, 'hub', stamp)));
}

function render() {
  for (const [name, el] of Object.entries(screens)) el.hidden = name !== state.screen;
  for (const tab of document.querySelectorAll('.screen-tab')) {
    tab.classList.toggle('is-active', tab.dataset.screen === state.screen);
  }
  if (state.screen === 'queue') {
    renderQueue(screens.queue, { rows: state.rows, onAdd: addToQueue, onRefresh: reload });
  }
  if (state.screen === 'sort') {
    renderSort(screens.sort, {
      rows: state.rows,
      onDecide: decide,
      onUndecide: reverseDecision,
      onProcess: processKeepers,
      processing: state.processing,
    });
  }
  if (state.screen === 'build') {
    renderBuild(screens.build, {
      rows: state.rows,
      draft: state.draft,
      onDraftChange: updateDraft,
      onExport: exportNewsletter,
    });
  }
  if (state.screen === 'downloads') {
    renderDownloads(screens.downloads, { rows: state.rows, onDownloadHub: exportHubCsv });
  }
}

for (const tab of document.querySelectorAll('.screen-tab')) {
  tab.addEventListener('click', () => {
    state.screen = tab.dataset.screen;
    render();
  });
}

export { state, render };

reload();
