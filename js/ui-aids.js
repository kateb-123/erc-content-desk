/**
 * Small DOM aids every screen shares: building an element, keeping the
 * keyboard's place across a redraw, the load-failed line and the mark an
 * in-flight row action leaves behind.
 */
import { busyWords, faIcon } from './icons.js';

/** The desk's one way to make an element: a tag, a class, its words. */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** An action: its words, its class, and the four things every button repeats:
 *  the type, its focus key, a leading icon, the click. Anything else (a
 *  title, an aria attribute, disabled, a trailing icon) goes on the node the
 *  caller gets back. */
export function button(label, className, { focus, icon, onClick } = {}) {
  const btn = el('button', className, label);
  btn.type = 'button';
  if (focus) btn.dataset.focus = focus;
  if (icon) btn.prepend(faIcon(icon));
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

/*
 * Every pipeline screen redraws itself with replaceChildren(), which throws
 * the keyboard's place away: the focused row or button is destroyed and focus
 * lands on the page. A control that should survive a redraw carries a
 * data-focus key; a screen reads the key before it rebuilds and puts focus
 * on the key's new element after, or on a fallback (the card's title).
 */

/** The data-focus key of the focused control inside container; '' when focus
 *  is inside on a control without a key; null when focus is elsewhere. */
export function focusKeyIn(container) {
  const active = document.activeElement;
  if (!active || active === document.body || !container.contains(active)) return null;
  return active.dataset?.focus || '';
}

/** Focus the control that now carries the key, else the fallback. A keyless
 *  control ('') goes straight to the fallback, so a redraw from a radio, a
 * Save or a Cancel never drops the keyboard to the page. */
export function restoreFocus(container, key, fallback) {
  if (key === null || key === undefined) return false;
  const next = key && container.querySelector(`[data-focus="${CSS.escape(key)}"]`);
  if (next && !next.disabled) { next.focus({ preventScroll: true }); return true; }
  if (fallback) { fallback.tabIndex = -1; fallback.focus({ preventScroll: true }); return true; }
  return false;
}

/** How far to scroll so a card's top shows (Kate, Sep 23: one scrollbar on
 *  Sort, the page's). 0 while the top is in view; otherwise bring it to 16px
 *  under the window's top. A top in the last 120px counts as out of view:
 *  the card would start below the fold. */
export function revealOffset(top, viewportHeight, room = 16) {
  return top >= 0 && top <= viewportHeight - 120 ? 0 : top - room;
}

/** Bring a card's top into view when it has scrolled away, in one step. */
export function revealTop(card) {
  const by = revealOffset(card.getBoundingClientRect().top, window.innerHeight);
  if (by) window.scrollBy({ top: by });
}

/** A panel's wait: one line of busy words, announced to assistive tech. */
export function busyLine(message) {
  const line = el('p', 'load-line');
  line.setAttribute('role', 'status');
  line.append(busyWords(message));
  return line;
}

/** When the first load failed: the reason is in the status line; this is the way to try again. */
export function tryAgain(onRefresh) {
  const box = el('p', 'load-failed');
  const btn = button('Try again', '', { onClick: () => { btn.disabled = true; onRefresh(); } });
  box.append("The desk couldn't load. ", btn);
  return box;
}

/**
 * The mark an in-flight row action leaves in its button's place: the mini
 * dots with a word for assistive tech, carrying the button's focus key so the
 * redraw that follows can land on the row's partner control. Takes focus
 * only when the button had it.
 */
export function inFlight(button, key, word) {
  const wait = el('span', 'queue-wait');
  wait.tabIndex = -1;
  wait.dataset.focus = key;
  wait.append(busyWords(word));
  const had = document.activeElement === button;
  button.replaceWith(wait);
  if (had) wait.focus({ preventScroll: true });
  return wait;
}
