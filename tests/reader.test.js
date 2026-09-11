import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import { readRow } from '../api/_lib/reader.js';

const PASTE = 'Date: Friday, September 11, 2026\nTime: 11:30 a.m. – 1:00 p.m.\nLocation: Rudder 401\n\n'
  + 'Please join the ERC for an Ed Talk with Dr. Melanie Kinskey on socioscientific issues.';

function submitted(overrides) {
  return blankRow({ id: 'r1', status: 'new', pending_read: 'yes', submitted_at: '2026-09-10T18:39:00Z', ...overrides });
}
const pageOk = async () => 'PAGE TEXT';
const pageDown = async () => '';

test('a pasted ERC event gets a clean description and its date, time, and room; the paste is kept', async () => {
  const row = submitted({ headline: 'ERC EdTalk with Melanie Kinskey', type: 'erc_event', blurb: PASTE, original_text: PASTE, link: 'https://calendar.tamu.edu/x' });
  const read = await readRow(row, {
    fetchPage: pageOk,
    extract: async () => ({
      date: '2026-09-11', time: '11:30 AM CT', location: 'Rudder 401', source: 'ERC',
      clean_blurb: 'Dr. Melanie Kinskey discusses socioscientific issues in elementary science.', needs_review: false,
    }),
  });
  assert.equal(read.blurb, 'Dr. Melanie Kinskey discusses socioscientific issues in elementary science.');
  assert.equal(read.original_text, PASTE);
  assert.equal(read.date, '2026-09-11');
  assert.equal(read.time, '11:30 AM CT');
  assert.equal(read.location, 'Rudder 401');
  assert.equal(read.link_checked, 'ok');
  assert.equal(read.pending_read, '');
  assert.equal(read.needs_review, '');
});

test('what the submitter typed is never overwritten', async () => {
  const row = submitted({ headline: 'Typed title', type: 'event', subtype: 'A&M', date: '2026-10-01', blurb: PASTE, original_text: PASTE, link: 'https://a.org' });
  const read = await readRow(row, {
    fetchPage: pageOk,
    extract: async () => ({ headline: 'Machine title', date: '2026-12-31', type: 'opportunity', clean_blurb: 'Clean.' }),
  });
  assert.equal(read.headline, 'Typed title');
  assert.equal(read.date, '2026-10-01');
  assert.equal(read.type, 'event');
});

test('a research abstract keeps its text even if the reader offers a cleaned one', async () => {
  const row = submitted({ headline: 'A paper', type: 'research', subtype: 'Working Paper', blurb: 'The abstract.', original_text: 'The abstract.', link: 'https://a.org' });
  const read = await readRow(row, { fetchPage: pageOk, extract: async () => ({ clean_blurb: 'Shorter.', authors: 'Chen' }) });
  assert.equal(read.blurb, 'The abstract.');
  assert.equal(read.authors, 'Chen');
  assert.equal(read.pending_read, '');
});

test('an untyped paste the reader files as an event is cleaned too', async () => {
  const row = submitted({ headline: 'Workshop', blurb: PASTE, original_text: PASTE, link: '' });
  const read = await readRow(row, { fetchPage: pageOk, extract: async () => ({ type: 'event', subtype: 'A&M', clean_blurb: 'A workshop.' }) });
  assert.equal(read.type, 'event');
  assert.equal(read.blurb, 'A workshop.');
});

test('a link-only item gets the description the reader writes from the page', async () => {
  const row = submitted({ headline: '', type: '', link: 'https://a.org/fellowship' });
  const read = await readRow(row, {
    fetchPage: pageOk,
    extract: async () => ({ headline: 'A Fellowship', blurb: 'From the page.', type: 'opportunity', subtype: 'Other' }),
  });
  assert.equal(read.headline, 'A Fellowship');
  assert.equal(read.blurb, 'From the page.');
  assert.equal(read.pending_read, '');
});

test('a page the desk cannot open is marked failed, and the paste is still read', async () => {
  const row = submitted({ headline: 'Talk', type: 'event', subtype: 'A&M', blurb: PASTE, original_text: PASTE, link: 'https://journals.sagepub.com/x' });
  let sawPage;
  const read = await readRow(row, {
    fetchPage: pageDown,
    extract: async (_row, page) => { sawPage = page; return { clean_blurb: 'A talk.' }; },
  });
  assert.equal(read.link_checked, 'failed');
  assert.equal(sawPage, '');
  assert.equal(read.blurb, 'A talk.');
});

