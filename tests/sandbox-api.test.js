import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, fixtureRows, SCHEDULE } from '../js/sandbox-api.js';

test('GET /api/sheet returns the fixture rows and schedule', async () => {
  const { handle } = createBackend();
  const res = await handle('/api/sheet', 'GET', {});
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.rows.length, 17);
  assert.deepEqual(res.body.schedule, SCHEDULE);
});

test('fixtureRows returns independent copies', () => {
  const a = fixtureRows();
  a[0].headline = 'mutated';
  assert.notEqual(fixtureRows()[0].headline, 'mutated');
});

test('PATCH /api/sheet merges by id and ignores unknown ids', async () => {
  const backend = createBackend();
  const res = await backend.handle('/api/sheet', 'PATCH', { rows: [
    { id: 'sbx_002', status: 'kept' },
    { id: 'nope', status: 'kept' },
  ] });
  assert.equal(res.body.saved, 1);
  assert.equal(backend.state.rows.find(r => r.id === 'sbx_002').status, 'kept');
  assert.equal(backend.state.rows.find(r => r.id === 'sbx_003').status, 'new');
});

test('POST /api/submit appends a new-status row with the next row number', async () => {
  const backend = createBackend();
  await backend.handle('/api/submit', 'POST', {
    title: 'T', blurb: 'B', link: 'https://example.org',
    type: 'headline', subtype: 'Texas', submitter: 'KB',
  });
  const added = backend.state.rows.at(-1);
  assert.equal(added.status, 'new');
  assert.equal(added.headline, 'T');
  assert.equal(added._rowNumber, 19);
  assert.equal(added.id, 'sbx_019');
});

test('POST /api/publish stamps only kept, unpublished, typed rows', async () => {
  const backend = createBackend();
  const res = await backend.handle('/api/publish', 'POST', {});
  assert.equal(res.body.published, 3); // sbx_013, sbx_014, sbx_015
  const stamped = backend.state.rows.filter(r => r.published_at).map(r => r.id).sort();
  // 016 and 017 arrive already published in the fixtures
  assert.deepEqual(stamped, ['sbx_013', 'sbx_014', 'sbx_015', 'sbx_016', 'sbx_017']);
});

test('unknown api path returns 404 with ok:false', async () => {
  const { handle } = createBackend();
  const res = await handle('/api/nope', 'GET', {});
  assert.equal(res.status, 404);
  assert.equal(res.body.ok, false);
});
