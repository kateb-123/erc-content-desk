/**
 * Send to Newsletter: the hand-off to the builder in this project. After the
 * Exchange is live, pick which items go to the issue, from everything
 * published since the last issue plus the newsletter-only holds. Nothing goes
 * unless she picks it. Send stamps them with the issue date; they drain from
 * the desk and the builder pulls them from here.
 */
import { screenHead } from './screen-info.js';
import { faIcon } from './icons.js';
import { buildPool, newsletterOnly, reshareFlags } from './workflow.js';
import { isErc } from './sort-view.js';
import { TYPE_ORDER, typeDisplay } from './schema.js';
import { GROUP_LABELS } from './newsletter-view.js';   // the issue's shape: spotlight leads, then the newsletter's sections
import { isoToShort } from './queue-view.js';
import { eventTiming, deadlineState } from './schedule.js';
import { el, button, focusKeyIn, restoreFocus } from './ui-aids.js';

// The builder lives inside this project — same origin, one deploy.
const BUILDER_URL = '/builder/';

// View state: lives while the page is open. The ticks clear after a Send and
// when the issue changes, not on a hop to another screen: tick five, check
// something in Finalize, come back, and they are still ticked.
let picked = new Set(); // nothing goes unless she picks it
let issuePick = '';     // '' = the next issue on the schedule
let confirmedEarly = new Set(); // later-event ids okayed via "Send early?" this visit
let askOpenId = null;           // later-event row currently asking
const justDeleted = new Map();  // past items deleted this visit, id -> the row as it was

// Folded categories survive re-renders (every checkbox click re-renders).
const collapsedGroups = new Set();

/** After a Send: nothing carries over to the next pick. */
export function resetNewsletterEntry() { picked = new Set(); issuePick = ''; confirmedEarly = new Set(); askOpenId = null; justDeleted.clear(); }

