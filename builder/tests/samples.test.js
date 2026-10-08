// builder/tests/samples.test.js: the two samples the Issue list offers (Kate,
// Oct 7, 2026: the hand-off to Kathy). Each is a draft the builder opens at
// once; the practice one is made up end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLES } from '../js/wizard.js';
import { SECTION_REGISTRY, countIssueItems } from '../js/model.js';
import { renderNewsletter, calloutsOf } from '../js/template.js';
import { placeholderItems } from '../js/options.js';

const load = (s) => JSON.parse(readFileSync(new URL(`../${s.file}`, import.meta.url), 'utf8'));

test('each sample is a draft the builder can open: its key, a date, items, no placeholder, every link https', () => {
  for (const s of SAMPLES) {
    const issue = load(s);
    assert.equal(issue.sample, s.key, `${s.key}: carries its key, so Save to the archive stays off`);
    assert.match(issue.date, /^[A-Z][a-z]+ \d{1,2}, 2026$/, `${s.key}: a date`);
    assert.ok(countIssueItems(issue) >= 10, `${s.key}: items`);
    assert.deepEqual(placeholderItems(issue), [], `${s.key}: no picture waits on a photo, so Save & Export opens`);
    assert.doesNotMatch(renderNewsletter(issue), /dashed/, `${s.key}: no placeholder in the email`);
    for (const link of JSON.stringify(issue).match(/"(?:url|image|flyer)":"[^"]+"/g) ?? []) assert.match(link, /:"https:\/\//, `${s.key}: ${link}`);
  }
});

test('the practice issue has every section, every research kind, a Date card, pictures and both callouts, and no featured event; nothing in it is real', () => {
  const issue = load(SAMPLES.find((s) => s.key === 'practice'));
  assert.equal(issue.date, 'October 13, 2026');
  assert.match(issue.intro, /practice issue/i);
  for (const reg of SECTION_REGISTRY) assert.ok(issue.sections[reg.key]?.enabled && issue.sections[reg.key].items.length > 0, `${reg.key} is filled`);
  assert.deepEqual(issue.sections.research.items.map((i) => i.group), ['brief', 'report', 'article', 'explains']);
  assert.equal(issue.sections.spotlight.items.filter((i) => i.fields.highlight === true).length, 1, 'one Date card');
  assert.equal(issue.sections.events.items.filter((i) => i.featured).length, 0, 'no featured event: the control is hidden (Kate, Oct 7)');
  assert.ok(issue.sections.research.items.some((i) => i.fields.image) && issue.sections.spotlight.items.some((i) => i.fields.image), 'pictures');
  assert.deepEqual(calloutsOf(issue).map((c) => c.kind).sort(), ['custom', 'share']);
  const html = renderNewsletter(issue);
  for (const words of ['Imaginary', 'Pretend', 'example.org', 'sample-chart.png', 'sample-headshot.png', 'Date card']) assert.ok(html.includes(words), words);
  for (const real of ['Hlavacik', 'Pianta', 'Berends', 'Kwok', 'Bartanen', 'calendar.tamu.edu', 'docs.google.com', 'nber.org', 'npr.org', 'nytimes.com']) assert.ok(!html.includes(real), `nothing real: ${real}`);
  assert.match(html, /width="176"[^>]*background-color:#500000/, 'the Date card draws');
  assert.doesNotMatch(html, /Featured Events/, 'nothing prints as featured');
});

test('the October 6 sample is the issue as sent: the fixture the regression test renders, with the sample key added', () => {
  const issue = load(SAMPLES.find((s) => s.key === 'oct-6-2026'));
  assert.equal(issue.date, 'October 6, 2026');
  assert.match(issue.intro, /^Howdy all! October is here/);
  assert.equal(issue.sections.spotlight.items[0].fields.title, 'ERC Colloquium: Controversies in the Classroom');
});
