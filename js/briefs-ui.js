/**
 * The Research briefs hub's pages (Kate, Oct 20 and 21, 2026; her picks A
 * and D of six drawn layouts): the hub is a full-width table, one row a
 * brief, with a stepper across the seven stages and what the brief waits
 * for; New brief opens a form above it. A brief's own page is the stepper
 * across the top, then only the stage it is at, with the folder's files
 * beside it. Round 1 draws the first stage, Paper and notes; the later ones
 * say they come in the next round.
 */
import { hubRows, stepStates, briefTitle, briefSlug, stageLabel, notesFile } from './briefs-view.js';
import { fillFromPaper } from './paper-read.js';
import { hubHead, HUB_LEDES } from './hub-head.js';
import { isoToShort } from './queue-view.js';
import { faIcon } from './icons.js';
import { el, button, busyLine, tryAgain, focusKeyIn, restoreFocus } from './ui-aids.js';

const MAX_PAPER_MB = 3;

/** The seven stages as a row of dots and a line: done, now, later. */
function stepper(steps, { small = false, subs = {} } = {}) {
  const list = el('ol', `steps${small ? ' steps-small' : ''}`);
  list.setAttribute('aria-label', 'Where it is');
  for (const s of steps) {
    const item = el('li', `step is-${s.state}${s.later ? ' is-round-two' : ''}`);
    const dot = el('span', 'step-dot');
    if (s.state === 'done') dot.append(faIcon('check'));
    const words = el('span', 'step-words', s.label);
    if (s.state === 'now') words.append(el('span', 'sr-only', ' (now)'));
    item.append(dot, words);
    if (subs[s.key]) item.append(el('span', 'step-sub', subs[s.key]));
    list.append(item);
  }
  return list;
}

