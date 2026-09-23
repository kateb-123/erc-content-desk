import test from 'node:test';
import assert from 'node:assert/strict';
import { todayCentral } from '../js/today.js';

// Kate, Sep 23: the desk's "today" is College Station's date, not UTC. In UTC
// the desk ran a day ahead from 7 pm Central (Next issue, Sends in N days, the
// Past group, the Schedule tab).
test('an evening in Central time is still that day, though UTC has moved on', () => {
  assert.equal(todayCentral(new Date('2026-09-24T01:30:00Z')), '2026-09-23');   // 8:30 pm CDT
});

test('just after midnight Central is the new day', () => {
  assert.equal(todayCentral(new Date('2026-09-23T05:30:00Z')), '2026-09-23');   // 12:30 am CDT
});

test('just before midnight Central is still the old day', () => {
  assert.equal(todayCentral(new Date('2026-09-23T04:30:00Z')), '2026-09-22');   // 11:30 pm CDT
});

test('the rule holds in winter, on standard time', () => {
  assert.equal(todayCentral(new Date('2026-12-01T05:30:00Z')), '2026-11-30');   // 11:30 pm CST
});

test('with no date given it answers for now, in the ISO shape', () => {
  assert.match(todayCentral(), /^\d{4}-\d{2}-\d{2}$/);
});

test('no desk page takes the UTC date as today any more', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../js/', import.meta.url);
  for (const f of readdirSync(dir).filter(n => n.endsWith('.js'))) {
    assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)/, `${f} takes the UTC date`);
  }
});
