/**
 * Sheet rows -> the builder's issue model.
 *
 * The builder's template renders sections of items whose `fields` are named
 * title/url/summary/etc. The hub CSV names the same things headline/link/blurb.
 * This module is the seam between those two vocabularies.
 */

import { createEmptyIssue } from './model.js';
import { NEWSLETTER_MAP } from './schema.js';
import { readyFor } from './workflow.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "2026-10-01" -> "October 1, 2026". Anything that is not a full ISO date —
 * a bare year, a month, or prose like "Fall 2026" — passes through unchanged,
 * because the hub genuinely stores all three.
 */
export function isoToDisplay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!match) return String(iso || '');
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  if (!name) return iso;
  return `${name} ${Number(day)}, ${year}`;
}

function fieldsFor(row) {
  const fields = {
    title: row.headline,
    url: row.link,
    summary: row.blurb,
  };
  if (row.source) fields.source = row.source;
  if (row.authors) fields.authors = row.authors;
  if (row.date) fields.date = isoToDisplay(row.date);
  if (row.time) fields.time = row.time;
  if (row.location) fields.location = row.location;
  if (row.deadline) fields.meta = `Deadline: ${isoToDisplay(row.deadline)}`;
  return fields;
}

/** [row, sectionKey, groupKey] for every draft row that has a place to go. */
function placements(rows) {
  const out = [];
  for (const row of readyFor(rows, 'newsletter')) {
    const mapping = NEWSLETTER_MAP[`${row.type}|${row.subtype}`];
    if (!mapping) continue;
    const [sectionKey, groupKey] = mapping;
    // `intro` maps to no section — its text is typed on the Build screen.
    if (!sectionKey || sectionKey === 'intro') continue;
    out.push([row, sectionKey, groupKey]);
  }
  return out;
}

/**
 * Exactly the rows that rowsToIssue will render. The Build screen stamps
 * newsletter_used_at on these and no others, so a row with an unmapped
 * type/subtype stays in the draft instead of vanishing unbuilt.
 */
export function mappedNewsletterRows(rows) {
  // One probe issue for the whole call — createEmptyIssue() always yields the
  // same section keys, so building one per row was pure allocation.
  const { sections } = createEmptyIssue();
  return placements(rows)
    .filter(([, sectionKey]) => Boolean(sections[sectionKey]))
    .map(([row]) => row);
}

export function rowsToIssue(rows, { date, intro, headerImageUrl = '' } = {}) {
  const issue = createEmptyIssue();
  issue.date = date || '';
  issue.intro = intro || '';
  issue.headerImageUrl = headerImageUrl;

  let counter = 0;
  for (const [row, sectionKey, groupKey] of placements(rows)) {
    const section = issue.sections[sectionKey];
    if (!section) continue;

    counter += 1;
    section.items.push({ id: `desk_${counter}`, group: groupKey, fields: fieldsFor(row) });
    section.enabled = true;
  }

  return issue;
}