function field(labelText, control, hint) {
  const wrap = el('div', 'card-field');
  const label = el('label', 'card-field-label', labelText);
  const id = `nb-${labelText.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  control.id = id;
  label.htmlFor = id;
  wrap.append(label, control);
  if (hint) wrap.append(el('p', 'field-hint', hint));
  return wrap;
}

const input = (type = 'text') => { const i = el('input'); i.type = type; return i; };

/** Her notes as a file (Kate, Oct 22): a .md or .txt that fills the notes box; a refusal says why on the problem line. */
function notesPicker(notes, problem) {
  const pick = input('file');
  pick.accept = '.md,.markdown,.txt,text/markdown,text/plain';
  pick.addEventListener('change', () => {
    const file = pick.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const got = notesFile(file.name, reader.result);
      if (!got.ok) { problem.textContent = got.error; pick.value = ''; return; }
      problem.textContent = '';
      notes.value = got.notes;
      notes.dispatchEvent(new Event('input', { bubbles: true }));
    };
    reader.onerror = () => { problem.textContent = "Couldn't read that file."; };
    reader.readAsText(file);
  });
  return field('Or your notes as a file', pick, 'A .md or .txt. It fills the box above.');
}

/**
 * What the New brief form holds between redraws: the chosen PDF and every
 * box's words, so a Creating… redraw or a refusal never drops what she typed
 * (the desk's rule: a redraw never drops what you are typing). Cleared when
 * the brief is made or the form is cancelled.
 */
const draft = { file: null, values: {} };
export function clearBriefDraft() { draft.file = null; draft.values = {}; }

/** The New brief form: the paper, who and what, her notes. Choosing the paper reads it and fills the empty boxes (Oct 22). */
function newBriefForm({ onCreate, onCancel, onReadPaper, creating, error }) {
  const box = el('form', 'hub-box new-brief');
  box.noValidate = true;
  const paper = input('file');
  paper.accept = 'application/pdf,.pdf';
  const defaultYear = String(new Date().getFullYear());
  const last = input(); last.autocomplete = 'off';
  const year = input(); year.inputMode = 'numeric'; year.maxLength = 4; year.value = defaultYear;
  const topic = input(); topic.placeholder = 'one word, like alignment';
  const paperTitle = input();
  const authors = input(); authors.placeholder = 'as the paper lists them';
  const journal = input();
  const record = input(); record.placeholder = 'Dr. Lastname, the one the email goes to';
  const notes = el('textarea'); notes.rows = 5; notes.placeholder = 'What to lead with, what to keep, which table is the visual.';
  const boxes = { last, year, topic, paperTitle, authors, journal, record, notes };
  for (const [key, control] of Object.entries(boxes)) {
    if (draft.values[key] != null) control.value = draft.values[key];
    control.addEventListener('input', () => { draft.values[key] = control.value; });
  }
  if (draft.file) {
    try { const dt = new DataTransfer(); dt.items.add(draft.file); paper.files = dt.files; } catch { /* an older browser: the file is still in the draft */ }
  }
  const folderLine = el('p', 'field-hint new-brief-folder');
  const sayFolder = () => { const slug = briefSlug({ authorLast: last.value, year: year.value, topic: topic.value }); folderLine.textContent = slug ? `Folder: ${slug}` : 'Folder: the last name, the year and the topic word'; };
  for (const c of [last, year, topic]) c.addEventListener('input', sayFolder);
  sayFolder();

  // The paper read: choosing a PDF fills the title, authors, journal, year and last name where they are empty.
  const readLine = el('p', 'field-hint new-brief-read');
  readLine.setAttribute('role', 'status');
  let reading = 0;
  paper.addEventListener('change', async () => {
    const file = paper.files?.[0];
    if (!file) return;
    draft.file = file;
    if (!/\.pdf$/i.test(file.name) || !onReadPaper) return;
    const turn = ++reading;
    readLine.replaceChildren(busyLine('Reading the paper'));
    try {
      const found = await onReadPaper(file);
      if (turn !== reading) return;
      const fill = fillFromPaper(found, { paperTitle: paperTitle.value, authors: authors.value, journal: journal.value, year: year.value, authorLast: last.value }, { defaultYear });
      const names = { paperTitle: 'title', authors: 'authors', journal: 'journal', year: 'year', authorLast: 'last name' };
      for (const [key, value] of Object.entries(fill)) {
        const control = key === 'authorLast' ? last : boxes[key];
        control.value = value;
        draft.values[key === 'authorLast' ? 'last' : key] = value;
      }
      sayFolder();
      const filled = Object.keys(fill).map(k => names[k]);
      readLine.textContent = filled.length ? `Read from the paper: ${filled.join(', ')}. Check them.` : 'Read the paper; the boxes already had their words.';
    } catch (err) {
      if (turn !== reading) return;
      readLine.textContent = `Couldn't read the paper (${String(err?.message ?? err)}). Type the title, authors, journal and year.`;
    }
  });

  const grid = el('div', 'card-grid');
  grid.append(
    field("Author's last name", last),
    field('Year', year),
    field('Topic word', topic, 'Tells two papers by one author apart.'),
    field('Author of record', record),
  );
  const problem = el('p', 'field-error');
  problem.setAttribute('role', 'alert');
  if (error) problem.textContent = error;
  const actions = el('div', 'new-brief-actions');
  const create = button(creating ? 'Creating…' : 'Create the brief', 'primary', { focus: 'nb-create', icon: creating ? null : 'file-arrow-up' });
  create.type = 'submit';
  create.disabled = Boolean(creating);
  const cancel = button('Cancel', 'btn-outline', { onClick: onCancel });
  actions.append(create, cancel);

  box.append(
    el('h3', 'section-label hub-label', 'New brief'),
    field('The paper, as a PDF', paper, `Up to ${MAX_PAPER_MB} MB. Bigger: Preview, File, Export, Reduce File Size. The desk reads it and fills the boxes it can.`),
    readLine,
    grid, folderLine,
    field("The paper's title", paperTitle),
    field('Authors', authors),
    field('Journal', journal),
    field('Your notes', notes),
    notesPicker(notes, problem),
    problem, actions,
  );

  box.addEventListener('submit', async event => {
    event.preventDefault();
    problem.textContent = '';
    const file = paper.files?.[0] ?? draft.file;
    if (!file) { problem.textContent = 'Choose the paper, a PDF.'; paper.focus(); return; }
    if (!/\.pdf$/i.test(file.name)) { problem.textContent = 'The paper must be a PDF.'; paper.focus(); return; }
    if (file.size > MAX_PAPER_MB * 1024 * 1024) { problem.textContent = `That PDF is over ${MAX_PAPER_MB} MB. Shrink it first (Preview, File, Export, Reduce File Size).`; paper.focus(); return; }
    if (!briefSlug({ authorLast: last.value, year: year.value, topic: topic.value })) { problem.textContent = "The author's last name and a four-digit year name the folder."; last.focus(); return; }
    const paperB64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.readAsDataURL(file);
    });
    onCreate({
      authorLast: last.value.trim(), year: year.value.trim(), topic: topic.value.trim(), paperTitle: paperTitle.value.trim(), authors: authors.value.trim(),
      journal: journal.value.trim(), authorOfRecord: record.value.trim(), notes: notes.value, paperName: file.name, paperB64,
    });
  });
  return box;
}

