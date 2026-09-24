// send-to-desk.test.js: an item added by hand in the builder becomes a desk row in
// Content Sort's queue, stamped for the builder's issue (Kate, Sep 23).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deskTypeFor, deskSubmission, sendItemToDesk, BUILDER_SUBMITTER } from '../js/send-to-desk.js';
import { SECTION_REGISTRY } from '../js/model.js';
import { NEWSLETTER_MAP } from '../../js/schema.js';
import { validateSubmission } from '../../js/intake.js';

const RAW = 'https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/builder/images/img-20260923-abcd1234.jpg';

test('a section and group map back to the desk type and subtype that land there', () => {
  const landings = new Map();
  for (const [key, [section, group]] of Object.entries(NEWSLETTER_MAP)) {
    const at = `${section}|${group}`;
    landings.set(at, [...(landings.get(at) ?? []), key]);
  }
  for (const [at, keys] of landings) {
    if (keys.length !== 1) continue;
    const [type, subtype] = keys[0].split('|');
    const [section, group] = at.split('|');
    assert.deepEqual(deskTypeFor(section, group), { type, subtype }, at);
  }
  assert.deepEqual(deskTypeFor('spotlight', 'events'), { type: 'erc_event', subtype: '' });
  assert.deepEqual(deskTypeFor('research', 'brief'), { type: 'research', subtype: 'ERC Research' });
});

test('a group two subtypes share, or one the desk never fills, keeps its section type and leaves the subtype to Sort', () => {
  assert.deepEqual(deskTypeFor('events', 'offcampus'), { type: 'event', subtype: '' });   // Off-Campus and Webinar-Online
  assert.deepEqual(deskTypeFor('events', 'featured'), { type: 'event', subtype: '' });
  assert.deepEqual(deskTypeFor('research', 'report'), { type: 'research', subtype: '' });
});

test('no clear type, no type: Sort asks for one', () => {
  assert.deepEqual(deskTypeFor('spotlight', 'programs'), { type: '', subtype: '' });
  assert.deepEqual(deskTypeFor('spotlight', 'thisandthat'), { type: '', subtype: '' });
  assert.deepEqual(deskTypeFor('misc', 'misc'), { type: '', subtype: '' });
  assert.deepEqual(deskTypeFor('nowhere', 'x'), { type: '', subtype: '' });
});

test("a section's own type never contradicts the map, and every answer is one the desk takes", () => {
  for (const reg of SECTION_REGISTRY) {
    for (const g of reg.groups) {
      const { type, subtype } = deskTypeFor(reg.key, g.key);
      const landing = Object.entries(NEWSLETTER_MAP).filter(([, [s]]) => s === reg.key).map(([k]) => k.split('|')[0]);
      if (type && !subtype) assert.ok(landing.every(t => t === type), `${reg.key}|${g.key} as ${type}`);
      const errors = validateSubmission({ link: 'https://x.org', submitter: BUILDER_SUBMITTER, type, subtype }, { allowBlankSubtype: true });
      assert.deepEqual(errors, [], `${reg.key}|${g.key}`);
    }
  }
});

test('the submit body carries the item as the desk names things, added by the builder', () => {
  const body = deskSubmission('opportunities', {
    id: 'misc_1', group: 'funding',
    fields: { title: ' Spencer small grants ', url: 'spencer.org/grants', summary: 'Up to $50,000.', meta: 'Deadline: November 1, 2026', image: RAW },
  });
  assert.deepEqual(body, {
    title: 'Spencer small grants',
    blurb: 'Up to $50,000.',
    link: 'https://spencer.org/grants',
    type: 'opportunity',
    subtype: 'Funding & Grants',
    submitter: 'the builder',
    original_text: 'Up to $50,000.\n\nDeadline: November 1, 2026',
    infographic: RAW,
  });
  assert.deepEqual(validateSubmission(body, { allowBlankSubtype: true }), []);
});

test("an event's date, time and place ride to the reader in original_text; with none there is no original_text", () => {
  const event = deskSubmission('events', {
    group: 'offcampus',
    fields: { title: 'Data talk', url: 'https://x.org/talk', date: 'October 1, 2026', time: '1:00 PM', location: 'Online' },
  });
  assert.equal(event.original_text, 'Date: October 1, 2026\nTime: 1:00 PM\nLocation: Online');
  assert.equal(event.blurb, '');
  assert.equal(event.type, 'event');
  assert.equal(event.subtype, '');
  const bare = deskSubmission('headlines', { group: 'texas', fields: { title: 'H', url: 'https://x.org/h' } });
  assert.equal('original_text' in bare, false);
  assert.equal('infographic' in bare, false);
});

