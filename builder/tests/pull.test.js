import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyIssue, mergeIssues, issueLinks, issueItemIds, partitionPulled, countIssueItems } from '../js/model.js';

function issueWith(items) {
  const issue = createEmptyIssue();
  for (const [section, fields] of items) {
    issue.sections[section].items.push({ id: `t_${issue.sections[section].items.length}`, group: '', fields });
    issue.sections[section].enabled = true;
  }
  return issue;
}

test('issueLinks collects every url already in the outline', () => {
  const issue = issueWith([
    ['events', { title: 'A', url: 'https://x.org/a' }],
    ['headlines', { title: 'B', url: 'https://x.org/b' }],
    ['headlines', { title: 'No link' }],
  ]);
  assert.deepEqual([...issueLinks(issue)].sort(), ['https://x.org/a', 'https://x.org/b']);
});

test('partitionPulled keeps only what the outline does not have yet', () => {
  const pulled = issueWith([
    ['events', { title: 'Known', url: 'https://x.org/a' }],
    ['events', { title: 'New', url: 'https://x.org/new' }],
    ['research', { title: 'Also known', url: 'https://x.org/b' }],
  ]);
  const { pulled: kept, already } = partitionPulled(pulled, new Set(['https://x.org/a', 'https://x.org/b']));
  assert.equal(already, 2);
  assert.equal(countIssueItems(kept), 1);
  assert.deepEqual(kept.sections.events.items.map(i => i.fields.title), ['New']);
  assert.equal(kept.sections.research.enabled, false);
  // re-pull is add-only: merging the kept remainder duplicates nothing
  const base = issueWith([['events', { title: 'Known', url: 'https://x.org/a' }]]);
  mergeIssues(base, kept);
  assert.equal(countIssueItems(base), 2);
});

test('countIssueItems sums across sections', () => {
  assert.equal(countIssueItems(createEmptyIssue()), 0);
  assert.equal(countIssueItems(issueWith([['events', { title: 'A' }], ['headlines', { title: 'B' }]])), 2);
});

test('the Miscellaneous section renders with only its section band, no group heading', async () => {
  const { renderNewsletter } = await import('../js/template.js');
  const issue = createEmptyIssue();
  issue.sections.misc.items.push({ id: 'm1', group: 'misc', fields: { title: 'A one-off thing', url: 'https://x.org/misc' } });
  issue.sections.misc.enabled = true;
  const html = renderNewsletter(issue);
  assert.ok(html.includes('Miscellaneous'));
  assert.ok(html.includes('A one-off thing'));
  assert.ok(!html.includes('letter-spacing: 1.1px;"></p>')); // no empty group label
});

test('partitionPulled also dedupes by stable id, so url-less items never duplicate', () => {
  const pulled = createEmptyIssue();
  pulled.sections.headlines.items.push({ id: 'desk_r9', group: 'texas', fields: { title: 'No link here' } });
  pulled.sections.headlines.enabled = true;
  const base = createEmptyIssue();
  base.sections.headlines.items.push({ id: 'desk_r9', group: 'texas', fields: { title: 'No link here' } });
  const { pulled: kept, already } = partitionPulled(pulled, issueLinks(base), issueItemIds(base));
  assert.equal(already, 1);
  assert.equal(countIssueItems(kept), 0);
});
