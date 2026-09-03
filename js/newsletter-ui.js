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
import { isoToDisplay } from './rows-to-issue.js';
import { eventTiming, deadlineState } from './schedule.js';

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
let confirmedEarly = new Set(); // later-event ids okayed via "Send early?" this visit
let askOpenId = null;           // later-event row currently asking

// Folded categories survive re-renders (every checkbox click re-renders).
const collapsedGroups = new Set();

export function resetNewsletterEntry() { picked = new Set(); issuePick = ''; confirmedEarly = new Set(); askOpenId = null; }

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

/** What the issue has outrun: an event that happens before it lands, an
 *  opportunity that closes first. Not pickable — the move left is Delete. */
function pastSection(container, { past, onTrash }) {
  if (!past.length) return;
  const fold = el('details', 'nl-sent nl-past');
  fold.append(el('summary', '', `Past items (${past.length})`));
  const table = el('table', 'queue-table');
  const tbody = el('tbody');
  for (const { row, why, when } of past) {
    const tr = el('tr');
    const titleTd = el('td');
    titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
    if (row.source) titleTd.append(el('span', 'item-source', row.source));
    if (when) titleTd.append(el('span', 'item-source', when));
    titleTd.append(el('span', 'badge badge-dupe', why));
    tr.append(titleTd);
    const actTd = el('td', 'nl-past-act');
    if (onTrash) {
      const del = el('button', 'linkish trash-link', ' Delete');
      del.type = 'button';
      del.prepend(faIcon('trash-can'));
      del.addEventListener('click', () => { del.disabled = true; onTrash(row); });
      actTd.append(del);
    }
    tr.append(actTd);
    tbody.append(tr);
  }
  table.append(tbody);
  fold.append(table);
  container.append(fold);
}

