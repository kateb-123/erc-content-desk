import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_REGISTRY, createEmptyIssue, mergeIssueItems, mergeIssues, deleteItem, insertItem, splitSections, bucketSectionItems, moveWithinBucket } from '../js/model.js';

test('registry order includes spotlight between research and events; no standalone happyhour', () => {
  const keys = SECTION_REGISTRY.map(s => s.key);
  assert.deepEqual(keys, ['research','spotlight','events','opportunities','policy','headlines','misc']);
});

test('createEmptyIssue starts every section disabled and empty', () => {
  const issue = createEmptyIssue();
  assert.equal(issue.sections.events.enabled, false);
  assert.deepEqual(issue.sections.events.items, []);
  assert.equal(issue.intro, '');
});

test('spotlight groups are programs, events, thisandthat in order', () => {
  const sp = SECTION_REGISTRY.find(s => s.key === 'spotlight');
  assert.equal(sp.kind, 'spotlight');
  assert.deepEqual(sp.groups.map(g => g.key), ['programs','events','thisandthat']);
});

test('research section has brief and report groups in order', () => {
  const r = SECTION_REGISTRY.find(s => s.key === 'research');
  assert.deepEqual(r.groups.map(g => g.key), ['brief', 'report']);
});

test('mergeIssueItems appends items with rvw_ ids and enables sections', () => {
  const issue = createEmptyIssue();
  mergeIssueItems(issue, [
    { sectionKey: 'headlines', item: { group: 'texas', fields: { title: 'A', url: 'https://a' } } },
    { sectionKey: 'headlines', item: { group: 'federal', fields: { title: 'B', url: 'https://b' } } },
  ]);
  assert.equal(issue.sections.headlines.items.length, 2);
  assert.equal(issue.sections.headlines.enabled, true);
  assert.deepEqual(issue.sections.headlines.items.map(i => i.id), ['rvw_1', 'rvw_2']);
  // second merge continues numbering
  mergeIssueItems(issue, [{ sectionKey: 'policy', item: { group: 'working', fields: { title: 'C' } } }]);
  assert.equal(issue.sections.policy.items[0].id, 'rvw_3');
});

test('mergeIssues appends items, fills empty date/intro, ORs enabled', () => {
  const base = createEmptyIssue();
  base.sections.headlines.items.push({ id: 'rvw_1', group: 'texas', fields: { title: 'A' } });
  base.sections.headlines.enabled = true;
  const extra = createEmptyIssue();
  extra.date = 'July 14, 2026';
  extra.intro = 'Howdy!';
  extra.sections.research.items.push({ id: 'itm_1', group: 'brief', fields: { title: 'Brief' } });
  extra.sections.research.enabled = true;
  mergeIssues(base, extra);
  assert.equal(base.date, 'July 14, 2026');
  assert.equal(base.intro, 'Howdy!');
  assert.equal(base.sections.research.items.length, 1);
  assert.equal(base.sections.headlines.items.length, 1);
  // does not overwrite non-empty date
  mergeIssues(base, { ...createEmptyIssue(), date: 'August 11, 2026' });
  assert.equal(base.date, 'July 14, 2026');
});

test('deleteItem removes by id and returns spot for undo; empties disable section', () => {
  const issue = createEmptyIssue();
  issue.sections.headlines.items = [
    { id: 'a', group: 'federal', fields: { title: 'A' } },
    { id: 'b', group: 'texas', fields: { title: 'B' } },
  ];
  issue.sections.headlines.enabled = true;
  const removed = deleteItem(issue, 'b');
  assert.deepEqual({ sectionKey: removed.sectionKey, index: removed.index, title: removed.item.fields.title },
    { sectionKey: 'headlines', index: 1, title: 'B' });
  assert.equal(issue.sections.headlines.items.length, 1);
  assert.equal(issue.sections.headlines.enabled, true);
  // remove the last one -> section disables
  deleteItem(issue, 'a');
  assert.equal(issue.sections.headlines.items.length, 0);
  assert.equal(issue.sections.headlines.enabled, false);
});

test('deleteItem returns null for an unknown id', () => {
  const issue = createEmptyIssue();
  assert.equal(deleteItem(issue, 'nope'), null);
});