test('the not-sure flag rides onto the row', async () => {
  const row = submitted({ headline: 'Thin', type: 'event', subtype: 'A&M', blurb: 'soon', original_text: 'soon' });
  const read = await readRow(row, { fetchPage: pageOk, extract: async () => ({ needs_review: true }) });
  assert.equal(read.needs_review, 'yes');
});

test('a reader failure throws, so the row stays pending for the catch-up', async () => {
  const row = submitted({ headline: 'X', type: 'event', blurb: PASTE, original_text: PASTE });
  await assert.rejects(
    readRow(row, { fetchPage: pageOk, extract: async () => { throw new Error('model timeout'); } }),
    /model timeout/,
  );
});

test('a page that is about a different item is marked mismatch and fills nothing (F20)', async () => {
  const row = submitted({ headline: 'Teacher Sorting and Preferences', type: 'research', subtype: 'Working Paper', blurb: 'One-author abstract.', original_text: 'One-author abstract.', link: 'https://edworkingpapers.com/ai26-1511' });
  const calls = [];
  const read = await readRow(row, {
    fetchPage: async () => 'PAGE: Why Are Bureaucrats More Left-Wing? by Coyoli, Davies, Finger, Phillips',
    extract: async (_row, page) => {
      calls.push(page);
      return page ? { link_matches: false, authors: 'Coyoli, Davies, Finger, Phillips', date: '2026-08-01' } : { link_matches: true, source: 'EdWorkingPapers' };
    },
  });
  assert.deepEqual(calls, ['PAGE: Why Are Bureaucrats More Left-Wing? by Coyoli, Davies, Finger, Phillips', '']);
  assert.equal(read.link_checked, 'mismatch');
  assert.equal(read.authors, '', 'nothing copied from the wrong page');
  assert.equal(read.source, 'EdWorkingPapers');
  assert.equal(read.pending_read, '');
});

test('a journal page the desk cannot open is read through its DOI instead, and the link counts as ok', async () => {
  const row = submitted({ headline: 'Identifying Structural Inequity During COVID-19', type: 'research', subtype: 'Peer-Reviewed', link: 'https://journals.sagepub.com/doi/full/10.3102/0013189X261457389' });
  let sawPage, sawDoi;
  const read = await readRow(row, {
    fetchPage: async () => '',
    lookupDoi: async doi => { sawDoi = doi; return 'Title: Identifying Structural Inequity During COVID-19\nAuthors: Motoko Akiba, Xiaonan Jiang\nPublished: 2026-06-23\nJournal: Educational Researcher'; },
    extract: async (_row, page) => { sawPage = page; return { authors: 'Motoko Akiba, Xiaonan Jiang', date: '2026-06-23', source: 'Educational Researcher', link_matches: true }; },
  });
  assert.equal(sawDoi, '10.3102/0013189X261457389');
  assert.match(sawPage, /^Authors: Motoko Akiba/m);
  assert.equal(read.link_checked, 'ok');
  assert.equal(read.authors, 'Motoko Akiba, Xiaonan Jiang');
  assert.equal(read.date, '2026-06-23');
});

test('no DOI, or a DOI Crossref does not know, leaves the failed read as it was', async () => {
  const noDoi = submitted({ headline: 'Zoom', type: 'event', subtype: 'Webinar-Online', link: 'https://brown.zoom.us/meeting/register/x' });
  let looked = 0;
  const a = await readRow(noDoi, { fetchPage: async () => '', lookupDoi: async () => { looked++; return 'X'; }, extract: async () => ({}) });
  assert.equal(looked, 0);
  assert.equal(a.link_checked, 'failed');
  const unknown = submitted({ headline: 'P', type: 'research', link: 'https://doi.org/10.3102/unknown' });
  const b = await readRow(unknown, { fetchPage: async () => '', lookupDoi: async () => '', extract: async () => ({}) });
  assert.equal(b.link_checked, 'failed');
});
