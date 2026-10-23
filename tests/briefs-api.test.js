// tests/briefs-api.test.js: /api/briefs, round 1 (Kate, Oct 20, 2026): the
// hub's list, one brief, New brief (the paper and her notes into a folder of
// its own on the team drive, through the Sheet's script), and her notes
// saved again. Kate only: every call needs the sign-in. The store is a
// table of its own, made by ensure-schema on her word.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBriefs, BRIEFS_SCHEMA, MAX_PAPER_BYTES } from '../api/_lib/briefs.js';
import { createBriefsHandler } from '../api/briefs.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

/** A query recorder: answers canned rows, keeps every statement. */
function recorder(answers = []) {
  const calls = [];
  const query = async (text, params = []) => { calls.push({ text: text.replace(/\s+/g, ' ').trim(), params }); return answers.shift() ?? []; };
  return { query, calls };
}

const ROW = {
  id: 'reveille-2026-yell', title: '', paper_title: 'Yell leaders and attendance', authors: 'Reveille and Sully', journal: 'Journal of Pretend Education',
  year: 2026, design: '', author_of_record: 'Dr. Reveille', stage: 'paper', stage_at: new Date('2026-10-19T14:00:00Z'), created_at: new Date('2026-10-19T14:00:00Z'),
  folder_id: 'fld1', folder_url: 'https://drive.google.com/drive/folders/fld1', paper_name: 'reveille.pdf', notes: 'Lead with attendance.', words: 0, extra: {},
};

test('the schema is one table, briefs, with the stage and the folder on it', () => {
  assert.match(BRIEFS_SCHEMA, /CREATE TABLE IF NOT EXISTS briefs/);
  for (const col of ['id text PRIMARY KEY', 'stage text', 'stage_at timestamptz', 'folder_id text', 'folder_url text', 'paper_name text', 'notes text', 'words integer', 'extra jsonb']) {
    assert.ok(BRIEFS_SCHEMA.includes(col), col);
  }
  const db = read('../api/_lib/db.js');
  assert.match(db, /import \{ BRIEFS_SCHEMA \} from '\.\/briefs\.js';/);
  assert.match(db, /await query\(BRIEFS_SCHEMA\);/, 'ensure-schema makes it');
  assert.match(read('../scripts/ensure-schema.js'), /briefs/);
});

test('createBriefs: list, get, create and update, every row the same shape', async () => {
  const { query, calls } = recorder([[ROW], [ROW], [], [{ ...ROW, notes: 'New notes' }]]);
  const briefs = createBriefs(query, { now: () => new Date('2026-10-20T15:00:00Z').getTime() });
  const list = await briefs.list();
  assert.deepEqual(list[0], {
    id: 'reveille-2026-yell', title: '', paperTitle: 'Yell leaders and attendance', authors: 'Reveille and Sully', journal: 'Journal of Pretend Education', year: 2026, design: '',
    authorOfRecord: 'Dr. Reveille', stage: 'paper', stageAt: '2026-10-19T14:00:00.000Z', createdAt: '2026-10-19T14:00:00.000Z',
    folderId: 'fld1', folderUrl: 'https://drive.google.com/drive/folders/fld1', paperName: 'reveille.pdf', notes: 'Lead with attendance.', words: 0, extra: {},
  });
  assert.match(calls[0].text, /SELECT .* FROM briefs ORDER BY/);
  assert.equal((await briefs.get('reveille-2026-yell')).id, 'reveille-2026-yell');
  await briefs.create({ id: 'x-2026-y', paperTitle: 'P', authors: 'A', journal: '', year: 2026, authorOfRecord: 'Dr. X', folderId: 'f', folderUrl: 'u', paperName: 'p.pdf', notes: 'n' });
  assert.match(calls[2].text, /INSERT INTO briefs/);
  assert.ok(calls[2].params.includes('paper'), 'a new brief starts at the paper stage');
  const updated = await briefs.update('reveille-2026-yell', { notes: 'New notes' });
  assert.equal(updated.notes, 'New notes');
  assert.match(calls[3].text, /UPDATE briefs SET notes = \$1/);
});

