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
  newsletterOnly, linkCheckedFromFetch, linkCheckState, reshareFlags, clearNewsletterIssue,
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

test('buildPool also takes newsletter-only rows that never reach the Exchange', () => {
  const rows = [
    // held: kept, unpublished, spotlight A&M event -> newsletter-only, belongs in the pool
    row({ id: 'g', status: 'kept', type: 'event', subtype: 'A&M', spotlight_request: true }),
    // not held: kept, unpublished, non-spotlight -> stays out of the pool
    row({ id: 'h', status: 'kept', type: 'event', subtype: 'A&M', spotlight_request: false }),
    // published rows behave as before
    row({ id: 'i', status: 'kept', published_at: '2026-09-01T00:00:00.000Z' }),
    row({ id: 'j', status: 'kept', published_at: '2026-09-01T00:00:00.000Z', newsletter_issue: '2026-09-01' }),
  ];
  assert.deepEqual(buildPool(rows).map(r => r.id), ['g', 'i']);
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

test('linkCheckedFromFetch maps page text to ok/failed', () => {
  assert.equal(linkCheckedFromFetch('Some page text'), 'ok');
  assert.equal(linkCheckedFromFetch(''), 'failed');
  assert.equal(linkCheckedFromFetch(undefined), 'failed');
});

test('linkCheckState: alert only for unread links, verified only for human checks', () => {
  const link = 'https://example.org/x';
  assert.equal(linkCheckState(blankRow({ link, link_checked: 'failed' })), 'alert');
  assert.equal(linkCheckState(blankRow({ link, link_checked: 'human' })), 'verified');
  assert.equal(linkCheckState(blankRow({ link, link_checked: 'ok' })), 'quiet');
  // Legacy rows (no value) stay quiet — the alert only fires on a recorded failure.
  assert.equal(linkCheckState(blankRow({ link, link_checked: '' })), 'quiet');
  // No link: nothing to check, even if a stale 'failed' value is present.
  assert.equal(linkCheckState(blankRow({ link: '', link_checked: 'failed' })), 'quiet');
});

test('newsletterOnly holds spotlight events except webinars', () => {
  assert.equal(newsletterOnly(blankRow({ type: 'event', subtype: 'A&M', spotlight_request: true })), true);
  assert.equal(newsletterOnly(blankRow({ type: 'event', subtype: 'Webinar-Online', spotlight_request: true })), false);
  assert.equal(newsletterOnly(blankRow({ type: 'event', subtype: 'A&M', spotlight_request: false })), false);
  assert.equal(newsletterOnly(blankRow({ type: 'research', subtype: 'ERC Research', spotlight_request: true })), false);
});

test('a row stamped into an issue is done with Publish — held rows drain', () => {
  const rows = [
    // stamped newsletter-only hold: out of readyToPublish entirely
    blankRow({ id: 'a', status: 'kept', type: 'event', subtype: 'A&M', spotlight_request: true, newsletter_issue: '2026-09-01' }),
    // unstamped hold: still a candidate (Publish lists it under Newsletter only)
    blankRow({ id: 'b', status: 'kept', type: 'event', subtype: 'A&M', spotlight_request: true }),
    // regular kept row, unpublished: still a candidate
    blankRow({ id: 'c', status: 'kept', type: 'headline', subtype: 'Texas' }),
  ];
  assert.deepEqual(readyToPublish(rows).map(r => r.id), ['b', 'c']);
});

test('reshareFlags points a row at a same-link row already sent in a past issue', () => {
  const today = '2026-09-01';
  const rows = [
    blankRow({ id: 'old', status: 'kept', link: 'https://x.org/a', newsletter_issue: '2026-08-18' }),
    blankRow({ id: 'again', status: 'new', link: 'https://x.org/a' }),
    blankRow({ id: 'staged', status: 'kept', link: 'https://x.org/b', newsletter_issue: '2026-10-06' }),
    blankRow({ id: 'fresh', status: 'new', link: 'https://x.org/b' }),   // staged ahead ≠ re-share
    blankRow({ id: 'nolink', status: 'new', link: '' }),
  ];
  const flags = reshareFlags(rows, today);
  assert.equal(flags.get('again'), '2026-08-18');
  assert.equal(flags.has('fresh'), false);      // future issue hasn't gone out
  assert.equal(flags.has('old'), false);        // a row never flags itself
  assert.equal(flags.has('nolink'), false);
});

test('an issue sent today already counts as shared', () => {
  const rows = [
    blankRow({ id: 'old', status: 'kept', link: 'https://x.org/a', newsletter_issue: '2026-09-01' }),
    blankRow({ id: 'again', status: 'new', link: 'https://x.org/a' }),
  ];
  assert.equal(reshareFlags(rows, '2026-09-01').get('again'), '2026-09-01');
});

test('clearNewsletterIssue is the un-send: the row rejoins the pool', () => {
  const row = blankRow({ id: 'a', status: 'kept', published_at: 'x', newsletter_issue: '2026-09-01' });
  const back = clearNewsletterIssue(row);
  assert.equal(back.newsletter_issue, '');
  assert.deepEqual(buildPool([back]).map(r => r.id), ['a']);
});
