/**
 * wizard.js: the wizard shell's pure logic. Which steps are open, and what
 * the restore banner says. app.js reads these; nothing here touches the DOM.
 */

import { countIssueItems } from './model.js';

/** The wizard's steps, in order. */
export const STEPS = ['review', 'triage', 'edit', 'export'];

/** What the status line says when a locked step or Next is pressed with no issue. */
export const LOCKED_STEP_MESSAGE = 'Pick an issue and pull from the desk first.';

/**
 * Review is always open; Outline, Preview & Edit and Save & Export need a
 * loaded issue. The step buttons and Next both ask this, so they agree.
 * @param {string} step
 * @param {boolean} hasIssue
 * @returns {boolean}
 */
export function canEnterStep(step, hasIssue) {
  if (!STEPS.includes(step)) return false;
  return step === 'review' || Boolean(hasIssue);
}

/**
 * The restore banner's question, naming the saved issue's date and how many
 * items it holds, so Discard is an informed choice.
 * @param {object} saved - the issue loaded from storage
 * @returns {string}
 */
export function restoreBannerMessage(saved) {
  const count = countIssueItems(saved);
  const items = `${count} ${count === 1 ? 'item' : 'items'}`;
  const date = String(saved?.date ?? '').trim();
  return date
    ? `Restore the in-progress newsletter for ${date} (${items})?`
    : `Restore the in-progress newsletter (${items})?`;
}
