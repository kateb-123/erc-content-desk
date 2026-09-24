import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import {
  pendingRows, circlebackRows,
  keep, trash, circleback,
  applyExtractedWithProvenance, withoutAutoFilled,
  readyToPublish, readyToFinalize, buildPool, sendTo, sendToValue,
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
  // Send it to (Kate, Sep 18): a kept row waits on Newsletter as soon as it is kept, published or not.
  assert.deepEqual(buildPool(rows).map(r => r.id), ['c', 'd']);
});

// ── Send it to (Kate, Sep 18: "Tick = it waits on that page") ──

test('sendTo reads the ticks a row carries', () => {
  assert.deepEqual(sendTo(row({ send_to: 'both' })), { newsletter: true, exchange: true });
  assert.deepEqual(sendTo(row({ send_to: 'newsletter' })), { newsletter: true, exchange: false });
  assert.deepEqual(sendTo(row({ send_to: 'exchange' })), { newsletter: false, exchange: true });
  assert.deepEqual(sendTo(row({ send_to: 'none' })), { newsletter: false, exchange: false });
});

test('an untouched row takes the old rule: both, but a campus event (A&M) and a row already stamped unpublished are newsletter only', () => {
  assert.deepEqual(sendTo(row({ type: 'research' })), { newsletter: true, exchange: true });
  assert.deepEqual(sendTo(row({ type: 'event', subtype: 'A&M' })), { newsletter: true, exchange: false });
  assert.deepEqual(sendTo(row({ type: 'event', subtype: 'Off-Campus', spotlight_request: true })), { newsletter: true, exchange: true });   // the old flag moves nothing
  assert.deepEqual(sendTo(row({ type: 'headline', newsletter_issue: '2026-09-22' })), { newsletter: true, exchange: false });   // quick add stamps before Sort
  assert.deepEqual(sendTo(row({ type: 'headline', newsletter_issue: '2026-09-22', published_at: 'x' })), { newsletter: true, exchange: true });
});

test('sendToValue writes the ticks back as one word', () => {
  assert.equal(sendToValue({ newsletter: true, exchange: true }), 'both');
  assert.equal(sendToValue({ newsletter: true, exchange: false }), 'newsletter');
  assert.equal(sendToValue({ newsletter: false, exchange: true }), 'exchange');
  assert.equal(sendToValue({ newsletter: false, exchange: false }), 'none');
});

test('keep freezes the ticks on the row, so a later stamp or type change never moves it', () => {
  assert.equal(keep(row({ type: 'research' })).send_to, 'both');
  assert.equal(keep(row({ type: 'event', subtype: 'A&M' })).send_to, 'newsletter');
  assert.equal(keep(row({ type: 'event', subtype: 'Off-Campus', spotlight_request: true })).send_to, 'both');
  assert.equal(keep(row({ type: 'research', send_to: 'exchange' })).send_to, 'exchange');
});

test('a tick puts a kept row on that page: Newsletter at once, published or not; the Exchange until it is published', () => {
  const rows = [
    row({ id: 'n', status: 'kept', send_to: 'newsletter' }),
    row({ id: 'e', status: 'kept', send_to: 'exchange' }),
    row({ id: 'b', status: 'kept', send_to: 'both' }),
    row({ id: 'x', status: 'kept', send_to: 'none' }),
    row({ id: 'bs', status: 'kept', send_to: 'both', newsletter_issue: '2026-09-22' }),   // in an issue, still to publish
    row({ id: 'bp', status: 'kept', send_to: 'both', published_at: 'x' }),
    row({ id: 'q', status: 'new', send_to: 'both' }),
  ];
  assert.deepEqual(buildPool(rows).map(r => r.id), ['n', 'b', 'bp']);
  assert.deepEqual(readyToPublish(rows).map(r => r.id), ['e', 'b', 'bs']);
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

test('newsletterOnly is the campus rule (Kate, Sep 22): an Event with the A&M subtype, nothing else', () => {
  assert.equal(newsletterOnly(blankRow({ type: 'event', subtype: 'A&M' })), true);
  assert.equal(newsletterOnly(blankRow({ type: 'event', subtype: 'A&M', spotlight_request: true })), true);
  assert.equal(newsletterOnly(blankRow({ type: 'event', subtype: 'Webinar-Online', spotlight_request: true })), false);
  assert.equal(newsletterOnly(blankRow({ type: 'event', subtype: 'Off-Campus', spotlight_request: true })), false);
  assert.equal(newsletterOnly(blankRow({ type: 'research', subtype: 'ERC Research', spotlight_request: true })), false);
  assert.equal(newsletterOnly(blankRow({ type: 'erc_event', subtype: 'A&M' })), false);   // ERC's own events go to the Exchange
});

test('Finalize takes every kept row still on its way, wherever it is ticked for: not published, not in an issue', () => {
  const rows = [
    row({ id: 'n', status: 'kept', send_to: 'newsletter' }),
    row({ id: 'e', status: 'kept', send_to: 'exchange' }),
    row({ id: 'p', status: 'kept', send_to: 'both', published_at: 'x' }),
    row({ id: 's', status: 'kept', send_to: 'both', newsletter_issue: '2026-09-22' }),
    row({ id: 'q', status: 'new' }),
  ];
  assert.deepEqual(readyToFinalize(rows).map(r => r.id), ['n', 'e']);
});

test('a row kept before Send it to keeps the old routing: newsletter-only holds and quick-added stamps stay off the Exchange', () => {
  const rows = [
    blankRow({ id: 'a', status: 'kept', type: 'event', subtype: 'A&M', spotlight_request: true, newsletter_issue: '2026-09-01' }),
    blankRow({ id: 'b', status: 'kept', type: 'event', subtype: 'A&M', spotlight_request: true }),
    blankRow({ id: 'c', status: 'kept', type: 'headline', subtype: 'Texas' }),
    blankRow({ id: 'd', status: 'kept', type: 'headline', subtype: 'Texas', newsletter_issue: '2026-09-01' }),
  ];
  assert.deepEqual(readyToPublish(rows).map(r => r.id), ['c']);
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
  // A webinar has no location to miss (Kate, Sep 23); an event still has.
  assert.deepEqual(missingFields({ type: 'event', subtype: 'Webinar-Online', date: '2026-09-20', time: '3 PM CT' }), []);
  assert.deepEqual(missingFields({ type: 'event', subtype: 'Off-Campus', date: '2026-09-20', time: '3 PM CT' }), ['location']);
  // The outlet (medium) is nothing anyone types: a headline needs no field filled.
  assert.deepEqual(missingFields({ type: 'headline', source: 'Texas Tribune' }), []);
  assert.deepEqual(missingFields({ type: 'headline' }), []);
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
