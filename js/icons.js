/**
 * Small shared visuals: the drawn confirmation check (submit + publish) and
 * the sliding-dots loader shown wherever work is in flight.
 */
export function checkSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'check-icon');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 10.5 8.5 15 16 5.5');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('pathLength', '24');
  svg.append(path);
  return svg;
}

/** A Font Awesome solid glyph (the FA css loads via CDN). */
export function faIcon(name) {
  const i = document.createElement('i');
  i.className = `fa-solid fa-${name}`;
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/** A wait's words end in one ellipsis, however the caller wrote them. */
export function busyText(message) {
  return `${String(message ?? '').trim().replace(/(\.\.\.|…)+$/, '')}…`;
}

/**
 * A wait, in words (Kate, Sep 23: the sliding dots went; her pick of nine was
 * shimmering words). The words say what is happening, and css/shell.css runs a
 * soft light across them; reduced motion and forced colours hold them still.
 */
export function busyWords(message) {
  const words = document.createElement('span');
  words.className = 'busy-words';
  words.textContent = busyText(message);
  return words;
}

