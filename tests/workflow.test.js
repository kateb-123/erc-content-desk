import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import {
  pendingRows, circlebackRows, decidedRows,
  keep, trash, circleback, undecide,
  applyExtractedWithProvenance, withoutAutoFilled,
  readyToPublish, publishedRows, buildPool,
  markPublished, markNewsletterIssue,
  staleCirclebacks, duplicateFlags, counts,
} from '../js/workflow.js';

const row = o => blankRow({ id: 'r1', status: 'new', ...o });

test('keep, trash, circleback, undecide set status without mutating input', () => {
  const r = row();
  assert.equal(keep(r).status, 'kept');
  assert.equal(trash(r).status, 'trashed');
  assert.equal(circleback(r).status, 'circleback');
  assert.equal(undecide(circleback(r)).status, 'new');
  assert.equal(r.status, 'new');
});

test('circleback appends a note on its own line', () => {
  const r = row({ note: 'from Andy' });
  assert.equal(circleback(r, 'ask Kathy').note, 'from Andy\nask Kathy');
  assert.equal(circleback(row(), 'ask Kathy').note, 'ask Kathy');
  assert.equal(circleback(r).note, 'from Andy');
});


test('filters split by status and publish state', () => {
  const rows = [
    row({ id: 'a', status: 'new' }),
    row({ id: 'b', status: 'circleback' }),
    row({ id: 'c', status: 'kept' }),
    row({ id: 'd', status: 'kept', published_at: '2026-09-01T00:00:00.000Z' }),
    row({ id: 'e', status: 'kept', published_at: '2026-09-01T00:00:00.000Z', newsletter_issue: '2026-09-01' }),
    row({ id: 'f', status: 'trashed' }),
  ];
  assert.deepEqual(pendingRows(rows).map(r => r.id), ['a']);
  assert.deepEqual(circlebackRows(rows).map(r => r.id), ['b']);
  assert.deepEqual(decidedRows(rows).map(r => r.id), ['c', 'd', 'e', 'f']);
  assert.deepEqual(readyToPublish(rows).map(r => r.id), ['c']);
  assert.deepEqual(publishedRows(rows).map(r => r.id), ['d', 'e']);
  assert.deepEqual(buildPool(rows).map(r => r.id), ['d']);
});

test('markPublished and markNewsletterIssue stamp pure copies', () => {
  const r = row({ status: 'kept' });
  const p = markPublished(r, '2026-09-01T12:00:00.000Z');
  assert.equal(p.published_at, '2026-09-01T12:00:00.000Z');
  assert.equal(r.published_at, '');
  const n = markNewsletterIssue(p, '2026-09-01');
  assert.equal(n.newsletter_issue, '2026-09-01');
  assert.equal(p.newsletter_issue, '');
});

test('staleCirclebacks flags past-dated parked events only', () => {
  const rows = [
    row({ id: 'a', status: 'circleback', type: 'event', date: '2026-08-01' }),
    row({ id: 'b', status: 'circleback', type: 'event', date: '2026-09-09' }),
    row({ id: 'c', status: 'circleback', type: 'research', date: '2026-08-01' }),
    row({ id: 'd', status: 'circleback', type: 'event', date: '' }),
  ];
  assert.deepEqual(staleCirclebacks(rows, '2026-08-26').map(r => r.id), ['a']);
});

test('duplicateFlags maps later same-link rows to the earliest submission', () => {
  const rows = [
    row({ id: 'a', link: 'https://x.org/1', submitted_at: '2026-08-01T00:00:00.000Z' }),
    row({ id: 'b', link: 'https://x.org/1', submitted_at: '2026-08-02T00:00:00.000Z' }),
    row({ id: 'c', link: 'https://x.org/2', submitted_at: '2026-08-03T00:00:00.000Z' }),
    row({ id: 'd', link: '', submitted_at: '2026-08-04T00:00:00.000Z' }),
    row({ id: 'e', link: '', submitted_at: '2026-08-05T00:00:00.000Z' }),
  ];
  const flags = duplicateFlags(rows);
  assert.equal(flags.get('b'), 'a');
  assert.equal(flags.has('a'), false);
  assert.equal(flags.has('c'), false);
  assert.equal(flags.has('d'), false); // blank links never flag
  assert.equal(flags.has('e'), false);
});

test('counts summarizes the v2 buckets', () => {
  const rows = [
    row({ id: 'a' }),
    row({ id: 'b', status: 'circleback' }),
    row({ id: 'c', status: 'kept' }),
    row({ id: 'd', status: 'kept', published_at: 'x' }),
    row({ id: 'e', status: 'trashed' }),
  ];
  assert.deepEqual(counts(rows), {
    pending: 1, circleback: 1, kept: 2, trashed: 1,
    readyToPublish: 1, published: 1, pool: 1,
  });
});

test('applyExtractedWithProvenance fills blanks only and records what it filled', () => {
  const row = blankRow({ headline: 'Kept title', type: '', source: '' });
  const { row: next, filled } = applyExtractedWithProvenance(row, {
    headline: 'Machine title', type: 'event', source: 'Brookings',
  });
  assert.equal(next.headline, 'Kept title');
  assert.equal(next.type, 'event');
  assert.equal(next.source, 'Brookings');
  assert.deepEqual(filled.sort(), ['source', 'type']);
  assert.equal(next.auto_filled, filled.join(','));
});

test('withoutAutoFilled removes only the named fields', () => {
  assert.equal(withoutAutoFilled('type,subtype,source', ['type', 'subtype']), 'source');
  assert.equal(withoutAutoFilled('source', ['type', 'subtype']), 'source');
  assert.equal(withoutAutoFilled('', ['type']), '');
  assert.equal(withoutAutoFilled(undefined, ['type']), '');
});
