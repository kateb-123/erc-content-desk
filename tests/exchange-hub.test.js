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

test('the hub says where the code, the handoff and the logins are, with how-to links in place of the forthcoming lines (the handoff, Oct 22: no dead ends), and never the logins themselves', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/exchange-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /forthcoming\(/);
  assert.match(src, /github\.com\/kateb-123\/erc-policy-exchange-app/);
  assert.match(src, /READ ME FIRST/);
  assert.match(src, /howToLink\('How to publish to the Exchange', '\/how-to\/sort\/#exchange'\)/);
  assert.doesNotMatch(src, /DESK_PASSWORD|password\s*[:=]/i, 'no login on the page');
  assert.match(src, /'\/#publish'/, 'Publish opens from the hub');
  assert.match(src, /'https:\/\/erc-policy-exchange\.vercel\.app\/'/, 'the live link');
});

// The Exchange's own edit door (Kate, Oct 23: "also on the hub"): the one place
// a live item is fixed, hidden or deleted. Its password is never on the page.
test('the hub links the Exchange edit door, and never its password', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/exchange-ui.js', import.meta.url), 'utf8');
  assert.match(src, /https:\/\/erc-policy-exchange\.vercel\.app\/2ujhtc8daz\//);
  assert.match(src, /Edit live items/);
  assert.doesNotMatch(src, /ADMIN_PASSWORD|password:/i);
  // One team password for the desk and the door since Oct 23 (Kate).
  assert.match(src, /It asks the team password\./);
  assert.doesNotMatch(src, /Exchange\\'s own password/);
});

// The team password's value is in the handoff doc alone: the desk, its
// how-tos and this repo are open to anyone (Kate, Oct 23).
test('no page or how-to names the Exchange edit door\'s password as its own, or writes the value', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../how-to/', import.meta.url);
  const files = ['../js/exchange-ui.js', ...readdirSync(dir, { recursive: true })
    .filter(f => /\.(html|json|txt)$/.test(f)).map(f => `../how-to/${f}`)];
  for (const f of files) {
    const text = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /Exchange's password|its own password|Exchange\\'s own password/, f);
    assert.doesNotMatch(text, /erc-123/, f);
  }
});

// Publish no longer carries the highlight (Kate, Oct 23): the picks have their
// own page and their own Save, so a publish never rewrites the card.
test('Publish sends no highlight picks and points to the Highlight page; the hub has a Highlight door', async () => {
  const { readFileSync } = await import('node:fs');
  const publish = readFileSync(new URL('../js/publish-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(publish, /highlights:\s*picks/);
  assert.doesNotMatch(publish, /renderHighlights/);
  assert.match(publish, /onGoTo\('highlight'\)/);
  const hub = readFileSync(new URL('../js/exchange-ui.js', import.meta.url), 'utf8');
  assert.match(hub, /'\/#highlight'/);
});
