/**
 * The one submit form, shared by Home's Add to the queue and Next
 * newsletter's quick add: the structured single-item form (radio
 * type/subtype) plus the bulk "whole doc" door. All DOM work lives inside
 * renderSubmitForm so the pure helpers stay importable under node --test.
 */
import { subtypesFor, TYPE_ORDER, typeDisplay } from './schema.js';

/** Picking a type clears the subtype; re-picking the current type is a no-op. */
export function pickType(selection, type) {
  return selection.type === type ? selection : { type, subtype: '' };
}

/** Which pill row a type message is about: the subtype
 *  row for "Pick a subtype.", the type row for everything else. */
export function typeRowFor(message) {
  return /^pick a subtype/i.test(String(message ?? '').trim()) ? 'subtype' : 'type';
}

/** Why a bulk row cannot land, in a few words: a row
 *  with no link says so before any attempt; after one, the server's reason. */
export function bulkRowProblem(item) {
  if (!String(item?.link ?? '').trim()) return 'No link';
  return String(item?.error ?? '');
}

/** The bulk button's word, from the count and whether this is a retry, so a
 *  redraw never forgets that these rows failed. */
export function bulkConfirmLabel(count, retrying) {
  if (!count) return 'Nothing left to add';
  return retrying ? `Retry ${count}` : `Add ${count} to the queue`;
}

/**
 * The type pills: every type as a pill, the picked one marked; the picked
 * type's subtypes as a second row; ERC Event is flat and gets the hint that
 * tells it apart from Event.
 */
export function typeChoices(selection) {
  const types = TYPE_ORDER.map(value => ({ value, label: typeDisplay(value), picked: selection.type === value }));
  const subtypes = selection.type
    ? subtypesFor(selection.type).map(value => ({ value, label: value, picked: selection.subtype === value }))
    : [];
  const hint = selection.type === 'erc_event' ? 'an event the ERC runs' : '';
  return { types, subtypes, hint };
}
import { validateSubmission, fieldFor } from './intake.js';
import { withScheme } from './links.js';
import { checkSvg, dotsLoader, loadingLabel, faIcon } from './icons.js';
import { runPool } from './pool.js';
import { openBusyOverlay } from './busy-overlay.js';
import { postJson, plainError } from './sheet-client.js';
import { queueMatch } from './queue-view.js';
import { el, button, focusKeyIn, restoreFocus } from './ui-aids.js';

/** How many bulk items are in flight at once. Each one is a page fetch plus a
 *  Claude read plus a sheet write, so serial was minutes; six is fast without
 *  stacking up writes on the Apps Script lock. */
const BULK_CONCURRENCY = 6;

function show(target, message, kind) {
  target.className = `status status-${kind}`;
  if (kind === 'busy' && message) {
    target.replaceChildren(dotsLoader(), loadingLabel(message));
  } else {
    target.textContent = message;
  }
}

/** One bulk item as a submit body. The description is only what the file's
 *  Description column said; extra columns go to the reader as original_text,
 * never onto the card. */
export function bulkSubmissionBody(item, submitter) {
  return {
    title: item.title || item.link,
    blurb: item.blurb || '',
    original_text: item.original_text || '',
    link: withScheme(item.link),
    type: item.type || '',        // untyped enters untyped: Sort's Needs a fix catches it
    subtype: item.subtype || '',
    spotlight: false,
    submitter,
  };
}

/** POST one item. A server page instead of JSON (a 502, a timeout) becomes
 * one plain sentence with the status, never parser noise. */