/** '2026-09-01' -> 'September 1', the way the desk names an issue on screen. */
function issueLabel(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/** A fold's summary: the chevron on the left, as on every opener. */
function foldSummary(text, className = '') {
  const summary = el('summary', className);
  summary.append(faIcon('chevron-right'), el('span', '', text));
  return summary;
}

/** Mistakes found later: what's already stamped for this issue, with a way back. */
function sentSection(container, { rows, issue, onUnsend }) {
  if (!issue) return;
  const sent = rows.filter(r => String(r.newsletter_issue ?? '') === issue);
  if (!sent.length) return;
  const box = el('details', 'nl-sent');
  box.append(foldSummary(`Already sent to this issue (${sent.length})`));
  const table = el('table', 'queue-table nl-table');
  const tbody = el('tbody');
  for (const row of sent) {
    const tr = el('tr');
    const titleTd = el('td');
    titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
    if (row.source) titleTd.append(el('span', 'item-source', row.source));
    tr.append(titleTd);
    const backTd = el('td', 'bulk-remove');
    const back = button(' Remove', 'linkish trash-link', { icon: 'trash-can', onClick: () => { back.disabled = true; onUnsend([row.id]); } });
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
function pastSection(container, { past, onTrash, onRestore, rows }) {
  // Deleted this visit: still listed, greyed, with Undo.
  const deleted = [...justDeleted.values()].filter(r => rows.find(x => x.id === r.id)?.status === 'trashed');
  if (!past.length && !deleted.length) return;
  const fold = el('details', 'nl-sent nl-past');
  fold.append(foldSummary(`Past items (${past.length + deleted.length})`));
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
    const del = button(' Delete', 'linkish trash-link',
      { focus: `delete:${row.id}`, icon: 'trash-can', onClick: () => { del.disabled = true; justDeleted.set(row.id, row); onTrash(row); } });
    actTd.append(del);
    tr.append(actTd);
    tbody.append(tr);
  }
  for (const row of deleted) {
    const tr = el('tr', 'queue-row is-deleted');
    const titleTd = el('td');
    titleTd.append(el('span', 'item-title', row.headline || row.link || '(untitled)'));
    tr.append(titleTd);
    const actTd = el('td', 'nl-past-act');
    actTd.append(el('span', 'queue-gone', 'Deleted'));
    const undo = button('Undo', 'linkish', { focus: `undo:${row.id}`, onClick: () => { undo.disabled = true; justDeleted.delete(row.id); onRestore(row); } });
    actTd.append(undo);
    tr.append(actTd);
    tbody.append(tr);
  }
  table.append(tbody);
  fold.append(table);
  container.append(fold);
}

export function renderNewsletter(container, props) {
  const { rows, schedule, today, busy, justSent, onSend, onUnsend, onTrash, onRestore, onPickMore } = props;
  const rerender = () => renderNewsletter(container, props);
  // Each group scrolls in its own box; every click rebuilds the screen, so the
  // positions ride across or an opened ask lands out of view below the fold.
  const focusKey = focusKeyIn(container);   // a redraw keeps the keyboard's place
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
      return { row: r, why: 'Before this issue', when: isoToShort(r.date, today) };
    }
    if (r.type === 'opportunity' && r.deadline && deadlineState(issue, r.deadline) === 'passed') {
      return { row: r, why: 'Closes before this issue', when: `Deadline ${isoToShort(r.deadline, today)}` };
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

  const { head, lede } = screenHead('Send to Newsletter', 'build',
    'Pick items for the issue and send them. They leave the desk and wait in the newsletter builder. Change your mind later with Remove under "Already sent". A "was in a past issue" note is just a heads-up, never a block.');
  if (justSent) {
    lede.append(`Sent ${justSent.ids.length} to the ${issueLabel(justSent.issue)} issue. The builder pulls them from here. `);
    if (justSent.ids.length) {
      const undo = button('Undo send', 'linkish', { onClick: () => { undo.disabled = true; onUnsend(justSent.ids); } });
      lede.append(undo);
    }
  } else if (!live.length) {
    lede.textContent = 'Nothing new for the newsletter yet.';
  } else {
    lede.textContent = 'Pick items to send to newsletter';
  }
  container.append(head);

  if (justSent) {
    const open = el('p', '');
    // The onward door, then a way back to the pool.
    const a = el('a', 'door', 'Open the newsletter builder ↗');
    a.href = BUILDER_URL; a.target = '_blank'; a.rel = 'noreferrer';
    a.append(el('span', 'sr-only', ' (opens in a new tab)'));
    open.append(a);
    open.append(' ', button('Pick more', 'linkish', { onClick: () => onPickMore() }));
    container.append(open);
    return;
  }
  if (!live.length && !past.length) { sentSection(container, { rows, issue, onUnsend }); return; }

  if (upcoming.length > 1) {
    const pickRow = el('p', 'nl-issue');
    const label = el('label', '', 'Issue');
    label.htmlFor = 'nl-issue';
    pickRow.append(label, ' ');
    const select = el('select');
    select.id = 'nl-issue';
    select.dataset.focus = 'issue';
    for (const date of upcoming) {
      const opt = el('option', '', issueLabel(date));
      opt.value = date;
      opt.selected = date === issue;
      select.append(opt);
    }
    select.addEventListener('change', () => {
      issuePick = select.value;
      // The picks and the "Send it early" answers were about the old issue — they never carry over.
      picked = new Set();
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
    const summary = foldSummary(`${label} · ${pickedHere} of ${group.length} picked`, 'p-group nl-group-summary');
    fold.append(summary);
    fold.dataset.group = label;
    const table = el('table', 'queue-table nl-table');
    // Every table names its columns: the date here is when it went live.
    const hr = el('tr');
    hr.append(el('th', 'nl-check'), el('th', '', 'Title'), el('th', '', 'Type'), el('th', '', 'Published'));
    const thead = el('thead');
    thead.append(hr);
    table.append(thead);
    const tbody = el('tbody');
    // Events for a later issue dim and sink to the bottom, nearest first.
    const ordered = [
      ...group.filter(r => !isLater(r)),
      ...group.filter(isLater).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    ];
    for (const row of ordered) {
      const tr = el('tr', 'nl-row');
      const checkTd = el('td', 'nl-check');
      const box = el('input');
      box.type = 'checkbox';
      box.setAttribute('aria-label', `Pick ${row.headline || row.link || 'this item'}`);
      box.dataset.focus = `pick:${row.id}`;
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
        titleTd.append(el('span', 'item-source', [isoToShort(row.date, today), row.location].filter(Boolean).join(' \u00b7 ')));
      }
      const timing = timings.get(row.id);
      if (timing.state === 'later') {
        if (!picked.has(row.id) && askOpenId !== row.id) tr.classList.add('nl-later');
        // The note stays put while the ask is open \u2014 it is the fact you need to
        // answer "how early is early?".
        titleTd.append(el('span', 'item-source nl-when', `For the ${issueLabel(timing.issue)} issue`));
        if (askOpenId === row.id) {
          askRow = tr;
          // The same shape as Sort's verify ask: the icon sits on the
          // bubble, the two outcomes stay bare words.
          const ask = el('div', 'nl-ask');
          ask.append(faIcon('clock'), ' Send early? ');
          // Both words go back on the row's own box after the ask.
          const ok = button('Confirm', 'linkish alert-word', {
            focus: `pick:${row.id}`,
            onClick: e => {
              e.stopPropagation();
              confirmedEarly.add(row.id);
              picked.add(row.id);
              askOpenId = null;
              rerender();
            },
          });
          askConfirm = ok;
          const no = button('Cancel', 'linkish alert-word nl-cancel', {
            focus: `pick:${row.id}`,
            onClick: e => { e.stopPropagation(); askOpenId = null; rerender(); },
          });
          ask.append(ok, ' \u00b7 ', no);
          titleTd.append(ask);
        }
      }
      if (row.type === 'opportunity' && row.deadline) {
        titleTd.append(el('span', 'item-source', `Deadline ${isoToShort(row.deadline, today)}`));
      }
      tr.append(titleTd);
      const typeTd = el('td');
      typeTd.append(el('span', '', row.type ? typeDisplay(row.type) : ''));
      if (row.subtype) typeTd.append(el('span', 'item-source', row.subtype));
      if (newsletterOnly(row)) typeTd.append(el('span', 'badge', 'Newsletter only'));
      tr.append(typeTd);
      tr.append(el('td', '', isoToShort(row.published_at, today) || ''));
      tr.addEventListener('click', () => pickGesture(row));
      tbody.append(tr);
    }
    table.append(tbody);
    const scroll = el('div', 'table-scroll nl-group-scroll');
    scroll.append(table);
    fold.append(scroll);
    container.append(fold);
  }

  // Send and the count ride at the foot of the window while the groups scroll.
  if (live.length && !busy) {
    const foot = el('div', 'nl-foot');
    foot.append(el('span', 'nl-picked', `${selected.length} picked`));
    const btn = el('button', 'primary', selected.length
      ? `Send ${selected.length} to the ${issueLabel(issue)} issue`
      : `Send to the ${issueLabel(issue)} issue`);
    btn.dataset.focus = 'send';
    btn.disabled = !selected.length || !issue;
    if (btn.disabled) btn.title = issue ? 'Pick at least one item' : 'Pick an issue';
    btn.addEventListener('click', () => { btn.disabled = true; onSend(selected, issue); });
    foot.append(btn);
    container.append(foot);
  }

  pastSection(container, { past, onTrash, onRestore, rows });

  // Put the scroll boxes back where they were, then make sure an open ask is
  // on screen and holding focus — otherwise the click reads as a no-op.
  for (const fold of container.querySelectorAll('[data-group]')) {
    const box = fold.querySelector('.nl-group-scroll');
    const top = scrollTops.get(fold.dataset.group);
    if (box && top) box.scrollTop = top;
  }
  if (askRow) askRow.scrollIntoView({ block: 'nearest' });
  if (askConfirm) askConfirm.focus({ preventScroll: true });
  else restoreFocus(container, focusKey, null);
}
