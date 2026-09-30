import test from 'node:test';
import assert from 'node:assert/strict';
import { SUMMARY_MAX, TITLE_MAX, wantsCardWords, fitSummary, fitTitle, fitCardWords } from '../js/card-words.js';

// The Exchange's New & upcoming card (Kate, Sep 30): a pick that is an
// event, an ERC event or an opportunity gets words that fit the card: a
// summary of 180 characters or fewer, one or two plain sentences, the
// invitation first, book and journal names in stars; the title as it is
// unless it runs past 80, then trimmed to 80 without losing the subject.

test('only events, ERC events and opportunities get card words', () => {
  assert.equal(wantsCardWords('event'), true);
  assert.equal(wantsCardWords('erc_event'), true);
  assert.equal(wantsCardWords('opportunity'), true);
  assert.equal(wantsCardWords('research'), false);
  assert.equal(wantsCardWords('headline'), false);
  assert.equal(wantsCardWords(''), false);
  assert.equal(SUMMARY_MAX, 180);
  assert.equal(TITLE_MAX, 80);
});

test('a summary that fits is kept as it is, tidied', () => {
  assert.equal(fitSummary('  Rural superintendents meet in Rudder Tower on October 30.  '), 'Rural superintendents meet in Rudder Tower on October 30.');
  assert.equal(fitSummary('Two\n\nlines   here.'), 'Two lines here.');
  assert.equal(fitSummary(''), '');
  assert.equal(fitSummary(null), '');
});

test('a summary past 180 is cut at the last sentence end that fits', () => {
  const one = 'Rural superintendents meet in Rudder Tower on October 30 to compare notes on staffing.';
  const two = ' Registration is open through the Maroon Education Association until the week before.';
  const three = ' Lunch is provided for everyone who signs up early.';
  const out = fitSummary(one + two + three);
  assert.equal(out, one + two);
  assert.ok(out.length <= SUMMARY_MAX);
});

test('with no sentence end that fits, the cut lands on a word and drops a dangling comma', () => {
  const words = Array.from({ length: 40 }, (_, i) => `word${i},`).join(' ');
  const out = fitSummary(words);
  assert.ok(out.length <= SUMMARY_MAX);
  assert.ok(!out.endsWith(','));
  assert.ok(!/\s$/.test(out));
  assert.ok(words.startsWith(out));
});

test('stars round a name stay paired: a lone star is dropped, an opened pair the cut broke is closed', () => {
  assert.equal(fitSummary('Read the call in *Educational Researcher* by March.'), 'Read the call in *Educational Researcher* by March.');
  assert.equal(fitSummary('A lone star * in the middle.'), 'A lone star in the middle.');
  const long = `${'x'.repeat(160)} in *Journal of Policy Analysis and Management* soon.`;
  const out = fitSummary(long);
  assert.ok(out.length <= SUMMARY_MAX);
  assert.equal((out.match(/\*/g) || []).length % 2, 0, out);
});

test('a title stays as it is under 80, and is cut to 80 on a word past it', () => {
  assert.equal(fitTitle('Rural Schools Symposium'), 'Rural Schools Symposium');
  const long = 'Texas Education Data Summit: A Two-Day Gathering on Student Records, Research Access, and Privacy in the Coming Year';
  const out = fitTitle(long);
  assert.ok(out.length <= TITLE_MAX);
  assert.ok(long.startsWith(out));
  assert.ok(!/[\s:,;-]$/.test(out));
  assert.equal(fitTitle(''), '');
});

test('fitCardWords takes the model\'s words, falls back to the item\'s own, and fits both', () => {
  const item = { headline: 'Rural Schools Symposium', blurb: 'The symposium returns to Rudder Tower.' };
  assert.deepEqual(fitCardWords({ title: 'Rural Schools Symposium', summary: 'Rural superintendents meet in Rudder Tower on October 30.' }, item),
    { title: 'Rural Schools Symposium', summary: 'Rural superintendents meet in Rudder Tower on October 30.' });
  assert.deepEqual(fitCardWords({}, item), { title: 'Rural Schools Symposium', summary: 'The symposium returns to Rudder Tower.' });
  const wide = fitCardWords({ title: 'A'.repeat(90), summary: 'B'.repeat(200) }, item);
  assert.ok(wide.title.length <= TITLE_MAX && wide.summary.length <= SUMMARY_MAX);
});
