/**
 * Newsletter's Past issues tab (Kate's wireframes, Sep 17): every issue saved
 * to the archive, newest first; each opens the email as it went out. The old
 * Past newsletters page (builder/archive.html) now lands here.
 */
import { dotsLoader, faIcon } from './icons.js';
import { newsletterPageHead } from './page-head.js';
import { el, button } from './ui-aids.js';

const ARCHIVE_DIR = '/builder/newsletters/';

/** archive: the index (a list of { date, file, label }), null while it loads,
 *  or false when it could not be read. */
export function renderPast(container, { archive, onGoTo, onRetry }) {
  const parts = [newsletterPageHead({ active: 'past', onGoTo })];
  if (archive === null) parts.push(dotsLoader());
  else if (archive === false) {
    const line = el('p', 'nl-empty', "Couldn't load the archive. ");
    const retry = button('Retry', 'linkish', { onClick: () => { retry.disabled = true; onRetry(); } });
    line.append(retry);
    parts.push(line);
  } else if (!archive.length) {
    parts.push(el('p', 'nl-empty', "Nothing archived yet. Save an issue from the builder's Save & Export step and it appears here."));
  } else {
    const list = el('div', 'nl-list past-list');
    const entries = [...archive].filter(e => e?.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    for (const entry of entries) {
      const a = el('a', 'past-row', entry.label ?? entry.date);
      a.href = `${ARCHIVE_DIR}${entry.file ?? `${entry.date}.html`}`;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.append(faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
      list.append(a);
    }
    parts.push(list);
  }
  container.replaceChildren(...parts);
}
