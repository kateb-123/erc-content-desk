/**
 * options.js: the per-issue layout options the Outline step sets (Claude
 * Design handoff, Oct 2026), as pure functions over the issue. The renderer
 * (template.js) reads what these write: issue.layout.callout, issue.layout.nav,
 * fields.showSummary and fields.pictureStyle. Nothing here touches the DOM.
 */

import { CALLOUT_STYLES, PICTURE_STYLES, PICTURE_MIN, PICTURE_MAX, RESEARCH_PICTURE_WIDTH, layoutOf, calloutsOf, summaryDefault, pictureDefault, pictureStyleOf } from './template.js';
import { SECTION_REGISTRY, newCallout } from './model.js';

/** A callout's three styles, in the order the control shows them. */
export const CALLOUT_CHOICES = [
  { key: 'maroon', label: 'Maroon block' },
  { key: 'gray', label: 'Light gray box' },
  { key: 'dotted', label: 'Dotted rule' },
];

/** The issue's callouts as a real list the builder can change (an older draft's is made on first touch). */
function calloutList(issue) {
  if (!Array.isArray(issue.callouts)) issue.callouts = calloutsOf(issue);
  return issue.callouts;
}

/** Adds a callout of one kind after a section; returns it. */
export function addCallout(issue, kind, after) {
  const c = newCallout(kind, after);
  calloutList(issue).push(c);
  return c;
}

/** Takes a callout out; returns it (for Undo) or null. */
export function removeCallout(issue, id) {
  const list = calloutList(issue);
  const at = list.findIndex((c) => c.id === id);
  if (at === -1) return null;
  return list.splice(at, 1)[0];
}

/** Puts a callout back where it was. */
export function restoreCallout(issue, callout, at) {
  const list = calloutList(issue);
  list.splice(Math.max(0, Math.min(at ?? list.length, list.length)), 0, callout);
}

/** Moves a callout to follow another section; an unknown section is ignored. */
export function moveCallout(issue, id, after) {
  if (!SECTION_REGISTRY.some((s) => s.key === after)) return false;
  const c = calloutList(issue).find((x) => x.id === id);
  if (!c) return false;
  c.after = after;
  return true;
}

/** Sets a callout's style; an unknown style is ignored. */
export function setCalloutStyle(callout, style) {
  if (CALLOUT_STYLES.includes(style)) callout.style = style;
}

/** The picture's three layouts, in the order the control shows them. */
export const PICTURE_CHOICES = [
  { key: 'none', label: 'None' },
  { key: 'stamp', label: 'Stamp' },
  { key: 'headshot', label: 'Headshot' },
];

/** Sections whose items can show a description and a picture. */
export const DESCRIBED_SECTIONS = new Set(['research', 'spotlight', 'events', 'opportunities']);

/** The issue's layout block, made if missing. */
function layoutBlock(issue) {
  if (!issue.layout || typeof issue.layout !== 'object') issue.layout = {};
  return issue.layout;
}

/** Shows or hides the contents strip under the masthead. */
export function setNav(issue, on) {
  layoutBlock(issue).nav = !!on;
}

/**
 * What the Outline shows for one item: whether it has a description to
 * offer, whether that description is on, and the picture state when it is.
 * @param {string} sectionKey
 * @param {object} item
 * @returns {{ hasDescription: boolean, descriptionOn: boolean, hasPicture: boolean, pictureStyle: string }}
 */
export function itemOptions(sectionKey, item) {
  const f = item?.fields || {};
  const hasDescription = DESCRIBED_SECTIONS.has(sectionKey) && !!String(f.summary ?? '').trim();
  const group = sectionKey === 'events' && item?.featured ? 'featured' : (item?.group || '');
  const descriptionOn = hasDescription && (typeof f.showSummary === 'boolean' ? f.showSummary : summaryDefault(sectionKey, group));
  const hasPicture = descriptionOn && !!String(f.image ?? '').trim();
  const pictureStyle = PICTURE_STYLES.includes(f.pictureStyle) ? f.pictureStyle : pictureDefault(f.title);
  return { hasDescription, descriptionOn, hasPicture, pictureStyle };
}

/**
 * The layouts an item can take, for the card's wireframes (Kate, Oct 5):
 * title and details only; with its description; the description beside a
 * 96px stamp; a 160px headshot beside it all. Each says whether it is the
 * one in force (`on`), whether the item still lacks the photo it draws
 * (`dim`, a hint only: the layout applies anyway, and the preview shows a
 * placeholder until a photo is added; Kate, Oct 5), and how to apply it.
 * Items with no summary, or outside the described sections, have only the
 * first.
 * @returns {Array<{key: string, label: string, on: boolean, dim: boolean, apply: () => void}>}
 */
