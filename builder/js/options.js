/**
 * options.js: the per-issue layout options the Outline step sets (Claude
 * Design handoff, Oct 2026), as pure functions over the issue. The renderer
 * (template.js) reads what these write: issue.layout.callout, issue.layout.nav,
 * fields.showSummary and fields.pictureStyle. Nothing here touches the DOM.
 */

import { CALLOUT_STYLES, PICTURE_STYLES, layoutOf, summaryDefault, pictureDefault } from './template.js';

/** The callout's four treatments, in the order the control shows them. */
export const CALLOUT_CHOICES = [
  { key: 'maroon', label: 'Maroon block' },
  { key: 'gray', label: 'Light gray box' },
  { key: 'dotted', label: 'Dotted rule' },
  { key: 'none', label: 'None' },
];

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

/** Sets the callout style; an unknown key is ignored. The old research.showSubmit
 *  switch is cleared so it cannot disagree with the choice. */
export function setCallout(issue, key) {
  if (!CALLOUT_STYLES.includes(key)) return;
  layoutBlock(issue).callout = key;
  if (issue.sections?.research) delete issue.sections.research.showSubmit;
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
  const { callout, nav } = layoutOf(issue);
  if (callout !== 'maroon' || !nav) return true;
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
