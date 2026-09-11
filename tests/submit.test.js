import test from 'node:test';
import assert from 'node:assert/strict';

// The endpoint builds an Anthropic client at import; these tests hand in fakes.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
const mod = await import('../api/submit.js');

function fakeRes() {
  return {
    code: 0, body: null, headers: {},
    status(code) { this.code = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    end() { return this; },
  };
}

const PASTE = 'Date: Friday, October 9, 2026\nTime: 11:30 a.m.\nLocation: Rudder 401\n\nPlease join the ERC for an EdTalk.';
const body = { title: 'ERC EdTalk with Joshua Howell', blurb: PASTE, link: 'https://calendar.tamu.edu/e', type: 'erc_event', subtype: '', submitter: 'KB' };

function harness({ read } = {}) {
  const calls = { appended: [], updated: [], deferred: [] };
  let release;
  const gate = new Promise(r => { release = r; });
  const deps = {
    appendRow: async row => { calls.appended.push(row); },
    updateRow: async row => { calls.updated.push(row); },
    readRow: read ?? (async row => { await gate; return { ...row, blurb: 'Clean.', pending_read: '' }; }),
    defer: p => { calls.deferred.push(p); },
    checkRequest: async () => null,
  };
  return { calls, deps, release };
}

test('submit saves the row as waiting for the reader and answers without waiting for it', async () => {
  assert.equal(typeof mod.createSubmitHandler, 'function');
  const { calls, deps } = harness();
  const res = fakeRes();
  await mod.createSubmitHandler(deps)({ method: 'POST', headers: {}, body }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.warnings, []);
  assert.equal(calls.appended.length, 1);
  const saved = calls.appended[0];
  assert.equal(saved.pending_read, 'yes');
  assert.equal(saved.blurb, PASTE);
  assert.equal(saved.original_text, PASTE);
  assert.equal(calls.updated.length, 0, 'nothing is re-saved before the reader finishes');
  assert.equal(calls.deferred.length, 1, 'the reading is handed to waitUntil');
});

test('when the background reading finishes, the read row is saved over the waiting one', async () => {
  assert.equal(typeof mod.createSubmitHandler, 'function');
  const { calls, deps, release } = harness();
  await mod.createSubmitHandler(deps)({ method: 'POST', headers: {}, body }, fakeRes());
  release();
  await calls.deferred[0];
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].id, calls.appended[0].id);
  assert.equal(calls.updated[0].pending_read, '');
  assert.equal(calls.updated[0].blurb, 'Clean.');
});

test('a failed reading leaves the row waiting, for Sort to retry', async () => {
  assert.equal(typeof mod.createSubmitHandler, 'function');
  const { calls, deps } = harness({ read: async () => { throw new Error('model timeout'); } });
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    await mod.createSubmitHandler(deps)({ method: 'POST', headers: {}, body }, fakeRes());
    await calls.deferred[0];
  } finally {
    console.error = original;
  }
  assert.equal(calls.updated.length, 0);
  assert.ok(errors.some(e => /reader/.test(e)), 'the failure is logged');
});

test('a submission that fails validation is refused before anything is saved', async () => {
  assert.equal(typeof mod.createSubmitHandler, 'function');
  const { calls, deps } = harness();
  const res = fakeRes();
  await mod.createSubmitHandler(deps)({ method: 'POST', headers: {}, body: { title: '', blurb: '', link: '' } }, res);
  assert.equal(res.code, 400);
  assert.equal(calls.appended.length, 0);
});

test('a row deleted from the queue while it was being read is not brought back', async () => {
  assert.equal(typeof mod.createSubmitHandler, 'function');
  const { calls, deps, release } = harness();
  deps.currentRow = async () => ({ ...calls.appended[0], status: 'trashed' });
  await mod.createSubmitHandler(deps)({ method: 'POST', headers: {}, body }, fakeRes());
  release();
  await calls.deferred[0];
  assert.equal(calls.updated.length, 0);
});
