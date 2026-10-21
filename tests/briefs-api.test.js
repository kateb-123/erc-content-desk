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
function handlerWith({ signedIn = true, rows = [ROW], script = {} } = {}) {
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
  const handler = createBriefsHandler({ session: { refuse: async (req, res) => { if (signedIn) return false; res.status(401).json({ ok: false, error: 'Sign in to the desk first.' }); return true; } }, briefs: () => store, drive, mode: () => 'db' });
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
