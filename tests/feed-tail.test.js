import test from 'node:test';
import assert from 'node:assert/strict';
import { cutFeedTail, sameStart, fixedBlurb } from '../js/feed-tail.js';

// Kate, Oct 6: "Fix the more. idk why that is there? we want those
// abstracts, you know?" A feed's summary of a paper is cut short and ends in
// its own link word ("… more →"); the scrape took that summary as the
// description. The tail never belongs to the item.
test('cutFeedTail: the feed\'s own tail goes, and the text says whether it was cut short', () => {
  assert.deepEqual(cutFeedTail('Data from over 10,000 school districts. Grassroots… more →'),
    { text: 'Data from over 10,000 school districts. Grassroots…', changed: true, cut: true });
  assert.deepEqual(cutFeedTail('A full abstract. It ends here.'), { text: 'A full abstract. It ends here.', changed: false, cut: false });
  assert.equal(cutFeedTail('Short … Read more »').text, 'Short …');
  assert.equal(cutFeedTail('Something [...] more ->').text, 'Something [...]');
  assert.deepEqual(cutFeedTail('A post about tutoring. The post Tutoring Works appeared first on The 74.'),
    { text: 'A post about tutoring.', changed: true, cut: false });
  assert.equal(cutFeedTail('').text, '');
  assert.equal(cutFeedTail('The study found... ').cut, true, 'an ellipsis at the end is a cut too');
});

test('sameStart: the page\'s abstract begins the way the cut text does, whatever the spacing or case', () => {
  assert.equal(sameStart('Special education finance systems rely on observable indicators…', 'Special education  finance systems rely on observable indicators such as disability classifications.'), true);
  assert.equal(sameStart('Special education finance…', 'A different paper altogether.'), false);
  assert.equal(sameStart('', 'Anything'), false);
});

test('fixedBlurb: the description the desk should hold, or null when it is fine as it is', () => {
  const cut = 'Special education finance systems rely on observable indicators… more →';
  const full = 'Special education finance systems rely on observable indicators such as placements. We study Texas.';
  assert.equal(fixedBlurb({ type: 'research', blurb: cut }, full), full);
  assert.equal(fixedBlurb({ type: 'research', blurb: cut }, ''), 'Special education finance systems rely on observable indicators…');
  assert.equal(fixedBlurb({ type: 'event', blurb: cut }, full), 'Special education finance systems rely on observable indicators…');
  assert.equal(fixedBlurb({ type: 'research', blurb: 'A whole abstract.' }, full), null);
});
