// tests/scraper-run.test.js: Run the scraper from the desk (Kate, Oct 19,
// 2026: "a button that will run the scraper", and the haul in Drive "so it's
// available to everyone"). The scraper runs on GitHub; the desk starts a run,
// reads its state and the last haul, and takes the haul's spreadsheets in
// through the bulk door to file them into the shared drive by the Sheet's
// own Apps Script. No new function: all of it rides /api/bulk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createScraperHandler, runState, haulChecks, issueFor, scrapeRows, haulNames, SCRAPE_HEADER, SCRAPER_WORKFLOW } from '../api/_lib/scraper.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function fakeRes() {
  return {
    code: 0, body: null,
    status(code) { this.code = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

const ENV = { SCRAPER_GITHUB_TOKEN: 'ghp_test', SCRAPER_REPO: 'erc/erc-scraper', SCRAPER_TOKEN: 'shared-secret' };
const RUNNING = { workflow_runs: [{ status: 'in_progress', conclusion: null, created_at: '2026-10-19T15:02:10Z', updated_at: '2026-10-19T15:03:00Z', html_url: 'https://github.com/erc/erc-scraper/actions/runs/1' }] };
const DONE = { workflow_runs: [{ status: 'completed', conclusion: 'success', created_at: '2026-10-19T12:00:10Z', updated_at: '2026-10-19T12:04:00Z', html_url: 'https://github.com/erc/erc-scraper/actions/runs/2' }] };
const FAILED = { workflow_runs: [{ status: 'completed', conclusion: 'failure', created_at: '2026-10-19T12:00:10Z', updated_at: '2026-10-19T12:01:00Z', html_url: 'https://github.com/erc/erc-scraper/actions/runs/3' }] };
const LATEST = { date: '2026-10-19', counts: { event: 22, research: 32, headline: 152, opportunity: 17 }, sources: 68, failed: 0, files: ['Events.xlsx'], folderUrl: 'https://drive.google.com/drive/folders/abc', deliveredAt: '2026-10-19T12:04:00Z' };

/** A GitHub that answers the runs list, the latest.json contents and a dispatch. */
function github({ runs = DONE, latest = LATEST, dispatch = 204 } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body });
    if (url.endsWith('/runs?per_page=1')) return { ok: true, status: 200, json: async () => runs, text: async () => JSON.stringify(runs) };
    if (url.includes('/contents/haul/latest.json')) {
      if (!latest) return { ok: false, status: 404, json: async () => ({}), text: async () => 'Not Found' };
      return { ok: true, status: 200, json: async () => ({ content: Buffer.from(JSON.stringify(latest)).toString('base64'), encoding: 'base64' }), text: async () => '' };
    }
    if (url.endsWith('/dispatches')) return { ok: dispatch === 204, status: dispatch, json: async () => ({}), text: async () => (dispatch === 204 ? '' : 'Not Found') };
    throw new Error(`unexpected ${url}`);
  };
  return { fetch, calls };
}

test('runState: queued or in progress is running, a finished run is idle or failed, nothing yet is idle', () => {
  assert.deepEqual(runState(RUNNING), { state: 'running', startedAt: '2026-10-19T15:02:10Z', updatedAt: '2026-10-19T15:03:00Z', url: 'https://github.com/erc/erc-scraper/actions/runs/1' });
  assert.equal(runState({ workflow_runs: [{ ...RUNNING.workflow_runs[0], status: 'queued' }] }).state, 'running');
  assert.equal(runState(DONE).state, 'idle');
  assert.equal(runState(FAILED).state, 'failed');
  assert.deepEqual(runState({ workflow_runs: [] }), { state: 'idle', startedAt: '', updatedAt: '', url: '' });
});

test('status: the run state and the last haul, read from GitHub with the token', async () => {
  const gh = github();
  const handler = createScraperHandler({ fetch: gh.fetch, env: ENV });
  const res = fakeRes();
  await handler.handle({ method: 'GET', query: { scraper: 'status' }, body: {} }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, configured: true, run: runState(DONE), last: LATEST });
  assert.ok(gh.calls.every(c => c.headers.Authorization === 'Bearer ghp_test'), 'every GitHub call carries the token');
  assert.ok(gh.calls.some(c => c.url === `https://api.github.com/repos/erc/erc-scraper/actions/workflows/${SCRAPER_WORKFLOW}/runs?per_page=1`));
  assert.ok(gh.calls.some(c => c.url === 'https://api.github.com/repos/erc/erc-scraper/contents/haul/latest.json?ref=main'));
});

