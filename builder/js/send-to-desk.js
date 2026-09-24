/**
 * send-to-desk.js: an item added by hand in the builder goes to the desk too
 * (Kate, Sep 23, 2026): a row in Content Sort's queue, stamped for the
 * builder's issue and added by the builder, so it is checked against the
 * Policy Exchange like everything else. It goes the way the desk's own Quick
 * add does (js/app.js stampSubmitted): submit, let the reader file the row,
 * then stamp it through the desk's save path. No DOM here; app.js hands in
 * the four doors.
 */

import { NEWSLETTER_MAP } from '../../js/schema.js';
import { isSafeLink, withScheme } from '../../js/links.js';
import { markNewsletterIssue } from '../../js/workflow.js';

/** Who Sort says added it ("added by the builder"). */
export const BUILDER_SUBMITTER = 'the builder';

/** Where the builder's upload puts a picture; /api/submit takes no other address. */
const UPLOADED_PICTURE = 'https://raw.githubusercontent.com/';

/** Sections that only ever hold one desk type, whatever the group: an item in
 *  one keeps that type and leaves the subtype for Sort to ask. ERC Spotlight
 *  and Miscellaneous are filled by hand, so they have none. */
const SECTION_TYPES = {
  research: 'research', policy: 'research', events: 'event', opportunities: 'opportunity', headlines: 'headline',
};

/**
 * The desk's type and subtype for a builder section and group: NEWSLETTER_MAP
 * read backwards where exactly one entry lands there; otherwise the section's
 * own type with the subtype left blank (Online & Off-Campus holds two); and no
 * type at all where the type is not clear, so Sort asks for one.
 * @returns {{ type: string, subtype: string }}
 */
export function deskTypeFor(sectionKey, group) {
  const landing = Object.keys(NEWSLETTER_MAP)
    .filter((key) => NEWSLETTER_MAP[key][0] === sectionKey && NEWSLETTER_MAP[key][1] === group);
  if (landing.length === 1) {
    const [type, subtype] = landing[0].split('|');
    return { type, subtype };
  }
  return { type: SECTION_TYPES[sectionKey] ?? '', subtype: '' };
}

const text = (value) => String(value ?? '').trim();

/**
 * The /api/submit body for a hand-added item, or null when it has no web link
 * (the desk takes nothing without one). The details the desk has no field
 * for at submit ride to the reader in original_text, the way the spreadsheet
 * door sends its extra columns, and the reader files them.
 * @param {string} sectionKey
 * @param {{ group?: string, fields?: object }} item
 */
export function deskSubmission(sectionKey, item) {
  const f = item?.fields ?? {};
  const link = withScheme(f.url);
  if (!isSafeLink(link)) return null;
  const summary = text(f.summary);
  const details = [['Date', f.date], ['Time', f.time], ['Location', f.location]]
    .filter(([, value]) => text(value))
    .map(([label, value]) => `${label}: ${text(value)}`);
  if (text(f.meta)) details.push(text(f.meta));   // "Deadline: ...", as the Add an item panel writes it
  const body = { title: text(f.title), blurb: summary, link, ...deskTypeFor(sectionKey, item?.group), submitter: BUILDER_SUBMITTER };
  if (details.length) body.original_text = [summary, details.join('\n')].filter(Boolean).join('\n\n');
  if (text(f.image).startsWith(UPLOADED_PICTURE)) body.infographic = text(f.image);
  return body;
}

/**
 * Send one hand-added item to the desk and stamp its row for the issue. The
 * row's id lands on item.deskId the moment the desk has the row, so Try again
 * after a failed stamp never files it twice, and a later pull knows it.
 * Throws with the reason; item.deskId says whether the row got that far.
 * @param {object} item - the builder item (its deskId is set here)
 * @param {{ sectionKey: string, issueIso: string, api: {
 *   submit: (body: object) => Promise<{ id: string }>,
 *   read: (id: string) => Promise<unknown>,
 *   rows: () => Promise<Array<object>>,
 *   save: (rows: Array<object>) => Promise<unknown> } }} o
 */
export async function sendItemToDesk(item, { sectionKey, issueIso, api }) {
  if (!item.deskId) {
    const reply = await api.submit(deskSubmission(sectionKey, item));
    if (!reply?.id) throw new Error('The desk sent back no id for it.');
    item.deskId = reply.id;
  }
  if (!issueIso) throw new Error('No issue is picked, so it is in the queue only.');
  // The reader files the row first, so the stamp's write never lands under
  // the reader's; a reading that fails leaves the row for Sort to read again.
  try { await api.read(item.deskId); } catch { /* Sort catches up */ }
  const row = (await api.rows()).find((r) => r.id === item.deskId);
  if (!row) throw new Error("It is in the queue, but the desk couldn't find it to stamp it for the issue.");
  await api.save([markNewsletterIssue(row, issueIso)]);
}
