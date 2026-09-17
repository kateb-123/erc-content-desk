/**
 * Publish as one table: every row the check returned, in one list, each
 * wearing its fate. Pure, so node --test can hold it. The check's own grouping stays the truth: rows are
 * looked up by the ids the endpoint returns, never re-derived client-side.
 */

export const FATES = [
  { key: 'adding', from: 'adding', label: 'Adding' },
  { key: 'held', from: 'newsletterOnly', label: 'Held for newsletter' },
  { key: 'fix', from: 'notReady', label: 'Needs a fix' },
  { key: 'live', from: 'skipped', label: 'Already live' },
];

/** One list in fate order: [{ row, fate }]. */
export function publishRows(preview, rows) {
  if (!preview) return [];
  const byId = new Map(rows.map(r => [r.id, r]));
  const list = [];
  for (const fate of FATES) {
    for (const item of preview[fate.from] ?? []) {
      const row = byId.get(item.id);
      if (row) list.push({ row, fate: fate.key });
    }
  }
  return list;
}

/** The legend under the bar: a count for every fate that holds rows, except
 *  Already live, which never carries a number: no counts and no skipped
 *  talk for the rows the write leaves out. */
export function legendItems(list) {
  return FATES.map(fate => {
    const count = list.filter(r => r.fate === fate.key).length;
    if (!count) return null;
    const text = fate.key === 'adding' ? `${count} adding`
      : fate.key === 'held' ? `${count} held for the newsletter`
      : fate.key === 'fix' ? `${count} ${count === 1 ? 'needs' : 'need'} a fix`
      : 'Already live';
    return { key: fate.key, text, count };
  }).filter(Boolean);
}

/** The table under a legend filter; no filter shows every row. */
export function filterByFate(list, key) {
  return key ? list.filter(r => r.fate === key) : list;
}

/** The bar: each fate that holds rows, with its share in percent. */
export function fateShares(list) {
  if (!list.length) return [];
  return FATES
    .map(fate => ({ key: fate.key, share: 100 * list.filter(r => r.fate === fate.key).length / list.length }))
    .filter(s => s.share > 0);
}
