/**
 * editpath.js: field accessor/mutator for newsletter issue objects.
 * Supports click-to-edit without leaking into exported HTML.
 *
 * ref = { section, item, field }
 *   - If field === 'intro', read/write issue.intro (the template's one
 *     item-less hook: section 'intro', no item, field 'intro')
 *   - Otherwise: issue.sections[section].items.find(i => i.id === item).fields[field]
 */

/** The item a ref points at, or undefined if the section or item is gone. */
function itemOf(issue, ref) {
  return issue.sections?.[ref.section]?.items?.find(i => i.id === ref.item);
}

/**
 * @param {object} issue
 * @param {{ section: string, item?: string, field: string }} ref
 * @returns {string|undefined}
 */
export function getField(issue, ref) {
  if (!issue || !ref) return undefined;
  if (ref.field === 'intro') return issue.intro;
  return itemOf(issue, ref)?.fields?.[ref.field];
}

/**
 * @param {object} issue
 * @param {{ section: string, item?: string, field: string }} ref
 * @param {string} value
 */
export function setField(issue, ref, value) {
  if (!issue || !ref) return;
  if (ref.field === 'intro') {
    issue.intro = value;
    return;
  }
  const item = itemOf(issue, ref);
  if (!item) return;
  if (!item.fields) item.fields = {};
  item.fields[ref.field] = value;
}
