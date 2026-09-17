// wizard.test.js: the wizard shell's pure logic (step gating, the restore banner's words).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, canEnterStep, LOCKED_STEP_MESSAGE, restoreBannerMessage, stepState, archivedEntry, archiveAskMessage, isoToDisplayDate, displayDateToISO } from '../js/wizard.js';
import { createEmptyIssue } from '../js/model.js';

test('Review is always open; the later steps need at least one pulled item (b22, b23, d9)', () => {
  assert.deepEqual(STEPS, ['review', 'triage', 'edit', 'export']);
  assert.equal(canEnterStep('review', 0), true);
  assert.equal(canEnterStep('review', 3), true);
  for (const step of ['triage', 'edit', 'export']) {
    assert.equal(canEnterStep(step, 0), false, `${step} locked with no items`);
    assert.equal(canEnterStep(step, undefined), false, `${step} locked with no issue at all`);
    assert.equal(canEnterStep(step, 1), true, `${step} open with one item`);
    assert.equal(canEnterStep(step, 14), true, `${step} open with items`);
  }
  assert.equal(canEnterStep('nowhere', 5), false);
  assert.equal(LOCKED_STEP_MESSAGE, 'Pick an issue and pull from the desk first.');
});

test('a step is current, complete, open or locked; checks survive going back (e29, d9)', () => {
  // On Save & Export with items: the three before it are complete.
  const at = { current: 'export', reached: 3, itemCount: 14 };
  assert.equal(stepState('review', at), 'complete');
  assert.equal(stepState('edit', at), 'complete');
  assert.equal(stepState('export', at), 'current');
  // Back on Review after reaching Save & Export: Outline and Preview & Edit keep their checks.
  const back = { current: 'review', reached: 3, itemCount: 14 };
  assert.equal(stepState('review', back), 'current');
  assert.equal(stepState('triage', back), 'complete');
  assert.equal(stepState('edit', back), 'complete');
  assert.equal(stepState('export', back), 'open', 'the furthest step reached is not finished');
  // A date alone opens nothing and checks nothing.
  const bare = { current: 'review', reached: 0, itemCount: 0 };
  assert.equal(stepState('review', bare), 'current');
  assert.equal(stepState('triage', bare), 'locked');
  assert.equal(stepState('export', bare), 'locked');
  // Items in hand but nothing visited yet: the later steps are open, not complete.
  const pulled = { current: 'review', reached: 0, itemCount: 5 };
  assert.equal(stepState('triage', pulled), 'open');
  assert.equal(stepState('review', { current: 'triage', reached: 1, itemCount: 5 }), 'complete');
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

test('the restore banner says when the saved issue already went out (e31)', () => {
  const saved = createEmptyIssue();
  saved.date = 'August 25, 2026';
  saved.sections.events.items.push({ id: 'a', group: 'tamu', fields: { title: 'A' } });
  saved.sentAt = '2026-08-25T15:00:00.000Z';
  assert.equal(restoreBannerMessage(saved), 'Restore the sent August 25, 2026 issue (1 item)?');
});

test('the archive index says whether a date is already archived, and the ask names it (d10)', () => {
  const index = [
    { date: '2026-08-25', file: '2026-08-25.html', label: 'August 25, 2026' },
    { date: '2026-06-16', file: '2026-06-16.html', label: 'June 16, 2026' },
  ];
  assert.deepEqual(archivedEntry(index, '2026-08-25'), index[0]);
  assert.equal(archivedEntry(index, '2026-09-08'), null);
  assert.equal(archivedEntry(null, '2026-08-25'), null, 'an unreadable index archives nothing');
  assert.equal(archivedEntry('nope', '2026-08-25'), null);
  assert.equal(archiveAskMessage(index[0]), 'Replace the archived August 25, 2026 issue?');
  assert.equal(archiveAskMessage({ date: '2026-09-08' }), 'Replace the archived September 8, 2026 issue?', 'no label: the date is spelled out');
});

test('issue dates read as the archive writes them, no zero padding (f17)', () => {
  assert.equal(isoToDisplayDate('2026-07-01'), 'July 1, 2026');
  assert.equal(isoToDisplayDate('2025-12-05'), 'December 5, 2025');
  assert.equal(isoToDisplayDate('2026-08-25'), 'August 25, 2026');
  assert.equal(isoToDisplayDate(''), '');
  assert.equal(isoToDisplayDate('2026-13'), '');
  assert.equal(displayDateToISO('July 1, 2026'), '2026-07-01');
  assert.equal(displayDateToISO('July 01, 2026'), '2026-07-01', 'an issue saved under the old spelling still parses');
  assert.equal(displayDateToISO('2026-07-01'), '2026-07-01');
  assert.equal(displayDateToISO('not a date'), '');
  assert.equal(displayDateToISO(''), '');
});