test('status: no latest.json yet is last null; no token is not configured, and GitHub is never asked', async () => {
  const gh = github({ latest: null });
  const res = fakeRes();
  await createScraperHandler({ fetch: gh.fetch, env: ENV }).handle({ method: 'GET', query: { scraper: 'status' }, body: {} }, res);
  assert.equal(res.body.last, null);
  const quiet = github();
  const res2 = fakeRes();
  await createScraperHandler({ fetch: quiet.fetch, env: { SCRAPER_TOKEN: 'x' } }).handle({ method: 'GET', query: { scraper: 'status' }, body: {} }, res2);
  assert.deepEqual(res2.body, { ok: true, configured: false, run: null, last: null });
  assert.equal(quiet.calls.length, 0);
});

test('status: GitHub not answering is a readable error, not a crash', async () => {
  const fetch = async () => { throw new Error('socket hang up'); };
  const res = fakeRes();
  await createScraperHandler({ fetch, env: ENV }).handle({ method: 'GET', query: { scraper: 'status' }, body: {} }, res);
  assert.equal(res.code, 502);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /GitHub/);
});

test('run: starts the workflow on main, and refuses while one is running', async () => {
  const gh = github();
  const res = fakeRes();
  await createScraperHandler({ fetch: gh.fetch, env: ENV }).handle({ method: 'POST', query: {}, body: { action: 'run' } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, started: true });
  const dispatch = gh.calls.find(c => c.url.endsWith('/dispatches'));
  assert.equal(dispatch.method, 'POST');
  assert.deepEqual(JSON.parse(dispatch.body), { ref: 'main' });

  const busy = github({ runs: RUNNING });
  const res2 = fakeRes();
  await createScraperHandler({ fetch: busy.fetch, env: ENV }).handle({ method: 'POST', query: {}, body: { action: 'run' } }, res2);
  assert.equal(res2.code, 409);
  assert.match(res2.body.error, /already running/i);
  assert.ok(!busy.calls.some(c => c.url.endsWith('/dispatches')), 'no second run');
});

test('run: not wired up says so; a GitHub refusal is passed on readably', async () => {
  const res = fakeRes();
  await createScraperHandler({ fetch: github().fetch, env: {} }).handle({ method: 'POST', query: {}, body: { action: 'run' } }, res);
  assert.equal(res.code, 503);
  assert.match(res.body.error, /SCRAPER_GITHUB_TOKEN/);
  const res2 = fakeRes();
  await createScraperHandler({ fetch: github({ dispatch: 404 }).fetch, env: ENV }).handle({ method: 'POST', query: {}, body: { action: 'run' } }, res2);
  assert.equal(res2.code, 502);
  assert.match(res2.body.error, /GitHub answered 404/);
});

const HAUL = {
  action: 'haul', token: 'shared-secret', date: '2026-10-19',
  counts: { event: 22 }, sources: 68, failed: 0,
  files: [{ name: 'Events.xlsx', b64: Buffer.from('PK-events').toString('base64') }, { name: 'run-log.txt', b64: Buffer.from('ERC scrape').toString('base64') }],
};

