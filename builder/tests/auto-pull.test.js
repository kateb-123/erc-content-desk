// builder/tests/auto-pull.test.js: the builder pulls without a button (Kate,
// Oct 7, 2026: "any time you click a date or whatever, you don't need to pull
// something from the desk"). Her answers: it pulls when a date is picked and
// each time that issue opens again, adding only what is new; Remove sends an
// item back to Ready to add on the desk, so a later pull never brings it back;
// a different date over an open draft asks first, then starts fresh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEmptyIssue, countIssueItems } from '../js/model.js';
import { issueForPull } from '../../js/rows-to-issue.js';
import {
  pickNeedsAsk, shouldPull, applyPull, deskRowId, unstampedRow, restampedRow, syncRemoval,
} from '../js/auto-pull.js';

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

function draft(date, titles = []) {
  const issue = createEmptyIssue();
  issue.date = date;
  for (const [n, title] of titles.entries()) {
    issue.sections.headlines.items.push({ id: `desk_r${n}`, group: 'texas', fields: { title, url: `https://x.org/${n}` } });
    issue.sections.headlines.enabled = true;
  }
  return issue;
}

const row = (id, issue, extra = {}) => ({ id, _rowNumber: 2, status: 'kept', newsletter_issue: issue, type: 'headline', subtype: 'Texas', headline: id, link: `https://x.org/${id}`, ...extra });

test('a different date over a draft with items asks first; anything else just picks', () => {
  assert.equal(pickNeedsAsk(draft('October 6, 2026', ['A']), '2026-10-20'), true, 'items under another date');
  assert.equal(pickNeedsAsk(draft('October 6, 2026', ['A']), '2026-10-06'), false, 'the same date');
  assert.equal(pickNeedsAsk(draft('October 6, 2026'), '2026-10-20'), false, 'an empty draft has nothing to lose');
  assert.equal(pickNeedsAsk(draft('', ['A']), '2026-10-20'), false, 'items with no date yet take the first date picked');
  assert.equal(pickNeedsAsk({ ...draft('October 6, 2026', ['A']), sample: 'practice' }, '2026-10-20'), false, 'a sample is never kept, so nothing to ask');
  assert.equal(pickNeedsAsk(null, '2026-10-20'), false);
  const intro = draft('October 6, 2026');
  intro.intro = 'Howdy';
  assert.equal(pickNeedsAsk(intro, '2026-10-20'), true, 'an introduction counts, as it does for Restore');
});

test('an issue pulls when it has a date and is not a sample', () => {
  assert.equal(shouldPull(draft('October 6, 2026')), true);
  assert.equal(shouldPull(draft('')), false);
  assert.equal(shouldPull({ ...draft('October 6, 2026'), sample: 'oct-6-2026' }), false, 'a sample never takes the desk\'s items');
  assert.equal(shouldPull(null), false);
});

test('a pull adds only what is new, keeps the issue\'s own date, and says what it did', () => {
  const issue = draft('October 6, 2026', ['Known']);
  const rows = [row('r0', '2026-10-06', { link: 'https://x.org/0' }), row('r9', '2026-10-06')];
  const reply = { issue: issueForPull(rows, '2026-10-06'), staged: { '2026-10-06': 2 } };
  assert.deepEqual(applyPull(issue, reply, '2026-10-06'), { fresh: 1, message: 'Pulled 1 new from the desk.' });
  assert.equal(countIssueItems(issue), 2);
  assert.equal(issue.date, 'October 6, 2026', 'never the ISO date the pull carries');
  assert.deepEqual(applyPull(issue, reply, '2026-10-06'), { fresh: 0, message: 'Nothing new from the desk.' }, 'the next opening adds nothing twice');
  assert.equal(countIssueItems(issue), 2);
});

test('a first pull counts what came; an empty one points at the issue that has items', () => {
  const issue = draft('October 6, 2026');
  const reply = { issue: issueForPull([row('a', '2026-10-06'), row('b', '2026-10-06')], '2026-10-06'), staged: {} };
  assert.deepEqual(applyPull(issue, reply, '2026-10-06'), { fresh: 2, message: 'Pulled 2 from the desk.' });
  const empty = draft('October 13, 2026');
  const none = { issue: issueForPull([], '2026-10-13'), staged: { '2026-10-20': 3, '2026-10-06': 2 } };
  assert.deepEqual(applyPull(empty, none, '2026-10-13'), { fresh: 0, message: 'Nothing on the desk for October 13, 2026 yet. October 6, 2026 has 2.' });
  assert.deepEqual(applyPull(empty, { issue: issueForPull([], '2026-10-13'), staged: {} }, '2026-10-13'), { fresh: 0, message: 'Nothing on the desk for October 13, 2026 yet.' });
});

