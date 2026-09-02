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

/** Forward arrow for the header door buttons. */
export function forwardIcon() {
  return faIcon('arrow-right');
}

export function dotsLoader(mini = false) {
  const wrap = document.createElement('div');
  wrap.className = mini ? 'dots-loader dots-mini' : 'dots-loader';
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 6; i += 1) {
    wrap.append(Object.assign(document.createElement('span'), { className: 'dot' }));
  }
  return wrap;
}

/** "Rewriting" + dots that type themselves — for busy status labels. */
export function loadingLabel(message) {
  const frag = document.createDocumentFragment();
  frag.append(message.replace(/…$/, ''));
  const dots = document.createElement('span');
  dots.className = 'dots-text';
  dots.setAttribute('aria-hidden', 'true');
  frag.append(dots);
  return frag;
}
