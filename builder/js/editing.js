/**
 * editing.js: pure helpers behind the Preview & Edit column. The keyboard
 * side of reordering, and what a pasted link becomes.
 */

/**
 * Where an ArrowUp or ArrowDown on a reorder row lands, within its group.
 * @param {string} key - the KeyboardEvent key
 * @param {number} idx - the row's index in its group
 * @param {number} len - the group's length
 * @returns {number|null} the target index, or null when the key does nothing
 */
export function arrowKeyTarget(key, idx, len) {
  if (key === 'ArrowUp' && idx > 0) return idx - 1;
  if (key === 'ArrowDown' && idx < len - 1) return idx + 1;
  return null;
}

/** Where an arrow press moves an Outline item (an old bug, fixed Oct 23: the
 *  arrows stopped at a group's edge). `listed` is the section's live items in
 *  display order, `groupOf` the group each is drawn under. Inside a group it
 *  moves past its neighbour; at an edge it lands at the near end of the next
 *  group: down before that group's first item, up after the group above's
 *  last. Null at the section's ends. */
export function itemArrowMove(listed, groupOf, item, key, plain = () => false) {
  const at = listed.indexOf(item);
  const step = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
  const other = step ? listed[at + step] : undefined;
  if (at < 0 || !other) return null;
  // Into the unheaded bucket (items whose group has no heading) is a plain step.
  const crossing = groupOf(other) !== groupOf(item) && !plain(other);
  return { other, before: crossing ? step > 0 : step < 0 };
}

/**
 * A link typed into the editor: trimmed, and given https:// when it names no
 * scheme. An empty field or a bare scheme is no link at all.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeLinkUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(s);
  if (scheme) return s.length > scheme[0].length + (s.startsWith(`${scheme[0]}//`) ? 2 : 0) ? s : '';
  return `https://${s}`;
}

/** A row's title as spoken: the placeholder stands in for an empty one. */
function spokenTitle(title) {
  return String(title ?? '').trim() || '(untitled)';
}

/**
 * A reorder row's accessible name: the title and its place in the bucket,
 * "Title, 2 of 5".
 * @param {string} title
 * @param {number} idx - the row's index in its bucket
 * @param {number} len - the bucket's length
 * @returns {string}
 */
export function reorderRowName(title, idx, len) {
  return `${spokenTitle(title)}, ${idx + 1} of ${len}`;
}

/**
 * What the live region says after a move: "Moved Title to 3 of 5".
 * @param {string} title
 * @param {number} idx - where the row landed
 * @param {number} len
 * @returns {string}
 */
export function movedAnnouncement(title, idx, len) {
  return `Moved ${spokenTitle(title)} to ${idx + 1} of ${len}`;
}
