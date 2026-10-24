/**
 * Small shared visuals: the drawn confirmation check (submit + publish), the
 * words shown wherever work is in flight, and the sidebar's line icons.
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
 * soft light across them; reduced motion and forced colors hold them still.
 */
export function busyWords(message) {
  const words = document.createElement('span');
  words.className = 'busy-words';
  words.textContent = busyText(message);
  return words;
}


/* The line icons of Kate's pick A (Oct 23): one stroke, round ends, drawn on
   a 24px grid and colored by currentColor. Each is its shapes, in order. */
const LINE_ICONS = {
  home: [['path', { d: 'M4 10.2 12 4l8 6.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z' }]],
  submit: [['path', { d: 'M12 4v9' }], ['path', { d: 'm8.5 9.5 3.5 3.5 3.5-3.5' }], ['path', { d: 'M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4' }]],
  queue: [['path', { d: 'M4 8.5 12 5l8 3.5-8 3.5z' }], ['path', { d: 'm4 12.5 8 3.5 8-3.5' }], ['path', { d: 'm4 16.5 8 3.5 8-3.5' }]],
  sort: [['rect', { x: 4, y: 4, width: 16, height: 16, rx: 3.5 }], ['path', { d: 'm8.5 12.2 2.4 2.4 4.8-4.9' }]],
  newsletter: [['rect', { x: 3.5, y: 5.5, width: 17, height: 13, rx: 2 }], ['path', { d: 'm4 7 8 6 8-6' }]],
  listserv: [['circle', { cx: 9, cy: 9, r: 3.2 }], ['path', { d: 'M3.5 19a5.5 5.5 0 0 1 11 0' }], ['path', { d: 'M15.5 6.2a3 3 0 0 1 0 5.6' }], ['path', { d: 'M17.5 14.3a5.5 5.5 0 0 1 3 4.7' }]],
  exchange: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M3.5 12h17' }], ['path', { d: 'M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z' }]],
  briefs: [['path', { d: 'M7 3.5h6.5L18 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z' }], ['path', { d: 'M13.5 3.5V8H18' }], ['path', { d: 'M9 13h6' }], ['path', { d: 'M9 16.5h4' }]],
  book: [['path', { d: 'M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13H6.5A1.5 1.5 0 0 0 5 18.5z' }], ['path', { d: 'M5 18.5A1.5 1.5 0 0 0 6.5 20H19' }]],
  help: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M9.7 9.6a2.4 2.4 0 0 1 4.7.6c0 1.6-2.4 2-2.4 3.6' }], ['path', { d: 'M12 16.9v.1' }]],
  signout: [['path', { d: 'M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14' }], ['path', { d: 'M10 8 6 12l4 4' }], ['path', { d: 'M6.5 12H15' }]],
  lock: [['rect', { x: 5.5, y: 10.5, width: 13, height: 9.5, rx: 2 }], ['path', { d: 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5' }]],
  check: [['path', { d: 'm6.5 12.5 3.5 3.5 7.5-8' }]],
  pin: [['path', { d: 'M9 4h6l-1 5 3 3v2H7v-2l3-3z' }], ['path', { d: 'M12 14v6' }]],
  chevron: [['path', { d: 'm9.5 6 6 6-6 6' }]],
  warning: [['path', { d: 'M10.4 4.8a1.8 1.8 0 0 1 3.2 0l7 12.4a1.8 1.8 0 0 1-1.6 2.8H5a1.8 1.8 0 0 1-1.6-2.8z' }], ['path', { d: 'M12 10v3.6' }], ['path', { d: 'M12 16.8v.1' }]],
};

/** One of the line icons, for decoration: hidden from assistive tech, sized and colored by CSS. */
export function lineIcon(name, className = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', `line-icon line-icon-${name}${className ? ` ${className}` : ''}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of LINE_ICONS[name] ?? []) {
    const shape = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, String(v));
    svg.append(shape);
  }
  return svg;
}
