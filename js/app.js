/**
 * Desk entry point. Owns the row list, the current screen, and the save cycle.
 * Every screen module is a pure render function that takes a container and
 * callbacks — screens never fetch or mutate state themselves.
 */

import { fetchRows, saveRows } from './sheet-client.js';
import { renderQueue } from './queue-ui.js';

const state = { rows: [], screen: 'queue' };

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

function render() {
  for (const [name, el] of Object.entries(screens)) el.hidden = name !== state.screen;
  for (const tab of document.querySelectorAll('.screen-tab')) {
    tab.classList.toggle('is-active', tab.dataset.screen === state.screen);
  }
  if (state.screen === 'queue') {
    renderQueue(screens.queue, { rows: state.rows, onAdd: addToQueue, onRefresh: reload });
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