function fakeRes() {
  return { code: 0, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
}

/** The handler over fakes: a session that holds (or not), a store, the Sheet's script. */
function handlerWith({ signedIn = true, rows = [ROW], script = {}, readModel = async () => '{}', wordToMarkdown = async () => '' } = {}) {
  const saved = [];
  const store = {
    async list() { return rows.map(r => ({ id: r.id, stage: r.stage })); },
    async get(id) { const r = rows.find(x => x.id === id); return r ? { id: r.id, stage: r.stage, folderId: r.folder_id, notes: r.notes } : null; },
    async create(b) { saved.push(['create', b]); return { ...b, stage: 'paper' }; },
    async update(id, patch) { saved.push(['update', id, patch]); return { id, ...patch }; },
  };
  const drive = {
    briefFolder: async name => { saved.push(['folder', name]); return { id: 'fld-' + name, url: 'https://drive/' + name }; },
    saveFile: async f => { saved.push(['file', f.folderId, f.name, f.contentType]); return { ok: true, url: 'u' }; },
    listFiles: async folderId => (script.listFails ? Promise.reject(new Error('no drive')) : [{ name: 'reveille.pdf', updated: '2026-10-19', url: 'u', size: 1000 }]),
  };
  const handler = createBriefsHandler({ session: { refuse: async (req, res) => { if (signedIn) return false; res.status(401).json({ ok: false, error: 'Sign in to the desk first.' }); return true; } }, briefs: () => store, drive, mode: () => 'db', readModel, wordToMarkdown });
  return { handler, saved };
}

test('every door needs the sign-in', async () => {
  const { handler } = handlerWith({ signedIn: false });
  for (const req of [{ method: 'GET', query: { list: '1' }, body: {} }, { method: 'POST', query: {}, body: { action: 'notes', id: 'x', notes: '' } }]) {
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.code, 401);
  }
});

test('GET ?list lists; GET ?id= gives one with its folder\'s files, and a Drive miss leaves the files out rather than failing', async () => {
  const { handler } = handlerWith();
  const res = fakeRes();
  await handler({ method: 'GET', query: { list: '1' }, body: {} }, res);
  assert.deepEqual(res.body, { ok: true, briefs: [{ id: 'reveille-2026-yell', stage: 'paper' }] });
  const one = fakeRes();
  await handler({ method: 'GET', query: { id: 'reveille-2026-yell' }, body: {} }, one);
  assert.equal(one.body.brief.id, 'reveille-2026-yell');
  assert.deepEqual(one.body.files, [{ name: 'reveille.pdf', updated: '2026-10-19', url: 'u', size: 1000 }]);
  const miss = fakeRes();
  await handlerWith({ script: { listFails: true } }).handler({ method: 'GET', query: { id: 'reveille-2026-yell' }, body: {} }, miss);
  assert.equal(miss.code, 200);
  assert.deepEqual(miss.body.files, null, 'files unknown, not an error');
  const gone = fakeRes();
  await handler({ method: 'GET', query: { id: 'nope' }, body: {} }, gone);
  assert.equal(gone.code, 404);
});

const PDF = Buffer.from('%PDF-1.4 fake').toString('base64');

test('create: a folder on the team drive named by her rule, the paper and notes.md filed in it, the row at the paper stage', async () => {
  const { handler, saved } = handlerWith({ rows: [] });
  const res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'create', authorLast: 'Reveille', year: '2026', topic: 'yell', paperTitle: 'Yell leaders and attendance', authors: 'Reveille and Sully', journal: 'Journal of Pretend Education', authorOfRecord: 'Dr. Reveille', paperName: 'yell leaders (final).PDF', paperB64: PDF, notes: 'Lead with attendance.' } }, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(res.body.brief.id, 'reveille-2026-yell');
  assert.deepEqual(saved[0], ['folder', 'reveille-2026-yell']);
  assert.deepEqual(saved[1], ['file', 'fld-reveille-2026-yell', 'yell-leaders-final.pdf', 'application/pdf'], 'the paper, its name made plain');
  assert.deepEqual(saved[2], ['file', 'fld-reveille-2026-yell', 'notes.md', 'text/markdown']);
  assert.equal(saved[3][0], 'create');
  assert.equal(saved[3][1].folderUrl, 'https://drive/reveille-2026-yell');
  assert.equal(saved[3][1].paperName, 'yell-leaders-final.pdf');
});

