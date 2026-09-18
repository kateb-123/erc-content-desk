/** Where the digests' "See more on the ERC website" tail links go by default. */
export const POLICY_EXCHANGE_URL = 'https://erc-policy-exchange.vercel.app/';

export const SECTION_REGISTRY = [
  { key: 'research', label: 'Featured Research', navLabel: 'ERC Research', kind: 'briefs',
    groups: [
      { key: 'brief',  label: 'Research Brief' },
      { key: 'report', label: 'Report' },
    ] },
  { key: 'spotlight', label: 'ERC Spotlight', navLabel: 'Spotlight', kind: 'spotlight',
    groups: [
      { key: 'programs', label: 'Programs & Opportunities' },
      { key: 'events', label: 'Events' },
      { key: 'thisandthat', label: 'This & That' },
    ] },
  { key: 'events', label: 'Upcoming Events', navLabel: 'Events', kind: 'grouped-list',
    groups: [
      { key: 'featured', label: 'Featured Events' },
      { key: 'tamu', label: 'Texas A&M' },
      { key: 'offcampus', label: 'Online & Off-Campus' },
    ] },
  { key: 'opportunities', seeMoreUrl: POLICY_EXCHANGE_URL, label: 'Opportunities', navLabel: 'Opportunities', kind: 'grouped-list',
    groups: [
      { key: 'funding', label: 'Funding & Grants' },
      { key: 'fellowships', label: 'Fellowships & Training' },
      { key: 'calls', label: 'Calls for Proposals' },
      { key: 'misc', label: 'Miscellaneous' },
    ] },
  { key: 'policy', seeMoreUrl: POLICY_EXCHANGE_URL, label: 'New Education Policy Research', navLabel: 'Policy Research', kind: 'grouped-digest',
    groups: [
      { key: 'working', label: 'Working Papers' },
      { key: 'peer', label: 'Peer-Reviewed' },
      { key: 'misc', label: 'Miscellaneous' },
    ] },
  { key: 'headlines', seeMoreUrl: POLICY_EXCHANGE_URL, label: 'Education Headlines', navLabel: 'Headlines', kind: 'grouped-digest',
    groups: [
      { key: 'federal', label: 'Federal' },
      { key: 'texas', label: 'Texas' },
    ] },
  // One-off items that fit nowhere else: a single unlabeled group, so the
  // section band is the only heading.
  { key: 'misc', label: 'Miscellaneous', navLabel: 'Miscellaneous', kind: 'grouped-digest',
    groups: [
      { key: 'misc', label: '' },
    ] },
];

export function createEmptyIssue() {
  const sections = {};
  for (const s of SECTION_REGISTRY) sections[s.key] = { enabled: false, items: [] };
  return { date: '', intro: '', sections };
}

