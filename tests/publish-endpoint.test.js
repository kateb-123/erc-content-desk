import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, CSV_COLUMNS } from '../js/schema.js';
import { issueToken } from '../api/_lib/session.js';
import { HIGHLIGHTS_PATH } from '../api/_lib/highlights.js';
import { createPublishHandler } from '../api/publish.js';

// /api/publish behind the desk password (Kate, Sep 23): the check and the
// write both need a signed-in browser, and the write asks for the password
// once more. The write also carries her highlight picks to the Exchange.

const SECRET = 'correct horse';
const NOW = Date.parse('2026-09-23T20:00:00.000Z');
const HEADER = CSV_COLUMNS.join(',');
const LIVE_CSV = `${HEADER}
2026-09-01,NAEP 2026,https://x.org/naep,research,Report,NAGB,,,,,,,,https://img/naep.jpg
2026-08-20,Old Symposium,https://x.org/old,event,Off-Campus,UT,,,,,,,,
`;

function fakeRes() {
  return {
    code: 0, body: null,
    status(c) { this.code = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

function fakeHub({ csv = LIVE_CSV, highlights = '' } = {}) {
  const puts = [];
  const files = { 'data/news.csv': { text: csv, sha: 'csv1' }, [HIGHLIGHTS_PATH]: highlights ? { text: highlights, sha: 'hl1' } : { text: '', sha: null } };
  return {
    puts,
    fetchFile: async path => files[path] ?? { text: '', sha: null },
    putFile: async (path, text, sha, message) => { puts.push({ path, text, sha, message }); files[path] = { text, sha: `${path}-next` }; },
  };
}

const kept = o => blankRow({ status: 'kept', send_to: 'both', ...o });

function desk(rows) {
  const updates = [];
  return {
    updates,
    readAllRows: async () => rows,
    updateRows: async changed => { updates.push(...changed); return { matched: changed.length, unmatched: [] }; },
  };
}

async function signedReq(method, body = {}) {
  return { method, body, headers: { cookie: `desk=${await issueToken(SECRET, NOW)}` } };
}

const handlerOver = (store, hub) => createPublishHandler({
  ...store, hub, session: { secret: SECRET, now: () => NOW }, today: () => '2026-09-23', clock: () => '2026-09-23T20:05:00.000Z',
});

test('signed out, the check and the write are both refused', async () => {
  const handler = handlerOver(desk([]), fakeHub());
  for (const method of ['GET', 'POST']) {
    const res = fakeRes();
    await handler({ method, body: {}, headers: {} }, res);
    assert.equal(res.code, 401, method);
    assert.deepEqual(res.body, { ok: false, error: 'Sign in to the desk first.' });
  }
});

test('the check answers what it always did, plus the live rows that can be picked and the picks as they stand', async () => {
  const rows = [
    kept({ id: 'a', link: 'https://x.org/new', headline: 'Brand new', type: 'research', subtype: 'Report' }),
    kept({ id: 'd', link: 'https://x.org/naep', headline: 'A repeat', type: 'research', subtype: 'Report' }),
  ];
  const hub = fakeHub({ highlights: JSON.stringify({ updated: '2026-09-20T00:00:00.000Z', items: [{ link: 'https://x.org/naep', image: '' }, { link: 'https://x.org/gone', image: '' }] }) });
  const res = fakeRes();
  await handlerOver(desk(rows), hub)(await signedReq('GET'), res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.adding, [{ id: 'a', headline: 'Brand new' }]);
  assert.deepEqual(res.body.skipped, [{ id: 'd', headline: 'A repeat' }]);
  assert.deepEqual(res.body.liveLinks, ['https://x.org/naep', 'https://x.org/old']);
  // Only what the Exchange still shows: the past event is out.
  assert.deepEqual(res.body.hub.map(r => r.link), ['https://x.org/naep']);
  assert.equal(res.body.hub[0].infographic, 'https://img/naep.jpg');
  assert.equal(res.body.highlights.updated, '2026-09-20T00:00:00.000Z');
  assert.deepEqual(res.body.highlights.items.map(i => [i.link, i.from, i.headline, i.photo]), [
    ['https://x.org/naep', 'live', 'NAEP 2026', 'https://img/naep.jpg'],
    ['https://x.org/gone', 'missing', '', ''],
  ]);
});

test('with no highlights file yet, the check says so plainly', async () => {
  const res = fakeRes();
  await handlerOver(desk([]), fakeHub())(await signedReq('GET'), res);
  assert.deepEqual(res.body.highlights, { items: [], updated: '' });
});

test('the write asks for the password again, in the body', async () => {
  const handler = handlerOver(desk([kept({ id: 'a', link: 'https://x.org/new', type: 'research', subtype: 'Report' })]), fakeHub());
  const missing = fakeRes();
  await handler(await signedReq('POST', {}), missing);
  assert.equal(missing.code, 400);
  assert.deepEqual(missing.body, { ok: false, error: 'Type the password to confirm.' });
  const wrong = fakeRes();
  await handler(await signedReq('POST', { password: 'nope' }), wrong);
  assert.equal(wrong.code, 403);
  assert.deepEqual(wrong.body, { ok: false, error: "That's not the password." });
});

test('the write appends the rows, then commits her picks with their photos, and the desk keeps the photo too', async () => {
  const rows = [
    kept({ id: 'a', link: 'https://x.org/new', headline: 'Brand new', type: 'research', subtype: 'Report', infographic: '' }),
    kept({ id: 'b', link: 'https://x.org/erc', headline: 'ERC workshop', type: 'erc_event', date: '2026-09-30', infographic: 'https://img/erc.jpg' }),
  ];
  const store = desk(rows);
  const hub = fakeHub();
  const res = fakeRes();
  await handlerOver(store, hub)(await signedReq('POST', {
    password: SECRET,
    highlights: [
      { link: 'https://x.org/new', image: 'https://img/mine.jpg' },
      { link: 'https://x.org/naep', image: '' },
      { link: 'https://x.org/erc', image: '' },
      { link: 'https://x.org/nowhere', image: '' },
    ],
  }), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.published, 2);
  assert.equal(res.body.highlighted, 3);
  assert.equal(hub.puts.length, 2);
  // The CSV line for the new row carries her photo, so the Exchange has it either way.
  assert.equal(hub.puts[0].path, 'data/news.csv');
  assert.match(hub.puts[0].text, /https:\/\/x\.org\/new,research,Report,.*https:\/\/img\/mine\.jpg\n/);
  assert.match(hub.puts[0].text, /https:\/\/x\.org\/erc,event,ERC Events,.*https:\/\/img\/erc\.jpg\n/);
  assert.equal(hub.puts[1].path, HIGHLIGHTS_PATH);
  assert.equal(hub.puts[1].sha, null);   // a new file
  assert.match(hub.puts[1].message, /highlight/i);
  assert.deepEqual(JSON.parse(hub.puts[1].text), { updated: '2026-09-23T20:05:00.000Z', items: [
    { link: 'https://x.org/new', image: 'https://img/mine.jpg' },
    { link: 'https://x.org/naep', image: '' },
    { link: 'https://x.org/erc', image: '' },
  ] });
  // published_at on both rows, and the photo on the one that had none.
  const a = store.updates.find(r => r.id === 'a');
  assert.equal(a.published_at, '2026-09-23T20:05:00.000Z');
  assert.equal(a.infographic, 'https://img/mine.jpg');
  assert.equal(store.updates.find(r => r.id === 'b').infographic, 'https://img/erc.jpg');
});

test('no picks in the body leaves the highlights file alone', async () => {
  const hub = fakeHub({ highlights: JSON.stringify({ items: [{ link: 'https://x.org/naep' }] }) });
  const res = fakeRes();
  await handlerOver(desk([kept({ id: 'a', link: 'https://x.org/new', type: 'research', subtype: 'Report' })]), hub)(await signedReq('POST', { password: SECRET }), res);
  assert.equal(res.code, 200);
  assert.deepEqual(hub.puts.map(p => p.path), ['data/news.csv']);
  assert.equal(res.body.highlighted, undefined);
});

test('picks can change with nothing new to publish: the file is written on its own', async () => {
  const hub = fakeHub({ highlights: JSON.stringify({ items: [{ link: 'https://x.org/naep' }] }) });
  const res = fakeRes();
  await handlerOver(desk([]), hub)(await signedReq('POST', { password: SECRET, highlights: [] }), res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, published: 0, skipped: 0, highlighted: 0 });
  assert.deepEqual(hub.puts.map(p => [p.path, p.sha]), [[HIGHLIGHTS_PATH, 'hl1']]);
  assert.deepEqual(JSON.parse(hub.puts[0].text).items, []);
});
