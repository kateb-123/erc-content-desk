import test from 'node:test';
import assert from 'node:assert/strict';
import { isIsoDate, normalizeSchedule, nextIssueDate } from '../js/schedule.js';

test('isIsoDate accepts YYYY-MM-DD only', () => {
  assert.equal(isIsoDate('2026-09-01'), true);
  assert.equal(isIsoDate('9/1/2026'), false);
  assert.equal(isIsoDate(''), false);
});

test('normalizeSchedule filters junk, dedupes, and sorts', () => {
  assert.deepEqual(
    normalizeSchedule([['2026-09-15'], ['dates'], ['2026-09-01'], ['2026-09-01'], ['']]),
    ['2026-09-01', '2026-09-15'],
  );
});

test('nextIssueDate picks the first date on or after today', () => {
  const schedule = ['2026-09-01', '2026-09-15', '2026-09-29'];
  assert.equal(nextIssueDate(schedule, '2026-08-26'), '2026-09-01');
  assert.equal(nextIssueDate(schedule, '2026-09-01'), '2026-09-01');
  assert.equal(nextIssueDate(schedule, '2026-09-02'), '2026-09-15');
  assert.equal(nextIssueDate(schedule, '2026-12-31'), '2026-09-29');
  assert.equal(nextIssueDate([], '2026-08-26'), '');
});