const postSubmission = body => postJson('/api/submit', body, 'add that to the queue');

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Render the shared submit form (single item + bulk door) into container.
 * onSubmitted fires after anything actually lands in the queue; a single
 * submission passes the reply ({ id }), so a caller can pick the row up. When
 * it returns a promise and pendingLine is given, the done box shows
 * pendingLine with the mini dots until that promise settles, then doneLine or
 * the error with Try again.
 * bulk: false leaves out the whole-doc door (Next newsletter's quick add).
 * knownLinks, when given, returns the desk's rows: a link already waiting in
 * the queue gets one ask before it is added again.
 */
export function renderSubmitForm(container, {
  onSubmitted, bulk = true, knownLinks = null,
  doneLine = "Got it. It's in the queue.", pendingLine = '',
} = {}) {
  let selection = { type: '', subtype: '' };

  container.innerHTML = `
    <form class="submit-form" novalidate>
      <div class="sf-pair">
        <div><label for="sf-title">Title</label>
          <input id="sf-title" type="text" autocomplete="off"></div>
        <div><label for="sf-link">Link <span class="hint">(required)</span></label>
          <input id="sf-link" type="url" autocomplete="off" placeholder="https://"></div>
      </div>
      <label for="sf-blurb">Description</label>
      <textarea id="sf-blurb" rows="4" aria-describedby="sf-blurb-help"></textarea>
      <p class="hint type-hint sf-help" id="sf-blurb-help">Paste whatever you have: dates, abstract, the whole announcement. Headlines can skip this.</p>
      <fieldset class="type-picker"></fieldset>
      <div class="sf-foot">
        <div class="sf-initials"><label for="sf-submitter">Your initials <span class="hint">(required)</span></label>
          <input id="sf-submitter" type="text" autocomplete="off"></div>
        <label class="check"><input id="sf-spotlight" type="checkbox">
          Requesting ERC Spotlight / newsletter feature</label>
        <button type="submit" class="primary submit-btn">Add to the queue</button>
      </div>
      <p class="status" role="status" aria-live="polite"></p>
    </form>
    <details class="bulk-door">
      <summary><i class="fa-solid fa-chevron-down" aria-hidden="true"></i><span>Have a whole doc or spreadsheet? Add it here. It gets split into items you review first.</span></summary>
      <label class="bulk-drop">
        <strong class="bulk-drop-word">Drop a file here</strong> or click to choose one
        <span class="hint">.docx, .md, .txt, .xlsx or .csv. Items are shown for review before anything is saved.</span>
        <input class="bulk-file sr-only" type="file" accept=".docx,.md,.txt,.xlsx,.csv">
      </label>
      <p class="bulk-templates">Need a starting point? <a href="/templates/erc-upload-template.docx" download>Word template</a> · <a href="/templates/erc-upload-template.xlsx" download>Spreadsheet template</a></p>
      <div class="bulk-review" hidden>
        <div class="bulk-items"></div>
        <button type="button" class="primary bulk-confirm-btn" data-focus="retry">Add all to the queue</button>
        <button type="button" class="bulk-cancel-btn">Cancel</button>
      </div>
      <p class="bulk-status" role="status" aria-live="polite"></p>
    </details>
  `;

  const form = container.querySelector('.submit-form');
  const statusEl = form.querySelector('.status');
  const typeBox = form.querySelector('.type-picker');
  const legend = el('legend', '', 'Type');
  const bulkDoor = container.querySelector('.bulk-door');
  if (!bulk) bulkDoor.hidden = true;

  // Errors land on their fields: the field a message
  // names turns red, says so to assistive tech, and the first one takes focus.
  // The status line under the button still lists them all.
  const FIELD_EL = { link: '#sf-link', submitter: '#sf-submitter', type: '.type-picker' };
  const clearOne = node => { node.classList.remove('is-invalid'); node.removeAttribute('aria-invalid'); node.removeAttribute('aria-describedby'); };
  function clearInvalid() {
    for (const sel of Object.values(FIELD_EL)) clearOne(form.querySelector(sel));
    for (const row of typeBox.querySelectorAll('.pill-row.is-invalid')) row.classList.remove('is-invalid');
    for (const line of form.querySelectorAll('.field-error')) line.remove();
  }
  // Each message sits under its own field, tied to it for assistive tech;
  // the status line keeps only what the server says. A type message lands on the pill
  // row it names, the subtype row when that is what is missing, and its first pill takes
  // focus, so the error is heard and the red sits on the right row.
  function markInvalid(errors) {
    let first = null;
    const spare = [];
    for (const message of errors) {
      const field = fieldFor(message);
      const sel = FIELD_EL[field];
      const node = sel && form.querySelector(sel);
      if (!node) { spare.push(message); continue; }
      node.classList.add('is-invalid');
      node.setAttribute('aria-invalid', 'true');
      const line = el('p', 'field-error', message);
      line.id = `sf-error-${field}`;
      line.setAttribute('role', 'alert');
      node.setAttribute('aria-describedby', line.id);
      if (node.matches('input')) {
        node.parentElement.append(line);
        first ??= node;
      } else {
        const rows = node.querySelectorAll('.pill-row');
        const row = (typeRowFor(message) === 'subtype' && rows[1]) || rows[0];
        node.classList.remove('is-invalid');
        row.classList.add('is-invalid');
        row.after(line);
        first ??= row.querySelector('.type-word');
      }
    }
    first?.focus();
    return spare;
  }
  for (const kind of ['input', 'change']) {
    form.addEventListener(kind, event => {
      for (const node of [event.target, event.target.closest('.type-picker')]) {
        if (node?.classList.contains('is-invalid')) clearOne(node);
      }
    });
  }

  // After a single submit the form gives way to a confirmation; "Add another"
  // brings the (already reset) form back with the name kept.
  const doneBox = el('div', 'submit-done');
  doneBox.hidden = true;
  doneBox.setAttribute('role', 'status');
  doneBox.tabIndex = -1;
  form.after(doneBox);   // where the form was, above the bulk door
  function showConfirm(note, run) {
    const line = el('p', 'done-line');
    const settled = () => {
      const icon = checkSvg();
      icon.classList.add('draw-check');
      line.className = 'done-line';
      line.replaceChildren(icon, doneLine);
    };
    // The confirmation waits for what the caller does with the item (the
    // newsletter stamp on Quick add) and says so, in the panel, not at the
    // top of the page; a failure gets its words and a way to try again here.
    const wait = promise => {
      line.className = 'done-line is-busy';
      line.replaceChildren(dotsLoader(true), loadingLabel(pendingLine));
      promise.then(settled, err => {
        line.className = 'done-line is-error';
        line.setAttribute('role', 'alert');
        const retry = button('Try again', 'linkish', { onClick: () => { retry.disabled = true; wait(Promise.resolve().then(run)); } });
        line.replaceChildren(plainError(err), ' ', retry);
      });
    };
    doneBox.replaceChildren(line);
    if (note) doneBox.append(el('p', 'hint', note));
    const again = button('Add another', '', {
      onClick: () => {
        doneBox.hidden = true;
        form.hidden = false;
        form.querySelector('#sf-title').focus();
      },
    });
    doneBox.append(again);
    // The spreadsheet door stays: a second item often follows the first.
    form.hidden = true;
    doneBox.hidden = false;
    doneBox.focus({ preventScroll: true });
    const pending = run?.();
    if (pendingLine && pending && typeof pending.then === 'function') wait(pending);
    else settled();
  }

  // The type as pills, the picked type's subtypes as a second row. Buttons,
  // so they never submit.
  function pill(label, picked, onClick, small = false) {
    const b = el('button', `type-word${small ? ' is-small' : ''}${picked ? ' is-picked' : ''}`, label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(picked));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderTypePicker() {
    const { types, subtypes, hint } = typeChoices(selection);
    const row = el('div', 'pill-row');
    for (const t of types) {
      // A pick clears the type error with it; the redraw alone left the red and the stale description behind.
      row.append(pill(t.label, t.picked, () => { selection = pickType(selection, t.value); clearOne(typeBox); renderTypePicker(); }));
    }
    typeBox.replaceChildren(legend, row);
    // "ERC Event" next to "Event" needs a word of difference.
    if (hint) typeBox.append(el('p', 'hint type-hint', hint));
    if (subtypes.length) {
      const sub = el('span', 'subtype-label', 'Subtype ');   // the reveal gets a name, and says it is required
      sub.append(el('span', 'hint', '(required)'));
      typeBox.append(sub);
      const subRow = el('div', 'pill-row');
      for (const s of subtypes) {
        subRow.append(pill(s.label, s.picked, () => { selection = { ...selection, subtype: s.value }; clearOne(typeBox); renderTypePicker(); }, true));
      }
      typeBox.append(subRow);
    }
  }
  renderTypePicker();

  function readForm() {
    return {
      title: form.querySelector('#sf-title').value,
      blurb: form.querySelector('#sf-blurb').value,
      link: withScheme(form.querySelector('#sf-link').value),
      type: selection.type,
      subtype: selection.subtype,
      spotlight: form.querySelector('#sf-spotlight').checked,
      submitter: form.querySelector('#sf-submitter').value,
    };
  }

  // A link already waiting in the queue gets one ask before it goes in again
  //: the warning note in the primary's place, the two
  // outcomes bare words, as Sort's link ask and Publish's ask are drawn.
  let ask = null;
  let addAnyway = false;
  function closeAsk() {
    ask?.remove();
    ask = null;
    form.querySelector('.submit-btn').hidden = false;
  }
  function openAsk(match) {
    const btn = form.querySelector('.submit-btn');
    btn.hidden = true;
    ask = el('div', 'nl-ask sf-ask');
    ask.tabIndex = -1;
    ask.append(faIcon('triangle-exclamation'), ` Already in the queue: ${match.title}${match.when ? `, ${match.when}` : ''}. `);
    const yes = button('Add anyway', 'linkish alert-word', { onClick: () => { addAnyway = true; closeAsk(); form.requestSubmit(); } });
    const no = button('Cancel', 'linkish alert-word nl-cancel', { onClick: () => { closeAsk(); form.querySelector('#sf-link').focus(); } });
    ask.append(yes, ' · ', no);
    statusEl.before(ask);
    ask.focus({ preventScroll: true });
  }

  async function send(body) {
    const btn = form.querySelector('.submit-btn');
    btn.disabled = true;
    btn.hidden = true;   // gone while sending — no double-clicks
    show(statusEl, 'Sending…', 'busy');
    try {
      const data = await postSubmission(body);
      const submitter = body.submitter;
      form.reset();
      selection = { type: '', subtype: '' };
      renderTypePicker();
      form.querySelector('#sf-submitter').value = submitter;
      show(statusEl, '', 'busy');
      showConfirm(data.warnings?.length ? data.warnings.join(' ') : '', () => onSubmitted?.(data));
    } catch (err) {
      show(statusEl, plainError(err), 'error');
    } finally {
      btn.disabled = false;
      btn.hidden = false;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (ask) { ask.focus(); return; }   // the ask is the one thing to answer
    const body = readForm();
    const errors = validateSubmission(body);
    clearInvalid();
    if (errors.length) {
      addAnyway = false;
      const spare = markInvalid(errors);
      return show(statusEl, spare.join(' '), spare.length ? 'error' : 'busy');
    }
    const match = knownLinks && !addAnyway ? queueMatch(body.link, knownLinks() ?? [], todayIso()) : null;
    addAnyway = false;
    if (match) return openAsk(match);
    await send(body);
  });

  // ---- bulk door ----
  const bulkFile = container.querySelector('.bulk-file');
  const bulkDrop = container.querySelector('.bulk-drop');
  const dropWord = container.querySelector('.bulk-drop-word');
  const bulkStatus = container.querySelector('.bulk-status');
  const bulkReview = container.querySelector('.bulk-review');
  const bulkItemsBox = container.querySelector('.bulk-items');
  const bulkConfirm = container.querySelector('.bulk-confirm-btn');
  const bulkCancel = container.querySelector('.bulk-cancel-btn');
  let bulkItems = [];
  const bulkOpen = new Set(); // rows peeked open (index into bulkItems)

  /** The rows the review lists, from a fresh split or from what failed: one
   *  owner, so the peeks and the button's word can never lag behind them. */
  function showBulkRows(items, settle = false) {
    bulkItems = items;
    bulkOpen.clear();
    renderBulkReview(settle);
  }

  /** The split as a queue-style table: title/link, type, Remove; click a row
   *  with text to peek at it. The count lives on the button. A redraw keeps
   *  the keyboard's place: the peek and Remove carry focus keys. */
  function renderBulkReview(settle = false) {
    const focusKey = focusKeyIn(bulkReview);
    const table = el('table', 'queue-table bulk-table');
    const tbody = el('tbody');
    bulkItems.forEach((item, i) => {
      const tr = el('tr', 'bulk-row');
      // Rows settle in once, right after the split, not on remove or peek.
      if (settle) { tr.classList.add('row-in'); tr.style.setProperty('--i', i); }
      // The peek is a chevron button, like Finalize's table.
      const text = item.blurb || item.original_text;
      const caretTd = el('td', 'f-caret');
      if (text) {
        const caret = el('button', 'chevron-btn');
        caret.type = 'button';
        caret.dataset.focus = `peek:${i}`;
        caret.setAttribute('aria-expanded', String(bulkOpen.has(i)));
        caret.setAttribute('aria-label', bulkOpen.has(i) ? 'Hide the text' : 'Show the text');
        caret.append(faIcon(bulkOpen.has(i) ? 'chevron-up' : 'chevron-down'));
        caret.addEventListener('click', () => {
          if (bulkOpen.has(i)) bulkOpen.delete(i);
          else bulkOpen.add(i);
          renderBulkReview();
        });
        caretTd.append(caret);
      }
      tr.append(caretTd);
      const titleTd = el('td');
      titleTd.append(el('span', 'item-title', item.title || item.link || '(untitled)'));
      if (item.link) titleTd.append(el('span', 'item-source', item.link));
      // Why this row cannot land, under it: no link, or what the server said last time.
      const problem = bulkRowProblem(item);
      if (problem) titleTd.append(el('p', 'field-error', problem));
      tr.append(titleTd);
      const typeTd = el('td');
      typeTd.append(el('span', item.type ? '' : 'missing', item.type ? typeDisplay(item.type) : 'No type'));
      if (item.subtype) typeTd.append(el('span', 'item-source', item.subtype));
      tr.append(typeTd);
      const rmTd = el('td', 'bulk-remove');
      rmTd.append(button('Remove', 'linkish',
        { focus: `remove:${i}`, onClick: () => showBulkRows(bulkItems.filter((_, n) => n !== i)) }));
      tr.append(rmTd);
      tbody.append(tr);
      if (text && bulkOpen.has(i)) {
        const peek = el('tr', 'bulk-peek');
        const td = el('td');
        td.colSpan = 4;
        td.append(el('p', 'f-blurb-text', text));
        peek.append(td);
        tbody.append(peek);
      }
    });
    table.append(tbody);
    const scroll = el('div', 'table-scroll');
    scroll.append(table);
    bulkItemsBox.replaceChildren(scroll);
    bulkConfirm.textContent = bulkConfirmLabel(bulkItems.length, bulkItems.some(item => item.error));
    bulkConfirm.disabled = !bulkItems.length;
    // The removed row's place: the Remove now in it, else the last one, else the buttons.
    const removes = bulkItemsBox.querySelectorAll('[data-focus^="remove:"]');
    restoreFocus(bulkReview, focusKey, removes[removes.length - 1] ?? (bulkConfirm.disabled ? bulkCancel : bulkConfirm));
  }

  /** base64 without the data: prefix — how .docx/.xlsx travel to the server. */
  const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });

  // Choosing a file starts the split — read-only until "Add all to the queue".
  // Text formats go up as text; .docx/.xlsx go up as files for server parsing.
  async function splitFile(file) {
    // One split at a time: a second file mid-split is ignored.
    if (!file || bulkFile.disabled) return;
    if (!/\.(docx|md|txt|xlsx|csv)$/i.test(file.name)) {
      return show(bulkStatus, 'Not a supported file. Use .docx, .md, .txt, .xlsx or .csv.', 'error');
    }
    // While one file is being read the zone says which, takes no other, and the chooser is off.
    bulkFile.disabled = true;
    bulkDrop.classList.add('is-busy');
    dropWord.textContent = `Reading ${file.name}`;
    show(bulkStatus, 'This can take a minute…', 'busy');
    try {
      const isText = /\.(md|txt|csv)$/i.test(file.name);
      const data = await postJson('/api/bulk', {
        name: file.name,
        text: isText ? await file.text() : '',
        file: isText ? '' : await fileToBase64(file),
      }, 'split that file');
      showBulkRows(data.items, true);
      bulkReview.hidden = false;
      show(bulkStatus, (data.warnings ?? []).join(' '), 'note');
    } catch (err) {
      show(bulkStatus, plainError(err), 'error');
    } finally {
      bulkFile.disabled = false;
      bulkDrop.classList.remove('is-busy');
      dropWord.textContent = 'Drop a file here';
    }
  }

  bulkFile.addEventListener('change', () => splitFile(bulkFile.files[0]));

  // A file dropped anywhere on the intake card opens the door and splits it;
  // one dropped elsewhere goes nowhere, instead of the browser leaving the page
  // with the typed form. Only files: dragging text into
  // a field keeps working. The drop on the zone itself arrives here too.
  if (bulk) {
    const card = () => container.closest('.card') ?? container;
    const hasFiles = event => [...(event.dataTransfer?.types ?? [])].includes('Files');
    document.addEventListener('dragover', event => {
      if (!hasFiles(event) || !container.isConnected) return;
      event.preventDefault();
      const over = card().contains(event.target);
      bulkDoor.classList.toggle('is-drag', over);
      if (!over) event.dataTransfer.dropEffect = 'none';
    });
    document.addEventListener('dragleave', event => {
      if (event.relatedTarget === null) bulkDoor.classList.remove('is-drag');
    });
    document.addEventListener('drop', event => {
      if (!hasFiles(event) || !container.isConnected) return;
      event.preventDefault();
      bulkDoor.classList.remove('is-drag');
      bulkDrop.classList.remove('is-drag');
      if (!card().contains(event.target)) return;
      bulkDoor.open = true;
      splitFile(event.dataTransfer.files[0]);
    });
  }

  bulkCancel.addEventListener('click', () => {
    bulkItems = [];
    bulkFile.value = '';
    bulkReview.hidden = true;
    show(bulkStatus, '', 'busy');
  });

  bulkConfirm.addEventListener('click', async event => {
    event.target.disabled = true;
    event.target.hidden = true;   // gone while adding — no double-clicks
    const submitter = form.querySelector('#sf-submitter').value.trim() || 'bulk upload';
    const items = bulkItems;
    // The popup is what actually stops a double-submit: the button being gone
    // only guards this one control, and people were clicking elsewhere.
    const overlay = openBusyOverlay({
      title: 'Adding to the queue',
      total: items.length,
      note: 'Keep this tab open until it finishes.',
    });
    let results = [];
    try {
      results = await runPool(items, BULK_CONCURRENCY, item => postSubmission(bulkSubmissionBody(item, submitter)),
        done => overlay.update(done));
    } finally {
      overlay.close();   // never leave the page locked behind the dim
    }
    // What failed stays in the review for a retry, each row
    // with its reason; only a clean run clears it.
    const failed = [];
    items.forEach((item, i) => {
      if (results[i]?.ok) return;
      failed.push({ ...item, error: plainError(results[i]?.error ?? new Error('Did not go through.')) });
    });
    const saved = items.length - failed.length;
    showBulkRows(failed);
    if (!failed.length) { bulkReview.hidden = true; bulkFile.value = ''; }
    show(bulkStatus, failed.length
      ? `Added ${saved}. ${failed.length} did not go through; they are listed above. Retry, or remove them.`
      : `Added all ${saved} to the queue`, failed.length ? 'error' : 'ok');
    if (!failed.length) bulkStatus.prepend(checkSvg());
    if (saved) onSubmitted?.();
    event.target.disabled = false;
    event.target.hidden = false;
  });
}
