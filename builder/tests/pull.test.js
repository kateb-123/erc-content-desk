import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyIssue, mergeIssues, partitionPulled, countIssueItems } from '../js/model.js';

function issueWith(items, prefix = 't') {
  const issue = createEmptyIssue();
  let n = 0;
  for (const [section, fields] of items) {
    issue.sections[section].items.push({ id: `${prefix}_${n++}`, group: '', fields });
    issue.sections[section].enabled = true;
  }
  return issue;
}

test('partitionPulled keeps only what the outline does not have yet', () => {
  const pulled = issueWith([
    ['events', { title: 'Known', url: 'https://x.org/a' }],
    ['events', { title: 'New', url: 'https://x.org/new' }],
    ['research', { title: 'Also known', url: 'https://x.org/b' }],
  ]);
  // the outline it is measured against: two of those urls, and a row with no link
  const base = issueWith([
    ['events', { title: 'Known', url: 'https://x.org/a' }],
    ['headlines', { title: 'Also known', url: 'https://x.org/b' }],
    ['headlines', { title: 'No link' }],
  ], 'b');
  const { pulled: kept, already } = partitionPulled(pulled, base);
  assert.equal(already, 2);
  assert.equal(countIssueItems(kept), 1);
  assert.deepEqual(kept.sections.events.items.map(i => i.fields.title), ['New']);
  assert.equal(kept.sections.research.enabled, false);
  // re-pull is add-only: merging the kept remainder duplicates nothing
  mergeIssues(base, kept);
  assert.equal(countIssueItems(base), 4);
});

test('countIssueItems sums across sections', () => {
  assert.equal(countIssueItems(createEmptyIssue()), 0);
  assert.equal(countIssueItems(issueWith([['events', { title: 'A' }], ['headlines', { title: 'B' }]])), 2);
});

test('partitionPulled also dedupes by stable id, so url-less items never duplicate', () => {
  const pulled = createEmptyIssue();
  pulled.sections.headlines.items.push({ id: 'desk_r9', group: 'texas', fields: { title: 'No link here' } });
  pulled.sections.headlines.enabled = true;
  const base = createEmptyIssue();
  base.sections.headlines.items.push({ id: 'desk_r9', group: 'texas', fields: { title: 'No link here' } });
  const { pulled: kept, already } = partitionPulled(pulled, base);
  assert.equal(already, 1);
  assert.equal(countIssueItems(kept), 0);
});
