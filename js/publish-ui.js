/**
 * Publish (the Final List): checked against the LIVE news.csv on arrival —
 * the report is the page. Queue-style rows grouped by fate (adding / already
 * live / newsletter-only / needs a type), each expandable for one last look.
 * One deliberate click: Publish. Append-only. After publishing, Go to Build.
 */
import { readyToPublish } from './workflow.js';
import { TYPE_LABELS } from './schema.js';
import { isoToSlash } from './queue-view.js';
import { detailBody, chevron } from './finalize-ui.js';
import { checkSvg, dotsLoader, forwardIcon } from './icons.js';
import { titleWithInfo } from './screen-info.js';

// View state only — resets on reload, never persisted.
let expanded = new Set();
let celebrated = ''; // which publish already played its confirmation — revisits stay still

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function itemRows(row, { cls, fix, rerender, onGoTo }) {
  const isOpen = expanded.has(row.id);
  const rowClass = ['f-item', cls, isOpen && 'is-open'].filter(Boolean).join(' ');

  const tr = el('tr', rowClass);
  const titleTd = el('td');
  titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
  if (row.source) titleTd.append(el('span', 'item-source', row.source));
  if (fix) {
    const jump = el('button', 'linkish p-fix', 'Fix in Finalize');
    jump.type = 'button';
    jump.addEventListener('click', event => { event.stopPropagation(); onGoTo('finalize'); });
    titleTd.append(jump);
  }
  tr.append(titleTd);
  const typeTd = el('td');
  typeTd.append(el('span', '', row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'));
  if (row.subtype) typeTd.append(el('span', 'item-source', row.subtype));
  tr.append(typeTd);
  tr.append(el('td', '', isoToSlash(String(row.submitted_at ?? '').slice(0, 10)) || '—'));
  const caretTd = el('td', 'f-caret');
  const caret = el('button', 'chevron-btn');
  caret.type = 'button';
  caret.setAttribute('aria-expanded', String(isOpen));
  caret.setAttribute('aria-label', isOpen ? 'Hide details' : 'Show details');
  caret.append(chevron());
  caretTd.append(caret);
  tr.append(caretTd);
  tr.addEventListener('click', () => {
    if (expanded.has(row.id)) expanded.delete(row.id);
    else expanded.add(row.id);
    rerender();
  });

  if (!isOpen) return [tr];
  const detailTr = el('tr', `f-detail-row ${rowClass}`);
  const td = el('td');
  td.colSpan = 4;
  td.append(detailBody(row, null));
  detailTr.append(td);
  return [tr, detailTr];
}

function group(container, title, rows, { cls, fix, hint, rerender, onGoTo }) {
  if (!rows.length) return;
  container.append(el('h3', 'p-group', title));
  if (hint) container.append(el('p', 'hint p-group-hint', hint));
  const table = el('table', 'queue-table finalize-table publish-table');
  const tbody = el('tbody');
  for (const row of rows) tbody.append(...itemRows(row, { cls, fix, rerender, onGoTo }));
  table.append(tbody);
  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  container.append(scroll);
}

export function renderPublish(container, props) {
  const { rows, preview, busy, justPublished, onPublish, onGoTo } = props;
  const rerender = () => renderPublish(container, props);
  container.replaceChildren();

  // The check's own grouping is the truth — rows looked up by the ids the
  // endpoint returns, never re-derived (or headline-matched) client-side.
  const candidates = readyToPublish(rows);
  const byId = new Map(rows.map(r => [r.id, r]));
  const pick = list => (list ?? []).map(item => byId.get(item.id)).filter(Boolean);
  const adding = pick(preview?.adding);
  const held = pick(preview?.newsletterOnly);
  const notReady = pick(preview?.notReady);

  const head = el('div', 'screen-head finalize-head');
  const lead = el('div');
  const info = titleWithInfo('Publish to Exchange', 'publish',
    'Everything here was checked against the live Exchange on arrival. Publish sends the Adding group to the site; newsletter-only items stay held for the issue, and anything already live is skipped.');
  lead.append(info.row, info.panel);
  const lede = el('p', 'lede');
  if (justPublished) {
    const icon = checkSvg();
    if (celebrated !== justPublished) {
      celebrated = justPublished;
      head.classList.add('pub-done-anim');
      icon.classList.add('draw-check');
    }
    lede.append(icon, `Published ${justPublished} — the site updates in about a minute.`);
  } else if (busy && !preview) {
    lede.textContent = 'Checking the live Exchange…';
  } else if (!candidates.length) {
    lede.textContent = 'Nothing waiting to publish.';
  } else {
    lede.textContent = 'Checked against the live Exchange';
  }
  lead.append(lede);
  head.append(lead);

  if (justPublished || (!candidates.length && !busy)) {
    const btn = el('button', 'primary head-action', 'Send to newsletter');
    btn.append(forwardIcon());
    btn.addEventListener('click', () => onGoTo('build'));
    head.append(btn);
  } else if (preview && !busy && adding.length) {
    // The button disappears while publishing — the status loader takes over.
    const btn = el('button', 'primary', `Publish ${adding.length} to the Exchange`);
    btn.addEventListener('click', () => { btn.disabled = true; onPublish(); });
    head.append(btn);
  } else if (preview && !busy) {
    // Nothing to add — the only move left is the newsletter door.
    const btn = el('button', 'primary head-action', 'Send to newsletter');
    btn.append(forwardIcon());
    btn.addEventListener('click', () => onGoTo('build'));
    head.append(btn);
  }
  container.append(head);

  // Published: the job here is done — just the confirmation and the door to Build.
  if (justPublished) return;

  if (busy && !preview) {
    container.append(el('p', 'rewrite-status', 'Reading the live news.csv so nothing gets overwritten or duplicated…'));
    container.append(dotsLoader());
    return;
  }
  // Silent dupe skip stays silent — the info panel says already-live items are skipped.

  group(container, 'Adding', adding, { rerender, onGoTo });
  group(container, 'Newsletter only', held, {
    cls: 'p-held', rerender, onGoTo,
    hint: 'Spotlight events stay off the Exchange — webinars excepted.',
  });
  if (notReady.length) {
    // Typing happens in Sort (the pill picker lives there) — just point the way.
    const fixLine = el('p', 'hint');
    fixLine.append(`${notReady.length} kept item${notReady.length === 1 ? '' : 's'} still need${notReady.length === 1 ? 's' : ''} a type — `);
    const jump = el('button', 'linkish', "fix in Sort's To review");
    jump.type = 'button';
    jump.addEventListener('click', () => onGoTo('sort'));
    fixLine.append(jump);
    container.append(fixLine);
  }
}
