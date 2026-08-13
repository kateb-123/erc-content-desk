/**
 * Downloads — the hub half of the output. Kate uploads news.csv to the
 * erc-policy-exchange repo herself; this only produces the file.
 */

import { hubCsvFor } from './hub-csv.js';
import { readyFor } from './workflow.js';

export function renderDownloads(container, { rows, onDownloadHub }) {
  container.replaceChildren();

  const pending = readyFor(rows, 'hub');

  const head = document.createElement('div');
  head.className = 'screen-head';
  head.innerHTML = `
    <h2>Downloads</h2>
    <p class="lede">${pending.length} item${pending.length === 1 ? '' : 's'} waiting for the policy hub.</p>
  `;
  container.append(head);

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
  button.addEventListener('click', () => onDownloadHub(csv));
  container.append(button);

  const hint = document.createElement('p');
  hint.className = 'lede';
  hint.textContent = 'Then upload it to erc-policy-exchange/data/news.csv the way you do today.';
  container.append(hint);
}
