// builder/tests/item-layouts.test.js: the card's wireframes (Kate, Oct 5, 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemLayouts } from '../js/options.js';
import { createEmptyIssue } from '../js/model.js';
import { renderNewsletter } from '../js/template.js';

const item = (fields = {}, group = 'brief') => ({ id: 'r1', group, fields: { title: 'A brief', ...fields } });
const on = (list) => list.filter((l) => l.on).map((l) => l.key);

test('an item without a summary, or outside the described sections, has one layout: title and details', () => {
  assert.deepEqual(itemLayouts('research', item()).map((l) => l.key), ['bare']);
  assert.deepEqual(itemLayouts('policy', item({ summary: 'x' }, 'working')).map((l) => l.key), ['bare']);
  assert.deepEqual(on(itemLayouts('research', item())), ['bare']);
});

test('an item with a summary offers four layouts; the picture ones say they lack a photo, and still apply with a placeholder', () => {
  const list = itemLayouts('research', item({ summary: 'x' }));
  assert.deepEqual(list.map((l) => [l.key, l.dim]), [['bare', false], ['text', false], ['stamp', true], ['headshot', true]]);
  assert.deepEqual(on(list), ['text'], 'Research shows the description by default, with no picture to show');
  const noPhoto = item({ summary: 'x' });
  itemLayouts('research', noPhoto).find((l) => l.key === 'headshot').apply();
  assert.deepEqual(on(itemLayouts('research', noPhoto)), ['headshot'], 'the choice holds without a photo');
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [noPhoto];
  assert.match(renderNewsletter(issue, { editable: true }), /width:160px; height:200px; border:1px dashed/, 'the preview draws the placeholder');
  assert.ok(!/dashed|width="160"/.test(renderNewsletter(issue)), 'the email draws nothing until a photo is there');
  const withPhoto = itemLayouts('research', item({ summary: 'x', image: 'https://x.org/p.jpg' }));
  assert.deepEqual(withPhoto.map((l) => l.dim), [false, false, false, false]);
  assert.deepEqual(on(withPhoto), ['stamp'], 'a photo defaults to the stamp');
  assert.deepEqual(on(itemLayouts('spotlight', item({ title: 'ERC EdTalk: Dr. Vale', summary: 'x', image: 'https://x.org/p.jpg' }, 'events'))), ['headshot']);
  assert.deepEqual(on(itemLayouts('events', item({ summary: 'x', image: 'https://x.org/p.jpg' }, 'tamu'))), ['bare'], 'a Texas A&M event hides its description by default');
});

test('applying a layout writes what the renderer reads, and only one layout is on afterwards', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  const it = item({ summary: 'A summary.', image: 'https://x.org/p.jpg' });
  issue.sections.research.items = [it];
  const pick = (key) => { itemLayouts('research', it).find((l) => l.key === key).apply(); return renderNewsletter(issue); };
  let html = pick('bare');
  assert.ok(!html.includes('A summary.') && !html.includes('p.jpg'));
  assert.deepEqual(on(itemLayouts('research', it)), ['bare']);
  html = pick('text');
  assert.ok(html.includes('A summary.') && !html.includes('p.jpg'));
  assert.deepEqual(on(itemLayouts('research', it)), ['text']);
  html = pick('headshot');
  assert.match(html, /width="160"/);
  assert.deepEqual(on(itemLayouts('research', it)), ['headshot']);
  html = pick('stamp');
  assert.match(html, /<td valign="top" width="160" style="width:160px; vertical-align:top;"><a [^>]*><img [^>]*width="160"/, 'a research stamp is 160, at the right of the box\'s text (Kate, Oct 6)');
  assert.deepEqual(on(itemLayouts('research', it)), ['stamp']);
});
