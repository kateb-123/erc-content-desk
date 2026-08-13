/**
 * Sort — the decision surface. This runs on the raw submitted text, before any
 * ERC-voice rewriting, which is the scrape pipeline's golden rule: you judge
 * what actually arrived, not what Claude made of it.
 *
 * A row expands in place so the full text, the source link, and who sent it are
 * all visible while you decide.
 */

import { pendingRows, decidedRows, keepersAwaitingProcess } from './workflow.js';
import { isHubEligible } from './schema.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function summaryLine(row) {
  const text = row.original_text || row.link || '(empty)';
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function detailsPanel(row) {
  const panel = el('div', 'row-detail');
  panel.append(el('p', 'row-detail-text', row.original_text || '(no text — link only)'));

  const meta = el('dl', 'row-meta');
  const pairs = [
    ['From', row.submitter || 'unknown'],
    ['Note', row.note || '—'],
    ['Arrived', row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'],
  ];
  for (const [term, value] of pairs) {
    meta.append(el('dt', '', term), el('dd', '', value));
  }
  panel.append(meta);

  if (row.link) {
    const link = document.createElement('a');
    link.href = row.link;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'source-link';
    link.textContent = 'Open the source ↗';
    panel.append(link);
  }
  return panel;
}

function decisionRow(row, onDecide) {
  const controls = el('div', 'row-controls');

  const newsletterLabel = el('label', 'flag');
  const newsletterBox = document.createElement('input');
  newsletterBox.type = 'checkbox';
  newsletterLabel.append(newsletterBox, document.createTextNode(' Newsletter'));

  const hubLabel = el('label', 'flag');
  const hubBox = document.createElement('input');
  hubBox.type = 'checkbox';
  hubLabel.append(hubBox, document.createTextNode(' Hub'));

  const keepBtn = el('button', 'keep-btn', 'Keep');
  keepBtn.addEventListener('click', () => {
    // Disable all controls in this row before invoking callback
    newsletterBox.disabled = true;
    hubBox.disabled = true;
    keepBtn.disabled = true;
    trashBtn.disabled = true;
    onDecide(row, { newsletter: newsletterBox.checked, hub: hubBox.checked, trashed: false });
  });

  const trashBtn = el('button', 'trash-btn', 'Trash');
  trashBtn.addEventListener('click', () => {
    // Disable all controls in this row before invoking callback
    newsletterBox.disabled = true;
    hubBox.disabled = true;
    keepBtn.disabled = true;
    trashBtn.disabled = true;
    onDecide(row, { trashed: true });
  });

  controls.append(newsletterLabel, hubLabel, keepBtn, trashBtn);
  return controls;
}

export function renderSort(container, { rows, onDecide, onUndecide, onProcess, processing }) {
  // Preserve open state of expanded details before replacing
  const openIds = new Set();
  for (const details of container.querySelectorAll('details.sort-item[data-id]')) {
    if (details.open) {
      openIds.add(details.dataset.id);
    }
  }
  const decidedWrapWasOpen = container.querySelector('details.decided-wrap')?.open ?? false;

  container.replaceChildren();

  const waiting = pendingRows(rows);
  const decided = decidedRows(rows);
  const awaiting = keepersAwaitingProcess(rows);

  const head = el('div', 'screen-head');
  head.append(el('h2', '', 'Sort'));
  head.append(el('p', 'lede', 'Read what came in, then decide. Nothing is rewritten until after you keep it.'));
  container.append(head);

  if (awaiting.length) {
    const bar = el('div', 'process-bar');
    bar.append(el('span', '', `${awaiting.length} keeper${awaiting.length === 1 ? '' : 's'} ready for Claude to categorise and write up.`));
    const btn = el('button', 'process-btn', processing ? 'Processing…' : 'Process keepers');
    btn.disabled = Boolean(processing);
    btn.addEventListener('click', onProcess);
    bar.append(btn);
    container.append(bar);
  }

  if (!waiting.length) {
    container.append(el('p', 'empty', 'Nothing left to sort. Nice.'));
  }

  for (const row of waiting) {
    const item = document.createElement('details');
    item.className = 'sort-item';
    item.dataset.id = row.id;

    const summary = document.createElement('summary');
    summary.append(el('span', 'sort-summary-text', summaryLine(row)));
    summary.append(el('span', 'sort-summary-from', row.submitter || ''));
    item.append(summary);

    item.append(detailsPanel(row));

    const controls = decisionRow(row, onDecide);
    if (!isHubEligible(row.type) && row.type) {
      controls.querySelectorAll('input')[1].disabled = true;
    }
    item.append(controls);
    container.append(item);

    // Restore open state if this row was expanded before
    if (openIds.has(row.id)) {
      item.open = true;
    }
  }

  if (decided.length) {
    const wrap = document.createElement('details');
    wrap.className = 'decided-wrap';
    const summary = document.createElement('summary');
    summary.textContent = `Already decided (${decided.length})`;
    wrap.append(summary);

    for (const row of decided) {
      const line = el('div', 'decided-row');
      // A trashed row has no destinations by definition (trash() clears
      // both flags) — showing "trashed · none" reads as if nothing was
      // decided, so just say trashed.
      const destText = row.status === 'trashed'
        ? 'trashed'
        : `${row.status} · ${[row.newsletter && 'newsletter', row.hub && 'hub'].filter(Boolean).join(' + ') || 'none'}`;
      line.append(el('span', 'decided-text', summaryLine(row)));
      line.append(el('span', 'decided-dest', destText));
      const undo = el('button', '', 'Undo');
      undo.addEventListener('click', () => {
        undo.disabled = true;
        onUndecide(row);
      });
      line.append(undo);
      wrap.append(line);
    }
    container.append(wrap);

    // Restore open state of decided-wrap if it was expanded before
    if (decidedWrapWasOpen) {
      wrap.open = true;
    }
  }
}
