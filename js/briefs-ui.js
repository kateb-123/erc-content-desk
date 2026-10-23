/**
 * The Research briefs hub's pages (Kate, Oct 20 and 21, 2026; her picks A
 * and D of six drawn layouts): the hub is a full-width table, one row a
 * brief, with a stepper across the seven stages and what the brief waits
 * for; New brief opens a form above it. A brief's own page is the stepper
 * across the top, then only the stage it is at, with the folder's files
 * beside it. Round 1 draws the first stage, Paper and notes; the later ones
 * say they come in the next round.
 */
import { hubRows, stepStates, briefTitle, briefSlug, stageLabel, notesFile, notesKind, createLock, wordCount, draftProgress, draftWait, pairFor, cutsToMake, bandPill } from './briefs-view.js';
import { fillFromPaper } from './paper-read.js';
import { renderMarkdown } from './markdown-lite.js';
import { chartSvg, chartAlt } from './brief-visual.js';
import { hubHead, HUB_LEDES } from './hub-head.js';
import { isoToShort } from './queue-view.js';
import { faIcon, busyWords } from './icons.js';
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

/** A labelled control. The id comes from the label, so a form that can stand in the DOM beside another (the brief's page beside a hidden New brief) passes its own prefix. */
function field(labelText, control, hint, prefix = 'nb') {
  const wrap = el('div', 'card-field');
  const label = el('label', 'card-field-label', labelText);
  const id = `${prefix}-${labelText.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  control.id = id;
  label.htmlFor = id;
  wrap.append(label, control);
  if (hint) wrap.append(el('p', 'field-hint', hint));
  return wrap;
}

const input = (type = 'text') => { const i = el('input'); i.type = type; return i; };

const NOTES_ACCEPT = '.md,.markdown,.txt,.docx,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * A notes file's words (Kate, Oct 22: "text, word or .md?"): a .md or .txt
 * is read here; a Word .docx goes to the desk's Word reader through
 * onReadNotes and comes back as markdown. Resolves { notes, b64 } (b64 only
 * for a Word file, kept as the original beside notes.md) or throws with the
 * sentence to show.
 */
function readNotesFile(file, onReadNotes) {
  const kind = notesKind(file.name);
  if (!kind) return Promise.reject(new Error('Notes come as a .md, .txt or Word .docx file, or pasted in.'));
  if (kind === 'word') {
    if (!onReadNotes) return Promise.reject(new Error('A Word file cannot be read here. Save it as .txt and choose that.'));
    return onReadNotes(file).then(({ notes, b64 }) => {
      const got = notesFile('notes.md', notes);
      if (!got.ok) throw new Error(got.error === 'That file is empty.' ? 'That Word file has no words in it.' : got.error);
      return { notes: got.notes, b64 };
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const got = notesFile(file.name, reader.result);
      if (!got.ok) reject(new Error(got.error)); else resolve({ notes: got.notes, b64: '' });
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsText(file);
  });
}

/** The brief page's notes box takes a file too: a .md, .txt or Word .docx that fills it; a refusal says why on the problem line. */
function notesPicker(notes, problem, onReadNotes) {
  const pick = input('file');
  pick.accept = NOTES_ACCEPT;
  const wrap = field('Or your notes as a file', pick, 'A .md, .txt or Word .docx. It fills the box above.', 'bp');
  pick.addEventListener('change', async () => {
    const file = pick.files?.[0];
    if (!file) return;
    problem.textContent = '';
    const hint = wrap.querySelector('.field-hint');
    if (notesKind(file.name) === 'word') hint.replaceChildren(busyWords('Reading the Word file'));
    try {
      const { notes: words } = await readNotesFile(file, onReadNotes);
      notes.value = words;
      notes.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) {
      problem.textContent = String(err?.message ?? err);
      pick.value = '';
    }
    hint.textContent = 'A .md, .txt or Word .docx. It fills the box above.';
  });
  return wrap;
}

/**
 * What the New brief form holds between redraws: the chosen files, the notes
 * file's text and every box's words, so a Creating… redraw or a refusal
 * never drops what she typed (the desk's rule: a redraw never drops what you
 * are typing). Cleared when the brief is made or the form is cancelled.
 */
const draft = { file: null, notesFile: null, notesB64: '', notes: '', pasteOpen: false, values: {}, read: false, readFilled: {} };
export function clearBriefDraft() { draft.file = null; draft.notesFile = null; draft.notesB64 = ''; draft.notes = ''; draft.pasteOpen = false; draft.values = {}; draft.read = false; draft.readFilled = {}; }

/** A file input showing a chosen file again after a redraw (older browsers skip it; the draft still holds the file). */
function showFile(control, file) {
  if (!file) return;
  try { const dt = new DataTransfer(); dt.items.add(file); control.files = dt.files; } catch { /* the file is still in the draft */ }
}

/**
 * The New brief form in her order (Kate, Oct 22): the two files first, the
 * paper and her notes, both needed; once the paper is in, the desk reads it
 * and the byline appears under the files, filled, for her to check and finish
 * with the topic word and the author of record; Create opens the brief's
 * page, where the draft comes next.
 */
function newBriefForm({ onCreate, onCancel, onReadPaper, onReadNotes, creating, error }) {
  const box = el('form', 'hub-box new-brief');
  box.noValidate = true;
  const paper = input('file');
  paper.accept = 'application/pdf,.pdf';
  const notesPick = input('file');
  notesPick.accept = NOTES_ACCEPT;
  const paperMeta = el('p', 'field-hint new-brief-filemeta');
  const notesMeta = el('p', 'field-hint new-brief-filemeta');
  // The notes box: opened by Paste instead, or shown filled once a file is read, so she sees what the desk got and can fix it.
  const pasteBox = el('textarea', 'new-brief-paste');
  pasteBox.rows = 6;
  pasteBox.placeholder = 'What to lead with, what to keep, which table is the visual.';
  pasteBox.value = draft.notes;
  pasteBox.addEventListener('input', () => { draft.notes = pasteBox.value; sayNotes(); sayLock(); });
  const pasteWord = button('Paste instead', 'linkish', { focus: 'nb-paste', onClick: () => { draft.pasteOpen = true; showPaste(); pasteBox.focus(); } });
  const defaultYear = String(new Date().getFullYear());
  const last = input(); last.autocomplete = 'off';
  const year = input(); year.inputMode = 'numeric'; year.maxLength = 4; year.value = defaultYear;
  const topic = input(); topic.placeholder = 'one word, like alignment';
  const paperTitle = input();
  const authors = input(); authors.placeholder = 'as the paper lists them';
  const journal = input();
  const record = input(); record.placeholder = 'Dr. Lastname, the one the email goes to';
  // The brief's own author line (her pick, Oct 22): whoever is signed in, from a box that remembers its last value.
  const briefAuthor = input();
  let remembered = '';
  try { remembered = localStorage.getItem('desk.briefAuthor') ?? ''; } catch { /* no storage, no memory */ }
  briefAuthor.value = remembered || 'Kate Barnes';
  briefAuthor.addEventListener('input', () => { try { localStorage.setItem('desk.briefAuthor', briefAuthor.value); } catch { /* fine */ } });
  const boxes = { last, year, topic, paperTitle, authors, journal, record, briefAuthor };
  for (const [key, control] of Object.entries(boxes)) {
    if (draft.values[key] != null) control.value = draft.values[key];
    control.addEventListener('input', () => { draft.values[key] = control.value; });
  }
  showFile(paper, draft.file);
  showFile(notesPick, draft.notesFile);

  const problem = el('p', 'field-error');
  problem.setAttribute('role', 'alert');
  if (error) problem.textContent = error;

  // The byline: hidden until the paper is in, then filled by the read.
  const byline = el('div', 'new-brief-byline');
  const readLine = el('p', 'field-hint new-brief-read');
  readLine.setAttribute('role', 'status');
  const folderLine = el('p', 'field-hint new-brief-folder');
  const sayFolder = () => { const slug = briefSlug({ authorLast: last.value, year: year.value, topic: topic.value }); folderLine.textContent = slug ? `Folder: ${slug}` : 'Folder: the last name, the year and the topic word'; };
  for (const c of [last, year, topic]) c.addEventListener('input', sayFolder);
  sayFolder();
  const pair = (a, b) => { const g = el('div', 'card-grid'); g.append(a, b); return g; };
  const topicField = field('Topic word', topic, 'Tells two papers by one author apart.');
  topicField.append(folderLine);
  byline.append(
    el('h3', 'section-label hub-label', 'The byline'),
    readLine,
    field("The paper's title", paperTitle),
    pair(field('Authors', authors), field('Journal', journal)),
    pair(field("Author's last name", last), field('Year', year)),
    pair(topicField, field('Author of record', record)),
    pair(field('Brief author', briefAuthor, "Named on the draft's cover as the brief's author."), el('div')),
  );

  // Create: locked, and saying why, until both files are in and the read is done.
  const create = button(creating ? 'Creating…' : 'Create the brief', 'primary', { focus: 'nb-create', icon: creating ? null : 'file-arrow-up' });
  create.type = 'submit';
  const lockLine = el('p', 'new-brief-lock');
  let reading = 0;
  const sayLock = () => {
    const bytes = (draft.file?.size ?? 0) + Math.ceil((draft.notesB64?.length ?? 0) * 3 / 4);
    const why = createLock({ paper: Boolean(draft.file), notes: Boolean(draft.notes.trim()), reading: reading > 0 && !draft.read, bytes });
    create.disabled = Boolean(creating) || Boolean(why);
    lockLine.textContent = why;
    byline.hidden = !draft.file;
  };

  const sayPaper = () => { paperMeta.textContent = draft.file ? `${Math.max(1, Math.round(draft.file.size / 1024))} KB` : ''; };
  const sayNotes = () => {
    const words = wordCount(draft.notes);
    notesMeta.textContent = draft.notesFile ? `${words.toLocaleString('en-US')} words from ${draft.notesFile.name}` : (draft.notes.trim() ? `${words.toLocaleString('en-US')} words, pasted` : '');
  };
  const pasteField = field('Your notes, as words', pasteBox, 'Fix anything the file got wrong, or paste them here.');
  const showPaste = () => { pasteField.hidden = !(draft.pasteOpen || draft.notesFile); pasteWord.hidden = !pasteField.hidden; };
  sayPaper(); sayNotes(); showPaste();

  // The paper read: choosing the PDF fills the title, authors, journal, year and last name where they are empty.
  paper.addEventListener('change', async () => {
    const file = paper.files?.[0];
    if (!file) return;
    problem.textContent = '';
    if (!/\.pdf$/i.test(file.name)) { problem.textContent = 'The paper must be a PDF.'; paper.value = ''; return; }
    if (file.size > MAX_PAPER_MB * 1024 * 1024) { problem.textContent = `That PDF is over ${MAX_PAPER_MB} MB. Shrink it first (Preview, File, Export, Reduce File Size).`; paper.value = ''; return; }
    draft.file = file; draft.read = false;
    sayPaper();
    if (!onReadPaper) { draft.read = true; sayLock(); return; }
    const turn = ++reading;
    sayLock();
    readLine.replaceChildren(busyWords('Reading the paper'));
    // A read is stale once another PDF was chosen, or the form was cancelled or created (draft.file is no longer this file).
    const stale = () => turn !== reading || draft.file !== file;
    try {
      const found = await onReadPaper(file);
      if (stale()) return;
      const current = { paperTitle: paperTitle.value, authors: authors.value, journal: journal.value, year: year.value, authorLast: last.value };
      const fill = fillFromPaper(found, current, { defaultYear, readFilled: draft.readFilled });
      const names = { paperTitle: 'title', authors: 'authors', journal: 'journal', year: 'year', authorLast: 'last name' };
      for (const [key, value] of Object.entries(fill)) {
        const control = key === 'authorLast' ? last : boxes[key];
        control.value = value;
        draft.values[key === 'authorLast' ? 'last' : key] = value;
        draft.readFilled[key] = value;
      }
      sayFolder();
      const filled = Object.keys(fill).map(k => names[k]);
      readLine.textContent = filled.length ? `Read from the paper: ${filled.join(', ')}. Check them.` : 'Read the paper; the boxes already had their words.';
    } catch (err) {
      if (stale()) return;
      const why = String(err?.message ?? err);
      readLine.textContent = /Type the title/.test(why) ? `Couldn't read the paper: ${why}` : `Couldn't read the paper (${why}). Type the title, authors, journal and year.`;
    }
    draft.read = true;
    sayLock();
    if (!topic.value) topic.focus();
  });

  // Her notes: the file's words ride with the brief as its notes, shown in the box so she can fix them.
  notesPick.addEventListener('change', async () => {
    const file = notesPick.files?.[0];
    if (!file) return;
    problem.textContent = '';
    if (notesKind(file.name) === 'word') notesMeta.replaceChildren(busyWords('Reading the Word file'));
    try {
      const { notes: words, b64 } = await readNotesFile(file, onReadNotes);
      if (notesPick.files?.[0] !== file) return;   // another file was chosen meanwhile
      draft.notesFile = file; draft.notesB64 = b64; draft.notes = words;
      pasteBox.value = words;
    } catch (err) {
      problem.textContent = String(err?.message ?? err);
      notesPick.value = ''; draft.notesFile = null; draft.notesB64 = '';
      if (!draft.pasteOpen) { draft.notes = ''; pasteBox.value = ''; }
    }
    sayNotes(); sayLock(); showPaste();
  });

  const files = el('div', 'card-grid new-brief-files');
  const paperField = field('The paper, as a PDF', paper, `Up to ${MAX_PAPER_MB} MB. Bigger: Preview, File, Export, Reduce File Size.`);
  paperField.append(paperMeta);
  const notesField = field('Your notes, as a .md, .txt or Word .docx', notesPick, 'What to lead with, what to keep, which table is the visual.');
  notesField.append(notesMeta, pasteWord);
  files.append(paperField, notesField);

  const actions = el('div', 'new-brief-actions');
  const cancel = button('Cancel', 'btn-outline', { onClick: onCancel });
  actions.append(create, cancel);
  const createBlock = el('div', 'new-brief-create');
  createBlock.append(actions, lockLine);
  sayLock();

  box.append(el('h3', 'section-label hub-label', 'New brief'), files, pasteField, byline, problem, createBlock);

  box.addEventListener('submit', async event => {
    event.preventDefault();
    problem.textContent = '';
    const file = paper.files?.[0] ?? draft.file;
    if (!file) { problem.textContent = 'Choose the paper, a PDF.'; paper.focus(); return; }
    if (!draft.notes.trim()) { problem.textContent = 'Choose your notes file, a .md, .txt or Word .docx, or paste them.'; notesPick.focus(); return; }
    if (!briefSlug({ authorLast: last.value, year: year.value, topic: topic.value })) { problem.textContent = "The author's last name and a four-digit year name the folder."; last.focus(); return; }
    const paperB64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.readAsDataURL(file);
    });
    onCreate({
      authorLast: last.value.trim(), year: year.value.trim(), topic: topic.value.trim(), paperTitle: paperTitle.value.trim(), authors: authors.value.trim(),
      journal: journal.value.trim(), authorOfRecord: record.value.trim(), notes: draft.notes, paperName: file.name, paperB64,
      notesName: draft.notesFile?.name ?? '', notesB64: draft.notesB64, briefAuthor: briefAuthor.value.trim(),
    });
  });
  return box;
}

/** The hub: the table of briefs, New brief above it. */
export function renderBriefs(container, props) {
  const { briefs, loaded, error, today, onOpen, onRefresh, newOpen, onToggleNew, onCreate, onReadPaper, onReadNotes, creating, createError } = props;
  const focusKey = focusKeyIn(container);
  const page = el('div', 'hub-page briefs-page');
  const head = el('div', 'briefs-head');
  head.append(hubHead('Research briefs', HUB_LEDES.briefs));
  if (!newOpen) {
    head.append(button('New brief', 'primary', { focus: 'new-brief', icon: 'file-arrow-up', onClick: onToggleNew }));
  }
  page.append(head);
  if (newOpen) page.append(newBriefForm({ onCreate, onCancel: onToggleNew, onReadPaper, onReadNotes, creating, error: createError }));

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

/** A file to save from words the page already holds: a Blob link named for the folder's file. */
function downloadButton(label, name, text) {
  const btn = button(label, 'linkish brief-download', { icon: 'download' });
  btn.title = name;
  btn.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return btn;
}

/** The running box (round 2): every step by name, the icon saying done, now or later; Continue when nothing runs. Kate's copy edit (Oct 22). */
function draftRunningBox(brief, { running, error, onWriteDraft }) {
  const box = el('div', 'hub-box brief-stage');
  const list = el('ol', 'draft-steps');
  for (const row of draftProgress(brief, { running })) {
    const item = el('li', `draft-step is-${row.state}`);
    item.append(faIcon(row.state === 'done' ? 'circle-check' : row.state === 'now' ? 'circle-notch' : 'circle'));
    item.append(row.state === 'now' ? busyWords(row.words) : el('span', '', row.words));
    list.append(item);
  }
  box.append(list);
  const wait = draftWait(brief, { running });
  if (wait) { const p = el('p', 'draft-wait'); p.append(busyWords(wait)); box.append(p); }
  if (error) {
    const problem = el('p', 'field-error');
    problem.setAttribute('role', 'alert');
    problem.textContent = error;
    box.append(problem);
  }
  if (!running) {
    const actions = el('div', 'brief-actions');
    actions.append(button(error ? 'Try again' : 'Continue', 'primary', { focus: 'write-draft', icon: 'pen', onClick: () => onWriteDraft() }));
    box.append(actions);
  } else {
    box.append(el('p', 'brief-next', 'Keep this page open.'));
  }
  return box;
}

/** The proposed chart's picture in the figures folder, for the author round's Word doc. */
const PROPOSED_CHART = 'proposed-figure-1.png';

/** The paper's own table or figure, cut out: the picture from the figures folder, or a short word on why there is none. */
function clipOf(f, { brief, crops, cropFailed, files }) {
  if (!crops.has(f.crop)) {
    const failed = cropFailed.includes(f.crop);
    return el('p', `meta draft-clip-none${failed ? ' draft-crop-miss' : ''}`, failed ? 'Cut failed' : 'Not cut yet');
  }
  // The figures folder's copy first: an older cut can sit beside the draft from before the folder (review, Oct 22).
  const file = (files ?? []).find(x => x.name === `figures/${f.crop}`) ?? (files ?? []).find(x => x.name === f.crop);
  const src = `/api/briefs?id=${encodeURIComponent(brief.id)}&image=${encodeURIComponent(f.crop)}&v=${encodeURIComponent(brief.stageAt ?? '')}`;
  const link = el('a', 'draft-clip');
  link.href = file?.url || src;
  link.target = '_blank';
  link.rel = 'noopener';
  const img = el('img');
  img.src = src;
  img.alt = `${f.label} as the paper prints it`;
  img.addEventListener('error', () => link.replaceWith(el('p', 'meta draft-crop-miss', "Didn't load. It's in the folder.")));
  link.append(img);
  return link;
}

/** The proposal as it would sit in the brief: the chart in the brief's colours, or the table under its label. */
function proposalOf(visual) {
  const wrap = el('div', 'draft-proposal');
  if (visual.kind === 'chart') {
    const chart = el('div', 'draft-chart');
    chart.innerHTML = chartSvg(visual);   // drawn by the desk; every word from the model escaped
    chart.firstElementChild?.setAttribute('aria-label', chartAlt(visual));
    wrap.append(chart);
    return wrap;
  }
  const table = el('table', 'draft-proposal-table');
  table.append(el('caption', '', `${visual.name}. ${visual.title}`));
  const head = el('tr');
  for (const c of visual.columns) head.append(el('th', '', c));
  const thead = el('thead');
  thead.append(head);
  const tbody = el('tbody');
  for (const r of visual.rows) {
    const tr = el('tr');
    for (const c of r) tr.append(el('td', '', c));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

/**
 * The Draft box, her pick A of a leaner box (Oct 22, after "too wordy and
 * too much"): the word count and the downloads in one row, the brief as
 * reading text, then the paper's table or figure beside the proposed one.
 * Nothing else: the check's notes and the number conflicts are a file in
 * the folder (check-notes.md), the other cuts are in the figures folder.
 */
function draftBox(brief, { onWriteDraft, error, cropFailed = [], files = [], cutting = false }) {
  const d = brief.extra?.draft ?? {};
  const r = d.result;
  const box = el('div', 'hub-box brief-stage');
  if (error) {
    const problem = el('p', 'field-error');
    problem.setAttribute('role', 'alert');
    problem.textContent = error;
    box.append(problem);
  }
  const pill = bandPill(r.words);
  const tools = el('div', 'draft-tools');
  tools.append(
    el('span', 'meta', `${Number(r.words ?? 0).toLocaleString('en-US')} words`),
    el('span', `draft-pill${pill === 'In range' ? ' is-ok' : ''}`, pill),
    downloadButton('Draft', 'brief-draft.md', r.draft ?? ''),
    downloadButton('Grammarly copy', 'brief-for-grammarly.md', r.grammarly ?? ''),
    downloadButton('Page plan', 'page-plan.md', r.plan ?? ''),
  );
  if (!cutting) tools.append(button('Redraft', 'linkish', { focus: 'write-again', onClick: () => onWriteDraft({ restart: true }) }));
  const article = el('article', 'brief-read');
  article.innerHTML = renderMarkdown(r.draft ?? '');   // every character escaped by the renderer; only its own tags
  box.append(tools, article);

  const crops = new Set(d.crops ?? []);
  const visual = r.visual ?? null;
  if (visual) {
    const { theirs } = pairFor(r.figures ?? [], visual);
    const cut = { brief, crops, cropFailed, files };
    box.append(el('h3', 'section-label hub-label', visual.name));
    const pair = el('div', 'draft-pair');
    const left = el('div', 'draft-pair-side');
    left.append(el('p', 'draft-pair-head', theirs?.page ? `Paper, p. ${theirs.page}` : 'Paper'));
    left.append(theirs ? clipOf(theirs, cut) : el('p', 'meta draft-clip-none', 'Not found in the paper'));
    const right = el('div', 'draft-pair-side');
    right.append(el('p', 'draft-pair-head', 'Brief'), proposalOf(visual));
    pair.append(left, right);
    box.append(pair);
  }
  const missing = cutsToMake(r, [...crops]);
  const chartMissing = visual?.kind === 'chart' && !crops.has(PROPOSED_CHART);
  if (cutting) {
    // The cuts run under the draft, so she keeps her place on the page (review, Oct 22).
    const line = el('p', 'draft-wait');
    line.append(busyWords('Cutting figures'));
    box.append(line);
  } else if (missing.length || chartMissing) {
    const failed = [...missing.map(c => c.crop), ...(chartMissing ? [PROPOSED_CHART] : [])].some(n => cropFailed.includes(n));
    const again = el('div', 'brief-actions');
    again.append(button(failed ? 'Try again' : 'Cut figures', 'linkish', { focus: 'cut-again', onClick: () => onWriteDraft() }));
    box.append(again);
  }
  return box;
}

/** The stage a brief is at, as the one box on its page. */
/** What she has typed in the brief page's notes box and not yet saved, kept across redraws (review, Oct 22). */
let typedNotes = { id: '', text: null };

function stageBox(brief, { onSaveNotes, onReadNotes, onWriteDraft, savingNotes, notesSaved, draftRunning, draftError, cropFailed, files }) {
  const proofReady = brief.stage === 'proof' && Boolean(brief.extra?.draft?.result);
  if (brief.stage === 'draft' || (draftRunning && !proofReady)) return draftRunningBox(brief, { running: draftRunning, error: draftError, onWriteDraft });
  if (proofReady) return draftBox(brief, { onWriteDraft, error: draftError, cropFailed, files, cutting: Boolean(draftRunning) });
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
  // A redraw (Saving…, a refresh) never drops what she is typing: the page keeps her words until the row holds them.
  notes.value = typedNotes.id === brief.id && typedNotes.text != null ? typedNotes.text : (brief.notes ?? '');
  if (typedNotes.id === brief.id && typedNotes.text === (brief.notes ?? '')) typedNotes = { id: '', text: null };
  notes.addEventListener('input', () => { typedNotes = { id: brief.id, text: notes.value }; });
  const label = el('label', 'card-field-label', 'Your notes');
  label.htmlFor = notes.id;
  const problem = el('p', 'field-error');
  problem.setAttribute('role', 'alert');
  const actions = el('div', 'brief-actions');
  const save = button(savingNotes ? 'Saving…' : 'Save notes', 'btn-outline', { focus: 'save-notes', onClick: () => onSaveNotes(notes.value) });
  save.disabled = Boolean(savingNotes);
  actions.append(save, el('span', 'brief-saved', notesSaved || 'Saved to the row and as notes.md in the folder.'));
  const go = el('div', 'brief-actions brief-write');
  go.append(
    button('Write the draft', 'primary', { focus: 'write-draft', icon: 'pen', onClick: () => onWriteDraft({ notes: notes.value }) }),
    el('span', 'meta', 'A few minutes. Reads the whole paper, plans the pages, writes the brief.'),
  );
  if (draftError) { const p = el('p', 'field-error'); p.setAttribute('role', 'alert'); p.textContent = draftError; go.append(p); }
  box.append(paperRow, label, notes, notesPicker(notes, problem, onReadNotes), problem, actions, go);
  return box;
}

/** One brief: the stepper, the stage it is at, the folder. */
export function renderBrief(container, props) {
  const { brief, files, loading, error, today, onRefresh, onSaveNotes, onReadNotes, onWriteDraft, savingNotes, notesSaved, draftRunning, draftError, cropFailed } = props;
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
  main.append(el('h3', 'section-label hub-label', stageLabel(brief.stage)), stageBox(brief, { onSaveNotes, onReadNotes, onWriteDraft, savingNotes, notesSaved, draftRunning, draftError, cropFailed: cropFailed ?? [], files: files ?? [] }));
  const aside = el('aside', 'qh-side');
  aside.append(el('h3', 'section-label hub-label', 'In the folder'), filesBox(loading ? undefined : files));
  split.append(main, aside);
  page.append(head, stepper(stepStates(brief.stage), { subs }), split);
  container.replaceChildren(page);
  if (focusKey !== null) restoreFocus(container, focusKey, page.querySelector('.page-title'));
}
