// builder/tests/options.test.js: the Outline's per-issue layout options (Oct 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALLOUT_CHOICES, PICTURE_CHOICES, setCallout, setNav, itemOptions, setDescription, setPictureStyle, acceptPictureUrl, resetOptions, hasCustomOptions, includedWords } from '../js/options.js';
import { layoutOf, renderNewsletter, CALLOUT_STYLES, PICTURE_STYLES } from '../js/template.js';
import { createEmptyIssue } from '../js/model.js';

const item = (id, group, fields = {}, extra = {}) => ({ id, group, fields: { title: id, ...fields }, ...extra });

test('the controls offer exactly what the renderer understands, in the handoff\'s order', () => {
  assert.deepEqual(CALLOUT_CHOICES.map((c) => c.key), CALLOUT_STYLES);
  assert.deepEqual(CALLOUT_CHOICES.map((c) => c.label), ['Maroon block', 'Light gray box', 'Dotted rule', 'None']);
  assert.deepEqual(PICTURE_CHOICES.map((c) => c.key), ['none', 'stamp', 'headshot']);
  assert.ok(PICTURE_CHOICES.every((c) => PICTURE_STYLES.includes(c.key)));
});

test('setCallout writes issue.layout.callout, ignores junk, and retires the old showSubmit switch', () => {
  const issue = createEmptyIssue();
  issue.sections.research.showSubmit = false;
  setCallout(issue, 'gray');
  assert.deepEqual(layoutOf(issue), { callout: 'gray', nav: true });
  assert.ok(!('showSubmit' in issue.sections.research));
  setCallout(issue, 'bogus');
  assert.equal(issue.layout.callout, 'gray');
});

test('setNav hides and shows the contents strip', () => {
  const issue = createEmptyIssue();
  setNav(issue, false);
  assert.equal(layoutOf(issue).nav, false);
  setNav(issue, 1);
  assert.equal(layoutOf(issue).nav, true);
});

test('itemOptions: a description is offered only in the four full sections and only with a summary', () => {
  assert.equal(itemOptions('policy', item('p', 'working', { summary: 'x' })).hasDescription, false);
  assert.equal(itemOptions('research', item('r', 'brief', { summary: '  ' })).hasDescription, false);
  assert.equal(itemOptions('research', item('r', 'brief', { summary: 'x' })).hasDescription, true);
});

test('itemOptions: the description starts on in Research and Spotlight, on for a featured event, off for other events and all opportunities', () => {
  assert.equal(itemOptions('research', item('r', 'brief', { summary: 'x' })).descriptionOn, true);
  assert.equal(itemOptions('spotlight', item('s', 'programs', { summary: 'x' })).descriptionOn, true);
  assert.equal(itemOptions('events', item('f', 'featured', { summary: 'x' })).descriptionOn, true);
  assert.equal(itemOptions('events', item('f', 'tamu', { summary: 'x' }, { featured: true })).descriptionOn, true, 'the Featured checkbox pins it under Featured Events');
  assert.equal(itemOptions('events', item('e', 'tamu', { summary: 'x' })).descriptionOn, false);
  assert.equal(itemOptions('events', item('e', 'offcampus', { summary: 'x' })).descriptionOn, false);
  assert.equal(itemOptions('opportunities', item('o', 'funding', { summary: 'x' })).descriptionOn, false);
});

test('itemOptions: the picture is in play only with the description on and an image; its style defaults by title', () => {
  const photo = 'https://x.org/p.jpg';
  const o1 = itemOptions('events', item('e', 'tamu', { summary: 'x', image: photo }));
  assert.equal(o1.hasPicture, false, 'description off, no picture');
  const o2 = itemOptions('research', item('r', 'brief', { summary: 'x', image: photo }));
  assert.deepEqual([o2.hasPicture, o2.pictureStyle], [true, 'stamp']);
  const o3 = itemOptions('spotlight', item('s', 'events', { title: 'ERC EdTalk: Dr. Vale', summary: 'x', image: photo }));
  assert.equal(o3.pictureStyle, 'headshot');
  const o4 = itemOptions('spotlight', item('s', 'events', { title: 'ERC EdTalk: Dr. Vale', summary: 'x', image: photo, pictureStyle: 'none' }));
  assert.deepEqual([o4.hasPicture, o4.pictureStyle], [true, 'none']);
  assert.equal(itemOptions('research', item('r', 'brief', { summary: 'x' })).hasPicture, false, 'no image, no picture control');
});

test('setDescription and setPictureStyle write the fields the renderer reads; None keeps the image URL', () => {
  const it = item('r', 'brief', { summary: 'x', image: 'https://x.org/p.jpg' });
  setDescription(it, false);
  assert.equal(it.fields.showSummary, false);
  setPictureStyle(it, 'none');
  assert.equal(it.fields.pictureStyle, 'none');
  assert.equal(it.fields.image, 'https://x.org/p.jpg');
  setPictureStyle(it, 'sideways');
  assert.equal(it.fields.pictureStyle, 'none');
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [it];
  assert.ok(!/p\.jpg/.test(renderNewsletter(issue)), 'the email draws no picture');
});

test('acceptPictureUrl takes an http(s) address and nothing else', () => {
  assert.equal(acceptPictureUrl('  https://x.org/a.jpg '), 'https://x.org/a.jpg');
  assert.equal(acceptPictureUrl('http://x.org/a.jpg'), 'http://x.org/a.jpg');
  assert.equal(acceptPictureUrl('x.org/a.jpg'), '');
  assert.equal(acceptPictureUrl('javascript:alert(1)'), '');
  assert.equal(acceptPictureUrl('https://x.org/a b.jpg'), '');
  assert.equal(acceptPictureUrl(''), '');
});

test('resetOptions returns every option to its default, and hasCustomOptions knows when there is something to reset', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [item('r', 'brief', { summary: 'x', image: 'https://x.org/p.jpg' })];
  assert.equal(hasCustomOptions(issue), false);
  setCallout(issue, 'dotted');
  assert.equal(hasCustomOptions(issue), true);
  resetOptions(issue);
  assert.equal(hasCustomOptions(issue), false);
  setDescription(issue.sections.research.items[0], true);
  assert.equal(hasCustomOptions(issue), true, 'a stated choice counts even when it matches the default');
  setNav(issue, false);
  resetOptions(issue);
  assert.deepEqual(layoutOf(issue), { callout: 'maroon', nav: true });
  assert.ok(!('showSummary' in issue.sections.research.items[0].fields));
  assert.ok(!('layout' in issue));
  issue.sections.research.showSubmit = false;
  assert.equal(hasCustomOptions(issue), true, 'the old switch reads as a custom callout');
  resetOptions(issue);
  assert.equal(hasCustomOptions(issue), false);
});

test('the Outline\'s count line', () => {
  assert.equal(includedWords(3, 3), '3 of 3 items included');
  assert.equal(includedWords(0, 1), '0 of 1 item included');
});
