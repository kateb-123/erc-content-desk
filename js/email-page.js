/**
 * A page that shows one issue file as the email (Kate, Oct 8): the blank
 * template or the fictional sample, drawn through the builder's own template
 * each time it opens, so it never goes stale. Copy HTML puts the email's
 * code on the clipboard for Outlook. The page says which file it draws in
 * data-issue on its sheet.
 */
import { renderNewsletter } from '/builder/js/template.js';
import { renderShell } from '/js/shell-ui.js';
import { el } from '/js/ui-aids.js';
import { busyWords } from '/js/icons.js';

renderShell(document.querySelector('.topbar'), { screen: 'emailpage' });

const sheet = document.querySelector('.email-sheet');
const status = document.querySelector('.email-status');
const copy = document.querySelector('.email-copy');
status.replaceChildren(busyWords('Drawing the email'));

let html = '';
try {
  const res = await fetch(sheet.dataset.issue, { cache: 'no-store' });
  if (!res.ok) throw new Error(`The issue did not load (${res.status}).`);
  html = renderNewsletter(await res.json());
  sheet.srcdoc = html;
  status.textContent = '';
  copy.hidden = false;
} catch (err) {
  status.replaceChildren(el('span', 'email-error', `Couldn't draw the email. ${err.message}`));
}

copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(html);
    status.textContent = 'Copied.';
  } catch {
    status.textContent = 'Copy failed. Check browser permissions.';
  }
  setTimeout(() => { if (status.textContent === 'Copied.') status.textContent = ''; }, 2400);
});
