/**
 * Sheet rows -> the builder's issue model.
 *
 * The builder's template renders sections of items whose `fields` are named
 * title/url/summary/etc. The hub CSV names the same things headline/link/blurb.
 * This module is the seam between those two vocabularies.
 */

import { createEmptyIssue } from './model.js';
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
  return fields;
}

/** Where a row lands by default: the ⭐ flag beats the type map. */
export function defaultSection(row) {
  if (row.spotlight_request) return 'spotlight';
  return NEWSLETTER_MAP[`${row.type}|${row.subtype}`]?.[0] ?? '';
}

/** The group inside a section — only meaningful when the section fits the type. */
export function groupFor(row, sectionKey) {
  const entry = NEWSLETTER_MAP[`${row.type}|${row.subtype}`];
  if (entry && entry[0] === sectionKey) return entry[1];
  if (sectionKey === 'spotlight') return row.type === 'event' ? 'events' : 'thisandthat';
  return '';
}

/**
 * Build an issue from explicit picks. picks: [{ id, sectionKey }] — the Build
 * screen's checkboxes plus any "move to…" overrides. Unpicked rows never
 * appear; that is the whole point of v2's pick-based build.
 */
export function issueFromPicks(rows, picks, { date, intro } = {}) {
  const byId = new Map(rows.map(r => [r.id, r]));
  const issue = createEmptyIssue();
  issue.date = date ?? '';
  issue.intro = intro ?? '';
  let seq = 0;
  for (const pick of picks ?? []) {
    const row = byId.get(pick.id);
    const section = issue.sections[pick.sectionKey];
    if (!row || !section) continue;
    seq += 1;
    section.items.push({
      id: `desk_${seq}`,
      group: groupFor(row, pick.sectionKey),
      fields: fieldsFor(row),
    });
    section.enabled = true;
  }
  return issue;
}