test('only an uploaded picture rides along; the desk refuses any other address', () => {
  const body = deskSubmission('research', { group: 'brief', fields: { title: 'B', url: 'https://x.org/b', image: 'http://localhost:4173/sandbox-images/img1.png' } });
  assert.equal('infographic' in body, false);
});

test('with no web link there is nothing the desk can take', () => {
  assert.equal(deskSubmission('misc', { group: 'misc', fields: { title: 'A note' } }), null);
  assert.equal(deskSubmission('misc', { group: 'misc', fields: { title: 'A note', url: '  ' } }), null);
  assert.equal(deskSubmission('misc', { group: 'misc', fields: { title: 'Mail', url: 'mailto:erc@tamu.edu' } }), null);
});

/** The desk's four doors, recorded; `fail` names the ones that throw. */
function fakeDesk({ fail = [], rows = null } = {}) {
  const calls = [];
  const deskRow = { id: 'row-9', _rowNumber: 41, headline: 'Spencer small grants', newsletter_issue: '', status: 'new' };
  const maybe = door => { if (fail.includes(door)) throw new Error(`${door} down`); };
  const api = {
    submit: async body => { calls.push(['submit', body.title]); maybe('submit'); return { ok: true, id: 'row-9' }; },
    read: async id => { calls.push(['read', id]); maybe('read'); return { read: 1, failed: 0 }; },
    rows: async () => { calls.push(['rows']); maybe('rows'); return rows ?? [{ id: 'other', _rowNumber: 2 }, deskRow]; },
    save: async saved => { calls.push(['save', saved]); maybe('save'); return saved.length; },
  };
  return { api, calls };
}

const handAdded = () => ({ id: 'misc_1', group: 'funding', fields: { title: 'Spencer small grants', url: 'https://spencer.org/grants' } });

test('send files the item, lets the reader file it, then stamps the row for the issue through the save path', async () => {
  const item = handAdded();
  const { api, calls } = fakeDesk();
  await sendItemToDesk(item, { sectionKey: 'opportunities', issueIso: '2026-10-06', api });
  assert.deepEqual(calls.map(c => c[0]), ['submit', 'read', 'rows', 'save']);
  assert.equal(calls[1][1], 'row-9');
  const [stamped] = calls[3][1];
  assert.equal(stamped.id, 'row-9');
  assert.equal(stamped.newsletter_issue, '2026-10-06');
  assert.equal(stamped._rowNumber, 41, 'the save path matches rows it read');
  assert.equal(item.deskId, 'row-9', 'the desk id stays on the builder item');
});

test('a reading that fails does not stop the stamp: Sort reads the row again', async () => {
  const item = handAdded();
  const { api, calls } = fakeDesk({ fail: ['read'] });
  await sendItemToDesk(item, { sectionKey: 'opportunities', issueIso: '2026-10-06', api });
  assert.deepEqual(calls.map(c => c[0]), ['submit', 'read', 'rows', 'save']);
});

test('a submit that fails leaves no desk id and asks nothing more', async () => {
  const item = handAdded();
  const { api, calls } = fakeDesk({ fail: ['submit'] });
  await assert.rejects(sendItemToDesk(item, { sectionKey: 'opportunities', issueIso: '2026-10-06', api }), /submit down/);
  assert.equal(item.deskId, undefined);
  assert.deepEqual(calls.map(c => c[0]), ['submit']);
});

test('a stamp that fails keeps the desk id, so Try again stamps without filing the item twice', async () => {
  const item = handAdded();
  const first = fakeDesk({ fail: ['save'] });
  await assert.rejects(sendItemToDesk(item, { sectionKey: 'opportunities', issueIso: '2026-10-06', api: first.api }), /save down/);
  assert.equal(item.deskId, 'row-9');
  const again = fakeDesk();
  await sendItemToDesk(item, { sectionKey: 'opportunities', issueIso: '2026-10-06', api: again.api });
  assert.deepEqual(again.calls.map(c => c[0]), ['read', 'rows', 'save']);
});

test("a row the desk can't find, or an issue with no date, is in the queue only, and says so", async () => {
  const lost = handAdded();
  await assert.rejects(
    sendItemToDesk(lost, { sectionKey: 'opportunities', issueIso: '2026-10-06', api: fakeDesk({ rows: [] }).api }),
    /couldn't find it/,
  );
  assert.equal(lost.deskId, 'row-9');
  const undated = handAdded();
  const { api, calls } = fakeDesk();
  await assert.rejects(sendItemToDesk(undated, { sectionKey: 'opportunities', issueIso: '', api }), /queue only/);
  assert.deepEqual(calls.map(c => c[0]), ['submit']);
  assert.equal(undated.deskId, 'row-9');
});