test('haulChecks: the token, the date and the file names are checked before anything is saved', () => {
  assert.equal(haulChecks(HAUL, 'shared-secret'), null);
  assert.match(haulChecks({ ...HAUL, token: 'wrong' }, 'shared-secret'), /token/i);
  assert.match(haulChecks({ ...HAUL, token: '' }, ''), /token/i, 'an unset secret refuses everything');
  assert.match(haulChecks({ ...HAUL, date: '19-10-2026' }, 'shared-secret'), /date/i);
  assert.match(haulChecks({ ...HAUL, files: [] }, 'shared-secret'), /files/i);
  assert.match(haulChecks({ ...HAUL, files: [{ name: '../x.xlsx', b64: 'QQ==' }] }, 'shared-secret'), /name/i);
  assert.match(haulChecks({ ...HAUL, files: [{ name: 'a.exe', b64: 'QQ==' }] }, 'shared-secret'), /name/i);
  assert.match(haulChecks({ ...HAUL, files: Array.from({ length: 13 }, (_, i) => ({ name: `f${i}.xlsx`, b64: 'QQ==' })) }, 'shared-secret'), /files/i);
  const big = { name: 'Headlines.xlsx', b64: Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64') };
  assert.match(haulChecks({ ...HAUL, files: [big] }, 'shared-secret'), /big/i);
});

test('haul: every file goes to the Sheet\'s script under the date folder, and the Drive folder comes back', async () => {
  const saved = [];
  const saveFile = async file => { saved.push(file); return { ok: true, url: `https://drive.google.com/file/${file.name}`, folderUrl: 'https://drive.google.com/drive/folders/abc' }; };
  const res = fakeRes();
  const real = { ...HAUL, files: [await xlsxFile('Events.xlsx', [['Title', 'Link', 'Type'], ['Howdy Policy Trivia Night', 'https://example.org/trivia', 'event']]), HAUL.files[1]] };
  // The day's first delivery (GitHub's last haul is from another day), so the names stay plain.
  await createScraperHandler({ fetch: github({ latest: { ...LATEST, date: '2026-10-12' } }).fetch, saveFile, appendScrape: async () => ({ ok: true, sheetUrl: 'https://docs.google.com/spreadsheets/d/s#gid=7', tab: 'Oct 27, 2026' }), readSchedule: async () => ['2026-10-20', '2026-10-27'], env: ENV }).handle({ method: 'POST', query: {}, body: real }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, folderUrl: 'https://drive.google.com/drive/folders/abc', saved: ['Events.xlsx', 'run-log.txt'], issue: '2026-10-20', sheetUrl: 'https://docs.google.com/spreadsheets/d/s#gid=7', tab: 'Oct 27, 2026' });
  assert.deepEqual(saved.map(f => [f.folder, f.name, f.contentType]), [
    ['2026-10-19', 'Events.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['2026-10-19', 'run-log.txt', 'text/plain'],
  ]);
  assert.equal(saved[0].b64, real.files[0].b64);
});

test('haul: a wrong token is refused before any file is saved; a Drive failure is reported', async () => {
  let saves = 0;
  const saveFile = async () => { saves += 1; return { ok: true }; };
  const res = fakeRes();
  await createScraperHandler({ fetch: github().fetch, saveFile, env: ENV }).handle({ method: 'POST', query: {}, body: { ...HAUL, token: 'nope' } }, res);
  assert.equal(res.code, 401);
  assert.equal(saves, 0);
  const res2 = fakeRes();
  await createScraperHandler({ fetch: github().fetch, saveFile: async () => { throw new Error('Sheet API error: no folder'); }, appendScrape: async () => ({ ok: true }), readSchedule: async () => [], env: ENV }).handle({ method: 'POST', query: {}, body: HAUL }, res2);
  assert.equal(res2.code, 502);
  assert.match(res2.body.error, /no folder/);
});

test('the bulk door hands these three to the scraper handler and keeps its file split for everything else', () => {
  const src = read('../api/bulk.js');
  assert.match(src, /import \{ createScraperHandler \} from '\.\/_lib\/scraper\.js';/);
  assert.match(src, /scraper\.handles\(req\)/, 'a GET ?scraper=status, a POST run or haul');
  assert.match(src, /if \(req\.method !== 'POST'\)/, 'the split still wants POST');
  const sheets = read('../api/_lib/sheets.js');
  assert.match(sheets, /export async function saveFile\(/);
  assert.match(sheets, /callSheetApi\('saveFile'/);
  const gs = read('../apps-script/Code.gs');
  assert.match(gs, /case 'saveFile':/);
  assert.match(gs, /SCRAPE_FOLDER_ID/, 'the scrapes folder\'s id lives in a script property, never in the file');
  assert.match(gs, /Utilities\.base64Decode/);
  const readme = read('../README.md');
  for (const name of ['SCRAPER_TOKEN', 'SCRAPER_GITHUB_TOKEN', 'SCRAPER_REPO', 'SCRAPE_FOLDER_ID']) assert.ok(readme.includes(name), `README names ${name}`);
});

// The scrape by issue (Kate, Oct 19: "a new sheet based on the scrape, by the
// newsletter send out dates"; her pick: one Sheet, a tab per issue). The
// desk reads the run's spreadsheets, stamps every row with the run and the
// issue it feeds (the next send date on or after the run), and hands them to
// the script, which keeps "Newsletter scrapes" in the scrapes folder.
test('issueFor: the next send date on or after the run, else nothing', () => {
  assert.equal(issueFor(['2026-10-20', '2026-11-03'], '2026-10-21'), '2026-11-03');
  assert.equal(issueFor(['2026-10-20', '2026-11-03'], '2026-10-20'), '2026-10-20');
  assert.equal(issueFor(['2026-10-20', '2026-11-03'], '2026-11-04'), '');
  assert.equal(issueFor([], '2026-10-21'), '');
});

async function xlsxFile(name, matrix) {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Items');
  return { name, b64: XLSX.write(book, { type: 'base64', bookType: 'xlsx' }) };
}

test('scrapeRows: the spreadsheets become one table, the run first, every type\'s columns in the writer\'s order, the log left out', async () => {
  const files = [
    await xlsxFile('Events.xlsx', [['Title', 'Link', 'Type', 'Subtype', 'Description', 'Source', 'Date', 'Time', 'Location'], ['Howdy Policy Trivia Night', 'https://example.org/trivia', 'event', 'A&M', 'Bring a team.', 'Aggie Policy Club', '2026-10-30', '6:00 PM CT', 'Rudder 401']]),
    await xlsxFile('Headlines-1.xlsx', [['Title', 'Link', 'Type', 'Subtype', 'Description', 'Source', 'Date'], ['Twelfth Man Tutoring Expands', 'https://example.org/tutoring', 'headline', 'Texas', '', 'Made-Up Times', '2026-10-18']]),
    await xlsxFile('Headlines-2.xlsx', [['Title', 'Link', 'Type', 'Subtype', 'Description', 'Source', 'Date'], ['Reveille Reads', 'https://example.org/reveille', 'headline', 'National', 'A dog.', 'Pretend Post', '2026-10-17']]),
    { name: 'run-log.txt', b64: Buffer.from('ERC scrape').toString('base64') },
  ];
  const { header, rows } = await scrapeRows(files, '2026-10-19');
  assert.deepEqual(header, SCRAPE_HEADER);
  assert.deepEqual(SCRAPE_HEADER, ['Run', 'Title', 'Link', 'Type', 'Subtype', 'Description', 'Source', 'Date', 'Time', 'Location', 'Authors', 'Note', 'Deadline']);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ['2026-10-19', 'Howdy Policy Trivia Night', 'https://example.org/trivia', 'event', 'A&M', 'Bring a team.', 'Aggie Policy Club', '2026-10-30', '6:00 PM CT', 'Rudder 401', '', '', '']);
  assert.deepEqual(rows[2].slice(0, 4), ['2026-10-19', 'Reveille Reads', 'https://example.org/reveille', 'headline']);
});

test('haul: the rows go to the issue\'s tab, once, after the files; no schedule files them under the run date', async () => {
  const calls = [];
  const appendScrape = async payload => { calls.push(payload); return { ok: true, sheetUrl: 'https://docs.google.com/spreadsheets/d/s#gid=1', tab: 'Oct 27, 2026' }; };
  const events = await xlsxFile('Events.xlsx', [['Title', 'Link', 'Type'], ['Howdy Policy Trivia Night', 'https://example.org/trivia', 'event']]);
  const body = { ...HAUL, files: [events, HAUL.files[1]] };
  const res = fakeRes();
  await createScraperHandler({ fetch: github().fetch, saveFile: async () => ({ ok: true, folderUrl: 'f' }), appendScrape, readSchedule: async () => ['2026-10-27'], env: ENV }).handle({ method: 'POST', query: {}, body }, res);
  assert.equal(res.code, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].issue, '2026-10-27');
  assert.equal(calls[0].run, '2026-10-19');
  assert.deepEqual(calls[0].header, SCRAPE_HEADER);
  assert.deepEqual(calls[0].rows[0].slice(0, 4), ['2026-10-19', 'Howdy Policy Trivia Night', 'https://example.org/trivia', 'event']);
  assert.equal(res.body.issue, '2026-10-27');

  const res2 = fakeRes();
  await createScraperHandler({ fetch: github().fetch, saveFile: async () => ({ ok: true, folderUrl: 'f' }), appendScrape, readSchedule: async () => { throw new Error('no sheet'); }, env: ENV }).handle({ method: 'POST', query: {}, body }, res2);
  assert.equal(res2.code, 200);
  assert.equal(calls[1].issue, '', 'no schedule, no issue: the script files it under the run date');
});

test('haul: a Sheet write that fails after the files are filed is reported, and the script replaces that run\'s rows on a re-delivery', async () => {
  const events = await xlsxFile('Events.xlsx', [['Title', 'Link', 'Type'], ['Howdy Policy Trivia Night', 'https://example.org/trivia', 'event']]);
  const res = fakeRes();
  await createScraperHandler({ fetch: github().fetch, saveFile: async () => ({ ok: true, folderUrl: 'f' }), appendScrape: async () => { throw new Error('Sheet API error: locked'); }, readSchedule: async () => [], env: ENV }).handle({ method: 'POST', query: {}, body: { ...HAUL, files: [events] } }, res);
  assert.equal(res.code, 502);
  assert.match(res.body.error, /Newsletter scrapes.*locked/);
  const gs = read('../apps-script/Code.gs');
  assert.match(gs, /case 'appendScrape':/);
  assert.match(gs, /Newsletter scrapes/);
  // Kate, Oct 20: what the team deletes by hand stays deleted; a second run the same day only adds what is new.
  const append = gs.slice(gs.indexOf('function handleAppendScrape'));
  assert.doesNotMatch(append, /deleteRow/, 'the script never removes a row');
  assert.match(append, /onTab\[/, 'links already on the tab are skipped');
  const sheets = read('../api/_lib/sheets.js');
  assert.match(sheets, /export async function appendScrape\(/);
});

// A second run on the same day (Kate, Oct 20: running it daily): its files
// keep their own names, with the run's time in them, so the morning's files
// stay in Drive; and a spreadsheet with no rows is never sent at all.
test('haulNames: the day\'s first delivery keeps plain names; a later one carries the time; empties are dropped', async () => {
  const empty = await xlsxFile('Research.xlsx', [['Title', 'Link', 'Type']]);
  const full = await xlsxFile('Events.xlsx', [['Title', 'Link', 'Type'], ['Howdy Policy Trivia Night', 'https://example.org/trivia', 'event']]);
  const log = { name: 'run-log.txt', b64: Buffer.from('ERC scrape').toString('base64') };
  const first = await haulNames([full, empty, log], { secondOfDay: false, time: '14-59' });
  assert.deepEqual(first.map(f => f.name), ['Events.xlsx', 'run-log.txt']);
  const second = await haulNames([full, empty, log], { secondOfDay: true, time: '14-59' });
  assert.deepEqual(second.map(f => f.name), ['Events 14-59.xlsx', 'run-log 14-59.txt']);
  assert.equal(second[0].b64, full.b64, 'the file itself is untouched');
});

test('haul: a delivery on a day that already has one files under timed names', async () => {
  const saved = [];
  const saveFile = async file => { saved.push(file.name); return { ok: true, folderUrl: 'f' }; };
  const full = await xlsxFile('Events.xlsx', [['Title', 'Link', 'Type'], ['Howdy Policy Trivia Night', 'https://example.org/trivia', 'event']]);
  const body = { ...HAUL, date: '2026-10-19', files: [full, HAUL.files[1]] };
  const res = fakeRes();
  await createScraperHandler({ fetch: github({ latest: { ...LATEST, date: '2026-10-19' } }).fetch, saveFile, appendScrape: async () => ({ ok: true }), readSchedule: async () => [], env: ENV, now: () => new Date('2026-10-19T19:59:00Z') }).handle({ method: 'POST', query: {}, body }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(saved, ['Events 14-59.xlsx', 'run-log 14-59.txt'], 'Central time in the names');
  assert.deepEqual(res.body.saved, ['Events 14-59.xlsx', 'run-log 14-59.txt']);

  const saved2 = [];
  const res2 = fakeRes();
  await createScraperHandler({ fetch: github({ latest: { ...LATEST, date: '2026-10-18' } }).fetch, saveFile: async file => { saved2.push(file.name); return { ok: true, folderUrl: 'f' }; }, appendScrape: async () => ({ ok: true }), readSchedule: async () => [], env: ENV, now: () => new Date('2026-10-19T19:59:00Z') }).handle({ method: 'POST', query: {}, body }, res2);
  assert.deepEqual(saved2, ['Events.xlsx', 'run-log.txt'], 'the day\'s first delivery keeps plain names');
});
