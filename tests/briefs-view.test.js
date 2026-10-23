// tests/briefs-view.test.js: the Research briefs hub (Kate, Oct 20, 2026,
// her go; docs/research-briefs-handoff.md), round 1. The pure rules: the
// seven stages in her pipeline's order, where a brief stands on them, what
// it waits for in the hub's table, the folder name on the team drive, and
// the table's order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAGES, stepStates, waitsFor, briefSlug, hubRows, briefTitle, stageLabel, notesFile, notesKind, NOTES_MAX, createLock, wordCount, draftProgress, restartDraft, draftWait, UPLOAD_CAP_BYTES } from '../js/briefs-view.js';
import { DRAFT_STEPS } from '../js/brief-draft.js';

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
  assert.deepEqual(notesFile('notes.rtf', 'x'), { ok: false, error: 'Notes come as a .md, .txt or Word .docx file, or pasted in.' });
  assert.deepEqual(notesFile('notes.md', ''), { ok: false, error: 'That file is empty.' });
  assert.deepEqual(notesFile('notes.md', 'a'.repeat(20001)), { ok: false, error: 'That file is over 20,000 characters, more than a brief\'s notes hold. Trim it first.' });
  assert.equal(notesFile('notes.md', 'a'.repeat(20000)).ok, true, 'the limit is the API\'s own, MAX_TEXT');
});

test('createLock: New brief needs the paper and the notes, then waits for the read; the reason says which (Kate, Oct 22: "you should have to upload the paper and notes, then it reads and fills out the byline")', () => {
  assert.equal(createLock({ paper: false, notes: false, reading: false }), 'Choose the paper and your notes first.');
  assert.equal(createLock({ paper: true, notes: false, reading: false }), 'Choose your notes file, or paste them, first.');
  assert.equal(createLock({ paper: false, notes: true, reading: false }), 'Choose the paper first.');
  assert.equal(createLock({ paper: true, notes: true, reading: true }), 'Reading the paper first.');
  assert.equal(createLock({ paper: true, notes: true, reading: false }), '');
  assert.equal(createLock({ paper: true, notes: false, reading: true }), 'Choose your notes file, or paste them, first.', 'the files come before the wait');
});

test('notesKind: a .md, .markdown or .txt is read in the browser, a Word .docx goes to the desk, anything else is nothing (Kate, Oct 22: "text, word or .md? or a copy paste option?")', () => {
  assert.equal(notesKind('holzman-2026-alignment-notes.md'), 'text');
  assert.equal(notesKind('notes.TXT'), 'text');
  assert.equal(notesKind('notes.markdown'), 'text');
  assert.equal(notesKind('Nagro brief notes.docx'), 'word');
  assert.equal(notesKind('notes.DOCX'), 'word');
  assert.equal(notesKind('notes.doc'), '', 'the old Word format is not read');
  assert.equal(notesKind('notes.pdf'), '');
  assert.equal(notesKind(''), '');
});

test('notesFile names the three kinds when it refuses', () => {
  assert.equal(notesFile('notes.pdf', 'x').error, 'Notes come as a .md, .txt or Word .docx file, or pasted in.');
});

test('wordCount counts words the way the brief does', () => {
  assert.equal(wordCount('# Race, Nativity\n\n- linkage: majors to occupations\n'), 6);
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount(null), 0);
});

