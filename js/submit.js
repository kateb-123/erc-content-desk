import { validateSubmission } from './intake.js';

const form = document.getElementById('submit-form');
const statusEl = document.getElementById('status');
const button = document.getElementById('submit-btn');

function show(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status status-${kind}`;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const content = document.getElementById('content').value;
  const submitter = document.getElementById('submitter').value;
  const note = document.getElementById('note').value;

  const errors = validateSubmission({ content, submitter });
  if (errors.length) {
    show(errors.join(' '), 'error');
    return;
  }

  button.disabled = true;
  show('Sending…', 'busy');
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, submitter, note }),
    });
    const data = await res.json();
    if (!data.ok) {
      show(data.errors.join(' '), 'error');
      return;
    }
    form.reset();
    document.getElementById('submitter').value = submitter;
    show('Got it — thanks. Send another whenever.', 'ok');
  } catch (err) {
    show("Couldn't reach the server. Try again in a moment.", 'error');
  } finally {
    button.disabled = false;
  }
});
