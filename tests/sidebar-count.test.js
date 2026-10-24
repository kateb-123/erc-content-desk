import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { navBadges, sidebarCheck } from '../js/shell-view.js';
import { hubCards } from '../js/home-panel.js';
import { exchangeStatus } from '../js/exchange-view.js';

// Kate, Oct 23: the sidebar's Policy Exchange row showed 3 on every page and
// dropped to 2 once the Exchange page ran the live check. Her pick: one
// number. The row counts what Publish would add, from the live Exchange check,
// once a check has landed this visit; until then it shows nothing, no guess.

const today = '2026-10-23';
// Three kept rows ticked for the Exchange; the live check finds c already live.
const rows = [
  { id: 'a', status: 'kept', type: 'research', link: 'https://example.org/howdy-brief' },
  { id: 'b', status: 'kept', type: 'research', link: 'https://example.org/gig-em-report' },
  { id: 'c', status: 'kept', type: 'headline', link: 'https://example.org/reveille-headline' },
];
const check = { adding: [{ id: 'a' }, { id: 'b' }], skipped: [{ id: 'c' }], liveLinks: [] };
const cards = preview => hubCards({ rows, today, loaded: true, preview });
const exchangeCard = preview => cards(preview).find(c => c.key === 'exchange');

test('before a live check has landed, the sidebar row shows nothing, never the kept rows guessed at', () => {
  assert.equal(exchangeCard(null).guess, true, 'the front page row says its count is the stand-in');
  assert.equal(navBadges(cards(null)).exchange, '');
  assert.equal(navBadges(hubCards({ rows, today, loaded: false, preview: null })).exchange, '', 'nor while the rows load');
});

test('once the check lands, the sidebar, the front page row and the Exchange page door show one number', () => {
  const badge = navBadges(cards(check)).exchange;
  assert.equal(badge, '2');
  assert.equal(exchangeCard(check).guess, false);
  assert.equal(String(exchangeCard(check).count), badge, 'the front page row');
  assert.equal(String(exchangeStatus({ rows, today, loaded: true, preview: check }).waiting), badge, 'the door counts from exchangeStatus');
  assert.equal(navBadges(cards({ ...check, adding: [] })).exchange, '0', 'nothing to publish is a checked 0, not a blank');
});

test('a change clears the current check; the row keeps the last check that landed until the next one does', () => {
  const last = check;
  const fresh = { ...check, adding: [{ id: 'a' }] };
  assert.equal(sidebarCheck(null, null), null, 'no check yet');
  assert.equal(sidebarCheck(null, last), last, 'cleared by a change: the last one that landed');
  assert.equal(sidebarCheck(fresh, last), fresh, 'the current check wins');
  assert.equal(navBadges(cards(sidebarCheck(null, last))).exchange, '2', 'no blank, no guess, between a change and the next check');
});

test('the desk keeps each check that lands and counts the sidebar, the front page and the Exchange page from it, with no new call', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.equal((app.match(/state\.publishPreview = state\.lastCheck = data;/g) ?? []).length, 2, 'both landings: Publish\'s check and the quiet one');
  const shown = 'preview: sidebarCheck(state.publishPreview, state.lastCheck)';
  assert.match(app, new RegExp(`badges: navBadges\\(hubCards\\(\\{[^\\n]*${shown.replace(/[()]/g, '\\$&')}`), 'the sidebar');
  assert.match(app, new RegExp(`renderHome\\(screens\\.home, \\{[\\s\\S]{0,200}${shown.replace(/[()]/g, '\\$&')}`), 'the front page');
  assert.match(app, new RegExp(`renderExchange\\(screens\\.exchange, \\{[^\\n]*${shown.replace(/[()]/g, '\\$&')}`), 'the Exchange page');
  assert.match(app, /state\.justPublished = data\.published;[\s\S]{0,800}state\.lastCheck = null;/, 'a publish changes what waits: no number until the next check');
  assert.equal((app.match(/fetch\('\/api\/publish'\)/g) ?? []).length, 2, 'the same two checks as before, no new network call');
});

test('once a check has landed, any page asks again after a change, so the count is never left stale (review, Oct 23)', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /function render\(\) \{\n[^\n]*\n?\s*if \(state\.loaded && state\.lastCheck && !state\.publishPreview && !laneCheck\.inFlight && laneCheck\.failedAt !== state\.rows\) quietPublishCheck\(\);/);
});