test('create: refuses a missing paper, a bad name, a paper too big, and a folder already taken', async () => {
  const base = { action: 'create', authorLast: 'Reveille', year: '2026', topic: 'yell', paperTitle: 'P', paperName: 'p.pdf', paperB64: PDF, notes: '' };
  const cases = [
    [{ ...base, paperB64: '' }, /paper/i],
    [{ ...base, paperName: 'p.docx' }, /PDF/],
    [{ ...base, authorLast: '' }, /last name/i],
    [{ ...base, paperB64: Buffer.alloc(MAX_PAPER_BYTES + 1).toString('base64') }, /3 MB/],
  ];
  for (const [body, want] of cases) {
    const res = fakeRes();
    await handlerWith({ rows: [] }).handler({ method: 'POST', query: {}, body }, res);
    assert.equal(res.code, 400, JSON.stringify(body).slice(0, 80));
    assert.match(res.body.error, want);
  }
  const taken = fakeRes();
  await handlerWith().handler({ method: 'POST', query: {}, body: base }, taken);
  assert.equal(taken.code, 409);
  assert.match(taken.body.error, /already/);
});

test('notes: saved on the row and as notes.md in the folder', async () => {
  const { handler, saved } = handlerWith();
  const res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'notes', id: 'reveille-2026-yell', notes: 'Table 2 is the visual.' } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(saved[0], ['file', 'fld1', 'notes.md', 'text/markdown']);
  assert.deepEqual(saved[1], ['update', 'reveille-2026-yell', { notes: 'Table 2 is the visual.' }]);
});

test('the Sheet\'s script gained the briefs doors, and sheets.js wraps them', () => {
  const gs = read('../apps-script/Code.gs');
  for (const action of ["case 'briefFolder':", "case 'listFiles':", "case 'getFile':"]) assert.ok(gs.includes(action), action);
  assert.match(gs, /BRIEFS_FOLDER_ID/, 'the Research briefs folder\'s id is a script property');
  assert.match(gs, /\(xlsx\|txt\|pdf\|md\|docx\|png\|jpg\|jpeg\)/, 'saveFile takes a paper, notes, a Word doc and a picture');
  const sheets = read('../api/_lib/sheets.js');
  for (const fn of ['export async function briefFolder(', 'export async function listFiles(', 'export async function getFile(']) assert.ok(sheets.includes(fn), fn);
  assert.match(read('../README.md'), /BRIEFS_FOLDER_ID/);
});

test('POST read: the paper\'s first pages as text go to the model, and the fields come back shaped (Kate, Oct 22: "id rather it read it and filled it in")', async () => {
  const asked = [];
  const readModel = async prompt => { asked.push(prompt); return '{"title":" Screen or Barrier? Science of Reading Certification Exams and Teacher Supply in Texas ","authors":"Andrew Avitabile","journal":"","year":"2026","firstAuthorLast":"Avitabile"}'; };
  const { handler } = handlerWith({ readModel });
  const res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'read', text: 'Screen or Barrier? Science of Reading Certification Exams and Teacher Supply in Texas\nAndrew Avitabile\nUniversity of Virginia\nLast Updated October 5, 2026' } }, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.fields, { title: 'Screen or Barrier? Science of Reading Certification Exams and Teacher Supply in Texas', authors: 'Andrew Avitabile', journal: '', year: '2026', firstAuthorLast: 'Avitabile' });
  assert.equal(asked.length, 1);
  assert.match(asked[0], /Andrew Avitabile/);
});

test('POST read refuses an empty text, and a model reply that is not JSON is a plain failure, not a crash', async () => {
  const { handler } = handlerWith({ readModel: async () => 'Sorry, I cannot do that.' });
  let res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'read', text: '   ' } }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /nothing to read/i);
  res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'read', text: 'some paper' } }, res);
  assert.equal(res.code, 502);
  assert.match(res.body.error, /read the paper/i);
});

test('POST read needs the sign-in like every other door', async () => {
  const { handler } = handlerWith({ signedIn: false, readModel: async () => '{}' });
  const res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'read', text: 'some paper' } }, res);
  assert.equal(res.code, 401);
});

test('POST notes-text: a Word .docx goes up as base64 and comes back as markdown notes, through the desk\'s Word reader (Kate, Oct 22: "what if someone wants to upload a word doc?")', async () => {
  const asked = [];
  const wordToMarkdown = async buffer => { asked.push(buffer.length); return '# Nagro notes\n\n- lead with the survey\\.\n\nTable 2 \\(columns 2 and 4\\) is the visual\\.\n'; };
  const { handler } = handlerWith({ wordToMarkdown });
  const res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'notes-text', name: 'Nagro brief notes.docx', b64: Buffer.from('PK fake docx bytes').toString('base64') } }, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(res.body.notes, '# Nagro notes\n\n- lead with the survey.\n\nTable 2 (columns 2 and 4) is the visual.', 'the reader\'s markdown escapes are gone');
  assert.deepEqual(asked, ['PK fake docx bytes'.length]);
});

