/**
 * Downloads — the hub half of the output. Kate uploads news.csv to the
 * erc-policy-exchange repo herself; this only produces the file.
 */

import { hubCsvFor, hubExportableRows } from './hub-csv.js';
import { readyFor } from './workflow.js';

export function renderDownloads(container, { rows, onDownloadHub }) {
  container.replaceChildren();

  const pending = hubExportableRows(rows);
  const heldBack = readyFor(rows, 'hub').filter(r => !pending.includes(r));

  const head = document.createElement('div');
  head.className = 'screen-head';
  head.innerHTML = `
    <h2>Downloads</h2>
    <p class="lede">${pending.length} item${pending.length === 1 ? '' : 's'} waiting for the policy hub.</p>
  `;
  container.append(head);

  if (heldBack.length > 0) {
    const warn = document.createElement('p');
    warn.className = 'warn';
    warn.textContent = `${heldBack.length} kept item${heldBack.length === 1 ? " doesn't" : "s don't"} have a category yet, so ${heldBack.length === 1 ? 'it stays' : 'they stay'} out of this file. Set the type and subtype in the Sheet to bring ${heldBack.length === 1 ? 'it' : 'them'} in.`;
    container.append(warn);
  }

  if (!pending.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nothing waiting. Items land here once you keep them for the hub and process them.';
    container.append(empty);
    return;
  }

  const csv = hubCsvFor(rows);

  const preview = document.createElement('pre');
  preview.className = 'csv-preview';
  preview.textContent = csv.split('\n').slice(0, 6).join('\n');
  container.append(preview);

  const button = document.createElement('button');
  button.className = 'primary';
  button.textContent = 'Download news.csv and mark sent';
  button.addEventListener('click', () => {
    button.disabled = true;
    onDownloadHub(csv);
  });
  container.append(button);

  const hint = document.createElement('p');
  hint.className = 'lede';
  hint.textContent = 'Then upload it to erc-policy-exchange/data/news.csv the way you do today.';
  container.append(hint);
}
