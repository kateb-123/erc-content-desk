/**
 * removals.js: Remove with its Undo in place (Kate, Sep 23: the desk's own
 * pattern, Next issue's removed rows). Remove takes an item out of the issue
 * at once, so the preview and the saved draft never carry it, and the step
 * keeps it listed where it stood, greyed with its own Undo, until the step is
 * left; app.js holds the waiting list and drops it then. Each waiting removal
 * remembers the row listed just above it (an item, or another waiting
 * removal), so it keeps its place while other rows come, go and move, and
 * Undo puts it back in the issue exactly there. Nothing here touches the DOM.
 */

import { SECTION_REGISTRY, deleteItem, insertItem } from './model.js';

/**
 * @typedef {object} Waiting
 * @property {string} sectionKey
 * @property {object} item - the item as it was taken out
 * @property {string|null} after - the id of the row listed above it; null at its section's head
 * @property {number} index - where it sat in its section's items, for a trail that is lost
 */

/**
 * A section's rows as the step lists them: its items in order, each waiting
 * removal back under the row it was listed under.
 * @param {object} issue
 * @param {Waiting[]} waiting - the step's removals, oldest first
 * @param {string} sectionKey
 * @returns {object[]} the items, the waiting ones among them
 */
export function listedItems(issue, waiting, sectionKey) {
  const mine = waiting.filter((w) => w.sectionKey === sectionKey);
  const rows = [];
  const placed = new Set();
  function under(id) {
    for (const w of mine) if (w.after === id && !placed.has(w)) place(w);
  }
  function place(w) {
    placed.add(w);
    rows.push(w.item);
    under(w.item.id);
  }
  under(null);
  for (const item of issue?.sections?.[sectionKey]?.items ?? []) {
    rows.push(item);
    under(item.id);
  }
  // A removal whose row above went some other way is still listed, last.
  for (const w of mine) if (!placed.has(w)) place(w);
  return rows;
}

/**
 * Remove: the item leaves the issue now and waits on the step, listed where
 * it stood.
 * @param {object} issue
 * @param {Waiting[]} waiting - the step's removals (mutated)
 * @param {string} itemId
 * @returns {Waiting|null} null when the issue holds no such item
 */
export function takeOut(issue, waiting, itemId) {
  const sectionKey = Object.keys(issue?.sections ?? {})
    .find((key) => (issue.sections[key].items ?? []).some((it) => it.id === itemId));
  if (!sectionKey) return null;
  const rows = listedItems(issue, waiting, sectionKey);
  const above = rows[rows.findIndex((it) => it.id === itemId) - 1];
  const { item, index } = deleteItem(issue, itemId);
  const entry = { sectionKey, item, after: above?.id ?? null, index };
  waiting.push(entry);
  return entry;
}

/**
 * Undo: the waiting item goes back into the issue under the row its greyed
 * row is listed under, and stops waiting. One event is featured, so a
 * featured item that comes back after another was picked comes back plain.
 * @param {object} issue
 * @param {Waiting[]} waiting - the step's removals (mutated)
 * @param {string} itemId
 * @returns {object|null} the item, or null when nothing with that id waits
 */
export function putBack(issue, waiting, itemId) {
  const at = waiting.findIndex((w) => w.item.id === itemId);
  const entry = waiting[at];
  const items = issue?.sections?.[entry?.sectionKey]?.items;
  if (!entry || !items) return null;
  waiting.splice(at, 1);
  if (entry.item.featured && items.some((it) => it.featured)) entry.item.featured = false;
  insertItem(issue, entry.sectionKey, returnIndex(items, waiting, entry), entry.item);
  return entry.item;
}

/** Where a waiting item goes back in its section's items: right after the
 *  nearest item above its greyed row, at the head when there is none, and at
 *  its old index when the trail above it is lost. */
function returnIndex(items, waiting, entry) {
  const trail = new Set();
  for (let after = entry.after; after != null;) {
    const at = items.findIndex((it) => it.id === after);
    if (at !== -1) return at + 1;
    const above = waiting.find((w) => w.sectionKey === entry.sectionKey && w.item.id === after);
    if (!above || trail.has(above)) return entry.index;
    trail.add(above);
    after = above.after;
  }
  return 0;
}

/**
 * The Outline's two lists while removals wait: the sections that hold items
 * or a waiting removal, in registry order, and the labels of the rest.
 * @param {object} issue
 * @param {Waiting[]} waiting
 * @returns {{ populated: Array<object>, missing: Array<string> }}
 */
export function listedSections(issue, waiting) {
  const held = new Set(waiting.map((w) => w.sectionKey));
  const populated = [];
  const missing = [];
  for (const reg of SECTION_REGISTRY) {
    if ((issue?.sections?.[reg.key]?.items?.length ?? 0) > 0 || held.has(reg.key)) populated.push(reg);
    else missing.push(reg.label);
  }
  return { populated, missing };
}
