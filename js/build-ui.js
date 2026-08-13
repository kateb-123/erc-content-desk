/**
 * Build — the running newsletter draft, previewed and exported.
 *
 * The intro and issue date are the two things that never come from a link, so
 * they are typed here rather than sorted in.
 */

import { rowsToIssue, mappedNewsletterRows } from './rows-to-issue.js';
import { renderNewsletter } from './template.js';
import { readyFor } from './workflow.js';

export function renderBuild(container, { rows, draft, onDraftChange, onExport }) {
  container.replaceChildren();

  const pending = mappedNewsletterRows(rows);
  const readyRows = readyFor(rows, 'newsletter');
  const unplacedRows = readyRows.filter(r => !pending.includes(r));
  const introUnplaced = unplacedRows.filter(r => r.type === 'intro').length;
  const otherUnplaced = unplacedRows.filter(r => r.type !== 'intro').length;

  const head = document.createElement('div');
  head.className = 'screen-head';
  head.innerHTML = `
    <h2>Build</h2>
    <p class="lede">${pending.length} item${pending.length === 1 ? '' : 's'} in the running draft.</p>
  `;
  container.append(head);

  if (introUnplaced > 0) {
    const warn = document.createElement('p');
    warn.className = 'warn';
    warn.textContent = `${introUnplaced} item${introUnplaced === 1 ? ' is' : 's are'} marked as intro — the intro text goes in the field below, so ${introUnplaced === 1 ? 'it stays' : 'they stay'} out of the issue.`;
    container.append(warn);
  }

  if (otherUnplaced > 0) {
    const warn = document.createElement('p');
    warn.className = 'warn';
    warn.textContent = `${otherUnplaced} kept item${otherUnplaced === 1 ? " doesn't" : "s don't"} have a category yet, so ${otherUnplaced === 1 ? 'it stays' : 'they stay'} out of this issue. Set the type and subtype in the Sheet to bring ${otherUnplaced === 1 ? 'it' : 'them'} in.`;
    container.append(warn);
  }

  const form = document.createElement('div');
  form.className = 'build-form';
  form.innerHTML = `
    <label for="issue-date">Issue date</label>
    <input id="issue-date" type="text" placeholder="August 2026" />
    <label for="issue-intro">Intro</label>
    <textarea id="issue-intro" rows="4" placeholder="Written fresh each issue."></textarea>
  `;
  const dateInput = form.querySelector('#issue-date');
  const introInput = form.querySelector('#issue-intro');
  dateInput.value = draft.date;
  introInput.value = draft.intro;
  dateInput.addEventListener('input', () => onDraftChange({ date: dateInput.value, intro: introInput.value }));
  introInput.addEventListener('input', () => onDraftChange({ date: dateInput.value, intro: introInput.value }));
  container.append(form);

  if (!pending.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nothing in the draft yet. Keep items for the newsletter on the Sort screen, then process them.';
    container.append(empty);
    return;
  }

  const issue = rowsToIssue(rows, draft);
  const html = renderNewsletter(issue);

  const actions = document.createElement('div');
  actions.className = 'build-actions';

  const copy = document.createElement('button');
  copy.textContent = 'Copy HTML';
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(html);
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy HTML'; }, 1500);
  });

  const download = document.createElement('button');
  download.className = 'primary';
  download.textContent = 'Download HTML and mark built';
  download.addEventListener('click', () => {
    download.disabled = true;
    onExport(html);
  });

  actions.append(copy, download);
  container.append(actions);

  const frame = document.createElement('iframe');
  frame.className = 'preview-frame';
  frame.title = 'Newsletter preview';
  frame.srcdoc = html;
  container.append(frame);
}
