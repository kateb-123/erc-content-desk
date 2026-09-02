import test from 'node:test';
import assert from 'node:assert/strict';
import { isIsoDate, normalizeSchedule, nextIssueDate, eventTiming, deadlineState } from '../js/schedule.js';

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

test('eventTiming: an event belongs to the last issue before it happens', () => {
  const sched = ['2026-09-08', '2026-09-22', '2026-10-06', '2026-10-20'];
  assert.deepEqual(eventTiming(sched, '2026-09-08', '2026-09-10'), { state: 'now' });
  assert.deepEqual(eventTiming(sched, '2026-09-08', '2026-09-21'), { state: 'now' });
  assert.deepEqual(eventTiming(sched, '2026-09-08', '2026-09-22'), { state: 'later', issue: '2026-09-22' });
  assert.deepEqual(eventTiming(sched, '2026-09-08', '2026-10-09'), { state: 'later', issue: '2026-10-06' });
  assert.deepEqual(eventTiming(sched, '2026-09-08', '2026-09-05'), { state: 'passed' });
  assert.deepEqual(eventTiming(sched, '2026-10-06', '2026-10-09'), { state: 'now' });
  assert.deepEqual(eventTiming(sched, '2026-09-08', '2026-12-20'), { state: 'later', issue: '2026-10-20' });
  assert.deepEqual(eventTiming(sched, '2026-09-08', ''), { state: '' });
  assert.deepEqual(eventTiming([], '2026-09-08', '2026-10-01'), { state: 'now' });
});

test('deadlineState: open until the deadline, passed after', () => {
  assert.equal(deadlineState('2026-09-08', '2026-10-15'), 'open');
  assert.equal(deadlineState('2026-09-08', '2026-09-08'), 'open');
  assert.equal(deadlineState('2026-09-08', '2026-09-01'), 'passed');
  assert.equal(deadlineState('2026-09-08', ''), '');
});