/** Append review-sourced items to an issue. Ids continue the rvw_ sequence. */
export function mergeIssueItems(issue, entries) {
  let max = 0;
  for (const key of Object.keys(issue.sections)) {
    for (const it of issue.sections[key].items) {
      const m = /^rvw_(\d+)$/.exec(it.id || '');
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  for (const { sectionKey, item } of entries) {
    const sec = issue.sections[sectionKey];
    if (!sec) continue;
    sec.items.push({ id: `rvw_${++max}`, group: item.group || '', fields: { ...item.fields } });
    sec.enabled = true;
  }
  return issue;
}

/**
 * Remove one item from the issue by id. Returns { sectionKey, index, item }
 * so the caller can offer Undo (re-insert at the same spot), or null if not
 * found. Empties auto-disable the section (matches the empty-section rule).
 */
export function deleteItem(issue, itemId) {
  for (const sectionKey of Object.keys(issue.sections)) {
    const items = issue.sections[sectionKey].items;
    const index = items.findIndex(it => it.id === itemId);
    if (index === -1) continue;
    const [item] = items.splice(index, 1);
    issue.sections[sectionKey].enabled = items.length > 0;
    return { sectionKey, index, item };
  }
  return null;
}

/** Re-insert a previously deleted item at its original spot (the Undo path). */
export function insertItem(issue, sectionKey, index, item) {
  const sec = issue.sections[sectionKey];
  if (!sec) return issue;
  const at = Math.max(0, Math.min(index, sec.items.length));
  sec.items.splice(at, 0, item);
  sec.enabled = true;
  return issue;
}

/** Split a pulled issue against what the outline already holds (by link, and by
 *  the stable desk_* id so even url-less items never duplicate): keep the new,
 *  count the known. */
export function partitionPulled(pulled, existing) {
  const existingLinks = new Set();
  const existingIds = new Set();
  for (const key of Object.keys(existing?.sections ?? {})) {
    for (const item of existing.sections[key].items ?? []) {
      const url = String(item?.fields?.url ?? '').trim();
      if (url) existingLinks.add(url);
      if (item?.id) existingIds.add(item.id);
    }
  }
  let already = 0;
  const kept = structuredClone(pulled);
  for (const key of Object.keys(kept?.sections ?? {})) {
    const sec = kept.sections[key];
    sec.items = (sec.items ?? []).filter(item => {
      const url = String(item?.fields?.url ?? '').trim();
      if ((url && existingLinks.has(url)) || (item?.id && existingIds.has(item.id))) {
        already += 1;
        return false;
      }
      return true;
    });
    sec.enabled = sec.items.length > 0;
  }
  return { pulled: kept, already };
}

/** Total items across every section. */
export function countIssueItems(issue) {
  return Object.values(issue?.sections ?? {})
    .reduce((n, sec) => n + (sec.items?.length ?? 0), 0);
}

/** Merge a pulled or parsed issue into an existing one (the Outline side door). */
export function mergeIssues(base, extra) {
  if (!base.date && extra.date) base.date = extra.date;
  if (!base.intro && extra.intro) base.intro = extra.intro;
  for (const key of Object.keys(base.sections)) {
    const from = extra.sections && extra.sections[key];
    if (!from || !from.items || !from.items.length) continue;
    base.sections[key].items.push(...from.items);
    base.sections[key].enabled = true;
  }
  return base;
}

/**
 * The Outline's two lists: the registry sections that hold items, in
 * registry order, and the labels of the ones that do not.
 * @param {object} issue
 * @returns {{ populated: Array<object>, missing: Array<string> }}
 */
export function splitSections(issue) {
  const populated = [];
  const missing = [];
  for (const reg of SECTION_REGISTRY) {
    const items = issue?.sections?.[reg.key]?.items ?? [];
    if (items.length) populated.push(reg);
    else missing.push(reg.label);
  }
  return { populated, missing };
}

/**
 * Bucket a section's items for display: one bucket per non-empty group
 * (labeled), then a trailing unlabeled bucket for items that matched no
 * group, so nothing is silently dropped. Flat sections are one bucket.
 * @param {object} reg - SECTION_REGISTRY entry
 * @param {Array<object>} secItems
 * @returns {Array<{label: string|null, items: Array<object>}>}
 */
export function bucketSectionItems(reg, secItems) {
  const hasGroups = reg.groups && reg.groups.length > 0;
  const buckets = [];
  if (hasGroups) {
    const claimed = new Set();
    for (const grp of reg.groups) {
      const grpItems = secItems.filter((it) => it.group === grp.key);
      if (grpItems.length === 0) continue;
      grpItems.forEach((it) => claimed.add(it));
      buckets.push({ label: grp.label, items: grpItems });
    }
    const leftover = secItems.filter((it) => !claimed.has(it));
    if (leftover.length > 0) buckets.push({ label: null, items: leftover });
  } else {
    buckets.push({ label: null, items: secItems.slice() });
  }
  return buckets;
}

/**
 * Move one item within its display bucket and write the new order back into
 * the section's full item array (bucket members keep their original slots,
 * so items in other groups are untouched).
 * @param {Array<object>} allItems - the section's full items array (mutated)
 * @param {Array<object>} bucketItems - the bucket's items, display order
 * @param {number} fromIdx - index within the bucket being dragged
 * @param {number} toIdx - index within the bucket to land on
 */
export function moveWithinBucket(allItems, bucketItems, fromIdx, toIdx) {
  if (fromIdx === toIdx) return;
  const positions = bucketItems.map((it) => allItems.indexOf(it));
  const newBucket = bucketItems.slice();
  const [moved] = newBucket.splice(fromIdx, 1);
  newBucket.splice(toIdx, 0, moved);
  positions.forEach((pos, i) => { allItems[pos] = newBucket[i]; });
}