test('insertItem restores a deleted item at its original index (undo)', () => {
  const issue = createEmptyIssue();
  issue.sections.policy.items = [
    { id: 'x', group: 'working', fields: { title: 'X' } },
    { id: 'y', group: 'working', fields: { title: 'Y' } },
    { id: 'z', group: 'working', fields: { title: 'Z' } },
  ];
  issue.sections.policy.enabled = true;
  const removed = deleteItem(issue, 'y');            // middle one
  assert.deepEqual(issue.sections.policy.items.map(i => i.id), ['x', 'z']);
  insertItem(issue, removed.sectionKey, removed.index, removed.item);
  assert.deepEqual(issue.sections.policy.items.map(i => i.id), ['x', 'y', 'z']); // back in place
});

test('insertItem re-enables an emptied section', () => {
  const issue = createEmptyIssue();
  issue.sections.events.items = [{ id: 'e1', group: 'offcampus', fields: { title: 'E' } }];
  issue.sections.events.enabled = true;
  const removed = deleteItem(issue, 'e1');
  assert.equal(issue.sections.events.enabled, false);
  insertItem(issue, removed.sectionKey, removed.index, removed.item);
  assert.equal(issue.sections.events.enabled, true);
  assert.equal(issue.sections.events.items.length, 1);
});

test('splitSections keeps the populated sections in registry order and names the rest (f15)', () => {
  const issue = createEmptyIssue();
  issue.sections.headlines.items.push({ id: 'b', group: 'texas', fields: { title: 'B' } });
  issue.sections.events.items.push({ id: 'a', group: 'tamu', fields: { title: 'A' } });
  const { populated, missing } = splitSections(issue);
  assert.deepEqual(populated.map((s) => s.key), ['events', 'headlines']);
  assert.deepEqual(missing, ['Featured Research', 'ERC Spotlight', 'Opportunities', 'New Education Policy Research', 'Miscellaneous']);
  const none = splitSections(createEmptyIssue());
  assert.equal(none.populated.length, 0);
  assert.equal(none.missing.length, 7);
});

test('bucketSectionItems labels one bucket per non-empty group and trails the unmatched', () => {
  const reg = SECTION_REGISTRY.find(s => s.key === 'events');
  const items = [
    { id: 'a', group: 'tamu', fields: { title: 'A' } },
    { id: 'b', group: 'featured', fields: { title: 'B' } },
    { id: 'c', group: 'nonsense', fields: { title: 'C' } },
    { id: 'd', group: 'tamu', fields: { title: 'D' } },
  ];
  const buckets = bucketSectionItems(reg, items);
  assert.deepEqual(buckets.map(b => b.label), ['Featured Events', 'Texas A&M', null]);
  assert.deepEqual(buckets.map(b => b.items.map(i => i.id)), [['b'], ['a', 'd'], ['c']]);
  // an empty group gets no bucket at all
  assert.ok(!buckets.some(b => b.label === 'Online & Off-Campus'));
});

test('bucketSectionItems gives a group-less section one unlabeled bucket', () => {
  const items = [{ id: 'a', group: '', fields: { title: 'A' } }];
  const buckets = bucketSectionItems({ key: 'flat', groups: [] }, items);
  assert.deepEqual(buckets, [{ label: null, items }]);
});

test('moveWithinBucket reorders inside the bucket and leaves other groups in place', () => {
  const a = { id: 'a', group: 'tamu' }, b = { id: 'b', group: 'featured' };
  const c = { id: 'c', group: 'tamu' }, d = { id: 'd', group: 'tamu' };
  const all = [a, b, c, d];
  const bucket = [a, c, d];              // the tamu bucket, display order
  moveWithinBucket(all, bucket, 2, 0);   // d to the front of its group
  assert.deepEqual(all.map(i => i.id), ['d', 'b', 'a', 'c']); // b keeps its slot
});

test('moveWithinBucket is a no-op when the item does not move', () => {
  const all = [{ id: 'a' }, { id: 'b' }];
  moveWithinBucket(all, all, 1, 1);
  assert.deepEqual(all.map(i => i.id), ['a', 'b']);
});
