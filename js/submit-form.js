/**
 * The one submit form, shared by /submit and the desk Home screen: the
 * structured single-item form (radio type/subtype) plus the bulk "whole doc"
 * door. All DOM work lives inside renderSubmitForm (added with the renderer)
 * so the pure helpers stay importable under node --test.
 */
import { TYPES } from './schema.js';

/** Display order Kate approved in the mockup — not Object.keys(TYPES) order. */
export const TYPE_ORDER = ['research', 'event', 'opportunity', 'headline'];

export const TYPE_LABELS = {
  research: 'New Ed Policy Research', event: 'Event',
  opportunity: 'Opportunity', headline: 'Headline',
};

/** Picking a type clears the subtype; re-picking the current type is a no-op. */
export function pickType(selection, type) {
  return selection.type === type ? selection : { type, subtype: '' };
}

import { subtypesFor } from './schema.js';
import { validateSubmission } from './intake.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function show(target, message, kind) {
  target.textContent = message;
  target.className = `status status-${kind}`;
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
      <label for="sf-blurb">Blurb / details <span class="hint">(paste whatever you have — dates, abstract, the whole announcement; headlines can skip this)</span></label>
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
      <summary>Have a whole doc? Add it here — it gets split into items you review first.</summary>
      <p class="hint">Paste an entire document — it gets split into individual items you confirm before anything is saved.</p>
      <textarea class="bulk-text" rows="10"></textarea>
      <button type="button" class="bulk-split-btn">Split into items</button>
      <div class="bulk-review" hidden>
        <p class="bulk-summary"></p>
        <ul class="bulk-list"></ul>
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
      link: form.querySelector('#sf-link').value,
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
    show(statusEl, 'Sending…', 'busy');
    try {
      const data = await postSubmission(body);
      if (!data.ok) throw new Error((data.errors ?? ['Something went wrong.']).join(' '));
      const submitter = body.submitter;
      form.reset();
      selection = { type: '', subtype: '' };
      renderTypePicker();
      form.querySelector('#sf-submitter').value = submitter;
      const note = data.warnings?.length ? ` (${data.warnings.join(' ')})` : '';
      show(statusEl, `Got it — in the queue ✓${note}`, 'ok');
      onSubmitted?.();
    } catch (err) {
      show(statusEl, err instanceof TypeError
        ? "Couldn't reach the server. Check your connection." : err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ---- bulk door ----
  const bulkText = container.querySelector('.bulk-text');
  const bulkStatus = container.querySelector('.bulk-status');
  const bulkReview = container.querySelector('.bulk-review');
  const bulkList = container.querySelector('.bulk-list');
  const bulkSummary = container.querySelector('.bulk-summary');
  let bulkItems = [];

  container.querySelector('.bulk-split-btn').addEventListener('click', async event => {
    event.target.disabled = true;
    show(bulkStatus, 'Reading the document — this can take a minute…', 'busy');
    try {
      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkText.value }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      bulkItems = data.items;
      const parts = Object.entries(data.counts).map(([t, n]) => `${n} ${t}`);
      bulkSummary.textContent =
        `Found ${bulkItems.length} items: ${parts.join(', ')}.` +
        (data.warnings.length ? ` ${data.warnings.join(' ')}` : '');
      bulkList.replaceChildren(...bulkItems.map(item =>
        el('li', '', `${item.type || '?'} — ${item.title || item.link}`)));
      bulkReview.hidden = false;
      show(bulkStatus, '', 'busy');
    } catch (err) {
      show(bulkStatus, err instanceof TypeError
        ? "Couldn't reach the server. Check your connection." : err.message, 'error');
    } finally {
      event.target.disabled = false;
    }
  });

  container.querySelector('.bulk-cancel-btn').addEventListener('click', () => {
    bulkItems = [];
    bulkReview.hidden = true;
    show(bulkStatus, '', 'busy');
  });

  container.querySelector('.bulk-confirm-btn').addEventListener('click', async event => {
    event.target.disabled = true;
    const submitter = form.querySelector('#sf-submitter').value.trim() || 'bulk upload';
    let saved = 0;
    const failures = [];
    for (const [i, item] of bulkItems.entries()) {
      show(bulkStatus, `Adding ${i + 1} of ${bulkItems.length}…`, 'busy');
      try {
        const data = await postSubmission({
          title: item.title || item.link,
          blurb: item.blurb || item.original_text,
          link: item.link,
          type: item.type || 'headline',        // untyped items enter loosely; fixed during sort
          subtype: item.subtype || (item.type ? '' : 'National'),
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
    show(bulkStatus, failures.length
      ? `Added ${saved}. Couldn't add: ${failures.join('; ')}`
      : `Added all ${saved} to the queue ✓`, failures.length ? 'error' : 'ok');
    if (saved) onSubmitted?.();
    event.target.disabled = false;
  });
}
