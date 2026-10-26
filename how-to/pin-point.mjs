// Where a numbered pin sits on the box of the element it marks (how-to/capture.mjs).
// By default its middle; 'left', 10px in from its left edge; and since Oct 25
// (the owner: the scraper slide's pins sat on the buttons' words) 'corner', on
// its top right corner, and 'before', just outside its left edge, so a pin
// need never cover a control's label or a line's words.
export const BESIDE = 18;   // clear of the words: a pin is 24px with a 2px ring, and a still is drawn at 0.8 to 1.4 times

export function pinPoint(b, at = '') {
  if (at === 'left') return { x: b.x + 10, y: b.y + b.height / 2 };
  if (at === 'corner') return { x: b.x + b.width, y: b.y };
  if (at === 'before') return { x: b.x - BESIDE, y: b.y + b.height / 2 };
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
