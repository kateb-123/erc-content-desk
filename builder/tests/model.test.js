import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_REGISTRY, createEmptyIssue, sectionByAlias, groupByAlias, mergeIssueItems, mergeIssues, deleteItem, insertItem } from '../js/model.js';

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

test('sectionByAlias matches synonyms case-insensitively', () => {
  assert.equal(sectionByAlias('Upcoming Events').key, 'events');
  assert.equal(sectionByAlias('events & webinars').key, 'events');
  assert.equal(sectionByAlias('Education Headlines').key, 'headlines');
  assert.equal(sectionByAlias('Totally Unknown'), null);
});

test('groupByAlias maps event groups', () => {
  assert.equal(groupByAlias('events', 'Texas A&M'), 'tamu');
  assert.equal(groupByAlias('events', 'Online & Off-Campus'), 'offcampus');
  assert.equal(groupByAlias('events', 'Featured'), 'featured');
});

test('spotlight groups are programs, events, thisandthat in order', () => {
  const sp = SECTION_REGISTRY.find(s => s.key === 'spotlight');
  assert.equal(sp.kind, 'spotlight');
  assert.deepEqual(sp.groups.map(g => g.key), ['programs','events','thisandthat']);
});

test('spotlight group aliases resolve', () => {
  assert.equal(groupByAlias('spotlight', 'Programs & Opportunities'), 'programs');
  assert.equal(groupByAlias('spotlight', 'Events'), 'events');
  assert.equal(groupByAlias('spotlight', 'This & That'), 'thisandthat');
  // legacy alias still resolves so old content keeps parsing
  assert.equal(groupByAlias('spotlight', 'ERC Happy Hour'), 'thisandthat');
});

test('research section has brief and report groups in order', () => {
  const r = SECTION_REGISTRY.find(s => s.key === 'research');
  assert.deepEqual(r.groups.map(g => g.key), ['brief', 'report']);
});

test('new group aliases resolve', () => {
  assert.equal(groupByAlias('research', 'Research Brief'), 'brief');
  assert.equal(groupByAlias('research', 'Report'), 'report');
  assert.equal(groupByAlias('events', 'Off-Campus & Online'), 'offcampus');
  assert.equal(groupByAlias('spotlight', 'ERC Happy Hours'), 'thisandthat');
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
