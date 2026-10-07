// builder/tests/options.test.js: the Outline's per-issue layout options (Oct 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALLOUT_CHOICES, PICTURE_CHOICES, addCallout, removeCallout, restoreCallout, moveCallout, setCalloutStyle, setNav, itemOptions, setDescription, setPictureStyle, acceptPictureUrl, resetOptions, hasCustomOptions, includedWords, canHighlight, setHighlight, setSectionOrder, moveSection } from '../js/options.js';
import { layoutOf, calloutsOf, sectionOrder, renderNewsletter, CALLOUT_STYLES, PICTURE_STYLES } from '../js/template.js';
import { createEmptyIssue, CALLOUT_KINDS, SHARE_URL, SECTION_REGISTRY } from '../js/model.js';

const item = (id, group, fields = {}, extra = {}) => ({ id, group, fields: { title: id, ...fields }, ...extra });

test('the controls offer exactly what the renderer understands, in the handoff\'s order', () => {
  assert.deepEqual(CALLOUT_CHOICES.map((c) => c.key), CALLOUT_STYLES);
  assert.deepEqual(CALLOUT_CHOICES.map((c) => c.label), ['Maroon block', 'Light gray box', 'Dotted rule']);
  assert.deepEqual(PICTURE_CHOICES.map((c) => c.key), ['none', 'stamp', 'headshot']);
  assert.ok(PICTURE_CHOICES.every((c) => PICTURE_STYLES.includes(c.key)));
});

test('the two kinds of callout (Kate, Oct 5): Share, in the desk\'s words to its share page, and your own words', () => {
  assert.deepEqual(Object.keys(CALLOUT_KINDS), ['share', 'custom']);
  assert.equal(CALLOUT_KINDS.share.url, SHARE_URL);
  assert.equal(SHARE_URL, 'https://erc-policy-exchange.vercel.app/share/');
  assert.match(CALLOUT_KINDS.share.text, /Research, an event, an announcement/);
  assert.equal(CALLOUT_KINDS.custom.url, '');
});

test('a new issue has one Share callout after ERC Research; add, move, style, remove and restore work on the list', () => {
  const issue = createEmptyIssue();
  assert.deepEqual(calloutsOf(issue).map((c) => [c.kind, c.after, c.style]), [['share', 'research', 'maroon']]);
  const c = addCallout(issue, 'custom', 'headlines');
  assert.equal(c.kind, 'custom');
  assert.equal(c.after, 'headlines');
  assert.equal(c.title, 'A title for this callout');
  assert.equal(addCallout(issue, 'bogus', 'nowhere').after, 'research', 'unknown kind and section fall back');
  assert.equal(calloutsOf(issue).length, 3);
  assert.equal(moveCallout(issue, c.id, 'policy'), true);
  assert.equal(c.after, 'policy');
  assert.equal(moveCallout(issue, c.id, 'nowhere'), false);
  setCalloutStyle(c, 'dotted');
  assert.equal(c.style, 'dotted');
  setCalloutStyle(c, 'none');
  assert.equal(c.style, 'dotted', 'none is not a style any more; removing is');
  const gone = removeCallout(issue, c.id);
  assert.equal(gone, c);
  assert.equal(calloutsOf(issue).length, 2);
  assert.equal(removeCallout(issue, 'zz'), null);
  restoreCallout(issue, gone, 1);
  assert.deepEqual(issue.callouts.map((x) => x.id)[1], c.id);
});

test('an older draft with no callouts list gets one made from its layout.callout on the first change', () => {
  const issue = createEmptyIssue();
  delete issue.callouts;
  issue.layout = { callout: 'gray' };
  const added = addCallout(issue, 'custom', 'events');
  assert.deepEqual(issue.callouts.map((c) => [c.kind, c.style]), [['share', 'gray'], ['custom', 'maroon']]);
  assert.equal(issue.callouts[1], added);
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
  setNav(issue, false);
  assert.equal(hasCustomOptions(issue), true);
  resetOptions(issue);
  assert.equal(hasCustomOptions(issue), false);
  setDescription(issue.sections.research.items[0], true);
  assert.equal(hasCustomOptions(issue), true, 'a stated choice counts even when it matches the default');
  setNav(issue, false);
  addCallout(issue, 'custom', 'events');
  resetOptions(issue);
  assert.deepEqual(layoutOf(issue), { nav: true });
  assert.ok(!('showSummary' in issue.sections.research.items[0].fields));
  assert.ok(!('layout' in issue));
  assert.equal(calloutsOf(issue).length, 2, 'callouts are content, not options: Reset leaves them');
  assert.equal(hasCustomOptions(issue), false);
});

test('the highlight card (Kate, Oct 6) is offered to Spotlight and Upcoming Events items; setHighlight writes the field, Reset clears it, and it counts as a custom option', () => {
  assert.equal(canHighlight('spotlight'), true);
  assert.equal(canHighlight('events'), true);
  assert.equal(canHighlight('research'), false);
  assert.equal(canHighlight('opportunities'), false);
  const issue = createEmptyIssue();
  issue.sections.spotlight.enabled = true;
  const it = item('c', 'events', { summary: 'x', date: 'October 20, 2026' });
  issue.sections.spotlight.items = [it];
  assert.equal(hasCustomOptions(issue), false);
  setHighlight(it, true);
  assert.equal(it.fields.highlight, true);
  assert.equal(hasCustomOptions(issue), true);
  assert.match(renderNewsletter(issue), /background-color:#500000; padding:22px 20px 20px 20px;/);
  setHighlight(it, false);
  assert.ok(!('highlight' in it.fields), 'off is the default, so the field goes');
  setHighlight(it, true);
  resetOptions(issue);
  assert.ok(!('highlight' in it.fields));
});

test('setSectionOrder and moveSection (Kate, Oct 6: drag and drop) write the order the renderer reads; the registry order is the default and Reset returns to it', () => {
  const registry = SECTION_REGISTRY.map((s) => s.key);
  const issue = createEmptyIssue();
  assert.equal(hasCustomOptions(issue), false);
  setSectionOrder(issue, ['spotlight', 'research']);
  assert.deepEqual(sectionOrder(issue), ['spotlight', 'research', 'events', 'opportunities', 'policy', 'headlines', 'misc']);
  assert.equal(hasCustomOptions(issue), true);
  assert.equal(moveSection(issue, 'headlines', 0), true);
  assert.deepEqual(sectionOrder(issue).slice(0, 3), ['headlines', 'spotlight', 'research']);
  assert.equal(moveSection(issue, 'headlines', 99), true);
  assert.equal(sectionOrder(issue).at(-1), 'headlines', 'past the end lands last');
  assert.equal(moveSection(issue, 'nowhere', 0), false);
  setSectionOrder(issue, registry);
  assert.equal(hasCustomOptions(issue), false, 'the registry order is the default, so nothing to reset');
  assert.ok(!('order' in (issue.layout || {})), 'and the field goes');
  moveSection(issue, 'misc', 0);
  resetOptions(issue);
  assert.deepEqual(sectionOrder(issue), registry);
});

test('the Outline\'s count line', () => {
  assert.equal(includedWords(3, 3), '3 of 3 items included');
  assert.equal(includedWords(0, 1), '0 of 1 item included');
});
