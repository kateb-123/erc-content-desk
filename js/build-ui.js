/**
 * Build: tick what makes this issue from the published pool. Items auto-slot
 * by type (⭐ -> Spotlight), each with a "move to…" override. Only the intro
 * is typed. Export downloads Outlook HTML and stamps newsletter_issue.
 */
import { buildPool } from './workflow.js';
import { defaultSection, issueFromPicks, isoToDisplay } from './rows-to-issue.js';
import { SECTION_REGISTRY } from './model.js';
import { renderNewsletter } from './template.js';
import { nextIssueDate } from './schedule.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderBuild(container, props) {
  const { rows, schedule, today, draft, picks,
    onTogglePick, onMovePick, onDraftChange, onExport } = props;
  container.replaceChildren();
  const pool = buildPool(rows);
  const starred = pool.filter(r => r.spotlight_request);
  const rest = pool.filter(r => !r.spotlight_request);

  const head = el('div', 'screen-head');
  head.append(el('h2', '', 'Build'));
  head.append(el('p', 'lede', pool.length
    ? `Pick this issue's items — ${pool.length} published item(s) available.`
    : 'Nothing published and unused yet. Publish first, then build.'));
  container.append(head);

  const form = el('div', 'build-form');
  const issueDate = draft.date || nextIssueDate(schedule, today);
  const dateSel = document.createElement('select');
  dateSel.id = 'issue-date';
  const options = schedule.length ? schedule : [issueDate].filter(Boolean);
  dateSel.replaceChildren(...options.map(d =>
    new Option(isoToDisplay(d), d, false, d === issueDate)));
  dateSel.addEventListener('change', () => onDraftChange({ date: dateSel.value }));
  const intro = document.createElement('textarea');
  intro.id = 'issue-intro';
  intro.rows = 4;
  intro.placeholder = 'Intro — the one thing you write by hand.';
  intro.value = draft.intro;
  intro.addEventListener('input', () => onDraftChange({ intro: intro.value }));
  form.append(el('label', '', 'Issue date '), dateSel, intro);
  container.append(form);
  if (!pool.length) return;

  const sectionOptions = SECTION_REGISTRY.map(s => [s.key, s.label]);
  const pickRow = row => {
    const line = el('div', 'pick-row');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = picks.has(row.id);
    const chosen = picks.get(row.id) ?? defaultSection(row);
    box.addEventListener('change', () => onTogglePick(row.id, chosen || 'headlines'));
    line.append(box);
    if (row.spotlight_request) line.append(el('span', 'badge badge-star', '⭐'));
    line.append(el('span', 'item-title', row.headline));
    line.append(el('span', 'item-meta', [row.subtype, row.date && isoToDisplay(row.date)]
      .filter(Boolean).join(' · ')));
    if (picks.has(row.id)) {
      const move = document.createElement('select');
      move.replaceChildren(...sectionOptions.map(([key, label]) =>
        new Option(`→ ${label}`, key, false, key === picks.get(row.id))));
      move.addEventListener('change', () => onMovePick(row.id, move.value));
      line.append(move);
    }
    return line;
  };

  if (starred.length) {
    container.append(el('h3', '', '⭐ Requested features'));
    for (const row of starred) container.append(pickRow(row));
  }
  container.append(el('h3', '', 'Everything else'));
  for (const row of rest) container.append(pickRow(row));

  const pickedIds = [...picks.keys()].filter(id => pool.some(r => r.id === id));
  const pickList = pickedIds.map(id => ({ id, sectionKey: picks.get(id) }));
  const issue = issueFromPicks(rows, pickList, {
    date: issueDate ? isoToDisplay(issueDate) : '', intro: draft.intro,
  });
  const html = renderNewsletter(issue);

  const actions = el('div', 'build-actions');
  const buildBtn = el('button', 'primary',
    `Build — download HTML & stamp ${pickedIds.length} item(s)`);
  buildBtn.disabled = !pickedIds.length || !issueDate;
  buildBtn.addEventListener('click', () => {
    buildBtn.disabled = true;
    onExport(html, pickedIds, issueDate);
  });
  const copyBtn = el('button', '', 'Copy HTML');
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(html);
    copyBtn.textContent = 'Copied ✓';
    setTimeout(() => { copyBtn.textContent = 'Copy HTML'; }, 1500);
  });
  actions.append(buildBtn, copyBtn);
  container.append(actions);

  const frame = document.createElement('iframe');
  frame.className = 'preview-frame';
  frame.srcdoc = html;
  container.append(frame);
}
