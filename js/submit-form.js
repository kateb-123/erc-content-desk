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
import { validateSubmission } from './intake.js';
import { withScheme } from './links.js';
import { checkSvg, dotsLoader, loadingLabel } from './icons.js';

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
 * onSubmitted fires after anything actually lands in the queue.
 */
export function renderSubmitForm(container, { onSubmitted } = {}) {
  let selection = { type: '', subtype: '' };

  container.innerHTML = `
    <form class="submit-form" novalidate>
      <label for="sf-title">Title</label>
      <input id="sf-title" type="text" autocomplete="off">
      <label for="sf-blurb">Description <span class="hint">(paste whatever you have — dates, abstract, the whole announcement; headlines can skip this)</span></label>
      <textarea id="sf-blurb" rows="6"></textarea>
      <label for="sf-link">Link</label>
      <input id="sf-link" type="url" autocomplete="off">
      <fieldset class="type-picker"></fieldset>
      <label class="check"><input id="sf-spotlight" type="checkbox">
        Requesting ERC Spotlight / newsletter feature</label>
      <label for="sf-submitter">Your name or initials</label>
      <input id="sf-submitter" type="text" autocomplete="off">
      <button type="submit" class="primary submit-btn">Submit</button>
      <p class="status" role="status" aria-live="polite"></p>
    </form>
    <details class="bulk-door">
      <summary>Have a whole doc or spreadsheet? Add it here — it gets split into items you review first.</summary>
      <label class="bulk-drop">
        <strong>Drop a file here</strong> or click to choose one
        <span class="hint">.docx, .md, .txt, .xlsx, .csv — items are shown for review before anything is saved</span>
        <input class="bulk-file" type="file" accept=".docx,.md,.txt,.xlsx,.csv" hidden>
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

  // After a single submit the form gives way to a confirmation; "Submit
  // another" brings the (already reset) form back with the name kept.
  const doneBox = el('div', 'submit-done');
  doneBox.hidden = true;
  container.append(doneBox);
  function showConfirm(note) {
    const line = el('p', 'done-line');
    const icon = checkSvg();
    icon.classList.add('draw-check');
    line.append(icon, 'Got it — in the queue.');
    doneBox.replaceChildren(line);
    if (note) doneBox.append(el('p', 'hint', note));
    const again = el('button', '', 'Submit another');
    again.type = 'button';
    again.addEventListener('click', () => {
      doneBox.hidden = true;
      form.hidden = false;
      bulkDoor.hidden = false;
      form.querySelector('#sf-title').focus();
    });
    doneBox.append(again);
    form.hidden = true;
    bulkDoor.hidden = true;
    doneBox.hidden = false;
  }

  function radio(name, value, labelText, checked, onChange) {
    const label = el('label', 'radio');
    const input = Object.assign(el('input'), { type: 'radio', name, value, checked });
    input.addEventListener('change', onChange);
    label.append(input, ` ${labelText}`);
    return label;
  }

  function renderTypePicker() {
    typeBox.replaceChildren(legend);
    for (const type of TYPE_ORDER) {
      typeBox.append(radio('sf-type', type, TYPE_LABELS[type], selection.type === type, () => {
        selection = pickType(selection, type);
        renderTypePicker();
      }));
      if (selection.type !== type) continue;
      const sub = el('div', 'subtype-list');
      for (const subtype of subtypesFor(type)) {
        sub.append(radio('sf-subtype', subtype, subtype, selection.subtype === subtype, () => {
          selection = { ...selection, subtype };
        }));
      }
      typeBox.append(sub);
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
    if (errors.length) return show(statusEl, errors.join(' '), 'error');
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
      onSubmitted?.();
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
      // Rows settle in once, right after the split — not on remove/peek.
      if (settle) { tr.classList.add('row-in'); tr.style.setProperty('--i', i); }
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
      rm.addEventListener('click', event => {
        event.stopPropagation();
        bulkItems.splice(i, 1);
        bulkOpen.clear();
        renderBulkReview();
      });
      rmTd.append(rm);
      tr.append(rmTd);
      const text = item.blurb || item.original_text;
      if (text) {
        tr.classList.add('has-text');
        tr.addEventListener('click', () => {
          if (bulkOpen.has(i)) bulkOpen.delete(i);
          else bulkOpen.add(i);
          renderBulkReview();
        });
      }
      tbody.append(tr);
      if (text && bulkOpen.has(i)) {
        const peek = el('tr', 'bulk-peek');
        const td = el('td');
        td.colSpan = 3;
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
      return show(bulkStatus, 'Not a supported file — .docx, .md, .txt, .xlsx, or .csv.', 'error');
    }
    show(bulkStatus, `Reading ${file.name} — this can take a minute…`, 'busy');
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
    let saved = 0;
    const failures = [];
    for (const [i, item] of bulkItems.entries()) {
      show(bulkStatus, `Adding ${i + 1} of ${bulkItems.length}…`, 'busy');
      try {
        const data = await postSubmission({
          title: item.title || item.link,
          blurb: item.blurb || item.original_text,
          link: withScheme(item.link),
          type: item.type || '',        // untyped enters untyped — Sort's To review catches it
          subtype: item.subtype || '',
          spotlight: false,
          submitter,
        });
        if (data.ok) saved += 1;
        else failures.push(item.title || item.link);
      } catch {
        failures.push(item.title || item.link);
      }
    }
    bulkReview.hidden = true;
    bulkItems = [];
    bulkFile.value = '';
    show(bulkStatus, failures.length
      ? `Added ${saved}. Couldn't add: ${failures.join('; ')}`
      : `Added all ${saved} to the queue ✓`, failures.length ? 'error' : 'ok');
    if (saved) onSubmitted?.();
    event.target.disabled = false;
    event.target.hidden = false;
  });
}
