/**
 * Newsletter: the hand-off to the standalone newsletter builder. After the
 * Exchange is live, pick which items go to the issue — everything published
 * since the last issue plus the newsletter-only holds, all selected by
 * default. Send stamps them with the issue date; they drain from the desk
 * and the builder pulls them from here. No .md, no export.
 */
import { titleWithInfo } from './screen-info.js';
import { faIcon } from './icons.js';
import { buildPool, newsletterOnly, reshareFlags } from './workflow.js';
import { isErc } from './sort-view.js';
import { TYPE_ORDER, TYPE_LABELS } from './schema.js';
import { isoToSlash } from './queue-view.js';

// The builder lives inside this project — same origin, one deploy.
const BUILDER_URL = '/builder/';

// The issue's shape: spotlight leads, then the newsletter's sections.
const GROUP_LABELS = {
  research: 'New Ed Policy Research', event: 'Events',
  opportunity: 'Opportunities', headline: 'Headlines',
};

// View state only — resets on every visit to the screen.
let picked = new Set(); // nothing goes unless she picks it
let issuePick = '';     // '' = the next issue on the schedule

// Folded categories survive re-renders (every checkbox click re-renders).
const collapsedGroups = new Set();

export function resetNewsletterEntry() { picked = new Set(); issuePick = ''; }

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** '2026-09-01' -> 'September 1' (how the desk header names issues). */
function issueLabel(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/** Mistakes found later: what's already stamped for this issue, with a way back. */
function sentSection(container, { rows, issue, onUnsend }) {
  if (!issue || !onUnsend) return;
  const sent = rows.filter(r => String(r.newsletter_issue ?? '') === issue);
  if (!sent.length) return;
  const box = el('details', 'nl-sent');
  box.append(el('summary', '', `Already sent to this issue (${sent.length})`));
  const table = el('table', 'queue-table nl-table');
  const tbody = el('tbody');
  for (const row of sent) {
    const tr = el('tr');
    const titleTd = el('td');
    titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
    if (row.source) titleTd.append(el('span', 'item-source', row.source));
    tr.append(titleTd);
    const backTd = el('td', 'bulk-remove');
    const back = el('button', 'linkish trash-link', ' Remove');
    back.prepend(faIcon('trash-can'));
    back.type = 'button';
    back.addEventListener('click', () => { back.disabled = true; onUnsend([row.id]); });
    backTd.append(back);
    tr.append(backTd);
    tbody.append(tr);
  }
  table.append(tbody);
  const scroll = el('div', 'table-scroll');
  scroll.append(table);
  box.append(scroll);
  container.append(box);
}

export function renderNewsletter(container, props) {
  const { rows, schedule, today, busy, justSent, onSend, onUnsend } = props;
  const rerender = () => renderNewsletter(container, props);
  container.replaceChildren();

  const pool = buildPool(rows);
  const selected = pool.filter(r => picked.has(r.id));
  // Past issues never show — only today and later can be picked.
  const upcoming = (schedule ?? []).filter(d => !today || d >= today);
  const issue = issuePick || upcoming[0] || '';

  const head = el('div', 'screen-head finalize-head');
  const lead = el('div');
  const info = titleWithInfo('Send to Newsletter', 'build',
    'Pick items for the issue and send them — they leave the desk and wait in the newsletter builder. Change your mind later with Remove under "Already sent". A "was in a past issue" note is just a heads-up, never a block.');
  lead.append(info.row, info.panel);
  const lede = el('p', 'lede');
  if (justSent) {
    lede.append(`Sent ${justSent.count} to the ${issueLabel(justSent.issue)} issue — the builder pulls them from here. `);
    if (justSent.ids?.length && onUnsend) {
      const undo = el('button', 'linkish', 'Undo send');
      undo.type = 'button';
      undo.addEventListener('click', () => { undo.disabled = true; onUnsend(justSent.ids); });
      lede.append(undo);
    }
  } else if (!pool.length) {
    lede.textContent = 'Nothing new for the newsletter yet.';
  } else {
    lede.textContent = 'Pick items to send to newsletter';
  }
  lead.append(lede);
  head.append(lead);
  if (!justSent && pool.length && !busy) {
    const btn = el('button', 'primary', selected.length
      ? `Send ${selected.length} to the ${issueLabel(issue)} issue`
      : `Send to the ${issueLabel(issue)} issue`);
    btn.disabled = !selected.length || !issue;
    btn.addEventListener('click', () => { btn.disabled = true; onSend(selected, issue); });
    head.append(btn);
  }
  container.append(head);

  if (justSent) {
    const open = el('p', '');
    const a = el('a', 'panel-link', 'Open the newsletter builder ↗');
    a.href = BUILDER_URL; a.target = '_blank'; a.rel = 'noreferrer';
    open.append(a);
    container.append(open);
    return;
  }
  if (!pool.length) { sentSection(container, { rows, issue, onUnsend }); return; }

  if (upcoming.length > 1) {
    const pickRow = el('p', 'nl-issue');
    pickRow.append('Issue: ');
    const select = el('select');
    for (const date of upcoming) {
      const opt = el('option', '', issueLabel(date));
      opt.value = date;
      opt.selected = date === issue;
      select.append(opt);
    }
    select.addEventListener('change', () => { issuePick = select.value; rerender(); });
    pickRow.append(select);
    container.append(pickRow);
  }

  sentSection(container, { rows, issue, onUnsend });

  const reshare = reshareFlags(rows, today ?? '');
  const groups = [
    ['ERC Spotlight', pool.filter(isErc)],
    ...TYPE_ORDER.map(type =>
      [GROUP_LABELS[type], pool.filter(r => !isErc(r) && (r.type || '') === type)]),
    ['Untyped', pool.filter(r => !isErc(r) && !TYPE_ORDER.includes(r.type || ''))],
  ];
  for (const [label, group] of groups) {
    if (!group.length) continue;
    const pickedHere = group.filter(r => picked.has(r.id)).length;
    // Each category folds (state survives re-renders) and scrolls in its own box.
    const fold = el('details', 'nl-group');
    fold.open = !collapsedGroups.has(label);
    fold.addEventListener('toggle', () => {
      if (fold.open) collapsedGroups.delete(label);
      else collapsedGroups.add(label);
    });
    const summary = el('summary', 'p-group nl-group-summary', `${label} · ${pickedHere} of ${group.length} picked`);
    fold.append(summary);
    const table = el('table', 'queue-table nl-table');
    const tbody = el('tbody');
    for (const row of group) {
      const tr = el('tr', 'nl-row');
      const checkTd = el('td', 'nl-check');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = picked.has(row.id);
      box.addEventListener('click', event => event.stopPropagation());
      box.addEventListener('change', () => {
        if (box.checked) picked.add(row.id);
        else picked.delete(row.id);
        rerender();
      });
      checkTd.append(box);
      tr.append(checkTd);
      const titleTd = el('td');
      titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
      if (row.source) titleTd.append(el('span', 'item-source', row.source));
      // Re-sharing is sometimes the point — a note, never a blocker.
      if (reshare.has(row.id)) {
        titleTd.append(el('span', 'item-source nl-reshare', `Was in the ${issueLabel(reshare.get(row.id))} issue`));
      }
      tr.append(titleTd);
      const typeTd = el('td');
      typeTd.append(el('span', '', row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'));
      if (row.subtype) typeTd.append(el('span', 'item-source', row.subtype));
      if (newsletterOnly(row)) typeTd.append(el('span', 'item-source', 'newsletter only'));
      tr.append(typeTd);
      tr.append(el('td', '', isoToSlash(String(row.published_at ?? '').slice(0, 10)) || '—'));
      tr.addEventListener('click', () => {
        if (picked.has(row.id)) picked.delete(row.id);
        else picked.add(row.id);
        rerender();
      });
      tbody.append(tr);
    }
    table.append(tbody);
    const scroll = el('div', 'table-scroll nl-group-scroll');
    scroll.append(table);
    fold.append(scroll);
    container.append(fold);
  }
}
