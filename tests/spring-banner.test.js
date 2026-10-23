import test from 'node:test';
import assert from 'node:assert/strict';
import { dayAfterThanksgiving, springDatesDue, snoozeUntil, addDays } from '../js/spring-banner.js';

test('the day after Thanksgiving, the fourth Thursday of November', () => {
  assert.equal(dayAfterThanksgiving(2026), '2026-11-27');
  assert.equal(dayAfterThanksgiving(2025), '2025-11-28');
  assert.equal(dayAfterThanksgiving(2027), '2027-11-26');
});

// Kate, Oct 23: from the day after Thanksgiving, a note under the top bar until the spring dates are on the schedule.
test('due from the day after Thanksgiving while no date in the next year is on the schedule', () => {
  const fall = ['2026-11-03', '2026-11-17', '2026-12-15'];
  assert.equal(springDatesDue(fall, '2026-11-26'), false);
  assert.equal(springDatesDue(fall, '2026-11-27'), true);
  assert.equal(springDatesDue(fall, '2026-12-20'), true);
  assert.equal(springDatesDue([...fall, '2027-01-12'], '2026-11-27'), false);
});

test('due once the dates run out, any time of year', () => {
  assert.equal(springDatesDue(['2026-12-15'], '2027-01-05'), true);
  assert.equal(springDatesDue(['2027-01-12', '2027-05-04'], '2027-02-01'), false);
});

test('never due before the schedule has loaded', () => {
  assert.equal(springDatesDue([], '2026-12-01'), false);
});

test('a snooze hides it until its day', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(snoozeUntil('2026-12-01', '2026-11-30'), true);
  assert.equal(snoozeUntil('2026-12-01', '2026-12-01'), false);
  assert.equal(snoozeUntil('', '2026-12-01'), false);
});
