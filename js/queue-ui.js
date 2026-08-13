/**
 * Queue — everything that has arrived and not yet been decided on.
 *
 * Shown in the CSV's own shape so the empty cells make the pipeline legible:
 * type, headline, and blurb stay blank until the Process step fills them.
 */

import { pendingRows } from './workflow.js';

function cell(text, className = '') {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function preview(row) {
  const text = row.original_text || row.link || '';
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? '' : d.toLocaleDateString();
}

export function renderQueue(container, { rows, onAdd, onRefresh }) {
  container.replaceChildren();

  const waiting = pendingRows(rows);

  const head = document.createElement('div');
  head.className = 'screen-head';
  head.innerHTML = `
    <h2>Queue</h2>
    <p class="lede">${waiting.length} item${waiting.length === 1 ? '' : 's'} waiting to be sorted. The weekly scrape lands here too.</p>
  `;
  const refresh = document.createElement('button');
  refresh.textContent = 'Refresh';
  refresh.addEventListener('click', onRefresh);
  head.append(refresh);
  container.append(head);

  const adder = document.createElement('form');
  adder.className = 'adder';
  adder.innerHTML = `
    <label for="queue-content">Add anything — a link, an email, a paragraph</label>
    <textarea id="queue-content" rows="3" placeholder="Paste it here in whatever shape it arrived"></textarea>
    <div class="adder-row">
      <input id="queue-submitter" type="text" placeholder="Who's adding it" />
      <button type="submit">Add to queue</button>
    </div>
  `;
  const addBtn = adder.querySelector('button[type="submit"]');
  adder.addEventListener('submit', async event => {
    event.preventDefault();
    // Disable before invoking the callback, matching the Sort screen's
    // decision buttons — otherwise a second click before the POST resolves
    // adds the same item twice.
    addBtn.disabled = true;
    const content = adder.querySelector('#queue-content').value;
    const submitter = adder.querySelector('#queue-submitter').value;
    await onAdd({ content, submitter });
  });
  container.append(adder);

  if (!waiting.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nothing waiting. Add something above, or head to Sort to work through what you kept.';
    container.append(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'grid';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Arrived</th><th>From</th><th>What came in</th><th>Type</th><th>Headline</th><th>Blurb</th>
      </tr>
    </thead>
  `;
  const body = document.createElement('tbody');
  for (const row of waiting) {
    const tr = document.createElement('tr');
    tr.append(
      cell(shortDate(row.submitted_at)),
      cell(row.submitter),
      cell(preview(row), 'wrap'),
      cell(row.type, 'blank'),
      cell(row.headline, 'blank'),
      cell(row.blurb, 'blank'),
    );
    body.append(tr);
  }
  table.append(body);
  container.append(table);
}
