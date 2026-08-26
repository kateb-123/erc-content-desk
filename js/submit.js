/** /submit page controller: structured single form + the bulk side door. */
import { validateSubmission } from './intake.js';
import { TYPES, subtypesFor } from './schema.js';

const form = document.querySelector('#submit-form');
const statusEl = document.querySelector('#status');
const typeEl = document.querySelector('#type');
const subtypeEl = document.querySelector('#subtype');

const TYPE_LABELS = {
  research: 'New Ed Policy Research', event: 'Event',
  opportunity: 'Opportunity', headline: 'Headline',
};

for (const type of Object.keys(TYPES)) {
  typeEl.append(new Option(TYPE_LABELS[type] ?? type, type));
}

typeEl.addEventListener('change', () => {
  const subtypes = subtypesFor(typeEl.value);
  subtypeEl.replaceChildren(new Option(subtypes.length ? 'Pick one…' : 'Pick a type first', ''));
  for (const s of subtypes) subtypeEl.append(new Option(s, s));
  subtypeEl.disabled = !subtypes.length;
});

function show(el, message, kind) {
  el.textContent = message;
  el.className = `status status-${kind}`;
}

function readForm() {
  return {
    title: form.querySelector('#title').value,
    blurb: form.querySelector('#blurb').value,
    link: form.querySelector('#link').value,
    type: typeEl.value,
    subtype: subtypeEl.value,
    spotlight: form.querySelector('#spotlight').checked,
    submitter: form.querySelector('#submitter').value,
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

form.addEventListener('submit', async event => {
  event.preventDefault();
  const body = readForm();
  const errors = validateSubmission(body);
  if (errors.length) return show(statusEl, errors.join(' '), 'error');
  const btn = form.querySelector('#submit-btn');
  btn.disabled = true;
  show(statusEl, 'Sending…', 'busy');
  try {
    const data = await postSubmission(body);
    if (!data.ok) throw new Error((data.errors ?? ['Something went wrong.']).join(' '));
    const submitter = body.submitter;
    form.reset();
    typeEl.dispatchEvent(new Event('change'));
    form.querySelector('#submitter').value = submitter;
    const note = data.warnings?.length ? ` (${data.warnings.join(' ')})` : '';
    show(statusEl, `Got it — in the queue ✓${note}`, 'ok');
  } catch (err) {
    show(statusEl, err instanceof TypeError
      ? "Couldn't reach the server. Check your connection." : err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ---- bulk side door ----
const bulkText = document.querySelector('#bulk-text');
const bulkStatus = document.querySelector('#bulk-status');
const bulkReview = document.querySelector('#bulk-review');
const bulkList = document.querySelector('#bulk-list');
let bulkItems = [];

document.querySelector('#bulk-split-btn').addEventListener('click', async event => {
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
    document.querySelector('#bulk-summary').textContent =
      `Found ${bulkItems.length} items: ${parts.join(', ')}.` +
      (data.warnings.length ? ` ${data.warnings.join(' ')}` : '');
    bulkList.replaceChildren(...bulkItems.map(item => {
      const li = document.createElement('li');
      li.textContent = `${item.type || '?'} — ${item.title || item.link}`;
      return li;
    }));
    bulkReview.hidden = false;
    show(bulkStatus, '', 'busy');
  } catch (err) {
    show(bulkStatus, err instanceof TypeError
      ? "Couldn't reach the server. Check your connection." : err.message, 'error');
  } finally {
    event.target.disabled = false;
  }
});

document.querySelector('#bulk-cancel-btn').addEventListener('click', () => {
  bulkItems = [];
  bulkReview.hidden = true;
  show(bulkStatus, '', 'busy');
});

document.querySelector('#bulk-confirm-btn').addEventListener('click', async event => {
  event.target.disabled = true;
  const submitter = form.querySelector('#submitter').value.trim() || 'bulk upload';
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
  event.target.disabled = false;
});
