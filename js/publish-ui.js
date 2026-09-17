/**
 * Publish (the Final List): checked against the LIVE news.csv on arrival —
 * the report is the page. Queue-style rows grouped by fate (adding / already
 * live / newsletter-only / needs a type), each expandable for one last look.
 * One deliberate click: Publish. Append-only. After publishing, Go to Build.
 */
import { readyToPublish } from './workflow.js';
import { PUBLISH_PAUSED } from './flags.js';
import { hubCsvFilename } from './hub-csv.js';
import { TYPE_LABELS } from './schema.js';
import { isoToShort } from './queue-view.js';
import { detailBody } from './finalize-ui.js';
import { checkSvg, dotsLoader, faIcon, forwardIcon } from './icons.js';
import { titleWithInfo } from './screen-info.js';
import { FATES, publishRows, legendItems, filterByFate, fateShares } from './publish-view.js';
import { focusKeyIn, restoreFocus } from './ui-aids.js';

/** Hand the browser a file. Kate's Chrome puts downloads straight in her Drive,
 *  which is the whole point: publishing leaves a spare copy without a Drive API,
 *  an Apps Script action, or anything to redeploy. */
export function downloadCsv(text, when = new Date()) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = hubCsvFilename(when);
  a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// View state only — resets on reload, never persisted.
let expanded = new Set();
let fateFilter = null;   // the legend's filter; null shows every row
let celebrated = ''; // which publish already played its confirmation — revisits stay still
// Team trial (PUBLISH_PAUSED): the Publish button runs a MOCK — a "forthcoming"
// shadow alert, then a mimicked success receipt — and never calls the real
// endpoint, so nothing reaches the live Exchange. Per-page-load state.
let trialPosting = false; // showing the "posting…" shadow alert
let trialDone = 0;        // count on the mocked receipt (0 = not yet)
let confirming = false;   // the one ask before the append-only write (design audit b6)

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const FATE_CLASS = { adding: 'p-adding', held: 'p-held', fix: 'p-notready', live: 'p-skip' };
const FATE_LABEL = Object.fromEntries(FATES.map(f => [f.key, f.label]));

function itemRows({ row, fate }, { rerender, onGoTo, today }) {
  const isOpen = expanded.has(row.id);
  const rowClass = ['f-item', FATE_CLASS[fate], isOpen && 'is-open'].filter(Boolean).join(' ');

  const tr = el('tr', rowClass);
  const caretTd = el('td', 'f-caret');
  const caret = el('button', 'chevron-btn');
  caret.type = 'button';
  caret.dataset.focus = `chev:${row.id}`;
  caret.setAttribute('aria-expanded', String(isOpen));
  caret.setAttribute('aria-label', isOpen ? 'Hide details' : 'Show details');
  caret.append(faIcon(isOpen ? 'chevron-up' : 'chevron-down'));
  caretTd.append(caret);
  tr.append(caretTd);   // left, one glyph, like Sort (Kate, Sep 15, option A)

  const titleTd = el('td');
  titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  if (row.source) titleTd.append(el('span', 'item-source', row.source));
  tr.append(titleTd);
  const typeTd = el('td');
  typeTd.append(el('span', '', row.type ? (TYPE_LABELS[row.type] ?? row.type) : ''));
  if (row.subtype) typeTd.append(el('span', 'item-source', row.subtype));
  tr.append(typeTd);
  tr.append(el('td', '', isoToShort(row.submitted_at, today) || ''));

  // The fate, in words. A row that needs a fix is the way to its fix.
  const fateTd = el('td', 'p-fate');
  if (fate === 'fix') {
    const jump = el('button', 'linkish p-fate-fix', 'Needs a fix');
    jump.type = 'button';
    jump.title = "Opens Sort's Needs a fix";
    jump.addEventListener('click', event => { event.stopPropagation(); onGoTo('sort', 'fix'); });
    fateTd.append(jump);
  } else {
    fateTd.textContent = FATE_LABEL[fate];
  }
  tr.append(fateTd);

  tr.addEventListener('click', () => {
    if (expanded.has(row.id)) expanded.delete(row.id);
    else expanded.add(row.id);
    rerender();
  });

  if (!isOpen) return [tr];
  const detailTr = el('tr', `f-detail-row ${rowClass}`);
  const td = el('td');
  td.colSpan = 5;
  td.append(detailBody(row, null, today));
  detailTr.append(td);
  return [tr, detailTr];
}

