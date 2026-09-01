/**
 * Small shared visuals: the drawn confirmation check (submit + publish) and
 * the gooey loading blob (finalize rewrites, publish live-check). The blob
 * needs the #goo SVG filter that index.html carries.
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

export function gooLoader() {
  const wrap = document.createElement('div');
  wrap.className = 'goo-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  const loading = document.createElement('div');
  loading.className = 'blob-loading';
  loading.append(Object.assign(document.createElement('div'), { className: 'blob' }));
  wrap.append(loading);
  return wrap;
}
