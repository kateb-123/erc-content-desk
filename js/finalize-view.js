/**
 * Finalize as a list and a card. Pure, so node --test can hold it: which
 * stage the screen is in, how the kept rows group down the left, the progress
 * line and bar, and which row the card on the right shows.
 */
import { readyToFinalize, canRewrite } from './workflow.js';

/** The Finalize tab's count: kept items whose rewrite is still to do or to
 *  check; `verified` is the ids checked this visit. */
export function finalizeWaiting(rows, verified = new Set()) {
  return readyToFinalize(rows).filter(r => canRewrite(r) && !verified.has(r.id)).length;
}

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
export function finalizeGroups(keeps, { pending, review, verified, rewriting = new Set() }) {
  const groups = [
    { key: 'check', label: 'To check', fold: false, rows: keeps.filter(r => review.has(r.id)) },
    // Out for a rewrite since Keep (Kate, Sep 22): listed, so the wait is visible, not a blank.
    { key: 'rewriting', label: 'Rewriting', fold: false, rows: keeps.filter(r => rewriting.has(r.id) && !review.has(r.id)) },
    { key: 'rewrite', label: 'Needs a rewrite', fold: false, rows: keeps.filter(r => pending.has(r.id) && !review.has(r.id) && !rewriting.has(r.id)) },
    { key: 'done', label: 'Done', fold: false, rows: keeps.filter(r => verified.has(r.id) && !review.has(r.id) && !pending.has(r.id)) },
    { key: 'none', label: 'No rewrite needed', fold: true, rows: keeps.filter(r => !review.has(r.id) && !pending.has(r.id) && !verified.has(r.id) && !rewriting.has(r.id)) },
  ];
  return groups.filter(g => g.rows.length);
}

/** Rewrites started at Keep and not back yet: a quiet count in the lede. */
export function onTheWay(n) {
  if (!n) return '';
  return n === 1 ? '1 rewrite on its way' : `${n} rewrites on their way`;
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
 *  from the row. The media URL rides along like any other field. */
export function editChanges(row, values, base = row) {
  // `base` is what the form opened with; a prefilled description that was not
  // touched is no change.
  const changes = {};
  for (const [field, raw] of Object.entries(values)) {
    const value = String(raw ?? '').trim();
    if (value !== (base[field] ?? '')) changes[field] = value;
  }
  return changes;
}

/** What the edit form opens with: the row, its description falling back to
 * the original text while no rewrite exists yet. */
export function editBase(row) {
  return { ...row, blurb: row.blurb || row.original_text || '' };
}

/** The fields an edit form shows for a type: a research
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

/** One edit form on Sort and Finalize: the type's fields, then the link.
 *  Media is a row of its own on both. */
export function editFields(type) {
  return [...fieldsForType(type), 'link'];
}

/** Dates and deadlines are date inputs, so a typed "Oct 3" cannot vanish from every meta line. */
export function dateField(field) {
  return field === 'date' || field === 'deadline';
}
