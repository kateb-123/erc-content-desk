/**
 * Small DOM aids the screens share (design audit, Sep 17).
 *
 * Every pipeline screen redraws itself with replaceChildren(), which throws
 * the keyboard's place away: the focused row or button is destroyed and focus
 * lands on the page. A control that should survive a redraw carries a
 * data-focus key; a screen reads the key before it rebuilds and puts focus
 * on the key's new element after, or on a fallback (the card's title).
 */

/** The data-focus key of the focused control inside container, or null. */
export function focusKeyIn(container) {
  const active = document.activeElement;
  if (!active || !container.contains(active)) return null;
  return active.dataset?.focus || null;
}

/** Focus the control that now carries the key, else the fallback. */
export function restoreFocus(container, key, fallback) {
  if (!key) return false;
  const next = container.querySelector(`[data-focus="${CSS.escape(key)}"]`);
  if (next && !next.disabled) { next.focus({ preventScroll: true }); return true; }
  if (fallback) { fallback.tabIndex = -1; fallback.focus({ preventScroll: true }); return true; }
  return false;
}

/** A pane that scrolls inside itself shows a fade at its foot until the
 *  reader reaches the bottom, so the buttons below the fold are not a
 *  surprise (design audit c3). Measured after layout. */
export function markOverflow(pane) {
  const check = () => pane.classList.toggle('is-more', pane.scrollHeight - pane.scrollTop - pane.clientHeight > 4);
  requestAnimationFrame(check);
  pane.addEventListener('scroll', check, { passive: true });
}
