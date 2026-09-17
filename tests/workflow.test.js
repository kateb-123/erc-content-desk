import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import {
  pendingRows, circlebackRows,
  keep, trash, circleback,
  applyExtractedWithProvenance, withoutAutoFilled,
  readyToPublish, buildPool,
  markPublished, markNewsletterIssue,
  duplicateFlags,
  newsletterOnly, linkCheckedFromFetch, linkNeedsCheck, reshareFlags, clearNewsletterIssue,
  needsErcVoice, missingFields, canRewrite, needsDescription,
} from '../js/workflow.js';
import { mergeArchiveIndex, archiveLabel } from '../api/_lib/archive.js';

const row = o => blankRow({ id: 'r1', status: 'new', ...o });

test('keep, trash and circleback set status without mutating input', () => {
  const r = row();
  assert.equal(keep(r).status, 'kept');
  assert.equal(trash(r).status, 'trashed');
  assert.equal(circleback(r).status, 'circleback');
  assert.equal(r.status, 'new');
});

test('circleback leaves an existing note untouched', () => {
  assert.equal(circleback(row({ note: 'from Andy' })).note, 'from Andy');
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
  assert.deepEqual(readyToPublish(rows).map(r => r.id), ['c']);
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

test('linkNeedsCheck: asks only for unread links, never after a human check', () => {
  const link = 'https://example.org/x';
  assert.equal(linkNeedsCheck(blankRow({ link, link_checked: 'failed' })), true);
  assert.equal(linkNeedsCheck(blankRow({ link, link_checked: 'human' })), false);
  assert.equal(linkNeedsCheck(blankRow({ link, link_checked: 'ok' })), false);
  // Legacy rows (no value) stay quiet: the ask only fires on a recorded failure.
  assert.equal(linkNeedsCheck(blankRow({ link, link_checked: '' })), false);
  // No link: nothing to check, even if a stale 'failed' value is present.
  assert.equal(linkNeedsCheck(blankRow({ link: '', link_checked: 'failed' })), false);
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

test('mergeArchiveIndex replaces a re-saved issue and keeps newest first', () => {
  const list = [
    { date: '2026-08-25', label: 'August 25, 2026' },
    { date: '2026-06-16', label: 'June 16, 2026' },
  ];
  const merged = mergeArchiveIndex(list, '2026-09-01');
  assert.deepEqual(merged.map(e => e.date), ['2026-09-01', '2026-08-25', '2026-06-16']);
  assert.equal(merged[0].label, 'September 1, 2026');
  // re-save replaces, never duplicates
  const again = mergeArchiveIndex(merged, '2026-08-25');
  assert.equal(again.filter(e => e.date === '2026-08-25').length, 1);
  assert.equal(archiveLabel('2025-11-17'), 'November 17, 2025');
});

test('an ERC Event publishes to the Exchange like any event (Kate, Sep 10, after her meeting)', () => {
  assert.equal(newsletterOnly({ type: 'erc_event', subtype: '' }), false);
  assert.equal(newsletterOnly({ type: 'erc_event', subtype: '', spotlight_request: true }), false);
});

test('ERC Events get the ERC voice, like every other event', () => {
  assert.equal(needsErcVoice({ type: 'erc_event', blurb: 'anything' }), true);
});

test('a Report always gets rewritten, abstract or not (Kate, Sep 9)', () => {
  // Reports carry a page-long summary rather than a real abstract.
  assert.equal(needsErcVoice({ type: 'research', subtype: 'Report', blurb: 'a long summary' }), true);
  assert.equal(needsErcVoice({ type: 'research', subtype: 'Report', blurb: '' }), true);
  // Other research with a real abstract is still left alone.
  assert.equal(needsErcVoice({ type: 'research', subtype: 'Peer-Reviewed', blurb: 'an abstract' }), false);
  // And a checked row is done for good, Report or not.
  assert.equal(needsErcVoice({ type: 'research', subtype: 'Report', rewrite_checked: '2026-09-09' }), false);
});

test('missingFields names the blanks that matter for the row\'s type', () => {
  assert.deepEqual(missingFields({ type: 'erc_event' }), ['date', 'time', 'location']);
  assert.deepEqual(missingFields({ type: 'erc_event', date: '2026-09-20', time: '3 PM CT', location: 'Harrington' }), []);
  assert.deepEqual(missingFields({ type: 'event', date: '2026-09-20', time: '', location: 'Zoom' }), ['time']);
  assert.deepEqual(missingFields({ type: 'opportunity' }), ['deadline']);
  assert.deepEqual(missingFields({ type: 'opportunity', deadline: '2026-10-15' }), []);
  // A date is load-bearing for events only — research is not flagged for one.
  assert.deepEqual(missingFields({ type: 'research', authors: 'Chen' }), []);
});

test('missingFields says nothing about a row with no type yet', () => {
  assert.deepEqual(missingFields({ type: '' }), []);
});

test('a link the reader says opens a different item is an alert, like a failed read (F20)', () => {
  assert.equal(linkNeedsCheck(blankRow({ link: 'https://a.org', link_checked: 'mismatch' })), true);
});

test('canRewrite: needs the ERC voice AND has text to draft from; a link-only event needs a description instead (F2)', () => {
  const withText = { type: 'event', blurb: '', original_text: 'Please join us.' };
  const linkOnly = { type: 'event', blurb: '', original_text: '' };
  const research = { type: 'research', subtype: 'Working Paper', blurb: 'An abstract.' };
  assert.equal(canRewrite(withText), true);
  assert.equal(canRewrite(linkOnly), false);
  assert.equal(needsDescription(linkOnly), true);
  assert.equal(needsDescription(withText), false);
  assert.equal(needsDescription(research), false);
});

test('trash clears the newsletter stamp, so a deleted item never rides into an issue (Sep 15)', () => {
  const r = { id: 'x', status: 'new', newsletter_issue: '2026-09-22' };
  assert.deepEqual(trash(r), { id: 'x', status: 'trashed', newsletter_issue: '' });
});
