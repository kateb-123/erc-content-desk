/**
 * The blocking progress popup: a dimmed page you can't click through, a count,
 * and a bar. Bulk upload's "Add all to the queue" is the one caller — Kate,
 * Sep 10: the wait is long enough that people were clicking around mid-upload
 * and double-submitting.
 *
 * Deliberately not a <dialog>: this is not dismissible. There is no close
 * button and Escape does nothing, because leaving mid-add is exactly the thing
 * it exists to prevent.
 */

/** Bar width. A zero total is finished, not a divide by zero. */
export function progressPercent(done, total) {
  if (!total) return 100;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Opens the popup and returns { update, close }. Call update(done) as items
 * land and close() when the work is over — in a finally, so a thrown error
 * can never leave the page locked behind the dim.
 */
export function openBusyOverlay({ title, total, note = '' }) {
  const dim = el('div', 'busy-dim');
  const card = el('div', 'busy-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-live', 'polite');

  const heading = el('h2', '', title);
  const count = el('div', 'busy-count');
  const doneEl = el('strong', '', '0');
  count.append(doneEl, el('span', '', ` of ${total}`));
  const track = el('div', 'busy-track');
  const fill = el('div', 'busy-fill');
  track.append(fill);
  card.append(heading, count, track);
  if (note) card.append(el('p', 'busy-note', note));
  dim.append(card);

  // Nothing underneath is reachable: the dim eats the clicks, the scroll is
  // frozen, and the tab itself asks before it closes.
  const swallow = event => { event.preventDefault(); event.stopPropagation(); };
  dim.addEventListener('click', swallow);
  const warn = event => { event.preventDefault(); event.returnValue = ''; };
  window.addEventListener('beforeunload', warn);
  const scrollWas = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.append(dim);

  fill.style.width = '0%';

  return {
    update(done) {
      doneEl.textContent = String(done);
      fill.style.width = `${progressPercent(done, total)}%`;
    },
    close() {
      window.removeEventListener('beforeunload', warn);
      document.body.style.overflow = scrollWas;
      dim.remove();
    },
  };
}
