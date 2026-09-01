import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, _resetIds, unescapeMd, extractUrl, parseFieldLine } from '../js/parser.js';
import { readFileSync } from 'node:fs';

const md = `# ERC Newsletter
date: June 16, 2026

# Intro:
Welcome to this issue.

# Upcoming Events
## Texas A&M
### Event
**Title:** Something
`;

test('parseMarkdown enables only sections with content', () => {
  _resetIds();
  const { issue, warnings } = parseMarkdown(md);
  assert.deepEqual(warnings, []);
  assert.equal(issue.date, 'June 16, 2026');
  assert.equal(issue.intro, 'Welcome to this issue.');
  assert.equal(issue.sections.events.enabled, true);
  assert.ok(issue.sections.events.items.length > 0);
  assert.equal(issue.sections.events.items[0].group, 'tamu');
  assert.equal(issue.sections.events.items[0].fields.title, 'Something');
  // every other section is absent → disabled
  assert.equal(issue.sections.spotlight.enabled, false);
  assert.equal(issue.sections.research.enabled, false);
});

test('parseMarkdown warns on an unknown section heading', () => {
  const { warnings } = parseMarkdown('# ERC Newsletter\n# Mystery Section\n### Item\n**Title:** y\n');
  assert.ok(warnings.some(w => /Couldn't place section: Mystery Section/.test(w)));
});

test('full-issue fixture puts This & That inside spotlight', () => {
  _resetIds();
  const md = readFileSync(new URL('../fixtures/full-issue.md', import.meta.url), 'utf8');
  const { issue } = parseMarkdown(md);
  const groups = issue.sections.spotlight.items.map(i => i.group);
  assert.ok(groups.includes('programs'));
  assert.ok(groups.includes('events'));
  assert.ok(groups.includes('thisandthat'));
  // research carries both a Brief and a Report group
  const rgroups = issue.sections.research.items.map(i => i.group);
  assert.ok(rgroups.includes('brief'));
  assert.ok(rgroups.includes('report'));
});

test('real contributor sample parses with no warnings and expected counts', () => {
  _resetIds();
  const md = readFileSync(new URL('../fixtures/sample-real.md', import.meta.url), 'utf8');
  const { issue, warnings } = parseMarkdown(md);
  assert.deepEqual(warnings, []);
  assert.equal(issue.date, 'July 01, 2026');
  assert.match(issue.intro, /^Howdy!/);
  const count = k => issue.sections[k].items.length;
  assert.equal(count('research'), 5);        // 3 briefs + 2 reports
  assert.equal(count('spotlight'), 6);       // P&O 2, Events 3, Happy Hours (This & That) 1
  assert.equal(count('events'), 7);          // TAMU 3 + off-campus 4
  assert.equal(count('opportunities'), 8);   // F&G 3 + Fellowships 2 + Calls 3
  assert.equal(count('policy'), 9);          // WP 4 + peer 2 + misc 3
  assert.equal(count('headlines'), 8);       // federal 4 + texas 4
  // group wiring sanity
  const rgroups = issue.sections.research.items.map(i => i.group);
  assert.deepEqual(rgroups.slice().sort(), ['brief', 'brief', 'brief', 'report', 'report']);
  // one Fellowships & Training group with 2 items
  const fellows = issue.sections.opportunities.items.filter(i => i.group === 'fellowships');
  assert.equal(fellows.length, 2);
});

test('unescapeMd strips backslashes before punctuation', () => {
  assert.equal(unescapeMd('Texas A\\&M'), 'Texas A&M');
  assert.equal(unescapeMd('P\\&O \\#1'), 'P&O #1');
  assert.equal(unescapeMd('Howdy\\!'), 'Howdy!');
  assert.equal(unescapeMd('merc\\_pubs'), 'merc_pubs');
  assert.equal(unescapeMd('nothing to do'), 'nothing to do');
});

test('extractUrl pulls href from markdown links and passes bare urls', () => {
  assert.equal(
    extractUrl('[https://x.org/a](https://x.org/a)'), 'https://x.org/a');
  assert.equal(
    extractUrl('[reg](https://z.us/WN\\_cTTl\\#/registration)'),
    'https://z.us/WN_cTTl#/registration');
  assert.equal(extractUrl('https://plain.example'), 'https://plain.example');
});

test('extractUrl keeps trailing parenthesis in the URL (e.g. Wikipedia links)', () => {
  assert.equal(
    extractUrl('[t](https://en.wikipedia.org/wiki/Cape_Verde_(country))'),
    'https://en.wikipedia.org/wiki/Cape_Verde_(country)');
});

test('parseFieldLine handles bold, case, and metaline alias', () => {
  assert.deepEqual(parseFieldLine('**Title:** Hello'), { key: 'title', value: 'Hello' });
  assert.deepEqual(parseFieldLine('**title:** Hi'), { key: 'title', value: 'Hi' });
  assert.deepEqual(parseFieldLine('**Metaline:** Deadline'), { key: 'meta', value: 'Deadline' });
  assert.deepEqual(parseFieldLine('Authors: A & B'), { key: 'authors', value: 'A & B' });
  assert.deepEqual(parseFieldLine('**title**: Outside'), { key: 'title', value: 'Outside' });
  assert.equal(parseFieldLine('Just a sentence, no field.'), null);
  assert.equal(parseFieldLine('# Heading'), null);
});