/** The fate bar and its legend; a legend item filters the table (toggle). */
function fateBar(container, list, rerender) {
  const box = el('div', 'p-fate-box');
  const bar = el('div', 'p-fate-bar');
  bar.setAttribute('aria-hidden', 'true');
  for (const { key, share } of fateShares(list)) {
    const seg = el('span', `p-seg p-seg-${key}`);
    seg.style.flexGrow = String(share);
    bar.append(seg);
  }
  const legend = el('div', 'p-legend');
  for (const item of legendItems(list)) {
    const b = el('button', `p-legend-item${fateFilter === item.key ? ' is-active' : ''}`);
    b.type = 'button';
    b.dataset.focus = `legend:${item.key}`;
    b.setAttribute('aria-pressed', String(fateFilter === item.key));
    b.append(el('span', `p-dot p-seg-${item.key}`), item.text);
    b.addEventListener('click', () => { fateFilter = fateFilter === item.key ? null : item.key; rerender(); });
    legend.append(b);
  }
  box.append(bar, legend);
  container.append(box);
}

export function renderPublish(container, props) {
  const { rows, today, preview, busy, justPublished, onPublish, onGoTo, onRecheck, publishedCsv } = props;
  const rerender = () => renderPublish(container, props);
  const focusKey = focusKeyIn(container);   // a redraw keeps the keyboard's place (design audit a1)
  // The mocked receipt stands in for a real one during the trial.
  const showReceipt = justPublished || (PUBLISH_PAUSED && trialDone);
  const isTrial = !justPublished && PUBLISH_PAUSED && Boolean(trialDone);
  const receiptCount = justPublished || trialDone;
  container.replaceChildren();

  // The check's own grouping is the truth — rows looked up by the ids the
  // endpoint returns, never re-derived (or headline-matched) client-side.
  const candidates = readyToPublish(rows);
  const byId = new Map(rows.map(r => [r.id, r]));
  const adding = (preview?.adding ?? []).map(item => byId.get(item.id)).filter(Boolean);

  const head = el('div', 'screen-head finalize-head');
  const lead = el('div');
  const info = titleWithInfo('Publish to Exchange', 'publish',
    'Everything here was checked against the live Exchange on arrival. Publish sends the Adding rows to the site. Spotlight events stay held for the newsletter (webinars excepted); a row that needs a fix waits in Sort; anything already live is left out. Click a colour under the bar to see only those rows.');
  lead.append(info.row, info.panel);
  const lede = el('p', 'lede');
  if (showReceipt) {
    // The receipt card below is the confirmation — the head stays bare.
  } else if (busy && !preview) {
    lede.textContent = 'Checking the live Exchange…';
  } else if (!candidates.length) {
    lede.textContent = 'Nothing waiting to publish.';
  } else {
    // A failed check says so (the status bar carries the reason); Re-check stays.
    lede.append(preview ? 'Checked against the live Exchange · ' : 'The check did not go through · ');
    const again = el('button', 'linkish', 'Re-check');
    again.type = 'button';
    again.dataset.focus = 'recheck';
    again.addEventListener('click', () => { again.disabled = true; onRecheck?.(); });
    lede.append(again);
  }
  lead.append(lede);
  head.append(lead);

  if (showReceipt) {
    // receipt below carries the onward door — head stays bare
  } else if (!candidates.length && !busy) {
    const btn = el('button', 'door head-action', 'Send to Newsletter');
    btn.append(forwardIcon());
    btn.addEventListener('click', () => onGoTo('build'));
    head.append(btn);
  } else if (preview && !busy && !trialPosting && adding.length) {
    // The button disappears while publishing — the status loader takes over.
    const btn = el('button', 'primary', `Publish ${adding.length} to the Exchange`);
    btn.dataset.focus = 'publish';
    btn.addEventListener('click', () => {
      // First click asks; the ask's Confirm does the work (the Send early shape).
      if (!confirming) { confirming = true; rerender(); return; }
      btn.disabled = true;
      if (PUBLISH_PAUSED) {
        // Trial: no real publish — show the "forthcoming" alert, then mock success.
        const n = adding.length;
        trialPosting = true;
        rerender();
        setTimeout(() => { trialPosting = false; trialDone = n; rerender(); }, 1100);
      } else {
        onPublish();
      }
    });
    head.append(btn);
  } else if (preview && !busy && !trialPosting) {
    // Nothing to add — the only move left is the newsletter door.
    const btn = el('button', 'door head-action', 'Send to Newsletter');
    btn.append(forwardIcon());
    btn.addEventListener('click', () => onGoTo('build'));
    head.append(btn);
  }
  if (confirming && adding.length && !busy && !showReceipt) {
    head.querySelector('[data-focus="publish"]')?.remove();
    const ask = el('div', 'nl-ask p-ask');
    ask.append(faIcon('triangle-exclamation'), ` Publish ${adding.length} to the live Exchange? `);
    const ok = el('button', 'linkish alert-word', 'Confirm');
    ok.type = 'button';
    ok.dataset.focus = 'publish';
    ok.addEventListener('click', () => {
      confirming = false;
      ok.disabled = true;
      if (PUBLISH_PAUSED) {
        const n = adding.length;
        trialPosting = true;
        rerender();
        setTimeout(() => { trialPosting = false; trialDone = n; rerender(); }, 1100);
      } else {
        onPublish();
      }
    });
    const no = el('button', 'linkish alert-word nl-cancel', 'Cancel');
    no.type = 'button';
    no.addEventListener('click', () => { confirming = false; rerender(); });
    ask.append(ok, ' \u00b7 ', no);
    head.append(ask);
    queueMicrotask(() => ok.focus({ preventScroll: true }));
  }
  container.append(head);

  // Trial: the "forthcoming" shadow alert during the mocked posting beat.
  if (PUBLISH_PAUSED && trialPosting) {
    const shade = el('div', 'p-shade');
    shade.append(el('p', 'p-shade-line', 'Publishing paused. Continue in trial mode.'));
    shade.append(dotsLoader());
    container.append(shade);
    return;
  }

  // Published: the receipt IS the page — check, headline, one door onward.
  if (showReceipt) {
    const receipt = el('div', 'pub-receipt');
    if (celebrated !== `${isTrial ? 'trial:' : ''}${receiptCount}`) {
      celebrated = `${isTrial ? 'trial:' : ''}${receiptCount}`;
      receipt.classList.add('pub-done-anim');
    }
    const ring = el('span', 'check-ring');
    const icon = checkSvg();
    icon.classList.add('receipt-check');
    if (receipt.classList.contains('pub-done-anim')) icon.classList.add('draw-check');
    ring.append(icon);
    receipt.append(ring);
    receipt.append(el('h3', '', isTrial
      ? `Trial run: ${receiptCount} would have been published`
      : `Published ${receiptCount} to the Exchange`));
    receipt.append(el('p', '', isTrial
      ? 'Nothing went to the live Exchange.'
      : 'The site updates in about a minute.'));
    const door = el('button', 'door slim-door', 'Send to Newsletter ');
    door.append(forwardIcon());
    door.addEventListener('click', () => { trialDone = 0; onGoTo('build'); });
    receipt.append(door);
    // The saved copy downloads itself on publish; this is here to get it again
    // without republishing (a second click of a download is harmless).
    if (publishedCsv) {
      const again = el('button', 'linkish receipt-download', 'Download the CSV again');
      again.type = 'button';
      again.addEventListener('click', () => downloadCsv(publishedCsv));
      receipt.append(again);
    }
    container.append(receipt);
    return;
  }

  if (busy && !preview) {
    container.append(dotsLoader());
    return;
  }
  // Silent dupe skip stays silent — the info panel says already-live items are skipped.

  // One bar, one table (Claude Design round two, Kate's pick Sep 16): every
  // row the check returned, in fate order, the legend filtering it. Already
  // live carries no number anywhere (Kate, Sep 1).
  if (!preview) return;
  const list = publishRows(preview, rows);
  if (!list.length) return;
  if (fateFilter && !list.some(r => r.fate === fateFilter)) fateFilter = null;
  fateBar(container, list, rerender);

  const table = el('table', 'queue-table finalize-table publish-table');
  const hr = el('tr');
  hr.append(el('th', 'f-caret'), el('th', '', 'Title'), el('th', '', 'Type'), el('th', '', 'Submitted'), el('th', 'p-fate', 'Fate'));
  const thead = el('thead');
  thead.append(hr);
  table.append(thead);
  const tbody = el('tbody');
  for (const item of filterByFate(list, fateFilter)) tbody.append(...itemRows(item, { rerender, onGoTo, today }));
  table.append(tbody);
  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  container.append(scroll);
  restoreFocus(container, focusKey, null);
}
