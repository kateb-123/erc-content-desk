/**
 * The team's page, Submit content. Since Kate's drawn map (Oct 6, 2026) it
 * holds the form and its how-to and nothing else: the queue went to the
 * Content queue hub and the quick links to the Public links card, each a hub
 * of its own. The form is mounted once and left alone on re-renders, so
 * typing is never wiped.
 */
import { renderSubmitForm } from './submit-form.js';
import { el } from './ui-aids.js';

export function renderTeam(container, { onSubmitted, knownLinks }) {
  if (container.querySelector('.team-page')) return;
  const page = el('div', 'team-page');
  const head = el('div', 'page-head');
  const lede = el('p', 'lede', 'It lands in the queue and the desk sorts it before it goes out. ');
  const howTo = el('a', 'team-howto', 'How to submit content');
  howTo.href = '/how-to/submit-content/';
  lede.append(howTo);
  head.append(el('h2', 'page-title', 'Submit content'), lede);
  const box = el('div', 'form-box');
  renderSubmitForm(box, { onSubmitted, knownLinks });
  page.append(head, box);
  container.replaceChildren(page);
}
