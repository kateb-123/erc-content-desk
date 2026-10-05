// builder/tests/move-item.test.js: the Outline's Move to… (Kate, Oct 5, 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyIssue, moveItemToGroup } from '../js/model.js';
import { renderNewsletter } from '../js/template.js';

function issueWith() {
  const issue = createEmptyIssue();
  issue.sections.spotlight.enabled = true;
  issue.sections.spotlight.items = [
    { id: 'a', group: 'events', fields: { title: 'TXRDC talk', summary: 'x' } },
    { id: 'b', group: 'events', fields: { title: 'PEP Talk', summary: 'y' } },
  ];
  issue.sections.events.enabled = true;
  issue.sections.events.items = [
    { id: 'e1', group: 'tamu', fields: { title: 'Math', date: 'May 1' }, featured: true },
    { id: 'e2', group: 'offcampus', fields: { title: 'Webinar', date: 'May 2' } },
  ];
  return issue;
}

test('an item moves to another group in its own section, keeping its place in the list order of the target', () => {
  const issue = issueWith();
  assert.equal(moveItemToGroup(issue, 'a', 'spotlight', 'thisandthat'), true);
  const a = issue.sections.spotlight.items.find((i) => i.id === 'a');
  assert.equal(a.group, 'thisandthat');
  assert.deepEqual(issue.sections.spotlight.items.map((i) => i.id), ['b', 'a'], 'it joins the end');
  assert.match(renderNewsletter(issue), /This &amp; That<\/h3>[\s\S]*TXRDC talk/);
});

test('an item moves to another section; the one it left auto-hides when empty, and a featured event loses Featured on the way out', () => {
  const issue = issueWith();
  assert.equal(moveItemToGroup(issue, 'e1', 'spotlight', 'events'), true);
  const moved = issue.sections.spotlight.items.find((i) => i.id === 'e1');
  assert.equal(moved.group, 'events');
  assert.ok(!('featured' in moved));
  assert.equal(issue.sections.events.items.length, 1);
  assert.equal(moveItemToGroup(issue, 'e2', 'opportunities', 'misc'), true);
  assert.equal(issue.sections.events.enabled, false, 'nothing left in Events');
  assert.equal(issue.sections.opportunities.enabled, true);
});

test('moving an event into Featured Events makes it the one featured event', () => {
  const issue = issueWith();
  assert.equal(moveItemToGroup(issue, 'e2', 'events', 'featured'), true);
  assert.deepEqual(issue.sections.events.items.map((i) => [i.id, !!i.featured]), [['e1', false], ['e2', true]]);
});

test('an unknown item, section or group moves nothing', () => {
  const issue = issueWith();
  assert.equal(moveItemToGroup(issue, 'zz', 'spotlight', 'events'), false);
  assert.equal(moveItemToGroup(issue, 'a', 'nowhere', 'events'), false);
  assert.equal(moveItemToGroup(issue, 'a', 'spotlight', 'nogroup'), false);
  assert.deepEqual(issue.sections.spotlight.items.map((i) => i.id), ['a', 'b']);
});
