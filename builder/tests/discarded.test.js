// discarded.test.js: Discard keeps the draft on the desk; Review lists what was discarded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  discardBody, discardToDesk, draftIsOpen, replaceAskMessage,
  discardedTitle, discardedDetail, discardedWhen, withEntry, withoutEntry, restoreOver,
} from '../js/discarded.js';
import { createEmptyIssue } from '../js/model.js';

const TZ = 'America/Chicago';
const at = iso => new Date(iso);
const plain = s => s.replace(/ /g, ' ');   // Intl puts a narrow space before AM/PM

function issueWith(n, date = 'September 22, 2026') {
  const issue = createEmptyIssue();
  issue.date = date;
  for (let i = 0; i < n; i += 1) issue.sections.events.items.push({ id: `e${i}`, group: 'tamu', fields: { title: `E${i}` } });
  return issue;
}

test('Discard sends the draft with its date as ISO, then clears it here', async () => {
  const issue = issueWith(2);
  assert.deepEqual(discardBody(issue), { issueDate: '2026-09-22', draft: issue });
  assert.equal(discardBody(issueWith(0, '')).issueDate, '');
  const order = [];
  const reply = await discardToDesk(issue, {
    send: async body => { order.push(['send', body.issueDate]); return { ok: true, draft: { id: 'd1' } }; },
    clear: () => order.push(['clear']),
  });
  assert.deepEqual(order, [['send', '2026-09-22'], ['clear']]);
  assert.equal(reply.draft.id, 'd1');
});

test('a Discard the desk cannot keep clears nothing: the local draft stays', async () => {
  let cleared = false;
  await assert.rejects(
    discardToDesk(issueWith(2), { send: async () => { throw new Error('Kept drafts need the database.'); }, clear: () => { cleared = true; } }),
    /Kept drafts need the database/,
  );
  assert.equal(cleared, false);
});

test('a draft is open when it holds items or an introduction; a date alone is not worth an ask', () => {
  assert.equal(draftIsOpen(null), false);
  assert.equal(draftIsOpen(issueWith(0)), false);
  assert.equal(draftIsOpen(issueWith(1)), true);
  const introOnly = issueWith(0);
  introOnly.intro = 'Welcome back.';
  assert.equal(draftIsOpen(introOnly), true);
});

test('the one-line ask names the open draft before Restore replaces it', () => {
  assert.equal(replaceAskMessage(issueWith(12)), 'Replace the open draft for September 22, 2026 (12 items)? It goes to Recently discarded.');
  assert.equal(replaceAskMessage(issueWith(1, '')), 'Replace the open draft (1 item)? It goes to Recently discarded.');
});

test('an entry reads as its issue, then how many items and when it was discarded', () => {
  const now = at('2026-09-23T20:00:00Z');   // 3 PM in College Station
  const entry = { id: 'a', issueDate: '2026-09-22', discardedAt: '2026-09-23T19:14:00Z', items: 12 };
  assert.equal(discardedTitle(entry), 'September 22, 2026');
  assert.equal(discardedTitle({ ...entry, issueDate: '' }), 'No issue picked');
  assert.equal(plain(discardedDetail(entry, now, TZ)), '12 items · discarded today at 2:14 PM');
  assert.equal(plain(discardedDetail({ ...entry, items: 1 }, now, TZ)), '1 item · discarded today at 2:14 PM');
  assert.equal(discardedDetail({ ...entry, discardedAt: 'garbage' }, now, TZ), '12 items');
});

test('when it was discarded: today and yesterday by the clock in College Station, older by the date', () => {
  const now = at('2026-09-23T20:00:00Z');
  assert.equal(plain(discardedWhen('2026-09-23T13:05:00Z', now, TZ)), 'today at 8:05 AM');
  assert.equal(plain(discardedWhen('2026-09-23T04:30:00Z', now, TZ)), 'yesterday at 11:30 PM', 'still the 22nd in Texas');
  assert.equal(discardedWhen('2026-09-03T15:00:00Z', now, TZ), 'Sep 3');
  assert.equal(discardedWhen('', now, TZ), '');
});

test('the list keeps newest first: a new entry leads, one restored leaves', () => {
  const a = { id: 'a', issueDate: '2026-09-22', discardedAt: '2026-09-20T10:00:00Z', items: 3 };
  const b = { id: 'b', issueDate: '2026-10-06', discardedAt: '2026-09-23T10:00:00Z', items: 1 };
  assert.deepEqual(withEntry([a], b), [b, a]);
  assert.deepEqual(withEntry([b, a], b), [b, a], 'never listed twice');
  assert.deepEqual(withEntry(null, b), [b]);
  assert.deepEqual(withoutEntry([b, a], 'b'), [a]);
  assert.deepEqual(withoutEntry(null, 'b'), []);
});


// Kate, Sep 23: Restore over an open draft keeps the open one too, for the
// same 3 months, before it is replaced.
function restoreIo(log, { keepFails = false } = {}) {
  return {
    fetchDraft: async id => { log.push(`fetch ${id}`); return { id, body: { chosen: id } }; },
    keep: async issue => { log.push(`keep ${issue.date}`); if (keepFails) throw new Error('The desk is down.'); return { draft: { id: 'kept-1' } }; },
    remove: async id => { log.push(`remove ${id}`); },
  };
}

test('restoreOver with nothing open: fetch, take it off the desk, open it; nothing is kept', async () => {
  const log = [];
  const out = await restoreOver(null, 'd1', restoreIo(log));
  assert.deepEqual(log, ['fetch d1', 'remove d1']);
  assert.deepEqual(out, { body: { chosen: 'd1' }, kept: null });
});

test('restoreOver with a draft open keeps the open one before the chosen one leaves the desk', async () => {
  const log = [];
  const out = await restoreOver(issueWith(3), 'd1', restoreIo(log));
  assert.deepEqual(log, ['fetch d1', 'keep September 22, 2026', 'remove d1']);
  assert.deepEqual(out, { body: { chosen: 'd1' }, kept: { draft: { id: 'kept-1' } } });
});

test('restoreOver stops when the open draft cannot be kept: nothing is replaced or removed', async () => {
  const log = [];
  await assert.rejects(restoreOver(issueWith(3), 'd1', restoreIo(log, { keepFails: true })), /The desk is down/);
  assert.deepEqual(log, ['fetch d1', 'keep September 22, 2026']);
});
