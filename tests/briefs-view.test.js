// tests/briefs-view.test.js: the Research briefs hub (Kate, Oct 20, 2026,
// her go; docs/research-briefs-handoff.md), round 1. The pure rules: the
// seven stages in her pipeline's order, where a brief stands on them, what
// it waits for in the hub's table, the folder name on the team drive, and
// the table's order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAGES, stepStates, waitsFor, briefSlug, hubRows, briefTitle, stageLabel, notesFile, NOTES_MAX } from '../js/briefs-view.js';

test('the seven stages, in her order, the last two round two', () => {
  assert.deepEqual(STAGES.map(s => [s.key, s.label, Boolean(s.later)]), [
    ['paper', 'Paper and notes', false],
    ['draft', 'Draft', false],
    ['proof', 'Your proof', false],
    ['author', 'With author', false],
    ['approved', 'Approved', false],
    ['html', 'HTML', true],
    ['live', 'Live', true],
  ]);
  assert.equal(stageLabel('proof'), 'Your proof');
  assert.equal(stageLabel('nope'), '');
});

test('stepStates: done before the stage, now at it, later after', () => {
  assert.deepEqual(stepStates('proof').map(s => `${s.key}:${s.state}`),
    ['paper:done', 'draft:done', 'proof:now', 'author:later', 'approved:later', 'html:later', 'live:later']);
  assert.deepEqual(stepStates('live').map(s => s.state), ['done', 'done', 'done', 'done', 'done', 'done', 'now']);
  assert.deepEqual(stepStates('paper').map(s => s.state), ['now', 'later', 'later', 'later', 'later', 'later', 'later']);
  assert.deepEqual(stepStates('').map(s => s.state), ['now', 'later', 'later', 'later', 'later', 'later', 'later'], 'an unknown stage reads as the first');
});

const brief = over => ({
  id: 'reveille-2026-yell', title: '', paperTitle: 'Yell leaders and attendance', authors: 'Reveille and Sully',
  journal: 'Journal of Pretend Education', year: 2026, stage: 'paper', stageAt: '2026-10-19T14:00:00Z',
  createdAt: '2026-10-19T14:00:00Z', words: 0, authorOfRecord: 'Dr. Reveille', ...over,
});

test('waitsFor: what the hub\'s table says a brief waits for, stage by stage', () => {
  const today = '2026-10-20';
  assert.deepEqual(waitsFor(brief({ stage: 'paper' }), today), { title: 'Write the draft', meta: 'paper and notes in, Oct 19' });
  assert.deepEqual(waitsFor(brief({ stage: 'draft', stageAt: '2026-10-20T15:00:00Z' }), today), { title: 'Drafting', meta: 'started Oct 20' });
  assert.deepEqual(waitsFor(brief({ stage: 'proof', stageAt: '2026-10-20T15:00:00Z', words: 1480 }), today), { title: 'Your Grammarly pass', meta: 'drafted Oct 20, 1,480 words' });
  assert.deepEqual(waitsFor(brief({ stage: 'author', stageAt: '2026-10-02T15:00:00Z' }), today), { title: "Dr. Reveille's edits", meta: 'sent Oct 2, 18 days' });
  assert.deepEqual(waitsFor(brief({ stage: 'author', stageAt: '2026-10-19T15:00:00Z', authorOfRecord: '' }), today), { title: "The author's edits", meta: 'sent Oct 19, 1 day' });
  assert.deepEqual(waitsFor(brief({ stage: 'approved', stageAt: '2026-10-18T15:00:00Z' }), today), { title: 'The HTML, round two', meta: 'approved Oct 18' });
  assert.deepEqual(waitsFor(brief({ stage: 'live', stageAt: '2026-09-30T15:00:00Z' }), today), { title: 'Live', meta: 'Sep 30' });
});

test('briefSlug: the author\'s last name, the year and a topic word, as a folder name (her pick, Oct 20)', () => {
  assert.equal(briefSlug({ authorLast: 'Holzman', year: '2026', topic: 'Alignment' }), 'holzman-2026-alignment');
  assert.equal(briefSlug({ authorLast: 'De La Cruz', year: 2024, topic: 'clinical teaching' }), 'de-la-cruz-2024-clinical-teaching');
  assert.equal(briefSlug({ authorLast: "O'Brien", year: '2026', topic: '' }), 'obrien-2026', 'no topic, no trailing dash');
  assert.equal(briefSlug({ authorLast: '', year: '2026', topic: 'x' }), '', 'no author, no name');
  assert.equal(briefSlug({ authorLast: 'Svajda-Hardy', year: '26', topic: 'x' }), '', 'the year is four digits');
});

test('notesFile: her notes as a dropped .md or .txt fill the notes box; anything else is refused with a reason (Kate, Oct 22: "i just want to upload my md")', () => {
  assert.deepEqual(notesFile('holzman-2026-alignment-notes.md', '# Race, Nativity\n\n- linkage\n'), { ok: true, notes: '# Race, Nativity\n\n- linkage' });
  assert.deepEqual(notesFile('notes.TXT', '  plain words  '), { ok: true, notes: 'plain words' });
  assert.deepEqual(notesFile('notes.markdown', 'x'), { ok: true, notes: 'x' });
  assert.deepEqual(notesFile('notes.docx', 'x'), { ok: false, error: 'Notes come as a .md or .txt file. Save the Word file as text first.' });
  assert.deepEqual(notesFile('notes.md', ''), { ok: false, error: 'That file is empty.' });
  assert.deepEqual(notesFile('notes.md', 'a'.repeat(20001)), { ok: false, error: 'That file is over 20,000 characters, more than a brief\'s notes hold. Trim it first.' });
  assert.equal(notesFile('notes.md', 'a'.repeat(20000)).ok, true, 'the limit is the API\'s own, MAX_TEXT');
});

test('briefTitle: her title once there is one, the paper\'s until then', () => {
  assert.equal(briefTitle(brief()), 'Yell leaders and attendance');
  assert.equal(briefTitle(brief({ title: "Gig 'em and Go" })), "Gig 'em and Go");
  assert.equal(briefTitle(brief({ title: '', paperTitle: '' })), 'reveille-2026-yell');
});

test('hubRows: in progress first by stage then by when it moved, live last, each with its steps and what it waits for', () => {
  const rows = hubRows([
    brief({ id: 'a', stage: 'live', stageAt: '2026-09-30T00:00:00Z' }),
    brief({ id: 'b', stage: 'author', stageAt: '2026-10-02T00:00:00Z' }),
    brief({ id: 'c', stage: 'paper', stageAt: '2026-10-19T00:00:00Z' }),
    brief({ id: 'd', stage: 'proof', stageAt: '2026-10-20T00:00:00Z' }),
    brief({ id: 'e', stage: 'paper', stageAt: '2026-10-15T00:00:00Z' }),
  ], '2026-10-20');
  assert.deepEqual(rows.map(r => r.id), ['e', 'c', 'd', 'b', 'a'], 'earliest stage first, the older one of two first, live last');
  assert.equal(rows[2].steps.find(s => s.state === 'now').key, 'proof');
  assert.equal(rows[2].waits.title, 'Your Grammarly pass');
  assert.equal(rows[0].href, '/#briefs/e');
});

test('in the hub\'s table only the current step is named; the brief\'s page names them all (Kate, Oct 21, her pick A)', () => {
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.steps-small \.step-words \{ display: none; \}/);
  assert.match(css, /\.steps-small \.step\.is-now \.step-words \{ display: block; \}/);
});
