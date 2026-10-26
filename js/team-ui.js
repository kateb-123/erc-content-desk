/**
 * The team's page, Submit content. Since Kate's drawn map (Oct 6, 2026) it
 * holds the form and nothing else: the queue went to the Content queue hub and
 * the quick links to the Public links card, each a hub of its own. Its how-to
 * is in the How-tos panel at the page's top right (Oct 24, her pick D); the
 * team's own submit page, which has no sidebar and so no panel, asks for the
 * link in the lede (howTo). The form is mounted once and left alone on
 * re-renders, so typing is never wiped.
 */
import { renderSubmitForm } from './submit-form.js';
import { el } from './ui-aids.js';

export function renderTeam(container, { onSubmitted, knownLinks, howTo = false }) {
  if (container.querySelector('.team-page')) return;
  const page = el('div', 'team-page');
  const head = el('div', 'page-head');
  const lede = el('p', 'lede', "The team's form.");
  if (howTo) {
    const link = el('a', 'team-howto', 'How to submit content');
    link.href = '/how-to/submit-content/';
    lede.replaceChildren(link);
  }
  head.append(el('h2', 'page-title', 'Submit content'), lede);
  const box = el('div', 'form-box');
  renderSubmitForm(box, { onSubmitted, knownLinks });
  page.append(head, box);
  container.replaceChildren(page);
}
