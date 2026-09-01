// newsletter-builder/tests/template.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderNewsletter, renderProse } from '../js/template.js';
import { parseMarkdown, _resetIds } from '../js/parser.js';
import { createEmptyIssue } from '../js/model.js';

const issueOf = file => { _resetIds();
  return parseMarkdown(readFileSync(new URL(`../fixtures/${file}`, import.meta.url), 'utf8')).issue; };

test('render includes date, fonts, and a file-tab section header', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.match(html, /June 16, 2026/);
  assert.match(html, /Trebuchet MS/);
  assert.match(html, /border-radius:\s*8px 8px 0 0/); // file-tab corner
});

test('disabled/empty section is omitted from output', () => {
  const issue = issueOf('sparse-issue.md');
  const html = renderNewsletter(issue);
  assert.ok(!/This &amp; That/i.test(html)); // no spotlight/This & That group in sparse fixture
});

test('Submit callout shows by default and is omitted when showSubmit is false', () => {
  const marker = 'Submit Your Research for an ERC Research Brief';
  const issue = issueOf('full-issue.md');
  assert.ok(renderNewsletter(issue).includes(marker), 'callout should show by default');
  issue.sections.research.showSubmit = false;
  assert.ok(!renderNewsletter(issue).includes(marker), 'callout should be omitted when toggled off');
});

test('renderProse renders bold and italic, escaping the rest', () => {
  const html = renderProse('A **bold** and *italic* & <x>.');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /&amp;/);
  assert.match(html, /&lt;x&gt;/);
  assert.doesNotMatch(html, /data-edit/);
});

test('renderProse linkifies markdown links and escapes the rest', () => {
  const html = renderProse('See [Cape Verde](https://x.org/cv) & <b>more</b>.');
  assert.match(html, /<a href="https:\/\/x\.org\/cv" target="_blank" rel="noopener"[^>]*>Cape Verde<\/a>/);
  assert.match(html, /&amp;/);       // bare & escaped
  assert.match(html, /&lt;b&gt;/);   // stray HTML escaped, not rendered
  assert.doesNotMatch(html, /data-edit/);
});

test('renderProse keeps trailing parenthesis in a link href (e.g. Wikipedia links)', () => {
  const html = renderProse('See [Cape Verde](https://en.wikipedia.org/wiki/Cape_Verde_(country)) today.');
  assert.ok(html.includes('href="https://en.wikipedia.org/wiki/Cape_Verde_(country)"'));
  assert.ok(!html.includes('</a>)'), 'no dangling ) leaking into body text after the link');
});

test('renderProse only emits an anchor for safe URL schemes; unsafe schemes render as plain text', () => {
  const html = renderProse('Click [here](javascript:alert(1)) now');
  assert.ok(!html.includes('<a '), 'should not emit an anchor for a javascript: href');
  assert.ok(!html.includes('javascript:'), 'should not leak the javascript: scheme into output');
  assert.ok(html.includes('here'), 'label text should still render');
});

test('featured event renders under a FEATURED eyebrow', () => {
  // New grammar has no featured marker in the doc — featured is chosen in the app.
  const issue = issueOf('full-issue.md');
  const ev = issue.sections.events.items.find(Boolean);
  ev.group = 'featured';
  ev.featured = true;
  const html = renderNewsletter(issue);
  assert.match(html, /FEATURED/i);
});

test('all user text is escaped (no raw angle brackets injected)', () => {
  const issue = issueOf('full-issue.md');
  issue.sections.headlines.items[0].fields.title = 'A < B & C';
  const html = renderNewsletter(issue);
  assert.match(html, /A &lt; B &amp; C/);
});

// ─── Regression tests (Fix 1 + Fix 2) ────────────────────────────────────────

test('footer contains ERC horizontal lockup image URL', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.ok(
    html.includes('https://i.ibb.co/JjQWyZq3/ERC-Horizontal-White-Text-narrow.png'),
    'Expected footer ERC lockup image URL to appear in output'
  );
});

test('eyebrow group label uses maroon color #913B3B', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.ok(
    html.includes('#913B3B'),
    'Expected eyebrow group label to use maroon #913B3B'
  );
});

test('headlines render source in parenthesized format', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  // full-issue.md has a Federal headline with source "Ed Week"
  assert.match(html, /\(Ed Week\)/, 'Expected headline source to appear wrapped in parentheses');
});

test('"See more" tail link text appears in output', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.ok(
    html.includes('See more on the ERC website'),
    'Expected "See more on the ERC website" tail link to appear in output'
  );
});

test('spotlight renders between research and events with all three groups', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  const iSpot = html.indexOf('ERC Spotlight');
  const iResearch = html.indexOf('ERC Research');
  const iEvents = html.indexOf('Upcoming Events');
  assert.ok(iResearch < iSpot && iSpot < iEvents, 'spotlight sits between research and events');
  assert.match(html, /Programs &amp; Opportunities/);
  assert.match(html, /This &amp; That/i);
});

test('spotlight is a jump-nav target', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.match(html, /#spotlight/);
});

test('jump-nav contains anchor for the events section', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.ok(
    html.includes('href="#events"'),
    'Jump-nav must contain href="#events" for the enabled events section'
  );
});

test('export output has no edit hooks; editable output does', () => {
  const i = issueOf('full-issue.md');
  assert.ok(!/data-edit-/.test(renderNewsletter(i)));            // default = clean export
  assert.match(renderNewsletter(i, { editable: true }), /data-edit-field="title"/);
});

test('ungrouped research item falls back under the Research Brief group', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'itm_x', group: '', fields: { title: 'Untagged', summary: 's' } },
  ];
  const html = renderNewsletter(issue);
  assert.ok(html.includes('Research Brief'), 'expected the Research Brief eyebrow label');
  assert.ok(html.includes('Untagged'), 'expected the ungrouped item title to render');
});

test('research renders Brief and Report as separate labeled subgroups', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'itm_1', group: 'brief',  fields: { title: 'B-One', summary: 'x' } },
    { id: 'itm_2', group: 'report', fields: { title: 'R-One', summary: 'y' } },
  ];
  const html = renderNewsletter(issue);
  const iBriefLabel = html.indexOf('Research Brief');
  const iReportLabel = html.indexOf('Report');
  const iBOne = html.indexOf('B-One');
  const iROne = html.indexOf('R-One');
  assert.ok(iBriefLabel !== -1 && iReportLabel !== -1, 'both group labels present');
  assert.ok(iBriefLabel < iBOne && iBOne < iReportLabel, 'Brief group precedes Report group');
  assert.ok(iReportLabel < iROne, 'Report label precedes its item');
});
