/**
 * The one submit form, shared by /submit and the desk Home screen: the
 * structured single-item form (radio type/subtype) plus the bulk "whole doc"
 * door. All DOM work lives inside renderSubmitForm (added with the renderer)
 * so the pure helpers stay importable under node --test.
 */
import { subtypesFor, TYPE_ORDER, TYPE_LABELS } from './schema.js';

/** Picking a type clears the subtype; re-picking the current type is a no-op. */
export function pickType(selection, type) {
  return selection.type === type ? selection : { type, subtype: '' };
}

/**
 * The type pills (Claude Design round two, Kate's pick Sep 16): every type as
 * a pill, the picked one marked; the picked type's subtypes as a second row;
 * ERC Event is flat and gets the hint that tells it apart from Event (F13).
 */
export function typeChoices(selection) {
  const types = TYPE_ORDER.map(value => ({ value, label: TYPE_LABELS[value] ?? value, picked: selection.type === value }));
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

/** How many bulk items are in flight at once. Each one is a page fetch plus a
 *  Claude read plus a sheet write, so serial was minutes; six is fast without
 *  stacking up writes on the Apps Script lock. */
const BULK_CONCURRENCY = 6;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

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
 *  never onto the card (usability run F1, Sep 10). */
export function bulkSubmissionBody(item, submitter) {
  return {
    title: item.title || item.link,
    blurb: item.blurb || '',
    original_text: item.original_text || '',
    link: withScheme(item.link),
    type: item.type || '',        // untyped enters untyped — Sort's To review catches it
    subtype: item.subtype || '',
    spotlight: false,
    submitter,
  };
}

async function postSubmission(body) {
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Render the shared submit form (single item + bulk door) into container.
 * onSubmitted fires after anything actually lands in the queue; a single
 * submission passes the reply ({ id }), so a caller can pick the row up.
 * bulk: false leaves out the whole-doc door (the Next newsletter page, Sep 15).
 */
export function renderSubmitForm(container, { onSubmitted, bulk = true } = {}) {
  let selection = { type: '', subtype: '' };

  container.innerHTML = `
    <form class="submit-form" novalidate>
      <div class="sf-pair">
        <div><label for="sf-title">Title</label>
          <input id="sf-title" type="text" autocomplete="off"></div>
        <div><label for="sf-link">Link <span class="hint">(required)</span></label>
          <input id="sf-link" type="url" autocomplete="off" placeholder="https://"></div>
      </div>
      <label for="sf-blurb">Description <span class="hint">(paste whatever you have: dates, abstract, the whole announcement; headlines can skip this)</span></label>
      <textarea id="sf-blurb" rows="4"></textarea>
      <fieldset class="type-picker"></fieldset>
      <div class="sf-foot">
        <div class="sf-initials"><label for="sf-submitter">Your initials <span class="hint">(required)</span></label>
          <input id="sf-submitter" type="text" autocomplete="off"></div>
        <label class="check"><input id="sf-spotlight" type="checkbox">
          Requesting ERC Spotlight / newsletter feature</label>
        <button type="submit" class="primary submit-btn">Submit</button>
      </div>
      <p class="status" role="status" aria-live="polite"></p>
    </form>
    <details class="bulk-door">
      <summary>Have a whole doc or spreadsheet? Add it here. It gets split into items you review first.</summary>
      <label class="bulk-drop">
        <strong>Drop a file here</strong> or click to choose one
        <span class="hint">.docx, .md, .txt, .xlsx or .csv. Items are shown for review before anything is saved.</span>
        <input class="bulk-file sr-only" type="file" accept=".docx,.md,.txt,.xlsx,.csv">
      </label>
      <p class="bulk-templates">Need a starting point? <a href="/templates/erc-upload-template.docx" download>Word template</a> · <a href="/templates/erc-upload-template.xlsx" download>Spreadsheet template</a></p>
      <div class="bulk-review" hidden>
        <div class="bulk-items"></div>
        <button type="button" class="primary bulk-confirm-btn">Add all to the queue</button>
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

  // Errors land on their fields (design audit 13, Sep 15): the field a message
  // names turns red, says so to assistive tech, and the first one takes focus.
  // The status line under the button still lists them all.
  const FIELD_EL = { link: '#sf-link', submitter: '#sf-submitter', type: '.type-picker' };
  const clearOne = node => { node.classList.remove('is-invalid'); node.removeAttribute('aria-invalid'); node.removeAttribute('aria-describedby'); };
  function clearInvalid() {
    for (const sel of Object.values(FIELD_EL)) clearOne(form.querySelector(sel));
    for (const line of form.querySelectorAll('.field-error')) line.remove();
  }
  // Each message sits under its own field, tied to it for assistive tech (design audit b14);
  // the status line keeps only what the server says.
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
      node.setAttribute('aria-describedby', line.id);
      (node.matches('input') ? node.parentElement : node).append(line);
      first ??= node;
    }
    (first?.matches('input') ? first : first?.querySelector('input'))?.focus();
    return spare;
  }
  for (const kind of ['input', 'change']) {
    form.addEventListener(kind, event => {
      for (const node of [event.target, event.target.closest('.type-picker')]) {
        if (node?.classList.contains('is-invalid')) clearOne(node);
      }
    });
  }

  // After a single submit the form gives way to a confirmation; "Submit
  // another" brings the (already reset) form back with the name kept.
  const doneBox = el('div', 'submit-done');
  doneBox.hidden = true;
  doneBox.setAttribute('role', 'status');
  doneBox.tabIndex = -1;
  form.after(doneBox);   // where the form was, above the bulk door (design audit a4)
  function showConfirm(note) {
    const line = el('p', 'done-line');
    const icon = checkSvg();
    icon.classList.add('draw-check');
    line.append(icon, 'Got it. It\'s in the queue.');
    doneBox.replaceChildren(line);
    if (note) doneBox.append(el('p', 'hint', note));
    const again = el('button', '', 'Submit another');
    again.type = 'button';
    again.addEventListener('click', () => {
      doneBox.hidden = true;
      form.hidden = false;
      form.querySelector('#sf-title').focus();
    });
    doneBox.append(again);
    // The spreadsheet door stays: a second item often follows the first (F16).
    form.hidden = true;
    doneBox.hidden = false;
    doneBox.focus({ preventScroll: true });
  }

  // The type as pills, the picked type's subtypes as a second row (Claude
  // Design round two, Kate's pick Sep 16). Buttons, so they never submit.
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
      row.append(pill(t.label, t.picked, () => { selection = pickType(selection, t.value); renderTypePicker(); }));
    }
    typeBox.replaceChildren(legend, row);
    // "ERC Event" next to "Event" needs a word of difference (usability run F13).
    if (hint) typeBox.append(el('p', 'hint type-hint', hint));
    if (subtypes.length) {
      const sub = el('span', 'subtype-label', 'Subtype ');   // the reveal gets a name (F14), and says it is required (design audit b14)
      sub.append(el('span', 'hint', '(required)'));
      typeBox.append(sub);
      const subRow = el('div', 'pill-row');
      for (const s of subtypes) {
        subRow.append(pill(s.label, s.picked, () => { selection = { ...selection, subtype: s.value }; renderTypePicker(); }, true));
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

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const body = readForm();
    const errors = validateSubmission(body);
    clearInvalid();
    if (errors.length) {
      const spare = markInvalid(errors);
      return show(statusEl, spare.join(' '), spare.length ? 'error' : 'busy');
    }
    const btn = form.querySelector('.submit-btn');
    btn.disabled = true;
    btn.hidden = true;   // gone while sending — no double-clicks
    show(statusEl, 'Sending…', 'busy');
    try {
      const data = await postSubmission(body);
      if (!data.ok) throw new Error((data.errors ?? ['Something went wrong.']).join(' '));
      const submitter = body.submitter;
      form.reset();
      selection = { type: '', subtype: '' };
      renderTypePicker();
      form.querySelector('#sf-submitter').value = submitter;
      show(statusEl, '', 'busy');
      showConfirm(data.warnings?.length ? data.warnings.join(' ') : '');
      onSubmitted?.(data);
    } catch (err) {
      show(statusEl, err instanceof TypeError
        ? "Couldn't reach the server. Check your connection." : err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.hidden = false;
    }
  });

  // ---- bulk door ----
  const bulkFile = container.querySelector('.bulk-file');
  const bulkDrop = container.querySelector('.bulk-drop');
  const bulkStatus = container.querySelector('.bulk-status');
  const bulkReview = container.querySelector('.bulk-review');
  const bulkItemsBox = container.querySelector('.bulk-items');
  const bulkConfirm = container.querySelector('.bulk-confirm-btn');
  let bulkItems = [];
  const bulkOpen = new Set(); // rows peeked open (index into bulkItems)

  /** The split as a queue-style table: title/link, type, Remove; click a row
   *  with text to peek at it. The count lives on the button. */
  function renderBulkReview(settle = false) {
    const table = el('table', 'queue-table bulk-table');
    const tbody = el('tbody');
    bulkItems.forEach((item, i) => {
      const tr = el('tr', 'bulk-row');
      // Rows settle in once, right after the split, not on remove or peek.
      if (settle) { tr.classList.add('row-in'); tr.style.setProperty('--i', i); }
      // The peek is a chevron button, like Finalize's table (design audit b18).
      const text = item.blurb || item.original_text;
      const caretTd = el('td', 'f-caret');
      if (text) {
        const caret = el('button', 'chevron-btn');
        caret.type = 'button';
        caret.setAttribute('aria-expanded', String(bulkOpen.has(i)));
        caret.setAttribute('aria-label', bulkOpen.has(i) ? 'Hide the text' : 'Show the text');
        caret.append(faIcon(bulkOpen.has(i) ? 'chevron-up' : 'chevron-down'));
        caret.addEventListener('click', () => {
          if (bulkOpen.has(i)) bulkOpen.delete(i);
          else bulkOpen.add(i);
          renderBulkReview();
          bulkItemsBox.querySelectorAll('.chevron-btn')[[...bulkItems.keys()].filter(k => bulkItems[k].blurb || bulkItems[k].original_text).indexOf(i)]?.focus();
        });
        caretTd.append(caret);
      }
      tr.append(caretTd);
      const titleTd = el('td');
      titleTd.append(el('span', 'item-title', item.title || item.link || '(untitled)'));
      if (item.link) titleTd.append(el('span', 'item-source', item.link));
      tr.append(titleTd);
      const typeTd = el('td');
      typeTd.append(el('span', item.type ? '' : 'missing', item.type ? (TYPE_LABELS[item.type] ?? item.type) : 'To review'));
      if (item.subtype) typeTd.append(el('span', 'item-source', item.subtype));
      tr.append(typeTd);
      const rmTd = el('td', 'bulk-remove');
      const rm = el('button', 'linkish', 'Remove');
      rm.type = 'button';
      rm.addEventListener('click', () => {
        bulkItems.splice(i, 1);
        bulkOpen.clear();
        renderBulkReview();
      });
      rmTd.append(rm);
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
    bulkConfirm.textContent = bulkItems.length
      ? `Add ${bulkItems.length} to the queue` : 'Nothing left to add';
    bulkConfirm.disabled = !bulkItems.length;
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
    if (!file) return;
    if (!/\.(docx|md|txt|xlsx|csv)$/i.test(file.name)) {
      return show(bulkStatus, 'Not a supported file. Use .docx, .md, .txt, .xlsx or .csv.', 'error');
    }
    show(bulkStatus, `Reading ${file.name}. This can take a minute…`, 'busy');
    try {
      const isText = /\.(md|txt|csv)$/i.test(file.name);
      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          text: isText ? await file.text() : '',
          file: isText ? '' : await fileToBase64(file),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      bulkItems = data.items;
      bulkOpen.clear();
      renderBulkReview(true);
      bulkReview.hidden = false;
      show(bulkStatus, (data.warnings ?? []).join(' '), 'note');
    } catch (err) {
      show(bulkStatus, err instanceof TypeError
        ? "Couldn't reach the server. Check your connection." : err.message, 'error');
    }
  }

  bulkFile.addEventListener('change', () => splitFile(bulkFile.files[0]));
  bulkDrop.addEventListener('dragover', event => { event.preventDefault(); bulkDrop.classList.add('is-drag'); });
  bulkDrop.addEventListener('dragleave', () => bulkDrop.classList.remove('is-drag'));
  bulkDrop.addEventListener('drop', event => {
    event.preventDefault();
    bulkDrop.classList.remove('is-drag');
    splitFile(event.dataTransfer.files[0]);
  });

  container.querySelector('.bulk-cancel-btn').addEventListener('click', () => {
    bulkItems = [];
    bulkFile.value = '';
    bulkReview.hidden = true;
    show(bulkStatus, '', 'busy');
  });

  container.querySelector('.bulk-confirm-btn').addEventListener('click', async event => {
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
      results = await runPool(items, BULK_CONCURRENCY, async item => {
        const data = await postSubmission(bulkSubmissionBody(item, submitter));
        if (!data.ok) throw new Error((data.errors ?? []).join(' '));
        return data;
      }, done => overlay.update(done));
    } finally {
      overlay.close();   // never leave the page locked behind the dim
    }
    const failed = items.filter((_, i) => !results[i]?.ok);
    const saved = items.length - failed.length;
    // What failed stays in the review for a retry (design audit b19); only a clean run clears it.
    bulkItems = failed;
    bulkOpen.clear();
    if (failed.length) { renderBulkReview(); bulkConfirm.textContent = `Retry ${failed.length}`; }
    else { bulkReview.hidden = true; bulkFile.value = ''; }
    show(bulkStatus, failed.length
      ? `Added ${saved}. ${failed.length} did not go through; they are listed above. Retry, or remove them.`
      : `Added all ${saved} to the queue`, failed.length ? 'error' : 'ok');
    if (!failed.length) bulkStatus.prepend(checkSvg());
    if (saved) onSubmitted?.();
    event.target.disabled = false;
    event.target.hidden = false;
  });
}