/** The hub: the table of briefs, New brief above it. */
export function renderBriefs(container, props) {
  const { briefs, loaded, error, today, onOpen, onRefresh, newOpen, onToggleNew, onCreate, onReadPaper, creating, createError } = props;
  const focusKey = focusKeyIn(container);
  const page = el('div', 'hub-page briefs-page');
  const head = el('div', 'briefs-head');
  head.append(hubHead('Research briefs', HUB_LEDES.briefs));
  if (!newOpen) {
    head.append(button('New brief', 'primary', { focus: 'new-brief', icon: 'file-arrow-up', onClick: onToggleNew }));
  }
  page.append(head);
  if (newOpen) page.append(newBriefForm({ onCreate, onCancel: onToggleNew, onReadPaper, creating, error: createError }));

  if (!loaded) {
    page.append(error ? tryAgain(onRefresh) : busyLine('Loading the briefs'));
  } else if (!briefs.length) {
    page.append(el('p', 'briefs-empty', 'No briefs yet. New brief starts one: the paper and your notes.'));
  } else {
    const table = el('table', 'briefs-table');
    const thead = el('thead');
    const hr = el('tr');
    for (const [label, cls] of [['Brief', 'col-brief'], ['Where it is', 'col-steps'], ['Waits for', 'col-waits'], ['', 'col-go']]) {
      const th = el('th', cls, label); th.scope = 'col'; hr.append(th);
    }
    thead.append(hr);
    const tbody = el('tbody');
    for (const row of hubRows(briefs, today)) {
      const tr = el('tr', 'briefs-row');
      const name = el('td', 'col-brief');
      const open = el('a', 'briefs-link', row.title);
      open.href = row.href;
      open.dataset.focus = `brief-${row.id}`;
      open.addEventListener('click', event => { event.preventDefault(); onOpen(row.id); });
      name.append(el('div', 'briefs-title').appendChild(open).parentElement, el('div', 'briefs-meta', [row.authors, row.journal].filter(Boolean).join(' · ')));
      const where = el('td', 'col-steps');
      where.append(stepper(row.steps, { small: true }));
      const waits = el('td', 'col-waits');
      waits.append(el('div', 'briefs-title', row.waits.title), el('div', 'briefs-meta', row.waits.meta));
      const go = el('td', 'col-go');
      go.append(faIcon('arrow-right'));
      tr.append(name, where, waits, go);
      tr.addEventListener('click', event => { if (event.target.closest('a')) return; onOpen(row.id); });
      tbody.append(tr);
    }
    table.append(thead, tbody);
    page.append(table);
  }
  container.replaceChildren(page);
  if (focusKey !== null) restoreFocus(container, focusKey, page.querySelector('.page-title'));
}

/** The folder's files, newest first, each a link into Drive. */
function filesBox(files) {
  const box = el('div', 'hub-box brief-files');
  if (files === null) { box.append(el('p', 'brief-files-note', 'Drive did not answer just now. The folder link above still opens it.')); return box; }
  if (files === undefined) { box.append(busyLine('Reading the folder')); return box; }
  if (!files.length) { box.append(el('p', 'brief-files-note', 'Nothing in the folder yet.')); return box; }
  const list = el('ul', 'brief-file-list');
  for (const f of files) {
    const li = el('li');
    const a = el('a', 'brief-file', f.name);
    a.href = f.url; a.target = '_blank'; a.rel = 'noopener';
    a.append(el('span', 'sr-only', ' (opens in a new tab)'));
    li.append(faIcon(/\.pdf$/i.test(f.name) ? 'file-pdf' : /\.docx$/i.test(f.name) ? 'file-word' : /\.(png|jpe?g)$/i.test(f.name) ? 'file-image' : 'file-lines'), a, el('span', 'brief-file-when', f.updated ? isoToShort(f.updated, '') : ''));
    list.append(li);
  }
  box.append(list);
  return box;
}