test('the desk row behind an item: a pulled item\'s id, a hand-added item\'s deskId, else none', () => {
  assert.equal(deskRowId({ id: 'desk_r42' }), 'r42');
  assert.equal(deskRowId({ id: 'misc_k1_1', deskId: 'r7' }), 'r7');
  assert.equal(deskRowId({ id: 'misc_k1_2' }), '');
  assert.equal(deskRowId(null), '');
});

test('Remove clears the stamp only when the row is still stamped for this issue', () => {
  const rows = [row('r1', '2026-10-06'), row('r2', '2026-10-20'), row('r3', '')];
  assert.deepEqual(unstampedRow(rows, { id: 'desk_r1' }, '2026-10-06'), { ...rows[0], newsletter_issue: '' });
  assert.equal(unstampedRow(rows, { id: 'desk_r2' }, '2026-10-06'), null, 'moved to another issue on the desk: left alone');
  assert.equal(unstampedRow(rows, { id: 'desk_r3' }, '2026-10-06'), null, 'already back in Ready to add');
  assert.equal(unstampedRow(rows, { id: 'desk_r404' }, '2026-10-06'), null, 'gone from the desk');
  assert.equal(unstampedRow(rows, { id: 'desk_r1' }, ''), null, 'no issue picked');
});

test('Undo puts the stamp back only while the row is still free', () => {
  const rows = [row('r1', ''), row('r2', '2026-10-20'), row('r3', '', { status: 'trashed' })];
  assert.deepEqual(restampedRow(rows, { id: 'desk_r1' }, '2026-10-06'), { ...rows[0], newsletter_issue: '2026-10-06' });
  assert.equal(restampedRow(rows, { id: 'desk_r2' }, '2026-10-06'), null, 'taken by another issue meanwhile');
  assert.equal(restampedRow(rows, { id: 'desk_r3' }, '2026-10-06'), null, 'deleted on the desk meanwhile');
});

test('syncRemoval reads the desk, writes the one row, and never touches the desk for an item it does not know', async () => {
  const saved = [];
  let reads = 0;
  const api = { rows: async () => { reads++; return [row('r1', '2026-10-06')]; }, save: async (rows) => { saved.push(...rows); } };
  assert.equal(await syncRemoval({ id: 'desk_r1' }, { issueIso: '2026-10-06', removed: true, api }), true);
  assert.deepEqual(saved.map((r) => [r.id, r.newsletter_issue]), [['r1', '']]);
  assert.equal(await syncRemoval({ id: 'misc_k1_9' }, { issueIso: '2026-10-06', removed: true, api }), false);
  assert.equal(reads, 1, 'an item with no desk row costs no read');
  assert.equal(await syncRemoval({ id: 'desk_r1' }, { issueIso: '2026-10-20', removed: true, api }), false, 'stamped for another issue: nothing written');
  assert.equal(saved.length, 1);
});

test('the builder has no Pull button: a date pick and an opened draft pull on their own', () => {
  assert.doesNotMatch(app, /button\('Pull from the desk'/, 'the button is gone');
  assert.doesNotMatch(app, /pullBtn/);
  assert.match(app, /function pullIssue\(/);
  // The date list's change pulls, or asks first over an open draft.
  assert.match(app, /pickNeedsAsk\(state\.issue, iso\)/);
  assert.match(app, /function openDraft\(issue\) \{[\s\S]*?if \(shouldPull\(issue\)\) pullIssue\(\);[\s\S]*?\n\}/, 'Restore and Recently discarded open and pull');
  // A failed pull keeps its Retry, the one way to ask again.
  assert.match(app, /inlineNote\('error', "Couldn't reach the desk\.", pullIssue\)/);
});

test('Remove and Undo tell the desk, one write after another, and a sample never does', () => {
  assert.match(app, /function deleteItemWithUndo[\s\S]*?tellDesk\(entry\.item, true\)/);
  assert.match(app, /function undoRemove[\s\S]*?tellDesk\(item, false\)/);
  assert.match(app, /function tellDesk\(item, removed\) \{[\s\S]*?if \(state\.issue\?\.sample\) return;/);
  assert.match(app, /deskWrites = deskWrites\.then\(/, 'serialized, so a quick Undo never lands before its Remove');
});
