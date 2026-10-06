import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangeStatus } from '../js/exchange-view.js';

// The Policy Exchange hub (Kate's drawn map, Oct 6, 2026): its status, the
// live link with when the site last changed, how many wait to publish; the
// code, the handoff and where the logins are kept are forthcoming.

const rows = [
  { id: 'a', status: 'kept', type: 'research' },
  { id: 'b', status: 'kept', type: 'event', subtype: 'A&M' },   // a campus event: newsletter only
  { id: 'c', status: 'kept', type: 'headline', published_at: '2026-10-01T10:00:00Z' },
];

test('exchangeStatus: live with its last change, and what Publish would add', () => {
  assert.deepEqual(exchangeStatus({ rows, today: '2026-10-07', loaded: true, preview: { adding: [{ id: 'a' }, { id: 'x' }] }, hubUpdated: '2026-10-01' }), {
    site: 'Live', updated: 'Oct 1', waiting: 2,
  });
});

test('exchangeStatus: before the check lands it counts the kept rows ticked for the Exchange', () => {
  assert.equal(exchangeStatus({ rows, today: '2026-10-07', loaded: true, preview: null, hubUpdated: '2026-10-01' }).waiting, 1);
  assert.equal(exchangeStatus({ rows, today: '2026-10-07', loaded: false, preview: null, hubUpdated: null }).waiting, null);
});

test('exchangeStatus: while asked it says so; a site that did not answer is never called live', () => {
  assert.deepEqual(exchangeStatus({ rows: [], today: '2026-10-07', loaded: true, preview: null, hubUpdated: null }), { site: 'Checking', updated: '', waiting: 0 });
  assert.deepEqual(exchangeStatus({ rows: [], today: '2026-10-07', loaded: true, preview: null, hubUpdated: '' }), { site: "Didn't answer just now", updated: '', waiting: 0 });
});

test('the hub names its forthcoming items, and never the logins themselves', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/exchange-ui.js', import.meta.url), 'utf8');
  for (const words of ['The code', 'The handoff', 'Where the logins are kept']) assert.match(src, new RegExp(`forthcoming\\('${words}'\\)`));
  assert.match(src, /'\/#publish'/, 'Publish opens from the hub');
  assert.match(src, /'https:\/\/erc-policy-exchange\.vercel\.app\/'/, 'the live link');
});
