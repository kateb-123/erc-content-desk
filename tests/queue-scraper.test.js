// tests/queue-scraper.test.js: the Run the scraper block on the Content
// queue (Kate, Oct 19, 2026). Open to the team, like the page: the button
// starts a run on GitHub, the line under it says what the last run found and
// where the files are, and while a run is on the button goes and the line
// shimmers. Counts and a Drive link, nothing else.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scraperStatus } from '../js/queue-view.js';

const LAST = { date: '2026-10-19', counts: { event: 22, research: 32, headline: 152, opportunity: 17 }, sources: 68, failed: 0, files: ['Events.xlsx'], folderUrl: 'https://drive.google.com/drive/folders/abc', deliveredAt: '2026-10-19T12:04:00Z' };

test('scraperStatus: the last run, its counts in the files\' order, and the Drive folder', () => {
  assert.deepEqual(scraperStatus({ configured: true, run: { state: 'idle', startedAt: '', updatedAt: '', url: '' }, last: LAST }, '2026-10-21'), {
    state: 'idle', button: true,
    line: 'Last run Oct 19: 22 events, 32 research, 152 headlines, 17 opportunities.',
    link: { label: 'Open the files', href: 'https://drive.google.com/drive/folders/abc' },
  });
  assert.equal(scraperStatus({ configured: true, run: { state: 'idle' }, last: { ...LAST, counts: { event: 1, research: 0, headline: 2, opportunity: 0 } } }, '2026-10-21').line,
    'Last run Oct 19: 1 event, 0 research, 2 headlines, 0 opportunities.');
  assert.equal(scraperStatus({ configured: true, run: { state: 'idle' }, last: { ...LAST, date: '2025-12-29' } }, '2026-10-21').line.slice(0, 21), 'Last run Dec 29, 2025');
  assert.equal(scraperStatus({ configured: true, run: { state: 'idle' }, last: { ...LAST, failed: 3 } }, '2026-10-21').line,
    'Last run Oct 19: 22 events, 32 research, 152 headlines, 17 opportunities. 3 sources did not answer.');
});

test('scraperStatus: running shimmers with the start time in Central and hides the button; a failure says so with the button back', () => {
  const running = scraperStatus({ configured: true, run: { state: 'running', startedAt: '2026-10-19T15:02:10Z', updatedAt: '', url: '' }, last: LAST }, '2026-10-19');
  assert.deepEqual(running, { state: 'running', button: false, line: 'Scraping, started 10:02 AM', link: null });
  const failed = scraperStatus({ configured: true, run: { state: 'failed', startedAt: '2026-10-19T12:00:10Z', updatedAt: '', url: 'https://github.com/erc/erc-scraper/actions/runs/3' }, last: LAST }, '2026-10-19');
  assert.deepEqual(failed, {
    state: 'failed', button: true,
    line: 'The last run failed on GitHub. The files from Oct 19 are still in Drive.',
    link: { label: 'Open the files', href: 'https://drive.google.com/drive/folders/abc' },
  });
});

test('scraperStatus: no run yet, not wired up, still asking, and a desk that could not ask', () => {
  assert.deepEqual(scraperStatus({ configured: true, run: { state: 'idle' }, last: null }, '2026-10-19'), { state: 'idle', button: true, line: 'No run yet. Every Monday at 7:00, and whenever this is pressed.', link: null });
  assert.deepEqual(scraperStatus({ configured: false, run: null, last: null }, '2026-10-19'), { state: 'off', button: false, line: 'Not wired to the desk yet.', link: null });
  assert.deepEqual(scraperStatus(null, '2026-10-19'), { state: 'checking', button: false, line: 'Checking the scraper', link: null });
  assert.deepEqual(scraperStatus({ error: true }, '2026-10-19'), { state: 'error', button: false, line: "The desk couldn't ask GitHub just now.", link: null });
});

test('the queue page draws the block from the status, under the Sort door, and the app asks again while a run is on', () => {
  const ui = readFileSync(new URL('../js/queue-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /import \{ [^}]*scraperStatus[^}]* \} from '\.\/queue-view\.js';/);
  assert.match(ui, /'section-label hub-label', 'Scraper'/, 'the hubs\' own section label');
  assert.match(ui, /button\('Run the scraper', 'btn-outline'/, 'an outline button, nothing filled on an open page');
  assert.match(ui, /s\.state === 'running' \? busyLine\(s\.line\)/, 'the wait shimmers');
  assert.match(ui, /target = '_blank'/, 'the Drive folder opens in a new tab');
  assert.match(ui, /side\.append\(door, .*scraperBox, forthcoming\('How to sort'\)\);/, 'the block sits under the door, above the forthcoming line');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /async function loadScraper\(/);
  assert.match(app, /fetch\('\/api\/bulk\?scraper=status'\)/);
  assert.match(app, /action: 'run'/);
  assert.match(app, /SCRAPER_POLL_MS/, 'asks again on a timer while a run is on');
});
