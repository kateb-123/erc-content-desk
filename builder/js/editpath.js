/**
 * editpath.js — Field accessor/mutator for newsletter issue objects.
 * Supports click-to-edit without leaking into exported HTML.
 *
 * ref = { section, item, field }
 *   - If section === 'intro' (or field === 'intro'), read/write issue.intro
 *   - Otherwise: issue.sections[section].items.find(i => i.id === item).fields[field]
 */

/**
 * @param {object} issue
 * @param {{ section: string, item?: string, field: string }} ref
 * @returns {string|undefined}
 */
export function getField(issue, ref) {
  if (!issue || !ref) return undefined;
  if (ref.section === 'intro' || ref.field === 'intro') {
    return issue.intro;
  }
  const sec = issue.sections?.[ref.section];
  if (!sec) return undefined;
  const item = sec.items?.find(i => i.id === ref.item);
  if (!item) return undefined;
  return item.fields?.[ref.field];
}

/**
 * @param {object} issue
 * @param {{ section: string, item?: string, field: string }} ref
 * @param {string} value
 */
export function setField(issue, ref, value) {
  if (!issue || !ref) return;
  if (ref.section === 'intro' || ref.field === 'intro') {
    issue.intro = value;
    return;
  }
  const sec = issue.sections?.[ref.section];
  if (!sec) return;
  const item = sec.items?.find(i => i.id === ref.item);
  if (!item) return;
  if (!item.fields) item.fields = {};
  item.fields[ref.field] = value;
}
