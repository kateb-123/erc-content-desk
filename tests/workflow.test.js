import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import {
  pendingRows, decidedRows, keepersAwaitingProcess, readyFor,
  keep, trash, undecide, applyExtracted, markUsed, counts,
} from '../js/workflow.js';

test('pendingRows are the undecided ones', () => {
  const rows = [blankRow({ id: 'a', status: 'new' }), blankRow({ id: 'b', status: 'kept' })];
  assert.deepEqual(pendingRows(rows).map(r => r.id), ['a']);
});

test('decidedRows are kept and processed, not trashed', () => {
  const rows = [
    blankRow({ id: 'a', status: 'new' }),
    blankRow({ id: 'b', status: 'kept' }),
    blankRow({ id: 'c', status: 'processed' }),
    blankRow({ id: 'd', status: 'trashed' }),
  ];
  assert.deepEqual(decidedRows(rows).map(r => r.id), ['b', 'c']);
});

test('keep moves a row to kept and records the destinations', () => {
  const row = keep(blankRow({ id: 'a', status: 'new', type: 'headline' }), { newsletter: true, hub: true });
  assert.equal(row.status, 'kept');
  assert.equal(row.newsletter, true);
  assert.equal(row.hub, true);
});

test('keep never sets hub on a known newsletter-only type', () => {
  const row = keep(blankRow({ id: 'a', type: 'spotlight' }), { newsletter: true, hub: true });
  assert.equal(row.newsletter, true);
  assert.equal(row.hub, false);
});

test('keep honours hub when the type is not known yet', () => {
  // This is the real Sort-screen case: type is blank until Process runs, so an
  // eligibility check here would silently drop every hub tick the team makes.
  const row = keep(blankRow({ id: 'a', type: '' }), { newsletter: false, hub: true });
  assert.equal(row.hub, true);
});

test('keep does not mutate its input', () => {
  const before = blankRow({ id: 'a', status: 'new' });
  keep(before, { newsletter: true, hub: false });
  assert.equal(before.status, 'new');
  assert.equal(before.newsletter, false);
});

test('trash clears the destinations so a trashed row can never be built', () => {
  const row = trash(blankRow({ id: 'a', status: 'kept', newsletter: true, hub: true }));
  assert.equal(row.status, 'trashed');
  assert.equal(row.newsletter, false);
  assert.equal(row.hub, false);
});

test('undecide returns a row to the pending pile', () => {
  const row = undecide(blankRow({ id: 'a', status: 'kept', newsletter: true }));
  assert.equal(row.status, 'new');
  assert.equal(row.newsletter, false);
});

test('keepersAwaitingProcess is kept rows only, not already-processed ones', () => {
  const rows = [
    blankRow({ id: 'a', status: 'kept' }),
    blankRow({ id: 'b', status: 'processed' }),
    blankRow({ id: 'c', status: 'new' }),
  ];
  assert.deepEqual(keepersAwaitingProcess(rows).map(r => r.id), ['a']);
});

test('applyExtracted fills CSV fields, advances status, and preserves the original', () => {
  const before = blankRow({ id: 'a', status: 'kept', original_text: 'raw pasted text', submitter: 'Priya' });
  const row = applyExtracted(before, { headline: 'Clean headline', type: 'headline', subtype: 'Texas', blurb: 'A blurb.' });
  assert.equal(row.status, 'processed');
  assert.equal(row.headline, 'Clean headline');
  assert.equal(row.blurb, 'A blurb.');
  assert.equal(row.original_text, 'raw pasted text');
  assert.equal(row.submitter, 'Priya');
});

test('applyExtracted ignores keys that are not CSV columns', () => {
  const row = applyExtracted(blankRow({ id: 'a', status: 'kept' }), { headline: 'Ok', status: 'trashed', id: 'hacked' });
  assert.equal(row.status, 'processed');
  assert.equal(row.id, 'a');
});

test('applyExtracted drops the hub flag once the type turns out to be newsletter-only', () => {
  // The team ticks Hub before the type is known. If Claude then classifies the
  // item as ERC-internal, it must not end up in the public hub CSV.
  const row = applyExtracted(blankRow({ id: 'a', status: 'kept', newsletter: true, hub: true }), {
    headline: 'ERC happy hour', type: 'spotlight', subtype: 'This & That', blurb: 'b',
  });
  assert.equal(row.hub, false);
  assert.equal(row.newsletter, true);
});

test('applyExtracted keeps the hub flag for a hub-eligible type', () => {
  const row = applyExtracted(blankRow({ id: 'a', status: 'kept', hub: true }), {
    headline: 'A study', type: 'research', subtype: 'Report', blurb: 'b',
  });
  assert.equal(row.hub, true);
});

test('readyFor returns processed rows flagged for that destination and not yet used', () => {
  const rows = [
    blankRow({ id: 'a', status: 'processed', newsletter: true, hub: true }),
    blankRow({ id: 'b', status: 'processed', newsletter: true, newsletter_used_at: '2026-08-01' }),
    blankRow({ id: 'c', status: 'kept', newsletter: true }),
    blankRow({ id: 'd', status: 'processed', hub: true }),
  ];
  assert.deepEqual(readyFor(rows, 'newsletter').map(r => r.id), ['a']);
  assert.deepEqual(readyFor(rows, 'hub').map(r => r.id), ['a', 'd']);
});

test('markUsed stamps one destination and leaves the other alone', () => {
  const row = markUsed(blankRow({ id: 'a', status: 'processed', newsletter: true, hub: true }), 'newsletter', '2026-08-12T10:00:00Z');
  assert.equal(row.newsletter_used_at, '2026-08-12T10:00:00Z');
  assert.equal(row.hub_used_at, '');
  assert.equal(row.status, 'processed');
});

test('counts summarises the whole sheet', () => {
  const rows = [
    blankRow({ status: 'new' }),
    blankRow({ status: 'new' }),
    blankRow({ status: 'kept' }),
    blankRow({ status: 'processed', newsletter: true }),
    blankRow({ status: 'trashed' }),
  ];
  assert.deepEqual(counts(rows), {
    pending: 2, kept: 1, processed: 1, trashed: 1, newsletterReady: 1, hubReady: 0,
  });
});
