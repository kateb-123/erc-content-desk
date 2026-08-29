/**
 * Publish (the Final List): show exactly what will land on the Exchange,
 * checked against the LIVE news.csv, then one button. Append-only.
 */
import { readyToPublish, newsletterOnly } from './workflow.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderPublish(container, { rows, preview, busy, onPreview, onPublish }) {
  container.replaceChildren();
  const candidates = readyToPublish(rows);
  const held = candidates.filter(newsletterOnly);
  const readyCount = candidates.length - held.length;

  const head = el('div', 'screen-head');
  head.append(el('h2', '', 'Publish'));
  head.append(el('p', 'lede', candidates.length
    ? `${readyCount} item(s) ready for the Ed Policy Exchange.`
      + (held.length ? ` (+${held.length} newsletter-only)` : '')
    : 'Nothing waiting to publish.'));
  container.append(head);
  if (!candidates.length) return;

  if (!preview) {
    const check = el('button', 'primary', busy ? 'Checking…' : 'Check against the live site');
    check.disabled = busy;
    check.addEventListener('click', () => { check.disabled = true; onPreview(); });
    container.append(check);
    container.append(el('p', 'hint', 'This reads the live news.csv first, so nothing ever gets overwritten or duplicated.'));
    return;
  }

  const addList = el('section');
  addList.append(el('h3', '', `Adding ${preview.adding.length}`));
  const ul = el('ul');
  for (const item of preview.adding) ul.append(el('li', '', item.headline));
  addList.append(ul);
  container.append(addList);

  if (preview.skipped.length) {
    const skipList = el('section');
    skipList.append(el('h3', '', `Already on the Exchange — skipping ${preview.skipped.length}`));
    const ul2 = el('ul');
    for (const item of preview.skipped) ul2.append(el('li', '', item.headline));
    skipList.append(ul2);
    container.append(skipList);
  }

  if (preview.newsletterOnly && preview.newsletterOnly.length) {
    const holdList = el('section');
    holdList.append(el('h3', '', `Newsletter only — holding ${preview.newsletterOnly.length}`));
    const ulH = el('ul');
    for (const item of preview.newsletterOnly) ulH.append(el('li', '', item.headline));
    holdList.append(ulH);
    holdList.append(el('p', 'hint', 'ERC spotlight events stay out of the Exchange; webinars are the exception.'));
    container.append(holdList);
  }

  if (preview.notReady && preview.notReady.length) {
    const notReadyList = el('section');
    notReadyList.append(el('h3', '', `Not ready — needs a type (${preview.notReady.length})`));
    const ul3 = el('ul');
    for (const item of preview.notReady) ul3.append(el('li', '', item.headline));
    notReadyList.append(ul3);
    notReadyList.append(el('p', 'hint', 'Fix these in Finalize, then check again.'));
    container.append(notReadyList);
  }

  container.append(el('p', 'hint', `The Exchange currently has ${preview.hubCount} items. Publishing only ever adds rows.`));

  const go = el('button', 'primary', busy ? 'Publishing…' : `Publish ${preview.adding.length} to the Exchange`);
  go.disabled = busy || !preview.adding.length;
  go.addEventListener('click', () => { go.disabled = true; onPublish(); });
  container.append(go);
}
