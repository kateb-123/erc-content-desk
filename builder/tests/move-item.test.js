// builder/tests/move-item.test.js: the Outline's Move to… (Kate, Oct 5, 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyIssue, moveItemToGroup, moveItemNear } from '../js/model.js';
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

// ── A drag by the grip (Kate, Oct 7, 2026): on the Outline and on the email ──

test('an item dragged before or after another lands there and takes the group it lands in', () => {
  const issue = createEmptyIssue();
  issue.sections.events.enabled = true;
  issue.sections.events.items = [
    { id: 'e1', group: 'tamu', fields: { title: 'Math', date: 'May 1' }, featured: true },
    { id: 'e2', group: 'tamu', fields: { title: 'Talk', date: 'May 2' } },
    { id: 'e3', group: 'offcampus', fields: { title: 'Webinar', date: 'May 3' } },
  ];
  const items = issue.sections.events.items;
  const order = () => items.map((i) => `${i.id}:${i.group}${i.featured ? '*' : ''}`);
  assert.equal(moveItemNear(issue, 'events', 'e3', 'e2', true), true);
  assert.deepEqual(order(), ['e1:tamu*', 'e3:tamu', 'e2:tamu'], 'before: the Webinar joins Texas A&M ahead of the Talk');
  assert.equal(moveItemNear(issue, 'events', 'e3', 'e2', false), true);
  assert.deepEqual(order(), ['e1:tamu*', 'e2:tamu', 'e3:tamu'], 'after');
  assert.equal(moveItemNear(issue, 'events', 'e1', 'e3', false), true);
  assert.deepEqual(order(), ['e2:tamu', 'e3:tamu', 'e1:tamu'], 'the featured event dragged into the list stops being featured');
  const html = renderNewsletter(issue);
  assert.match(html, /Texas A&amp;M<\/h3>[\s\S]*Talk[\s\S]*Webinar[\s\S]*Math/);
  assert.doesNotMatch(html, /Featured Events/);
});

test('nothing lands beside the one featured event, and a stray id or section moves nothing', () => {
  const issue = issueWith();   // e1 featured, e2 off campus
  const before = JSON.stringify(issue);
  assert.equal(moveItemNear(issue, 'events', 'e2', 'e1', true), false, 'Feature it instead');
  assert.equal(moveItemNear(issue, 'events', 'e2', 'e2', true), false);
  assert.equal(moveItemNear(issue, 'events', 'zz', 'e1', true), false);
  assert.equal(moveItemNear(issue, 'spotlight', 'e2', 'a', true), false, 'the item is in another section');
  assert.equal(moveItemNear(issue, 'nowhere', 'e2', 'e1', true), false);
  assert.equal(JSON.stringify(issue), before, 'nothing changed');
});

test('in Research the group is the kind: a report dragged before a brief prints as a brief', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'r1', group: 'brief', fields: { title: 'A brief', summary: 'x' } },
    { id: 'r2', group: 'report', fields: { title: 'A report', summary: 'y' } },
  ];
  assert.equal(moveItemNear(issue, 'research', 'r2', 'r1', true), true);
  assert.deepEqual(issue.sections.research.items.map((i) => `${i.id}:${i.group}`), ['r2:brief', 'r1:brief']);
  const html = renderNewsletter(issue);
  assert.equal((html.match(/Research Brief<\/p>/g) || []).length, 2, 'two brief eyebrows');
  assert.ok(html.indexOf('A report') < html.indexOf('A brief'), 'the report prints first');
});
