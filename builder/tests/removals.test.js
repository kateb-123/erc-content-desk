// removals.test.js: Remove with its Undo in place (Kate, Sep 23: the desk's own
// pattern). A removed item leaves the issue at once and stays listed where it
// stood, greyed with its own Undo, until the step is left.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_REGISTRY, createEmptyIssue, countIssueItems, bucketSectionItems } from '../js/model.js';
import { renderNewsletter } from '../js/template.js';
import { takeOut, putBack, listedItems, listedSections } from '../js/removals.js';

/** An issue whose one section holds items with these ids, each titled after its id. */
function issueWith(sectionKey, ids, group = '') {
  const issue = createEmptyIssue();
  issue.sections[sectionKey].items = ids.map((id) => ({ id, group, fields: { title: `Item ${id}` } }));
  issue.sections[sectionKey].enabled = true;
  return issue;
}
const ids = (items) => items.map((it) => it.id);

/** Every ordering of a list. */
function orderings(list) {
  if (list.length < 2) return [list];
  return list.flatMap((first, i) => orderings([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [first, ...rest]));
}

test('a removed item leaves the issue at once: the newsletter and the saved draft never carry it', () => {
  const issue = createEmptyIssue();
  issue.sections.headlines.items = [
    { id: 'a', group: 'federal', fields: { title: 'Alpha funding rule', url: 'https://a.example.org' } },
    { id: 'b', group: 'federal', fields: { title: 'Bravo grant cut', url: 'https://b.example.org' } },
  ];
  issue.sections.headlines.enabled = true;
  const waiting = [];
  const entry = takeOut(issue, waiting, 'b');
  assert.equal(entry.item.fields.title, 'Bravo grant cut');
  assert.deepEqual(ids(issue.sections.headlines.items), ['a']);
  assert.equal(countIssueItems(issue), 1);
  assert.doesNotMatch(JSON.stringify(issue), /Bravo/, 'the saved draft is the issue as JSON');
  assert.doesNotMatch(renderNewsletter(issue), /Bravo/, 'the preview and the export render the issue');
  assert.match(renderNewsletter(issue), /Alpha funding rule/);
  assert.equal(waiting.length, 1);
});

test('the removed item stays listed where it stood, and Undo puts it back there', () => {
  const issue = issueWith('policy', ['x', 'y', 'z']);
  const waiting = [];
  takeOut(issue, waiting, 'y');
  assert.deepEqual(ids(issue.sections.policy.items), ['x', 'z']);
  assert.deepEqual(ids(listedItems(issue, waiting, 'policy')), ['x', 'y', 'z']);
  assert.equal(putBack(issue, waiting, 'y').id, 'y');
  assert.deepEqual(ids(issue.sections.policy.items), ['x', 'y', 'z']);
  assert.equal(waiting.length, 0);
});

test('any removals, undone in any order, keep every row where it stood', () => {
  const original = ['a', 'b', 'c', 'd', 'e'];
  for (const removeOrder of orderings(['a', 'c', 'd', 'e'])) {
    for (const undoOrder of orderings(['a', 'c', 'd', 'e'])) {
      const issue = issueWith('policy', original);
      const waiting = [];
      const why = `removed ${removeOrder}, undone ${undoOrder}`;
      for (const id of removeOrder) {
        takeOut(issue, waiting, id);
        assert.deepEqual(ids(listedItems(issue, waiting, 'policy')), original, why);
      }
      assert.deepEqual(ids(issue.sections.policy.items), ['b'], why);
      for (const id of undoOrder) {
        putBack(issue, waiting, id);
        assert.deepEqual(ids(listedItems(issue, waiting, 'policy')), original, why);
      }
      assert.deepEqual(ids(issue.sections.policy.items), original, why);
    }
  }
});

test('Undo between removals: the rows still come back in their own places', () => {
  const issue = issueWith('policy', ['x', 'a', 'b', 'y']);
  const waiting = [];
  takeOut(issue, waiting, 'a');
  takeOut(issue, waiting, 'b');
  putBack(issue, waiting, 'a');
  assert.deepEqual(ids(issue.sections.policy.items), ['x', 'a', 'y']);
  assert.deepEqual(ids(listedItems(issue, waiting, 'policy')), ['x', 'a', 'b', 'y']);
  takeOut(issue, waiting, 'y');
  putBack(issue, waiting, 'b');
  assert.deepEqual(ids(listedItems(issue, waiting, 'policy')), ['x', 'a', 'b', 'y']);
  putBack(issue, waiting, 'y');
  assert.deepEqual(ids(issue.sections.policy.items), ['x', 'a', 'b', 'y']);
});

test('a greyed row keeps to the row above it when the rows around it move, and Undo lands there', () => {
  const issue = issueWith('policy', ['a', 'b', 'c']);
  const waiting = [];
  takeOut(issue, waiting, 'b');
  const items = issue.sections.policy.items;
  [items[0], items[1]] = [items[1], items[0]];   // c moves up past a
  assert.deepEqual(ids(listedItems(issue, waiting, 'policy')), ['c', 'a', 'b']);
  putBack(issue, waiting, 'b');
  assert.deepEqual(ids(items), ['c', 'a', 'b']);
});

test('a greyed row sits in its own group, and only its own section lists it', () => {
  const reg = SECTION_REGISTRY.find((s) => s.key === 'events');
  const issue = createEmptyIssue();
  issue.sections.events.items = [
    { id: 't1', group: 'tamu', fields: { title: 'T1' } },
    { id: 'o1', group: 'offcampus', fields: { title: 'O1' } },
    { id: 't2', group: 'tamu', fields: { title: 'T2' } },
  ];
  issue.sections.policy.items = [{ id: 'p1', group: 'working', fields: { title: 'P1' } }];
  const waiting = [];
  takeOut(issue, waiting, 't2');   // the row above it is O1, in another group
  takeOut(issue, waiting, 'p1');
  const buckets = bucketSectionItems(reg, listedItems(issue, waiting, 'events'));
  assert.deepEqual(buckets.map((b) => ids(b.items)), [['t1', 't2'], ['o1']]);
  assert.deepEqual(ids(listedItems(issue, waiting, 'policy')), ['p1']);
  putBack(issue, waiting, 't2');
  assert.deepEqual(ids(issue.sections.events.items), ['t1', 'o1', 't2']);
});

test('the last item out switches its section off but keeps it listed until the step is left', () => {
  const issue = issueWith('events', ['e1'], 'tamu');
  const waiting = [];
  takeOut(issue, waiting, 'e1');
  assert.equal(issue.sections.events.enabled, false, 'an empty section is not in the newsletter');
  assert.equal(countIssueItems(issue), 0);
  const listed = listedSections(issue, waiting);
  assert.deepEqual(listed.populated.map((r) => r.key), ['events']);
  assert.ok(!listed.missing.includes('Upcoming Events'));
  assert.equal(listed.missing.length, SECTION_REGISTRY.length - 1);
  putBack(issue, waiting, 'e1');
  assert.equal(issue.sections.events.enabled, true);
  assert.deepEqual(ids(issue.sections.events.items), ['e1']);
});

test('once the step is left the removal is final: nothing waits, and the section is named as empty', () => {
  const issue = issueWith('events', ['e1', 'e2'], 'tamu');
  const waiting = [];
  takeOut(issue, waiting, 'e1');
  takeOut(issue, waiting, 'e2');
  waiting.length = 0;   // what leaving the step does
  assert.equal(putBack(issue, waiting, 'e1'), null);
  assert.equal(countIssueItems(issue), 0);
  assert.ok(listedSections(issue, waiting).missing.includes('Upcoming Events'));
});

test('an id that is not there changes nothing', () => {
  const issue = issueWith('policy', ['a']);
  const waiting = [];
  assert.equal(takeOut(issue, waiting, 'nope'), null);
  assert.equal(putBack(issue, waiting, 'nope'), null);
  assert.deepEqual(ids(issue.sections.policy.items), ['a']);
  assert.equal(waiting.length, 0);
});

test('Undo keeps one featured event: a newer pick wins over the one that comes back', () => {
  const issue = issueWith('events', ['f', 'g'], 'tamu');
  const [f, g] = issue.sections.events.items;
  f.featured = true;
  const waiting = [];
  takeOut(issue, waiting, 'f');
  g.featured = true;   // the Outline's Featured box, while f waits
  putBack(issue, waiting, 'f');
  assert.equal(f.featured, false);
  assert.equal(g.featured, true);
});

test('with no newer pick, a featured event comes back featured, as it was', () => {
  const issue = issueWith('events', ['h', 'i'], 'tamu');
  const [h] = issue.sections.events.items;
  h.featured = true;
  const waiting = [];
  takeOut(issue, waiting, 'h');
  putBack(issue, waiting, 'h');
  assert.equal(h.featured, true);
});

test('a greyed row whose row above went some other way is still listed, last, and Undo still brings it back', () => {
  const issue = issueWith('policy', ['a', 'b', 'c']);
  const waiting = [];
  takeOut(issue, waiting, 'b');
  issue.sections.policy.items.shift();   // a leaves without waiting
  assert.deepEqual(ids(listedItems(issue, waiting, 'policy')), ['c', 'b']);
  putBack(issue, waiting, 'b');
  assert.deepEqual(ids(issue.sections.policy.items), ['c', 'b']);
});