export function renderNewsletter(container, props) {
  const { rows, schedule, today, busy, justSent, onSend, onUnsend, onTrash } = props;
  const rerender = () => renderNewsletter(container, props);
  // Each group scrolls in its own box; every click rebuilds the screen, so the
  // positions ride across or an opened ask lands out of view below the fold.
  const scrollTops = new Map();
  for (const fold of container.querySelectorAll('[data-group]')) {
    const box = fold.querySelector('.nl-group-scroll');
    if (box) scrollTops.set(fold.dataset.group, box.scrollTop);
  }
  container.replaceChildren();

  const pool = buildPool(rows);
  // Past issues never show — only today and later can be picked.
  const upcoming = (schedule ?? []).filter(d => !today || d >= today);
  const issue = issuePick || upcoming[0] || '';

  // Timing is relative to the issue being assembled, so it is settled once per
  // render: the ordering, the row notes and both pick gestures read one answer.
  const timings = new Map(pool.map(r => [r.id,
    r.type === 'event' ? eventTiming(schedule ?? [], issue, r.date) : { state: '' }]));
  const isLater = r => timings.get(r.id)?.state === 'later';
  const needsAsk = r => isLater(r) && !confirmedEarly.has(r.id);
  // Picking is gated at the gesture, but the issue can change under a standing
  // pick (the dropdown, an undo, a reload) — re-checking here is what keeps an
  // unconfirmed early event from riding along to Send.
  for (const r of pool) if (picked.has(r.id) && needsAsk(r)) picked.delete(r.id);
  // Items the issue has outrun leave the picking list entirely — an event that
  // happens before it lands, an opportunity that closes first. They fold away
  // at the bottom where the only move left is Delete.
  const pastEntry = r => {
    if (timings.get(r.id)?.state === 'passed') {
      return { row: r, why: 'Before this issue', when: isoToDisplay(r.date) };
    }
    if (r.type === 'opportunity' && r.deadline && deadlineState(issue, r.deadline) === 'passed') {
      return { row: r, why: 'Closes before this issue', when: `Deadline ${isoToDisplay(r.deadline)}` };
    }
    return null;
  };
  const past = pool.map(pastEntry).filter(Boolean);
  const pastIds = new Set(past.map(p => p.row.id));
  for (const id of pastIds) picked.delete(id);
  const live = pool.filter(r => !pastIds.has(r.id));
  const selected = live.filter(r => picked.has(r.id));
  let askRow = null;   // the row asking "Send early?", brought into view after the rebuild
  let askConfirm = null;

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
  } else if (!live.length) {
    lede.textContent = 'Nothing new for the newsletter yet.';
  } else {
    lede.textContent = 'Pick items to send to newsletter';
  }
  lead.append(lede);
  head.append(lead);
  if (!justSent && live.length && !busy) {
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
    // Same door clothes as every other onward door — slim primary.
    const a = el('a', 'primary slim-door', 'Open the newsletter builder ↗');
    a.href = BUILDER_URL; a.target = '_blank'; a.rel = 'noreferrer';
    open.append(a);
    container.append(open);
    return;
  }
  if (!live.length && !past.length) { sentSection(container, { rows, issue, onUnsend }); return; }

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
    select.addEventListener('change', () => {
      issuePick = select.value;
      // "Send it early" was answered about the old issue — it never carries over.
      confirmedEarly.clear();
      askOpenId = null;
      rerender();
    });
    pickRow.append(select);
    container.append(pickRow);
  }

  sentSection(container, { rows, issue, onUnsend });

  const reshare = reshareFlags(rows, today ?? '');
  const groups = [
    ['ERC Spotlight', live.filter(isErc)],
    ...TYPE_ORDER.map(type =>
      [GROUP_LABELS[type], live.filter(r => !isErc(r) && (r.type || '') === type)]),
    ['Untyped', live.filter(r => !isErc(r) && !TYPE_ORDER.includes(r.type || ''))],
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
    fold.dataset.group = label;
    const table = el('table', 'queue-table nl-table');
    const tbody = el('tbody');
    // Events for a later issue dim and sink to the bottom, nearest first.
    const ordered = [
      ...group.filter(r => !isLater(r)),
      ...group.filter(isLater).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    ];
    // Both gestures mean one thing, so they share one door: a later event opens
    // the ask instead of picking; any other pick answers a standing ask by
    // leaving it — so it closes rather than lingering over unrelated work.
    const pickGesture = row => {
      if (!picked.has(row.id) && needsAsk(row)) { askOpenId = row.id; rerender(); return; }
      askOpenId = null;
      if (picked.has(row.id)) picked.delete(row.id);
      else picked.add(row.id);
      rerender();
    };
    for (const row of ordered) {
      const tr = el('tr', 'nl-row');
      const checkTd = el('td', 'nl-check');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = picked.has(row.id);
      box.addEventListener('click', event => event.stopPropagation());
      box.addEventListener('change', () => pickGesture(row));
      checkTd.append(box);
      tr.append(checkTd);
      const titleTd = el('td');
      titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
      if (row.source) titleTd.append(el('span', 'item-source', row.source));
      // Re-sharing is sometimes the point — a note, never a blocker.
      if (reshare.has(row.id)) {
        titleTd.append(el('span', 'item-source nl-reshare', `Was in the ${issueLabel(reshare.get(row.id))} issue`));
      }
      if (row.type === 'event' && row.date) {
        titleTd.append(el('span', 'item-source', [isoToDisplay(row.date), row.location].filter(Boolean).join(' \u00b7 ')));
      }
      const timing = timings.get(row.id);
      if (timing.state === 'later') {
        if (!picked.has(row.id) && askOpenId !== row.id) tr.classList.add('nl-later');
        // The note stays put while the ask is open \u2014 it is the fact you need to
        // answer "how early is early?".
        titleTd.append(el('span', 'item-source nl-when', `For the ${issueLabel(timing.issue)} issue`));
        if (askOpenId === row.id) {
          askRow = tr;
          // The card language's amber bubble, same as Sort's verify loop: the
          // icon sits on the bubble, the two outcomes stay bare words.
          const ask = el('div', 'nl-ask');
          ask.append(faIcon('clock'), ' Send early? ');
          const ok = el('button', 'linkish alert-word', 'Confirm');
          ok.type = 'button';
          ok.addEventListener('click', e => {
            e.stopPropagation();
            confirmedEarly.add(row.id);
            picked.add(row.id);
            askOpenId = null;
            rerender();
          });
          askConfirm = ok;
          const no = el('button', 'linkish alert-word nl-cancel', 'Cancel');
          no.type = 'button';
          no.addEventListener('click', e => {
            e.stopPropagation();
            askOpenId = null;
            rerender();
          });
          ask.append(ok, ' \u00b7 ', no);
          titleTd.append(ask);
        }
      }
      if (row.type === 'opportunity' && row.deadline) {
        titleTd.append(el('span', 'item-source', `Deadline ${isoToDisplay(row.deadline)}`));
      }
      tr.append(titleTd);
      const typeTd = el('td');
      typeTd.append(el('span', '', row.type ? (TYPE_LABELS[row.type] ?? row.type) : '—'));
      if (row.subtype) typeTd.append(el('span', 'item-source', row.subtype));
      if (newsletterOnly(row)) typeTd.append(el('span', 'badge', 'Newsletter only'));
      tr.append(typeTd);
      tr.append(el('td', '', isoToSlash(String(row.published_at ?? '').slice(0, 10)) || '—'));
      tr.addEventListener('click', () => pickGesture(row));
      tbody.append(tr);
    }
    table.append(tbody);
    const scroll = el('div', 'table-scroll nl-group-scroll');
    scroll.append(table);
    fold.append(scroll);
    container.append(fold);
  }

  pastSection(container, { past, onTrash });

  // Put the scroll boxes back where they were, then make sure an open ask is
  // on screen and holding focus — otherwise the click reads as a no-op.
  for (const fold of container.querySelectorAll('[data-group]')) {
    const box = fold.querySelector('.nl-group-scroll');
    const top = scrollTops.get(fold.dataset.group);
    if (box && top) box.scrollTop = top;
  }
  if (askRow) askRow.scrollIntoView({ block: 'nearest' });
  askConfirm?.focus({ preventScroll: true });
}
