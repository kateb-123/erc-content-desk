/**
 * Sheet rows -> the builder's issue model.
 *
 * The builder's template renders sections of items whose `fields` are named
 * title/url/summary/etc. The hub CSV names the same things headline/link/blurb.
 * This module is the seam between those two vocabularies.
 *
 * The issue is built from the builder's own registry, so the two can never
 * disagree about which sections exist and the pull can never drop a row that
 * maps to one side's missing section.
 */

import { createEmptyIssue } from '../builder/js/model.js';
import { NEWSLETTER_MAP } from './schema.js';

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
  if (row.infographic) fields.image = row.infographic;
  return fields;
}

/** Where a row lands by default: the ⭐ flag beats the type map. */
export function defaultSection(row) {
  if (row.spotlight_request) return 'spotlight';
  return NEWSLETTER_MAP[`${row.type}|${row.subtype}`]?.[0] ?? '';
}

/** The group inside a section: only meaningful when the section fits the type. */
function groupFor(row, sectionKey) {
  const entry = NEWSLETTER_MAP[`${row.type}|${row.subtype}`];
  if (entry && entry[0] === sectionKey) return entry[1];
  if (sectionKey === 'spotlight') {
    return (row.type === 'event' || row.type === 'erc_event') ? 'events' : 'thisandthat';
  }
  return '';
}

/**
 * Everything stamped for an issue, as the builder-shaped issue the pull door
 * serves. An unmappable row (untyped but stamped, rare) lands in Headlines
 * rather than vanishing: visible and movable beats silently missing.
 */
export function issueForPull(rows, issueDate) {
  const issue = createEmptyIssue();
  issue.date = issueDate ?? '';
  for (const row of rows) {
    if (String(row.newsletter_issue ?? '') !== issueDate) continue;
    const key = defaultSection(row) || 'headlines';
    const section = issue.sections[key];
    if (!section) continue;
    section.items.push({
      // Derived from the sheet row's own id: stable across pulls, so a
      // re-pull can never mint a colliding desk_N for a different item.
      id: `desk_${row.id}`,
      group: groupFor(row, key),
      fields: fieldsFor(row),
    });
    section.enabled = true;
  }
  return issue;
}

/** How many rows are staged per issue — the mismatch message points at these. */
export function stagedCounts(rows) {
  const counts = {};
  for (const row of rows) {
    const issue = String(row.newsletter_issue ?? '').trim();
    if (issue) counts[issue] = (counts[issue] || 0) + 1;
  }
  return counts;
}
