/**
 * The PUBLIC /submit page: anyone on the internet can send one item in.
 * Deliberately narrower than the desk's Home form — no spotlight request, no
 * bulk door, no subtypes (Sort fills those in), no Headline type — and it
 * requires a name and email so the desk can tell external submissions apart
 * (they arrive with submitter_email set and wear an External badge in Sort).
 * This page never links back into the desk.
 */
import { withScheme } from './links.js';
import { validateSubmission } from './intake.js';
import { checkSvg, dotsLoader, loadingLabel } from './icons.js';
import { buildImageControl } from './item-image.js';

// Public type choices: value -> label. "Other" enters untyped; Sort's
// To review catches it (subtypes are picked there too).
const PUBLIC_TYPES = [
  ['research', 'New Ed Policy Research'],
  ['event', 'Event/Webinar'],
  ['opportunity', 'Opportunity'],
  ['other', 'Other'],
];

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

const root = document.querySelector('#submit-root');
let picked = '';   // '', until a radio is chosen ('other' counts as chosen)

root.innerHTML = `
  <form class="public-form" novalidate>
    <div class="field-group">
      <label class="field-label" for="pf-title">Title</label>
      <input class="field-input" id="pf-title" type="text" autocomplete="off">
    </div>
    <div class="field-group">
      <label class="field-label" for="pf-blurb">Description <span class="hint">(paste whatever you have — dates, abstract, the whole announcement)</span></label>
      <textarea id="pf-blurb" rows="6"></textarea>
    </div>
    <div class="field-group">
      <label class="field-label" for="pf-link">Link</label>
      <input class="field-input" id="pf-link" type="url" autocomplete="off">
    </div>
    <fieldset>
      <legend>Type</legend>
      <div class="pf-types"></div>
    </fieldset>
    <div class="field-group">
      <span class="field-label">Media <span class="hint">(optional — a flyer, PDF, or picture)</span></span>
      <div class="pf-media"></div>
    </div>
    <div class="field-group">
      <label class="field-label" for="pf-name">Your name</label>
      <input class="field-input" id="pf-name" type="text" autocomplete="name">
    </div>
    <div class="field-group">
      <label class="field-label" for="pf-email">Your email address</label>
      <input class="field-input" id="pf-email" type="email" autocomplete="email">
    </div>
    <button type="submit" class="btn-submit">Submit</button>
    <p class="status" role="status" aria-live="polite"></p>
  </form>
`;

const form = root.querySelector('.public-form');
const statusEl = form.querySelector('.status');

const typesBox = form.querySelector('.pf-types');
for (const [value, label] of PUBLIC_TYPES) {
  const wrap = el('label', 'radio');
  const input = Object.assign(el('input'), { type: 'radio', name: 'pf-type', value });
  input.addEventListener('change', () => { picked = value; });
  wrap.append(input, ` ${label}`);
  typesBox.append(wrap);
}

const media = buildImageControl('', () => {});
form.querySelector('.pf-media').append(media.el);

// Success state: the form gives way to a thank-you; "Submit another"
// brings it back with name and email kept.
const doneBox = el('div', 'submit-done');
doneBox.hidden = true;
root.append(doneBox);
function showConfirm() {
  const title = el('p', 'done-title');
  const icon = checkSvg();
  icon.classList.add('draw-check');
  title.append(icon, 'Thank you — the ERC has it.');
  doneBox.replaceChildren(title);
  doneBox.append(el('p', '', 'The team reviews every submission before anything is published.'));
  const again = el('button', 'again-btn', 'Submit another');
  again.type = 'button';
  again.addEventListener('click', () => {
    doneBox.hidden = true;
    form.hidden = false;
    form.querySelector('#pf-title').focus();
  });
  doneBox.append(again);
  form.hidden = true;
  doneBox.hidden = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const body = {
    title: form.querySelector('#pf-title').value,
    blurb: form.querySelector('#pf-blurb').value,
    link: withScheme(form.querySelector('#pf-link').value),
    type: picked === 'other' ? '' : picked,
    subtype: '',
    spotlight: false,
    submitter: form.querySelector('#pf-name').value,
    submitter_email: form.querySelector('#pf-email').value.trim(),
    infographic: media.get(),
  };
  const errors = validateSubmission(body, { allowBlankSubtype: true, requireEmail: true });
  if (!picked) errors.unshift('Pick a type.');
  if (errors.length) return show(statusEl, errors.join(' '), 'error');

  const btn = form.querySelector('.btn-submit');
  btn.disabled = true;
  btn.hidden = true;   // gone while sending — no double-clicks
  show(statusEl, 'Sending', 'busy');
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) throw new Error((data.errors ?? ['Something went wrong.']).join(' '));
    const name = body.submitter;
    const email = body.submitter_email;
    form.reset();
    picked = '';
    media.set('');
    form.querySelector('#pf-name').value = name;
    form.querySelector('#pf-email').value = email;
    show(statusEl, '', 'busy');
    showConfirm();
  } catch (err) {
    show(statusEl, err instanceof TypeError
      ? "Couldn't reach the server. Check your connection." : err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.hidden = false;
  }
});