export function itemLayouts(sectionKey, item) {
  const f = item?.fields || {};
  const o = itemOptions(sectionKey, item);
  const hasPic = !!String(f.image ?? '').trim();
  // With no photo, only a layout chosen by hand counts (the preview draws its placeholder).
  const pic = !o.descriptionOn ? 'none' : hasPic ? o.pictureStyle : (PICTURE_STYLES.includes(f.pictureStyle) ? f.pictureStyle : 'none');
  const bare = { key: 'bare', label: 'Title and details', on: !o.descriptionOn, dim: false,
    apply: () => { if (!item.fields) item.fields = {}; item.fields.showSummary = false; } };
  if (!o.hasDescription) return [bare];
  return [
    bare,
    { key: 'text', label: 'With description', on: o.descriptionOn && pic === 'none', dim: false,
      apply: () => { item.fields.showSummary = true; if (hasPic) item.fields.pictureStyle = 'none'; } },
    { key: 'stamp', label: 'Stamp beside the text', on: o.descriptionOn && pic === 'stamp', dim: !hasPic,
      apply: () => { item.fields.showSummary = true; item.fields.pictureStyle = 'stamp'; } },
    { key: 'headshot', label: 'Headshot beside it all', on: o.descriptionOn && pic === 'headshot', dim: !hasPic,
      apply: () => { item.fields.showSummary = true; item.fields.pictureStyle = 'headshot'; } },
  ];
}

/** The picture sizes offered by hand (Kate, Oct 5): the width, and the height
 *  a portrait photo (4:5) would stand at, the shape the placeholder takes. */
export const PICTURE_SIZES = [64, 96, 128, 160, 200].map((w) => ({ width: w, label: `${w} × ${Math.round(w * 1.25)}` }));

/** The width a picture layout takes when no size was picked. */
export const DEFAULT_PICTURE_WIDTH = { stamp: 96, headshot: 160 };

/** The item's picture width in force: the one picked, else the layout's own
 *  (a research box draws 160 either way; Kate, Oct 6). */
export function pictureWidthOf(item, sectionKey = '') {
  const f = item?.fields || {};
  const picked = Number(f.pictureWidth);
  if (Number.isFinite(picked) && picked >= PICTURE_MIN && picked <= PICTURE_MAX) return Math.round(picked);
  if (sectionKey === 'research') return RESEARCH_PICTURE_WIDTH;
  return DEFAULT_PICTURE_WIDTH[pictureStyleOf(f)] ?? 96;
}

/** Sets the picture's width by hand; a width outside the renderer's range clears the choice. */
export function setPictureWidth(item, width) {
  if (!item.fields) item.fields = {};
  const w = Number(width);
  if (Number.isFinite(w) && w >= PICTURE_MIN && w <= PICTURE_MAX) item.fields.pictureWidth = Math.round(w);
  else delete item.fields.pictureWidth;
}

/**
 * The items whose picture layout is on but have no photo yet: the preview
 * shows a placeholder for each, the sent email shows nothing. Never a block
 * (Kate, Oct 5: "make sure you can advance if there's a placeholder"); the
 * export step names them.
 * @returns {Array<{ sectionKey: string, item: object }>}
 */
export function placeholderItems(issue) {
  const out = [];
  for (const [sectionKey, sec] of Object.entries(issue?.sections || {})) {
    if (!sec?.enabled) continue;
    for (const item of sec.items || []) {
      const f = item.fields || {};
      if (String(f.image ?? '').trim() || !PICTURE_STYLES.includes(f.pictureStyle) || f.pictureStyle === 'none') continue;
      if (itemOptions(sectionKey, item).descriptionOn) out.push({ sectionKey, item });
    }
  }
  return out;
}

/** Turns an item's description on or off for this issue. */
export function setDescription(item, on) {
  if (!item.fields) item.fields = {};
  item.fields.showSummary = !!on;
}

/** Picks the picture's layout; an unknown key is ignored. The image URL stays, so None is reversible. */
export function setPictureStyle(item, key) {
  if (!PICTURE_STYLES.includes(key)) return;
  if (!item.fields) item.fields = {};
  item.fields.pictureStyle = key;
}

/**
 * A pasted picture address: accepted only when it starts with http:// or
 * https://, trimmed; anything else is '' and leaves the item without one.
 * @param {string} raw
 * @returns {string}
 */
export function acceptPictureUrl(raw) {
  const s = String(raw ?? '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : '';
}

/** Every option back to its default: the layout block and the per-item choices go. */
export function resetOptions(issue) {
  delete issue.layout;
  if (issue.sections?.research) delete issue.sections.research.showSubmit;
  for (const sec of Object.values(issue.sections || {})) {
    for (const item of sec.items || []) {
      if (!item.fields) continue;
      delete item.fields.showSummary;
      delete item.fields.pictureStyle;
    }
  }
}

/** True when any option differs from its default, so Reset has something to do. */
export function hasCustomOptions(issue) {
  if (!layoutOf(issue).nav) return true;
  for (const sec of Object.values(issue?.sections || {})) {
    for (const item of sec.items || []) {
      const f = item.fields || {};
      if (typeof f.showSummary === 'boolean' || PICTURE_STYLES.includes(f.pictureStyle)) return true;
    }
  }
  return false;
}

/** "{n} of {m} items included" for the Outline's foot: items in the issue against items listed. */
export function includedWords(included, listed) {
  return `${included} of ${listed} ${listed === 1 ? 'item' : 'items'} included`;
}
