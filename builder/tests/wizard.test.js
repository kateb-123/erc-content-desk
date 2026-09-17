// wizard.test.js: the wizard shell's pure logic (step gating, the restore banner's words).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, canEnterStep, LOCKED_STEP_MESSAGE, restoreBannerMessage } from '../js/wizard.js';
import { createEmptyIssue } from '../js/model.js';

test('Review is always open; the later steps need a loaded issue (b22, b23)', () => {
  assert.deepEqual(STEPS, ['review', 'triage', 'edit', 'export']);
  assert.equal(canEnterStep('review', false), true);
  assert.equal(canEnterStep('review', true), true);
  for (const step of ['triage', 'edit', 'export']) {
    assert.equal(canEnterStep(step, false), false, `${step} locked with no issue`);
    assert.equal(canEnterStep(step, true), true, `${step} open with an issue`);
  }
  assert.equal(canEnterStep('nowhere', true), false);
  assert.equal(LOCKED_STEP_MESSAGE, 'Pick an issue and pull from the desk first.');
});

test('the restore banner names the saved issue and its item count (a10)', () => {
  const saved = createEmptyIssue();
  saved.date = 'July 01, 2026';
  saved.sections.events.items.push({ id: 'a', group: 'tamu', fields: { title: 'A' } });
  saved.sections.headlines.items.push({ id: 'b', group: 'texas', fields: { title: 'B' } });
  assert.equal(restoreBannerMessage(saved), 'Restore the in-progress newsletter for July 01, 2026 (2 items)?');
  saved.sections.headlines.items.pop();
  assert.equal(restoreBannerMessage(saved), 'Restore the in-progress newsletter for July 01, 2026 (1 item)?');
});

test('the restore banner copes with a saved issue that has no date yet', () => {
  const saved = createEmptyIssue();
  assert.equal(restoreBannerMessage(saved), 'Restore the in-progress newsletter (0 items)?');
});