test('POST notes-text refuses what is not a .docx, an empty file, and a Word file the reader cannot open', async () => {
  const { handler } = handlerWith({ wordToMarkdown: async () => { throw new Error('not a docx'); } });
  let res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'notes-text', name: 'notes.pdf', b64: 'eA==' } }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /\.docx/);
  res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'notes-text', name: 'notes.docx', b64: '' } }, res);
  assert.equal(res.code, 400);
  res = fakeRes();
  await handler({ method: 'POST', query: {}, body: { action: 'notes-text', name: 'notes.docx', b64: 'eA==' } }, res);
  assert.equal(res.code, 502);
  assert.match(res.body.error, /read that Word file/i);
});

test('POST create keeps the original Word file beside notes.md when the notes came as a .docx', async () => {
  const { handler, saved } = handlerWith({ rows: [] });
  const res = fakeRes();
  await handler({ method: 'POST', query: {}, body: {
    action: 'create', authorLast: 'Nagro', year: '2026', topic: 'reading', paperName: 'nagro.pdf', paperB64: Buffer.from('%PDF-1.4 x').toString('base64'),
    notes: '# Nagro notes', notesName: 'Nagro brief notes.docx', notesB64: Buffer.from('PK fake docx').toString('base64'),
  } }, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  const files = saved.filter(s => s[0] === 'file').map(s => s.slice(2));
  assert.deepEqual(files, [['nagro.pdf', 'application/pdf'], ['notes.md', 'text/markdown'], ['notes-original.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']]);
});

test('POST create ignores a notes original that is not a .docx (a .md original is notes.md already)', async () => {
  const { handler, saved } = handlerWith({ rows: [] });
  const res = fakeRes();
  await handler({ method: 'POST', query: {}, body: {
    action: 'create', authorLast: 'Nagro', year: '2026', topic: 'reading', paperName: 'nagro.pdf', paperB64: Buffer.from('%PDF-1.4 x').toString('base64'),
    notes: '# Nagro notes', notesName: 'notes.md', notesB64: Buffer.from('# Nagro notes').toString('base64'),
  } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(saved.filter(s => s[0] === 'file').map(s => s[2]), ['nagro.pdf', 'notes.md']);
});

test('POST create: a Drive refusal is a plain 502, never a crash; an unknown action on the Sheet\'s script says the script is old (live, Oct 22: "Unknown action: briefFolder" came back as a 500)', async () => {
  const { handler } = handlerWith({ rows: [] });
  const bad = createBriefsHandler({
    session: { refuse: async () => false }, briefs: () => ({ async get() { return null; }, async list() { return []; }, async create(b) { return b; }, async update() { return {}; } }),
    drive: { briefFolder: async () => { throw new Error('Sheet API error: Unknown action: briefFolder'); }, saveFile: async () => ({}), listFiles: async () => [] }, mode: () => 'db',
  });
  const res = fakeRes();
  await bad({ method: 'POST', query: {}, body: { action: 'create', authorLast: 'Holzman', year: '2026', topic: 'alignment', paperName: 'h.pdf', paperB64: Buffer.from('%PDF').toString('base64'), notes: 'n' } }, res);
  assert.equal(res.code, 502);
  assert.match(res.body.error, /Sheet's script does not know this action yet/);
  assert.match(res.body.error, /Code\.gs/);
  const other = createBriefsHandler({
    session: { refuse: async () => false }, briefs: () => ({ async get() { return null; }, async list() { return []; }, async create(b) { return b; }, async update() { return {}; } }),
    drive: { briefFolder: async () => { throw new Error('Sheet API error: You do not have permission to call DriveApp.getFolderById'); }, saveFile: async () => ({}), listFiles: async () => [] }, mode: () => 'db',
  });
  const res2 = fakeRes();
  await other({ method: 'POST', query: {}, body: { action: 'create', authorLast: 'Holzman', year: '2026', topic: 'alignment', paperName: 'h.pdf', paperB64: Buffer.from('%PDF').toString('base64'), notes: 'n' } }, res2);
  assert.equal(res2.code, 502);
  assert.match(res2.body.error, /couldn't do that: Sheet API error/);
  void handler;
});

// ---- Round 2: the draft (Kate, Oct 22, her Go) ----
import { DRAFT_STEPS, EXTRACT_PROMPT } from '../js/brief-draft.js';

/** A store that keeps state across steps, and a drive that records files and hands the paper back. */
function draftWorld({ extra = {}, model } = {}) {
  const rows = new Map([['holzman-2026-alignment', { id: 'holzman-2026-alignment', title: '', paperTitle: 'Race, Nativity', authors: 'Brian Holzman and Jeehee Han', journal: 'AERA Open', year: 2026, design: '', authorOfRecord: 'Dr. Holzman', stage: 'paper', stageAt: '2026-10-22T10:00:00.000Z', createdAt: '2026-10-22T10:00:00.000Z', folderId: 'fld-1', folderUrl: 'https://drive/fld-1', paperName: 'holzman.pdf', notes: 'Lead with the match premium.', words: 0, extra }]]);
  const files = [];
  const calls = [];
  const store = {
    async list() { return [...rows.values()]; },
    async get(id) { return rows.get(id) ? { ...rows.get(id) } : null; },
    async create(b) { rows.set(b.id, { ...b, stage: 'paper', extra: b.extra ?? {} }); return rows.get(b.id); },
    async update(id, patch) { rows.set(id, { ...rows.get(id), ...patch }); return { ...rows.get(id) }; },
  };
  const drive = {
    briefFolder: async name => ({ id: 'fld-' + name, url: 'https://drive/' + name }),
    saveFile: async f => { files.push([f.name, f.contentType, f.b64 ? Buffer.from(f.b64, 'base64').toString('utf8').slice(0, 40) : '', f.sub ?? '']); return { ok: true, url: 'u' }; },
    listFiles: async () => [],
    getFile: async (folderId, name, opts = {}) => (/\.png$/.test(name)
      ? { name, contentType: 'image/png', b64: Buffer.from(`png of ${name} in ${opts.sub ?? ''}`).toString('base64') }
      : { name, contentType: 'application/pdf', b64: Buffer.from('%PDF-1.4 the paper').toString('base64') }),
  };
  const extractJson = JSON.stringify({ title: 'Race, Nativity, and the Labor Market Returns to College Major-Occupation Alignment', authors: ['Brian Holzman', 'Jeehee Han'], journal: 'AERA Open', year: 2026, design: 'observational', research_questions: ['q'], sample: 's', methods_summary: 'm', key_numbers: [{ value: '1,366,603', context: 'workers, p. 8' }], findings: [{ title: 'Match pays', summary: 'Matched workers earn more.' }], policy_recommendations: ['r'], apa_citation: 'Holzman, B., & Han, J. (2026). Race, nativity. AERA Open.', recommended_visuals: [{ kind: 'table', source_label: 'Table 3', page: 12, why: 'the premium', suggested_caption: 'Earnings by match', box: { left: 0.1, top: 0.2, right: 0.9, bottom: 0.6 } }], number_flags: [] });
  const visualJson = JSON.stringify({ kind: 'table', source_label: 'Table 3', page: 12, box: { left: 0.1, top: 0.2, right: 0.9, bottom: 0.6 }, title: 'Matched workers earned more', kept: 'Kept: the two groups. Left out: the controls.', columns: ['Workers', 'Median earnings'], rows: [['Matched', '$52,000'], ['Not matched', '$44,000']], value_label: '', value_format: 'number', bars: [] });
  const draftModel = model ?? (async ({ prompt, schema, maxTokens, effort }) => {
    calls.push({ prompt, schema: Boolean(schema), maxTokens, effort });
    if (prompt.startsWith('Do a deep, close reading')) return extractJson;
    if (/TASK: Build the brief's one visual/.test(prompt)) return visualJson;
    if (/TASK: Write the page plan/.test(prompt)) return '# Page Plan: Holzman (2026)\n\nSuggested brief title: Majors That Lead Somewhere\n\n## Plan\n| Page | Content |\n|---|---|\n| Cover | Exec |\n';
    if (/Below is a complete ERC research brief draft/.test(prompt)) return JSON.stringify({ sections: [{ key: 'exec_summary', content: 'Checked exec. This brief summarizes a research study in AERA Open.' }], flags: [{ section: 'key_findings', note: 'Could not find 2.1%.' }] });
    const m = /TASK: (?:Write|Produce) (?:the )?([A-Za-z ]+?)(?: as|[.:])/.exec(prompt);
    return `${m ? m[1] : 'Section'} words.`;
  });
  const handler = createBriefsHandler({ session: { refuse: async () => false }, briefs: () => store, drive, mode: () => 'db', draftModel, now: () => new Date('2026-10-22T16:00:00.000Z').getTime() });
  return { handler, store, files, calls, rows };
}

const post = (handler, body) => { const res = fakeRes(); return handler({ method: 'POST', query: {}, body }, res).then(() => res); };

test('POST draft: the first step is the deep read; the extract is kept on the brief and as extract.md, the brief author too, the stage moves to draft, and the next step is the plan', async () => {
  const { handler, files, calls } = draftWorld();
  const res = await post(handler, { action: 'draft', id: 'holzman-2026-alignment', briefAuthor: 'Kate Barnes' });
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(res.body.step, 'extract');
  assert.equal(res.body.next, 'plan');
  assert.equal(res.body.brief.stage, 'draft');
  assert.equal(res.body.brief.extra.briefAuthor, 'Kate Barnes');
  assert.equal(res.body.brief.extra.draft.extract.design, 'observational');
  assert.deepEqual(res.body.brief.extra.draft.done, ['extract']);
  assert.equal(calls[0].schema, true);
  assert.ok(calls[0].prompt.startsWith(EXTRACT_PROMPT.slice(0, 40)));
  assert.deepEqual(files.map(f => f[0]), ['extract.md']);
  assert.match(files[0][2], /^# What the desk read from the paper/);
});

test('POST draft walks every step to the end: plan with its title and page-plan.md, each section with the ones before it, the check replacing what it corrected, then the four files, the words and the proof stage', async () => {
  const { handler, files, calls, rows } = draftWorld();
  let res;
  for (let i = 0; i < DRAFT_STEPS.length; i++) {
    res = await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });
    assert.equal(res.code, 200, `${DRAFT_STEPS[i]}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.step, DRAFT_STEPS[i]);
  }
  assert.equal(res.body.next, null);
  const brief = rows.get('holzman-2026-alignment');
  assert.equal(brief.extra.draft.title, 'Majors That Lead Somewhere');
  assert.equal(brief.extra.draft.sections.exec_summary, 'Checked exec. This brief summarizes a research study in AERA Open.', 'the check\'s correction took');
  assert.equal(brief.extra.draft.sections.key_findings, 'Key Findings words.');
  assert.deepEqual(brief.extra.draft.checkFlags, [{ section: 'key_findings', note: 'Could not find 2.1%.' }]);
  assert.equal(brief.stage, 'proof');
  assert.equal(brief.stageAt, '2026-10-22T16:00:00.000Z');
  assert.ok(brief.words > 0);
  assert.ok(brief.extra.draft.result.draft.startsWith('# Majors That Lead Somewhere\n\n**ERC Research Brief | October 2026**'));
  assert.match(brief.extra.draft.result.grammarly, /^Majors That Lead Somewhere\n\nExecutive Summary\n/);
  assert.equal(brief.extra.draft.result.figures[0].crop, 'figure-table-3-p12.png');
  assert.equal(brief.extra.draft.result.band, 'Under the floor of 1,300');
  assert.deepEqual(files.map(f => f[0]), ['extract.md', 'page-plan.md', 'proposed-visual.md', 'page-plan.md', 'brief-draft.md', 'brief-for-grammarly.md', 'figures.md', 'check-notes.md']);
  assert.match(files.find(f => f[0] === 'check-notes.md')[2], /^# Check notes/, 'what the check could not settle goes to the folder (Kate, Oct 22)');
  assert.equal(files.find(f => f[0] === 'proposed-visual.md')[3], 'figures', 'the proposal sits in the figures folder, one name whatever its kind, so a rerun replaces it');
  assert.match(files.find(f => f[0] === 'figures.md')[2], /^# Tables and figures in the paper/, 'figures.md is the inventory (review, Oct 22)');
  assert.equal(brief.extra.draft.visual.name, 'Table 1');
  assert.deepEqual(brief.extra.draft.result.visual, brief.extra.draft.visual, 'the proposal rides the result for the page');
  assert.deepEqual(brief.extra.draft.result.figures[0].box, { left: 0.1, top: 0.2, right: 0.9, bottom: 0.6 }, 'the box rides the inventory for the cut');
  assert.match(keyFindingsCallOf(calls), /\[Table 1 here\]/, 'the findings mark where the proposal goes, by its name');
  const keyFindingsCall = calls.find(c => /Key Findings as 2 to 4 findings/.test(c.prompt));
  assert.match(keyFindingsCall.prompt, /## introduction\nIntroduction words\./, 'the sections so far ride along');
  assert.match(keyFindingsCall.prompt, /Lead with the match premium/, 'her notes ride along');
  const again = await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });
  assert.equal(again.body.step, null, 'nothing left to do');
});

test('POST draft: a model failure is a plain 502 naming the step, and the step stays undone so it can be tried again', async () => {
  const { handler, rows } = draftWorld({ model: async () => { throw new Error('overloaded'); } });
  const res = await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });
  assert.equal(res.code, 502);
  assert.match(res.body.error, /couldn't write the draft at Reading the paper: overloaded/);
  assert.deepEqual(rows.get('holzman-2026-alignment').extra.draft?.done ?? [], []);
});

test('GET ?id&paper=1 hands the paper back for the crops; POST figure files a crop by a plain name only', async () => {
  const { handler, files } = draftWorld();
  const res = fakeRes();
  await handler({ method: 'GET', query: { id: 'holzman-2026-alignment', paper: '1' }, body: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.name, 'holzman.pdf');
  assert.equal(Buffer.from(res.body.b64, 'base64').toString('utf8'), '%PDF-1.4 the paper');
  const ok = await post(handler, { action: 'figure', id: 'holzman-2026-alignment', name: 'figure-table-3-p12.png', b64: Buffer.from('png bytes').toString('base64') });
  assert.equal(ok.code, 200, JSON.stringify(ok.body));
  assert.deepEqual(files.at(-1).slice(0, 2), ['figure-table-3-p12.png', 'image/png']);
  assert.equal(files.at(-1)[3], 'figures', 'a cut lands in the figures folder');
  assert.deepEqual(ok.body.brief.extra.draft.crops, ['figure-table-3-p12.png']);
  const bad = await post(handler, { action: 'figure', id: 'holzman-2026-alignment', name: '../evil.png', b64: 'eA==' });
  assert.equal(bad.code, 400);
});

test('POST draft with a step named starts over from it (Write it again), and assemble gives the row the plan\'s title when it had none', async () => {
  const { handler, rows } = draftWorld();
  for (let i = 0; i < DRAFT_STEPS.length; i++) await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });
  assert.equal(rows.get('holzman-2026-alignment').title, 'Majors That Lead Somewhere');
  const res = await post(handler, { action: 'draft', id: 'holzman-2026-alignment', step: 'extract' });
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.brief.extra.draft.done, ['extract'], 'everything after the named step is undone');
  assert.equal(res.body.next, 'plan');
  assert.equal(res.body.brief.stage, 'draft', 'back to drafting');
});

test('POST create keeps the brief author on the row', async () => {
  const { handler, rows } = draftWorld();
  const res = await post(handler, { action: 'create', authorLast: 'Nagro', year: '2026', topic: 'reading', paperName: 'n.pdf', paperB64: Buffer.from('%PDF').toString('base64'), notes: 'n', briefAuthor: 'Kate Barnes' });
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(rows.get('nagro-2026-reading').extra.briefAuthor, 'Kate Barnes');
});

test('Write it again clears the old run: no sections, flags, result or crops ride into the new draft, and the first new section is told it is the first (review, Oct 22)', async () => {
  const { handler, calls, rows } = draftWorld();
  for (let i = 0; i < DRAFT_STEPS.length; i++) await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });
  rows.get('holzman-2026-alignment').extra.draft.crops = ['figure-table-3-p12.png'];
  const res = await post(handler, { action: 'draft', id: 'holzman-2026-alignment', step: 'extract' });
  const d = res.body.brief.extra.draft;
  assert.deepEqual(d.sections, {}, 'the old sections are gone');
  assert.equal(d.result, undefined);
  assert.deepEqual(d.checkFlags ?? [], []);
  assert.deepEqual(d.crops ?? [], []);
  await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });   // plan
  await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });   // visual
  await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });   // exec_summary
  const exec = calls.at(-1).prompt;
  assert.match(exec, /This is the first section drafted/);
  assert.doesNotMatch(exec, /Sections drafted so far/);
});

test('POST draft with notes saves them on the row and as notes.md before the step runs, so Write the draft never drops what she typed (review, Oct 22)', async () => {
  const { handler, files, rows, calls } = draftWorld();
  await post(handler, { action: 'draft', id: 'holzman-2026-alignment', notes: 'Lead with the match premium. Keep Table 3.' });
  assert.equal(rows.get('holzman-2026-alignment').notes, 'Lead with the match premium. Keep Table 3.');
  assert.ok(files.some(([name]) => name === 'notes.md'), 'notes.md refiled');
  await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });   // plan reads the notes
  assert.match(calls.at(-1).prompt, /Keep Table 3/);
});

const keyFindingsCallOf = calls => calls.find(c => /Key Findings as 2 to 4 findings/.test(c.prompt))?.prompt ?? '';

test('every file the draft saves has a name the Sheet\'s script takes (live bug, Oct 22: the script refuses .json, so extract.json would have failed the first real draft)', async () => {
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  const rule = new RegExp(/var FILE_NAME_RULE = \/(.+)\/;/.exec(code)[1]);
  const { handler, files } = draftWorld();
  for (let i = 0; i < DRAFT_STEPS.length; i++) await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });
  await post(handler, { action: 'figure', id: 'holzman-2026-alignment', name: 'figure-table-3-p12.png', b64: Buffer.from('png').toString('base64') });
  await post(handler, { action: 'figure', id: 'holzman-2026-alignment', name: 'proposed-figure-1.png', b64: Buffer.from('png').toString('base64') });
  for (const [name] of files) assert.match(name, rule, `${name} would be refused by the script`);
});

test('POST figure takes the proposed chart as proposed-figure-1.png, into the figures folder, and keeps it with the cuts', async () => {
  const { handler, files } = draftWorld();
  const ok = await post(handler, { action: 'figure', id: 'holzman-2026-alignment', name: 'proposed-figure-1.png', b64: Buffer.from('png').toString('base64') });
  assert.equal(ok.code, 200, JSON.stringify(ok.body));
  assert.deepEqual(files.at(-1).slice(0, 2), ['proposed-figure-1.png', 'image/png']);
  assert.equal(files.at(-1)[3], 'figures');
  assert.deepEqual(ok.body.brief.extra.draft.crops, ['proposed-figure-1.png']);
  for (const name of ['proposed-figure-2.png', 'proposed-table-1.png', 'proposed.png']) {
    assert.equal((await post(handler, { action: 'figure', id: 'holzman-2026-alignment', name, b64: 'eA==' })).code, 400, name);
  }
});

test('GET ?id&image= hands a cut back as a picture from the figures folder, a plain name only, for the brief\'s page (Kate, Oct 22: "i want to see their figure and the proposed new one")', async () => {
  const { handler } = draftWorld();
  const res = { code: 0, headers: {}, sent: null, status(c) { this.code = c; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, send(b) { this.sent = b; return this; }, json(o) { this.body = o; return this; } };
  await handler({ method: 'GET', query: { id: 'holzman-2026-alignment', image: 'figure-table-3-p12.png' }, body: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers['content-type'], 'image/png');
  assert.match(res.headers['cache-control'], /^private/);
  assert.equal(Buffer.from(res.sent).toString('utf8'), 'png of figure-table-3-p12.png in figures');
  const bad = fakeRes();
  await handler({ method: 'GET', query: { id: 'holzman-2026-alignment', image: '../paper.pdf' }, body: {} }, bad);
  assert.equal(bad.code, 400);
});

test('the image door needs the sign-in like every other', async () => {
  const handler = createBriefsHandler({ session: { refuse: async (req, res) => { res.status(401).json({ ok: false }); return true; } }, briefs: () => ({}), drive: {}, mode: () => 'db' });
  const res = fakeRes();
  await handler({ method: 'GET', query: { id: 'x', image: 'figure-table-3-p12.png' }, body: {} }, res);
  assert.equal(res.code, 401);
});

test('Write it again clears the proposal with the rest, so a new plan gets a new visual', async () => {
  const { handler } = draftWorld();
  for (let i = 0; i < DRAFT_STEPS.length; i++) await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });
  const res = await post(handler, { action: 'draft', id: 'holzman-2026-alignment', step: 'extract' });
  assert.equal(res.body.brief.extra.draft.visual, undefined);
});

test('each step asks the model with its own budget from STEP_BUDGET (live, Oct 22: the read was cut short at 12,000)', async () => {
  const { handler, calls } = draftWorld();
  for (let i = 0; i < DRAFT_STEPS.length; i++) await post(handler, { action: 'draft', id: 'holzman-2026-alignment' });
  assert.deepEqual([calls[0].maxTokens, calls[0].effort], [20000, 'medium'], 'the read');
  const check = calls.find(c => /Below is a complete ERC research brief draft/.test(c.prompt));
  assert.equal(check.effort, 'high');
});
