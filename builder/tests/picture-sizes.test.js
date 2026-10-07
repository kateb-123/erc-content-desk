// builder/tests/picture-sizes.test.js: picture sizes by hand, and placeholders that never block (Kate, Oct 5, 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PICTURE_SIZES, pictureWidthOf, setPictureWidth, placeholderItems, itemLayouts } from '../js/options.js';
import { createEmptyIssue, countIssueItems } from '../js/model.js';
import { renderNewsletter, PICTURE_MIN, PICTURE_MAX } from '../js/template.js';
import { canEnterStep, lockedMessage, LOCKED_STEP_MESSAGE } from '../js/wizard.js';

const PHOTO = 'https://x.org/p.jpg';
const withItem = (fields, section = 'research', group = 'brief') => {
  const issue = createEmptyIssue();
  issue.sections[section].enabled = true;
  const item = { id: 'i1', group, fields: { title: 'A brief', summary: 'Words.', ...fields } };
  issue.sections[section].items = [item];
  return { issue, item };
};

test('the sizes on offer list the width and the height a portrait photo stands at, all inside the renderer\'s range', () => {
  assert.deepEqual(PICTURE_SIZES.map((s) => s.label), ['64 × 80', '96 × 120', '128 × 160', '160 × 200', '200 × 250']);
  for (const s of PICTURE_SIZES) assert.ok(s.width >= PICTURE_MIN && s.width <= PICTURE_MAX);
});

test('the width in force is the layout\'s own until one is picked; a picked size moves the photo and its column', () => {
  const { issue, item } = withItem({ image: PHOTO });
  assert.equal(pictureWidthOf(item), 96);
  assert.equal(pictureWidthOf(item, 'research'), 160, 'a research box draws 160 by default (Kate, Oct 6)');
  item.fields.pictureStyle = 'headshot';
  assert.equal(pictureWidthOf(item), 160);
  setPictureWidth(item, 200);
  assert.equal(pictureWidthOf(item), 200);
  const html = renderNewsletter(issue);
  assert.match(html, /<td valign="top" width="216" style="width:216px;[^"]*padding:3px 0 0 0;"><a [^>]*><img [^>]*width="200" style="width:200px; max-width:200px;/, 'a 200px headshot in a 216px column, beside the whole item');
  item.fields.pictureStyle = 'stamp';
  setPictureWidth(item, 64);
  assert.match(renderNewsletter(issue), /<td valign="top" width="64" style="width:64px; vertical-align:top;"><a [^>]*><img [^>]*width="64"/, 'a 64px stamp at the right of a research box\'s text');
  const ev = withItem({ image: PHOTO, pictureStyle: 'stamp' }, 'spotlight', 'events');
  setPictureWidth(ev.item, 64);
  assert.match(renderNewsletter(ev.issue), /<td valign="top" width="80" style="width:80px;[^"]*padding:4px 0 0 0;"><a [^>]*><img [^>]*width="64"/, 'a 64px stamp in an 80px column, beside the description');
  setPictureWidth(item, 9999);
  assert.equal(pictureWidthOf(item), 96, 'a width outside the range clears the choice');
  assert.ok(!('pictureWidth' in item.fields));
});

test('a picked size shapes the placeholder too', () => {
  const { issue, item } = withItem({ pictureStyle: 'stamp' });
  setPictureWidth(item, 128);
  assert.match(renderNewsletter(issue, { editable: true }), /width:128px; height:160px; border:1px dashed/);
});

test('placeholderItems names the items the preview draws a placeholder for, and nothing else', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'a', group: 'brief', fields: { title: 'No photo, stamp picked', summary: 'x', pictureStyle: 'stamp' } },
    { id: 'b', group: 'brief', fields: { title: 'No photo, nothing picked', summary: 'x' } },
    { id: 'c', group: 'brief', fields: { title: 'Photo there', summary: 'x', image: PHOTO, pictureStyle: 'headshot' } },
    { id: 'd', group: 'brief', fields: { title: 'Stamp picked, description off', summary: 'x', pictureStyle: 'stamp', showSummary: false } },
    { id: 'e', group: 'brief', fields: { title: 'None picked', summary: 'x', pictureStyle: 'none' } },
  ];
  assert.deepEqual(placeholderItems(issue).map((p) => p.item.id), ['a']);
  issue.sections.research.enabled = false;
  assert.deepEqual(placeholderItems(issue), [], 'a section that is off counts nothing');
});

test('a placeholder keeps Save & Export shut, and nothing else (Kate, Oct 5: "don\'t let it get to 4 without a picture")', () => {
  const { issue, item } = withItem({ pictureStyle: 'headshot' });
  const n = () => placeholderItems(issue).length;
  assert.equal(n(), 1);
  for (const step of ['triage', 'edit']) assert.equal(canEnterStep(step, countIssueItems(issue), n()), true, `${step} stays open`);
  assert.equal(canEnterStep('export', countIssueItems(issue), n()), false, 'Save & Export waits for the photo');
  assert.match(lockedMessage('export', countIssueItems(issue), n()), /^One item shows a placeholder where its photo would be\. Add the photo under Media/);
  assert.match(lockedMessage('export', 3, 2), /^2 items show a placeholder/);
  assert.equal(lockedMessage('export', 0, 2), LOCKED_STEP_MESSAGE, 'no issue at all says so first');
  item.fields.image = PHOTO;
  assert.equal(canEnterStep('export', countIssueItems(issue), n()), true, 'the photo opens it');
  delete item.fields.image;
  itemLayouts('research', item).find((l) => l.key === 'bare').apply();
  assert.equal(canEnterStep('export', countIssueItems(issue), n()), true, 'so does giving up the picture');
  assert.ok(!/dashed/.test(renderNewsletter(issue)), 'the sent email never carries a placeholder');
});
