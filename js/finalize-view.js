/**
 * Finalize as a list and a card (Claude Design round two, Kate's pick Sep 16).
 * Pure, so node --test can hold it: which stage the screen is in, how the
 * kept rows group down the left, the progress line and bar, and which row
 * the card on the right shows.
 */

/** before: rewrites wait; checking: rewrites came back and wait to be
 *  checked; plain: nothing to rewrite or check. */
export function finalizeStage({ pending, checks }) {
  if (checks > 0) return 'checking';
  if (pending > 0) return 'before';
  return 'plain';
}

/**
 * The left list, in the kept rows' standing order. `pending`, `review` and
 * `verified` are sets of ids: rows still needing a rewrite, rewrites waiting
 * to be checked, and rewrites checked this visit. Empty groups drop out.
 */
export function finalizeGroups(keeps, { pending, review, verified }) {
  const groups = [
    { key: 'check', label: 'To check', fold: false, rows: keeps.filter(r => review.has(r.id)) },
    { key: 'rewrite', label: 'Needs a rewrite', fold: false, rows: keeps.filter(r => pending.has(r.id) && !review.has(r.id)) },
    { key: 'done', label: 'Done', fold: false, rows: keeps.filter(r => verified.has(r.id) && !review.has(r.id) && !pending.has(r.id)) },
    { key: 'none', label: 'No rewrite needed', fold: true, rows: keeps.filter(r => !review.has(r.id) && !pending.has(r.id) && !verified.has(r.id)) },
  ];
  return groups.filter(g => g.rows.length);
}

/** The line under the title and the bar's share. */
export function finalizeProgress(stage, { pending = 0, keeps = 0, total = 0, left = 0 } = {}) {
  if (stage === 'before') return { text: `${pending} of ${keeps} kept items need an ERC-voice description`, pct: 0 };
  if (stage === 'checking') {
    const done = Math.max(total - left, 0);
    return { text: `${done} of ${total} rewrites checked`, pct: total ? Math.round(100 * done / total) : 0 };
  }
  return { text: '', pct: 100 };
}

/** The card shows the chosen row while it is still listed; otherwise the
 *  first rewrite to check or to do; otherwise nothing (the card becomes the
 *  door to Publish). */
export function pickSelection(groups, selectedId) {
  const all = groups.flatMap(g => g.rows);
  if (selectedId && all.some(r => r.id === selectedId)) return selectedId;
  const lead = groups.find(g => g.key === 'check' || g.key === 'rewrite');
  return lead ? lead.rows[0].id : null;
}

/** What an edit form changed: each value trimmed, kept only where it differs
 *  from the row. The media URL rides along like any field (Kate, Sep 17:
 *  "a small thing that says add media when you click edit"). */
export function editChanges(row, values) {
  const changes = {};
  for (const [field, raw] of Object.entries(values)) {
    const value = String(raw ?? '').trim();
    if (value !== (row[field] ?? '')) changes[field] = value;
  }
  return changes;
}

/** The fields an edit form shows for a type (design audit b4): a research
 *  item has no time or location, an event no deadline. An unknown or empty
 *  type keeps every field, so nothing is lost on a row the reader could not
 *  place. Order is the form's reading order. */
export function fieldsForType(type) {
  const per = {
    event: ['headline', 'date', 'time', 'location', 'source', 'blurb'],
    erc_event: ['headline', 'date', 'time', 'location', 'source', 'blurb'],
    opportunity: ['headline', 'deadline', 'topic', 'source', 'blurb'],
    research: ['headline', 'authors', 'source', 'topic', 'blurb'],
    headline: ['headline', 'source', 'blurb'],
  };
  return per[type] ?? ['headline', 'date', 'source', 'topic', 'blurb', 'deadline', 'authors', 'time', 'location'];
}

/** Dates and deadlines are date inputs, so a typed "Oct 3" cannot vanish from every meta line. */
export function dateField(field) {
  return field === 'date' || field === 'deadline';
}
