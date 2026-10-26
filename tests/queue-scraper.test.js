// tests/queue-scraper.test.js: the Run the scraper block on the Content
// queue (Kate, Oct 19, 2026). Open to the team, like the page: the button
// starts a run on GitHub, the line under it says what the last run found and
// where the files are, and while a run is on the button goes and the line
// shimmers. Counts and a Drive link, nothing else.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scraperStatus } from '../js/queue-view.js';

const LAST = { date: '2026-10-19', counts: { event: 22, research: 32, headline: 152, opportunity: 17 }, sources: 68, failed: 0, files: ['Events.xlsx'], folderUrl: 'https://drive.google.com/drive/folders/abc', issue: '2026-10-27', sheetUrl: 'https://docs.google.com/spreadsheets/d/s#gid=7', deliveredAt: '2026-10-19T12:04:00Z' };

test('scraperStatus: the last run, its counts in the files\' order, and the Drive folder', () => {
  assert.deepEqual(scraperStatus({ configured: true, run: { state: 'idle', startedAt: '', updatedAt: '', url: '' }, last: LAST }, '2026-10-21'), {
    state: 'idle', button: true,
    line: 'Last run Oct 19, for the Oct 27 issue: 22 events, 32 research, 152 headlines, 17 opportunities.',
    link: { label: 'Open the sheet', href: 'https://docs.google.com/spreadsheets/d/s#gid=7' },
    files: { label: 'the files', href: 'https://drive.google.com/drive/folders/abc' },
  });
  // A run with no issue on the schedule, or from before the sheet existed, links the folder alone.
  const older = scraperStatus({ configured: true, run: { state: 'idle' }, last: { ...LAST, issue: '', sheetUrl: '' } }, '2026-10-21');
  assert.equal(older.line, 'Last run Oct 19: 22 events, 32 research, 152 headlines, 17 opportunities.');
  assert.deepEqual(older.link, { label: 'Open the files', href: 'https://drive.google.com/drive/folders/abc' });
  assert.equal(older.files, null);
  assert.equal(scraperStatus({ configured: true, run: { state: 'idle' }, last: { ...LAST, issue: '', sheetUrl: '', counts: { event: 1, research: 0, headline: 2, opportunity: 0 } } }, '2026-10-21').line,
    'Last run Oct 19: 1 event, 0 research, 2 headlines, 0 opportunities.');
  assert.equal(scraperStatus({ configured: true, run: { state: 'idle' }, last: { ...LAST, date: '2025-12-29' } }, '2026-10-21').line.slice(0, 21), 'Last run Dec 29, 2025');
  assert.equal(scraperStatus({ configured: true, run: { state: 'idle' }, last: { ...LAST, issue: '', sheetUrl: '', failed: 3 } }, '2026-10-21').line,
    'Last run Oct 19: 22 events, 32 research, 152 headlines, 17 opportunities. 3 sources did not answer.');
});

test('scraperStatus: running shimmers with the start time in Central and hides the button; a failure says so with the button back', () => {
  const running = scraperStatus({ configured: true, run: { state: 'running', startedAt: '2026-10-19T15:02:10Z', updatedAt: '', url: '' }, last: LAST }, '2026-10-19');
  assert.deepEqual(running, { state: 'running', button: false, line: 'Scraping, started 10:02 AM', link: null, files: null });
  const failed = scraperStatus({ configured: true, run: { state: 'failed', startedAt: '2026-10-19T12:00:10Z', updatedAt: '', url: 'https://github.com/erc/erc-scraper/actions/runs/3' }, last: LAST }, '2026-10-19');
  assert.deepEqual(failed, {
    state: 'failed', button: true,
    line: 'The last run failed on GitHub. Last good run Oct 19.',
    link: { label: 'Open the sheet', href: 'https://docs.google.com/spreadsheets/d/s#gid=7' },
    files: { label: 'the files', href: 'https://drive.google.com/drive/folders/abc' },
  });
});

test('scraperStatus: no run yet, not wired up, still asking, and a desk that could not ask', () => {
  assert.deepEqual(scraperStatus({ configured: true, run: { state: 'idle' }, last: null }, '2026-10-19'), { state: 'idle', button: true, line: 'No run yet. Runs Mondays at 7:00.', link: null, files: null });
  assert.deepEqual(scraperStatus({ configured: false, run: null, last: null }, '2026-10-19'), { state: 'off', button: false, line: 'Not set up yet.', link: null, files: null });
  assert.deepEqual(scraperStatus(null, '2026-10-19'), { state: 'checking', button: false, line: 'Checking the scraper', link: null, files: null });
  assert.deepEqual(scraperStatus({ error: true }, '2026-10-19'), { state: 'error', button: false, line: "Couldn't reach GitHub.", link: null, files: null });
  assert.equal(scraperStatus({ error: true, message: 'GitHub answered 404 for the runs.' }, '2026-10-19').line, 'GitHub answered 404 for the runs.', 'the server\'s own words when it had any');
});

test('the queue page draws the block from the status, under the Sort door, and the app asks again while a run is on', () => {
  const ui = readFileSync(new URL('../js/queue-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /import \{ [^}]*scraperStatus[^}]* \} from '\.\/queue-view\.js';/);
  assert.match(ui, /'section-label hub-label', 'Scraper'/, 'the hubs\' own section label');
  assert.match(ui, /button\('Run the scraper', 'btn-outline'/, 'an outline button, nothing filled on an open page');
  assert.match(ui, /s\.state === 'running' \? busyLine\(s\.line\)/, 'the wait shimmers');
  assert.match(ui, /target = '_blank'/, 'the sheet and the folder open in a new tab');
  assert.match(ui, /s\.files/, 'the files beside the sheet');
  // The block sits under the door; the How to sort link that followed it is in the How-tos panel (Oct 24, her pick D).
  assert.match(ui, /side\.append\(door, .*scraperBox\);/, 'the block sits under the door, last in the column');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /async function loadScraper\(/);
  assert.match(app, /fetch\('\/api\/bulk\?scraper=status'\)/);
  assert.match(app, /action: 'run'/);
  assert.match(app, /SCRAPER_POLL_MS/, 'asks again on a timer while a run is on');
});
