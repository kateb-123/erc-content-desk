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

// A week before the last send date (Kate, Oct 22, 2026: "warn a week before
// the last newsletter"): the schedule says it is running out.
test('scheduleEnding: the last send date, once it is a week or less away, else nothing', async () => {
  const { scheduleEnding } = await import('../js/schedule.js');
  const schedule = ['2026-10-20', '2026-11-03', '2026-11-17'];
  assert.equal(scheduleEnding(schedule, '2026-10-21'), '', 'three weeks out: quiet');
  assert.equal(scheduleEnding(schedule, '2026-11-09'), '', 'eight days out: still quiet');
  assert.equal(scheduleEnding(schedule, '2026-11-10'), '2026-11-17', 'seven days out: says the last date');
  assert.equal(scheduleEnding(schedule, '2026-11-17'), '2026-11-17', 'the day itself');
  assert.equal(scheduleEnding(schedule, '2026-11-18'), '', 'past the last date the pages already say to add one');
  assert.equal(scheduleEnding([], '2026-11-10'), '');
  assert.equal(scheduleEnding(['2026-11-03', 'junk', '2026-11-17'], '2026-11-12'), '2026-11-17', 'a bad row is ignored');
});
