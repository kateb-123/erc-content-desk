// issue-dates.test.js: the dates the Review step's Issue list offers (Kate,
// Sep 23): nothing before today, today itself, and the draft's own date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueDateChoices } from '../js/wizard.js';

const TODAY = '2026-09-23';

test('the Issue list drops every date before today', () => {
  assert.deepEqual(issueDateChoices(['2026-09-08', '2026-09-22', '2026-10-06'], TODAY), ['2026-10-06']);
});

test('an issue stays listed through its own send day', () => {
  assert.deepEqual(issueDateChoices(['2026-09-22', '2026-09-23', '2026-10-06'], TODAY), ['2026-09-23', '2026-10-06']);
});

test('later dates stay, in order, each once: the schedule and the staged dates overlap', () => {
  assert.deepEqual(
    issueDateChoices(['2026-10-20', '2026-10-06', '2026-11-03', '2026-10-06'], TODAY),
    ['2026-10-06', '2026-10-20', '2026-11-03'],
  );
});

test("the draft's own date stays listed after it has passed, so the field is never blank", () => {
  assert.deepEqual(issueDateChoices(['2026-09-08', '2026-10-06'], TODAY, '2026-09-08'), ['2026-09-08', '2026-10-06']);
  // Gone from the desk's schedule altogether, it is still there, in its place.
  assert.deepEqual(issueDateChoices(['2026-10-06'], TODAY, '2026-08-25'), ['2026-08-25', '2026-10-06']);
  // A draft for a later date the desk does not list yet is kept too.
  assert.deepEqual(issueDateChoices(['2026-10-06'], TODAY, '2026-12-01'), ['2026-10-06', '2026-12-01']);
});

test('nothing from today on and no draft: the list is empty', () => {
  assert.deepEqual(issueDateChoices(['2026-09-08', '2026-09-22'], TODAY), []);
  assert.deepEqual(issueDateChoices([], TODAY), []);
  assert.deepEqual(issueDateChoices([], TODAY, ''), []);
});

test('a date that is not a date is never offered, since it cannot be told from the past', () => {
  assert.deepEqual(issueDateChoices(['', 'soon', '2026-10-6', '2026-10-06'], TODAY), ['2026-10-06']);
});