/** The stage a brief is at, as the one box on its page. Round 1: Paper and notes. */
function stageBox(brief, { onSaveNotes, savingNotes, notesSaved }) {
  const box = el('div', 'hub-box brief-stage');
  if (brief.stage !== 'paper') {
    box.append(el('p', 'brief-files-note', `${stageLabel(brief.stage)} comes in the next round. The folder holds everything so far.`));
    return box;
  }
  const paperRow = el('p', 'brief-paper');
  paperRow.append(faIcon('file-pdf'), ' ', brief.paperName || 'the paper');
  const notes = el('textarea', 'brief-notes');
  notes.id = 'brief-notes';
  notes.rows = 6;
  notes.value = brief.notes ?? '';
  const label = el('label', 'card-field-label', 'Your notes');
  label.htmlFor = notes.id;
  const problem = el('p', 'field-error');
  problem.setAttribute('role', 'alert');
  const actions = el('div', 'brief-actions');
  const save = button(savingNotes ? 'Saving…' : 'Save notes', 'btn-outline', { focus: 'save-notes', onClick: () => onSaveNotes(notes.value) });
  save.disabled = Boolean(savingNotes);
  actions.append(save, el('span', 'brief-saved', notesSaved || 'Saved to the row and as notes.md in the folder.'));
  box.append(paperRow, label, notes, notesPicker(notes, problem), problem, actions, el('p', 'brief-next', 'Next: the draft, in the next round.'));
  return box;
}

/** One brief: the stepper, the stage it is at, the folder. */
export function renderBrief(container, props) {
  const { brief, files, loading, error, today, onRefresh, onSaveNotes, savingNotes, notesSaved } = props;
  const focusKey = focusKeyIn(container);
  const page = el('div', 'hub-page brief-page');
  if (!brief) {
    page.append(hubHead('Research briefs', ''), error ? el('p', 'brief-files-note', error) : busyLine('Opening the brief'));
    if (error && onRefresh) page.append(tryAgain(onRefresh));
    container.replaceChildren(page);
    return;
  }
  const lede = el('p', 'lede');
  const who = [brief.authors, brief.journal ? el('i', '', brief.journal) : '', brief.year ? String(brief.year) : ''].filter(Boolean);
  who.forEach((part, i) => { if (i) lede.append(' · '); lede.append(part); });
  if (brief.folderUrl) {
    if (who.length) lede.append(' · ');
    const folder = el('a', 'hub-link', `${brief.id} on the team drive`);
    folder.href = brief.folderUrl; folder.target = '_blank'; folder.rel = 'noopener';
    folder.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
    lede.append(folder);
  }
  const head = el('div', 'page-head hub-head');
  head.append(el('h2', 'page-title', briefTitle(brief)), lede);
  const subs = { paper: brief.createdAt ? isoToShort(brief.createdAt.slice(0, 10), today) : '' };
  if (brief.stage !== 'paper' && brief.stageAt) subs[brief.stage] = isoToShort(brief.stageAt.slice(0, 10), today);
  for (const s of stepStates(brief.stage)) if (s.later && s.state === 'later') subs[s.key] = s.key === 'html' || s.key === 'live' ? 'round two' : subs[s.key];
  const split = el('div', 'qh-split brief-split');
  const main = el('div');
  main.append(el('h3', 'section-label hub-label', stageLabel(brief.stage)), stageBox(brief, { onSaveNotes, savingNotes, notesSaved }));
  const aside = el('aside', 'qh-side');
  aside.append(el('h3', 'section-label hub-label', 'In the folder'), filesBox(loading ? undefined : files));
  split.append(main, aside);
  page.append(head, stepper(stepStates(brief.stage), { subs }), split);
  container.replaceChildren(page);
  if (focusKey !== null) restoreFocus(container, focusKey, page.querySelector('.page-title'));
}
