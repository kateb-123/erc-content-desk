const norm = s => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export const SECTION_REGISTRY = [
  { key: 'research', label: 'Featured Research', navLabel: 'ERC Research', kind: 'briefs',
    aliases: ['featured research', 'featured erc research', 'research briefs', 'erc research'],
    groups: [
      { key: 'brief',  label: 'Research Brief', aliases: ['research brief', 'research briefs', 'brief', 'briefs'] },
      { key: 'report', label: 'Report', aliases: ['report', 'reports'] },
    ] },
  { key: 'spotlight', label: 'ERC Spotlight', navLabel: 'Spotlight', kind: 'spotlight',
    aliases: ['erc spotlight', 'spotlight'],
    groups: [
      { key: 'programs', label: 'Programs & Opportunities', aliases: ['programs and opportunities', 'programs', 'programs and ops'] },
      { key: 'events', label: 'Events', aliases: ['events', 'erc events'] },
      { key: 'thisandthat', label: 'This & That', aliases: ['this and that', 'this that', 'misc', 'miscellaneous', 'other', 'erc happy hour', 'erc happy hours', 'happy hour', 'happy hours'] },
    ] },
  { key: 'events', label: 'Upcoming Events', navLabel: 'Events', kind: 'grouped-list',
    aliases: ['upcoming events', 'events', 'events and webinars', 'am events'],
    groups: [
      { key: 'featured', label: 'Featured Events', aliases: ['featured', 'featured events'] },
      { key: 'tamu', label: 'Texas A&M', aliases: ['texas am', 'tamu', 'am', 'texas a and m', 'texas a&m'] },
      { key: 'offcampus', label: 'Online & Off-Campus', aliases: ['online and offcampus', 'offcampus and online', 'offcampus', 'webinars and offcampus', 'online'] },
    ] },
  { key: 'opportunities', label: 'Opportunities', navLabel: 'Opportunities', kind: 'grouped-list',
    aliases: ['opportunities'],
    groups: [
      { key: 'funding', label: 'Funding & Grants', aliases: ['funding and grants', 'funding', 'grants'] },
      { key: 'fellowships', label: 'Fellowships & Training', aliases: ['fellowships and training', 'fellowships', 'training'] },
      { key: 'calls', label: 'Calls for Proposals', aliases: ['calls for proposals', 'calls', 'cfp'] },
      { key: 'misc', label: 'Miscellaneous', aliases: ['miscellaneous', 'misc', 'other'] },
    ] },
  { key: 'policy', label: 'New Education Policy Research', navLabel: 'Policy Research', kind: 'grouped-digest',
    aliases: ['new education policy research', 'policy research', 'education policy research', 'policy'],
    groups: [
      { key: 'working', label: 'Working Papers', aliases: ['working papers', 'working'] },
      { key: 'peer', label: 'Peer-Reviewed', aliases: ['peerreviewed', 'peer reviewed', 'peer'] },
      { key: 'misc', label: 'Miscellaneous', aliases: ['miscellaneous', 'misc', 'other'] },
    ] },
  { key: 'headlines', label: 'Education Headlines', navLabel: 'Headlines', kind: 'grouped-digest',
    aliases: ['education headlines', 'headlines', 'education in the news', 'in the news'],
    groups: [
      { key: 'federal', label: 'Federal', aliases: ['federal'] },
      { key: 'texas', label: 'Texas', aliases: ['texas', 'state'] },
    ] },
  // One-off items that fit nowhere else — a single unlabeled group, so the
  // section band is the only heading.
  { key: 'misc', label: 'Miscellaneous', navLabel: 'Miscellaneous', kind: 'grouped-digest',
    aliases: ['miscellaneous', 'misc'],
    groups: [
      { key: 'misc', label: '', aliases: ['miscellaneous', 'misc', 'other'] },
    ] },
];

export function createEmptyIssue() {
  const sections = {};
  for (const s of SECTION_REGISTRY) sections[s.key] = { enabled: false, items: [] };
  return { date: '', headerImageUrl: '', intro: '', sections };
}

export function sectionByAlias(headerText) {
  const n = norm(headerText);
  return SECTION_REGISTRY.find(s => s.aliases.some(a => norm(a) === n)) || null;
}

export function groupByAlias(sectionKey, groupText) {
  const sec = SECTION_REGISTRY.find(s => s.key === sectionKey);
  if (!sec) return '';
  const n = norm(groupText);
  const g = sec.groups.find(g => g.aliases.some(a => norm(a) === n));
  return g ? g.key : '';
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

/** Every url already in the outline — the pull door's dedupe key. */
export function issueLinks(issue) {
  const links = new Set();
  for (const key of Object.keys(issue?.sections ?? {})) {
    for (const item of issue.sections[key].items ?? []) {
      const url = String(item?.fields?.url ?? '').trim();
      if (url) links.add(url);
    }
  }
  return links;
}

/** Every item id already in the outline — the pull door's second dedupe key. */
export function issueItemIds(issue) {
  const ids = new Set();
  for (const key of Object.keys(issue?.sections ?? {})) {
    for (const item of issue.sections[key].items ?? []) {
      if (item?.id) ids.add(item.id);
    }
  }
  return ids;
}

/** Split a pulled issue against what's already present (by link, and by the
 *  stable desk_* id so even url-less items never duplicate): keep the new,
 *  count the known. */
export function partitionPulled(pulled, existingLinks, existingIds = new Set()) {
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
