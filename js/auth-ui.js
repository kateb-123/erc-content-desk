/**
 * The sign-in (Kate, Sep 23): drawn in a locked screen's place until the
 * session holds. The page keeps its name in the bar and its title; under it,
 * one white box with the password field and nothing else to read (Kate:
 * "you're soooo text heavy"). A wrong password says so under the field and
 * stays.
 */
import { signInLine } from './auth-view.js';
import { el, button, busyLine, focusKeyIn, restoreFocus } from './ui-aids.js';

const TITLES = { home: 'Desk', sort: 'Content Sort', finalize: 'Content Sort', publish: 'Policy Exchange' };

export function renderSignIn(container, { screen, checking, busy, error, onSignIn, onGoTo }) {
  const focusKey = focusKeyIn(container);
  container.replaceChildren();
  const page = el('div', 'signin-page');
  const head = el('div', 'page-head');
  head.append(el('h2', 'page-title', TITLES[screen] ?? 'Desk'));
  page.append(head);
  if (checking) {
    // /api/auth has not answered yet: nothing to ask for until it has.
    page.append(busyLine('Opening'));
    container.append(page);
    return;
  }
  const box = el('form', 'card signin-box');
  box.setAttribute('aria-label', signInLine(screen));
  box.noValidate = true;
  const label = el('label', '', 'Password');
  label.htmlFor = 'signin-password';
  const field = el('input');
  field.type = 'password';
  field.id = 'signin-password';
  field.autocomplete = 'current-password';
  field.dataset.focus = 'password';
  field.required = true;
  if (error) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', 'signin-error');
  }
  box.append(label, field);
  if (error) {
    const line = el('p', 'field-error', error);
    line.id = 'signin-error';
    line.setAttribute('role', 'alert');
    box.append(line);
  }
  if (busy) {
    box.append(busyLine('Signing in'));
  } else {
    const go = button('Sign in', 'primary signin-btn', { focus: 'signin' });
    go.type = 'submit';
    box.append(go);
  }
  box.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    const password = field.value;
    if (!password) { field.focus(); return; }
    onSignIn(password);
  });
  page.append(box);

  // The team's own page is open: a way there for anyone who landed here.
  const team = el('p', 'signin-team');
  const a = el('a', '', 'Submit content');
  a.href = '/#team';
  a.addEventListener('click', event => { event.preventDefault(); onGoTo('team'); });
  team.append(a);
  page.append(team);
  container.append(page);
  // The field takes the keyboard on a fresh draw, and keeps it across a redraw.
  if (!restoreFocus(container, focusKey, null) && !busy) field.focus({ preventScroll: true });
}