test('draftProgress: the steps as the running box shows them, done, now and later, the current one in its busy words (round 2)', () => {
  const brief = { stage: 'draft', extra: { draft: { done: ['extract', 'plan', 'visual', 'exec_summary'], step: 'highlights' } } };
  const rows = draftProgress(brief, { running: true });
  assert.deepEqual(rows.map(r => [r.key, r.state]).slice(0, 6), [['extract', 'done'], ['plan', 'done'], ['visual', 'done'], ['exec_summary', 'done'], ['highlights', 'now'], ['introduction', 'later']]);
  assert.equal(rows[4].words, 'Report Highlights');
  assert.equal(rows[0].words, 'Read the paper');
  assert.equal(rows[1].words, 'Plan the pages');
  assert.equal(rows[3].words, 'Executive Summary');
  assert.equal(rows.at(-1).words, 'Put the files together');
  const paused = draftProgress(brief, { running: false });
  assert.equal(paused[4].state, 'later', 'nothing is "now" while nothing runs');
  assert.equal(draftProgress({ stage: 'paper', extra: {} }, { running: false }).every(r => r.state === 'later'), true);
});

test('waitsFor at the draft stage says which step the desk is on, or that it paused', () => {
  const today = '2026-10-22';
  const running = { stage: 'draft', stageAt: '2026-10-22T15:00:00Z', extra: { draft: { done: ['extract'], step: 'plan' } } };
  assert.deepEqual(waitsFor(running, today), { title: 'Drafting', meta: 'Planning the pages, started Oct 22' });
  const paused = { stage: 'draft', stageAt: '2026-10-22T15:00:00Z', extra: { draft: { done: DRAFT_STEPS.slice(0, 4), step: 'research_overview' } } };
  assert.equal(waitsFor(paused, today).meta, 'Writing the brief, Research Overview, started Oct 22');
  assert.deepEqual(waitsFor({ stage: 'draft', stageAt: '2026-10-20T15:00:00Z', extra: {} }, today), { title: 'Drafting', meta: 'started Oct 20' });
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

test('createLock: the paper and a Word file that together would not fit one upload say so (review, Oct 22: the create body has a 4.5 MB cap)', () => {
  assert.equal(createLock({ paper: true, notes: true, reading: false, bytes: UPLOAD_CAP_BYTES }), '');
  assert.equal(createLock({ paper: true, notes: true, reading: false, bytes: UPLOAD_CAP_BYTES + 1 }), 'Together the paper and the Word file are too big for one upload. Shrink the paper, or paste the notes instead.');
  assert.equal(createLock({ paper: true, notes: false, reading: false, bytes: UPLOAD_CAP_BYTES + 1 }), 'Choose your notes file, or paste them, first.', 'the files come first');
});

test('restartDraft: Write it again shows the read as now, not every step as done, before the first call returns (review, Oct 22)', () => {
  const brief = { stage: 'proof', extra: { draft: { done: [...DRAFT_STEPS], step: null, result: { words: 1 }, crops: ['a.png'] } } };
  const again = restartDraft(brief);
  const rows = draftProgress(again, { running: true });
  assert.deepEqual(rows.map(r => r.state), ['now', ...DRAFT_STEPS.slice(1).map(() => 'later')]);
  assert.equal(rows[0].words, 'Read the paper');
  assert.equal(brief.extra.draft.done.length, DRAFT_STEPS.length, 'the brief she holds is untouched');
  assert.equal(again.stage, 'draft');
});

test('draftProgress: once every step is done and the browser is still at work, the wait is the crops (review, Oct 22: two waits with no busy words)', () => {
  const brief = { stage: 'proof', extra: { draft: { done: [...DRAFT_STEPS], step: null } } };
  assert.equal(draftWait(brief, { running: true }), 'Cutting figures');
  assert.equal(draftWait(brief, { running: false }), '');
  assert.equal(draftWait({ stage: 'draft', extra: { draft: { done: ['extract'], step: 'plan' } } }, { running: true }), '');
});

test('draftProgress names the proposal step in the running box', () => {
  const rows = draftProgress({ stage: 'draft', extra: { draft: { done: ['extract', 'plan'], step: 'visual' } } }, { running: true });
  assert.equal(rows[2].key, 'visual');
  assert.equal(rows[2].words, 'Table or chart');
  const done = draftProgress({ stage: 'draft', extra: { draft: { done: ['extract', 'plan', 'visual'] } } });
  assert.equal(done[2].words, 'Table or chart');
  assert.equal(draftProgress({ stage: 'paper', extra: {} })[2].words, 'Table or chart');
});

import { pairFor, cutsToMake } from '../js/briefs-view.js';

const fig = (label, page) => ({ label, page, crop: `figure-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-p${page}.png`, box: null, caption: 'c', rework: 'Prose' });

test('pairFor: theirs is the proposal\'s own source, cut by its own box; the others leave it out (review, Oct 22: the wrong figure was paired on a label mismatch)', () => {
  const figures = [fig('Figure 1', 4), fig('Table 3. Earnings by match', 12)];
  const own = pairFor(figures, { source_label: 'Table 3', page: 12, crop: 'figure-table-3-p12.png', box: { left: 0.1, top: 0.1, right: 0.9, bottom: 0.5 } });
  assert.equal(own.theirs.crop, 'figure-table-3-p12.png');
  assert.equal(own.theirs.label, 'Table 3');
  assert.deepEqual(own.others.map(f => f.label), ['Figure 1'], 'the same table listed by the read is not shown twice');
  const loose = pairFor(figures, { source_label: 'table 3 (panel A)', page: 0, crop: '' });
  assert.equal(loose.theirs.label, 'Table 3. Earnings by match', 'no page of its own: the read\'s cut of the same table');
  const none = pairFor(figures, { source_label: 'Table A9', page: 0, crop: '' });
  assert.equal(none.theirs, null, 'never another table in its place');
  assert.equal(none.others.length, 2);
  assert.deepEqual(pairFor(figures, null), { theirs: null, others: figures });
});

test('cutsToMake: every listed table or figure with a page, and the proposal\'s source, each once, minus what is already cut', () => {
  const figures = [fig('Figure 1', 4), fig('Table 3', 12), fig('Table 9', 0)];
  const visual = { source_label: 'Table 3', page: 12, crop: 'figure-table-3-p12.png', box: { left: 0, top: 0, right: 1, bottom: 0.5 } };
  assert.deepEqual(cutsToMake({ figures, visual }, []).map(c => c.crop), ['figure-figure-1-p4.png', 'figure-table-3-p12.png']);
  assert.deepEqual(cutsToMake({ figures, visual }, []).find(c => c.crop === 'figure-table-3-p12.png').box, visual.box, 'the proposal\'s own box wins');
  assert.deepEqual(cutsToMake({ figures, visual }, ['figure-figure-1-p4.png']).map(c => c.crop), ['figure-table-3-p12.png']);
  assert.deepEqual(cutsToMake({ figures: [], visual: { source_label: 'Table 2', page: 5, crop: 'figure-table-2-p5.png', box: null } }, []).map(c => c.crop), ['figure-table-2-p5.png']);
});

import { bandPill } from '../js/briefs-view.js';

test('bandPill: the word count against 1,300 to 2,000, in two words (Kate\'s copy edit, Oct 22)', () => {
  assert.equal(bandPill(512), '788 short');
  assert.equal(bandPill(1300), 'In range');
  assert.equal(bandPill(2000), 'In range');
  assert.equal(bandPill(2212), '212 over');
  assert.equal(bandPill(0), '1,300 short');
});

test('the running steps read as plain names whatever their state (Kate\'s copy edit, Oct 22)', () => {
  const rows = draftProgress({ stage: 'draft', extra: { draft: { done: ['extract', 'plan'], step: 'visual' } } }, { running: true });
  assert.deepEqual(rows.slice(0, 4).map(r => r.words), ['Read the paper', 'Plan the pages', 'Table or chart', 'Executive Summary']);
  assert.equal(rows.at(-2).words, 'Check against the paper');
  assert.equal(rows.at(-1).words, 'Put the files together');
  assert.equal(draftWait({ stage: 'proof', extra: { draft: { done: [...DRAFT_STEPS] } } }, { running: true }), 'Cutting figures');
});
