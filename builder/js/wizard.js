/**
 * wizard.js: the wizard shell's pure logic. Which steps are open, what each
 * step's indicator shows, the restore banner's words, the archive ask, and
 * the issue date's two spellings. app.js reads these; nothing here touches
 * the DOM.
 */

import { countIssueItems } from './model.js';

/** The wizard's steps, in order. */
export const STEPS = ['review', 'triage', 'edit', 'export'];

/** What the status line says when a locked step or Next is pressed too early. */
export const LOCKED_STEP_MESSAGE = 'Pick an issue and pull from the desk first.';

/**
 * Review is always open; Outline, Preview & Edit and Save & Export need an
 * issue with at least one item: a date alone opens nothing. The step
 * buttons and Next both ask this, so they agree.
 * @param {string} step
 * @param {number} itemCount
 * @returns {boolean}
 */
export function canEnterStep(step, itemCount) {
  if (!STEPS.includes(step)) return false;
  return step === 'review' || Number(itemCount) > 0;
}

/**
 * What a step's indicator shows. `reached` is the furthest step index
 * visited with items in hand, so a check survives going back; the step being
 * stood on is never checked, and neither is the furthest one reached.
 * @param {string} step
 * @param {{ current: string, reached: number, itemCount: number }} o
 * @returns {'current'|'complete'|'open'|'locked'}
 */
export function stepState(step, { current, reached, itemCount }) {
  if (step === current) return 'current';
  if (!canEnterStep(step, itemCount)) return 'locked';
  const idx = STEPS.indexOf(step);
  return idx < Number(reached) ? 'complete' : 'open';
}

/**
 * The restore banner's question, naming the saved issue's date and how many
 * items it holds, so Discard is an informed choice. An issue stamped sentAt
 * already went out, and the banner says so.
 * @param {object} saved - the issue loaded from storage
 * @returns {string}
 */
export function restoreBannerMessage(saved) {
  const count = countIssueItems(saved);
  const items = `${count} ${count === 1 ? 'item' : 'items'}`;
  const date = String(saved?.date ?? '').trim();
  if (saved?.sentAt && date) return `Restore the sent ${date} issue (${items})?`;
  return date
    ? `Restore the in-progress newsletter for ${date} (${items})?`
    : `Restore the in-progress newsletter (${items})?`;
}

/**
 * The archive index's entry for an ISO date, or null when the date is new
 * or the index could not be read.
 * @param {Array<{date: string, label: string}>|null} index
 * @param {string} iso
 */
export function archivedEntry(index, iso) {
  if (!Array.isArray(index)) return null;
  return index.find((e) => e && e.date === iso) ?? null;
}

/** The one ask before an archived issue is written over. */
export function archiveAskMessage(entry) {
  const label = entry?.label || isoToDisplayDate(entry?.date ?? '');
  return `Replace the archived ${label} issue?`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "2026-07-01" to "July 1, 2026", spelled as the archive index spells it
 * (no zero padding). Component-wise, so no timezone drift.
 * @param {string} value
 * @returns {string}
 */
export function isoToDisplayDate(value) {
  const [y, m, d] = String(value ?? '').split('-').map(Number);
  if (!y || !m || !d || m > 12) return '';
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/**
 * "July 1, 2026" (or the older "July 01, 2026") to "2026-07-01"; '' when
 * unparseable.
 * @param {string} str
 * @returns {string}
 */
export function displayDateToISO(str) {
  const s = String(str ?? '').trim();
  // Already ISO: hand it back rather than parse it as UTC and lose a day locally.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
