// newsletter-builder/tests/template.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderNewsletter, renderProse } from '../js/template.js';
import { parseMarkdown, _resetIds } from '../js/parser.js';
import { createEmptyIssue, SECTION_REGISTRY, POLICY_EXCHANGE_URL } from '../js/model.js';

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

// ─── Item media: the stamp (spec 2026-09-02-newsletter-media-layout, Decision) ──

const FLYER = 'https://raw.githubusercontent.com/erc/media/main/flyer.png';
function mediaIssue() {
  const issue = createEmptyIssue();
  const oppGroup = SECTION_REGISTRY.find(s => s.key === 'opportunities').groups[0].key;
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'r1', group: 'brief', fields: { title: 'First blurb', summary: 'A summary. ' + 'Four lines of blurb beside the picture, enough to earn a stamp. '.repeat(4), image: FLYER } },
    { id: 'r2', group: 'brief', fields: { title: 'Second blurb', summary: 'Another summary. ' + 'Four lines of blurb beside the picture, enough to earn a stamp. '.repeat(4), image: FLYER } },
    { id: 'r3', group: 'brief', fields: { title: 'Brief sans summary', authors: 'A. Author', image: FLYER } },
  ];
  issue.sections.spotlight.enabled = true;
  issue.sections.spotlight.items = [
    { id: 's1', group: 'events', fields: { title: 'Spotlight short', date: 'May 1', location: 'Room 1', image: FLYER } },
  ];
  issue.sections.events.enabled = true;
  issue.sections.events.items = [
    { id: 'e1', group: 'tamu', fields: { title: 'Regular event', date: 'May 2', summary: 'Only featured events show this.', image: FLYER } },
  ];
  issue.sections.opportunities.enabled = true;
  issue.sections.opportunities.items = [
    { id: 'o1', group: oppGroup, fields: { title: 'Short one', meta: 'Deadline: soon', image: FLYER } },
  ];
  return issue;
}
const stampPositions = html => [...html.matchAll(/<img src="https:\/\/raw\.githubusercontent\.com[^"]*flyer\.png"/g)].map(m => m.index);

const stampWidth = (html, title) => {
  const seg = html.slice(html.indexOf(title));
  const nextTitle = seg.indexOf('<p style="margin:0 0 4px', 1); // the next item's title paragraph
  const scope = nextTitle > 0 ? seg.slice(0, nextTitle) : seg;
  const m = scope.match(/<img src="[^"]+flyer\.png" alt="[^"]*" width="(\d+)"/);
  return m ? Number(m[1]) : null;
};

test('a stamp links to the full picture, with no link text', () => {
  const html = renderNewsletter(mediaIssue());
  assert.match(html, new RegExp(`<a href="${FLYER}" target="_blank" rel="noopener"[^>]*><img src="${FLYER}" alt="[^"]*" width="\\d+"[^>]*><\\/a>`), 'the anchor holds the image and nothing else');
  assert.ok(!/View flyer/.test(html), 'no "View flyer" text');
});

test('the stamp sits under the title, beside the authors and blurb', () => {
  const html = renderNewsletter(mediaIssue());
  const title = html.indexOf('First blurb');
  const stamp = html.indexOf(`<img src="${FLYER}`);
  const blurb = html.indexOf('A summary.');
  assert.ok(title < stamp && stamp < blurb, 'title, then picture, then the text beside it');
  const between = html.slice(title, stamp);
  assert.match(between, /<\/p>\s*<table role="presentation"/, 'the title paragraph closes before the two-cell row opens');
  assert.ok(!/<p[^>]*>[^<]*First blurb/.test(html.slice(stamp)), 'the title is not inside the row');
});

test('the stamp is sized from the text beside it: short text, no stamp; medium text, a smaller stamp; long text, 96px', () => {
  const issue = mediaIssue();
  const items = issue.sections.research.items;
  items[0].fields.summary = 'One line.';
  items[1].fields.summary = 'About two hundred and fifty characters of blurb, so that the paragraph wraps to four lines in the column beside the picture, which leaves room for a medium-sized stamp but not the full ninety-six pixels. '.padEnd(250, 'More words. ');
  items[2].fields = { title: 'Long blurb', authors: 'A. Author', summary: 'x'.repeat(0) + 'A long blurb. '.repeat(40), image: FLYER };
  const html = renderNewsletter(issue);
  assert.equal(stampWidth(html, 'First blurb'), null, 'one line of text: no picture, it would stand taller');
  const mid = stampWidth(html, 'Second blurb');
  assert.ok(mid >= 40 && mid < 96, `medium text gets a medium stamp, got ${mid}`);
  assert.equal(stampWidth(html, 'Long blurb'), 96, 'ceiling');
});

test('the stamp cell is the picture plus one 14px gutter, no border, whatever the stamp width (Kate, 2026-09-08)', () => {
  const html = renderNewsletter(mediaIssue());
  const cells = [...html.matchAll(/<td valign="top" width="(\d+)" style="width:\d+px; vertical-align:top; padding:2px 0 0 0;"><a [^>]*><img [^>]*width="(\d+)"/g)];
  assert.ok(cells.length >= 2);
  for (const [, cell, img] of cells) assert.equal(Number(cell), Number(img) + 14);
  assert.ok(!/border:1px solid #e6e2dd/.test(html) && !/border-radius:3px/.test(html), 'no hairline, no rounded corners');
  assert.ok(!/padding:2px 14px 0 0/.test(html), 'gutter is not double-counted as padding');
});

test('items without a blurb render no picture, in every media section', () => {
  const html = renderNewsletter(mediaIssue());
  assert.equal(stampPositions(html).length, 2, 'only the two blurb items carry a stamp');
  assert.ok(!/width="36"/.test(html), 'no small stamp');
  for (const title of ['Brief sans summary', 'Spotlight short', 'Regular event', 'Short one']) {
    const i = html.indexOf(title);
    assert.ok(i > 0, `${title} rendered`);
    assert.ok(!/flyer\.png/.test(html.slice(i - 700, i + 400)), `${title} has no picture near it`);
  }
});


test('no text cell is justified or hyphenated', () => {
  const html = renderNewsletter(mediaIssue());
  assert.ok(!/text-align:\s*justify/.test(html));
  assert.ok(!/hyphens:\s*auto/.test(html));
});

test('item without a picture, or with an unsafe picture URL, renders no stamp', () => {
  const issue = mediaIssue();
  issue.sections.research.items[0].fields.image = 'javascript:alert(1)';
  delete issue.sections.research.items[1].fields.image;
  delete issue.sections.opportunities.items[0].fields.image;
  const html = renderNewsletter(issue);
  assert.equal(stampPositions(html).length, 0);
  assert.ok(!/javascript:/.test(html));
  assert.ok(!/alt="Picture:/.test(html), 'no stamp markup at all');
});

test('editable render tags the stamp for click-to-edit; export carries no hooks', () => {
  const issue = mediaIssue();
  assert.match(renderNewsletter(issue, { editable: true }), /<img [^>]*data-edit-field="image"/);
  assert.ok(!/data-edit-/.test(renderNewsletter(issue)));
});

// ─── Audit fixes (2026-09-03): the 18 no-decision items ──────────────────────
// Read from the source, not retyped: the address moved once already (GitHub
// Pages -> Vercel) and a hardcoded copy here just goes stale silently.
const POLICY_EXCHANGE = POLICY_EXCHANGE_URL;
const fullIssue = () => issueOf('full-issue.md');
const count = (html, needle) => html.split(needle).length - 1;

test('"See more" tail links point at the Policy Exchange by default and never at "#"', () => {
  const html = renderNewsletter(fullIssue());
  assert.ok(!/href="#"/.test(html), 'no placeholder hrefs');
  assert.equal(count(html, `href="${POLICY_EXCHANGE}" target="_blank" rel="noopener"`), 3, 'opportunities, policy, headlines');
});

test('a section can override its "See more" URL, and an empty override drops the row', () => {
  const issue = fullIssue();
  issue.sections.policy.seeMoreUrl = 'https://example.org/policy';
  issue.sections.headlines.seeMoreUrl = '';
  const html = renderNewsletter(issue);
  assert.ok(html.includes('href="https://example.org/policy"'));
  assert.equal(count(html, 'See more on the ERC website'), 2, 'headlines row omitted');
});

test('the sheet is 640px wide: masthead and every layout table carry the width attribute for classic Outlook', () => {
  const html = renderNewsletter(fullIssue());
  assert.ok(!/\b705\b/.test(html), 'no 705 left anywhere');
  assert.match(html, /<img width="640"[^>]*alt="Education Research Center Newsletter"[^>]*max-width: 640px/);
  const tables = html.match(/<table[^>]*width: 640px[^>]*>/g) || [];
  assert.ok(tables.length > 5, 'sample has several 640px tables');
  for (const t of tables) assert.match(t, /width="640"/, t.slice(0, 120));
});

test('the picture stamp names the item so its link has an accessible name', () => {
  const html = renderNewsletter(mediaIssue());
  assert.match(html, /<img src="[^"]+flyer\.png" alt="Picture: First blurb" width="\d+"/);
});

test('the two light grays that failed contrast are replaced', () => {
  const html = renderNewsletter(fullIssue());
  assert.ok(!/#8F8F8F/i.test(html) && !/#9a8a8a/i.test(html), 'old grays gone');
  assert.match(html, /color: #767676;[^"]*font-size: 14px; font-weight: 700;">See more/);
  assert.match(html, /<span style="color:#7A6A6A; font-size:14px;">\(/);
  assert.ok(!/#9a8a8a/.test(html.slice(0, html.indexOf('</style>'))), 'dark-mode selectors updated too');
});

test('a hidden preheader follows <body>, from issue.preheader or the intro\'s first sentence', () => {
  const issue = fullIssue();
  issue.intro = 'Welcome back, **everyone** — see [the site](https://x.org). Second sentence here.';
  let html = renderNewsletter(issue);
  const pre = html.match(/<body[^>]*>\s*<div style="display:none;[^"]*mso-hide:all;">([\s\S]*?)<\/div>/);
  assert.ok(pre, 'preheader div sits right after <body>');
  assert.ok(pre[1].startsWith('Welcome back, everyone — see the site.'), pre[1].slice(0, 80));
  issue.preheader = 'Three briefs & a symposium';
  html = renderNewsletter(issue);
  assert.match(html, /mso-hide:all;">Three briefs &amp; a symposium/);
});

test('rgb(80, 0, 0) is only ever a background, so the dark-mode rules cannot repaint the date or tab rows', () => {
  const html = renderNewsletter(fullIssue());
  const uses = html.slice(html.indexOf('</style>')).match(/[a-z-]+: rgb\(80, 0, 0\)/g) || [];
  assert.ok(uses.length > 0);
  for (const u of uses) assert.equal(u, 'background-color: rgb(80, 0, 0)');
  assert.match(html, /border-bottom: 3px solid #500000;/);
});

test('footer cell sets white text so blocked-image alt text stays readable on maroon', () => {
  const html = renderNewsletter(fullIssue());
  assert.match(html, /<td align="center" style="[^"]*color:#ffffff;[^"]*padding: 26px 24px 24px;/);
});

test('jump nav carries no label; the section links stand alone (Kate, 2026-09-08)', () => {
  const html = renderNewsletter(fullIssue());
  assert.ok(!html.includes('In this issue'));
  assert.match(html, /<a href="#research"[^>]*>ERC Research<\/a> &nbsp;\|&nbsp; <a href="#spotlight"/);
});

test('the mailing-list link has one name in the header and the footer', () => {
  const html = renderNewsletter(fullIssue());
  assert.equal(count(html, '>Join the mailing list</a>'), 2);
  assert.ok(!/Listserv|Join Mailing List/.test(html));
});

test('document declares its language and a doctype, and every new-tab link is noopener', () => {
  const html = renderNewsletter(fullIssue());
  assert.ok(html.startsWith('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"'));
  assert.match(html, /<html lang="en"/);
  assert.match(html, /<div lang="en" style="background-color: rgb\(234, 234, 234\)/);
  assert.equal(count(html, 'target="_blank"'), count(html, 'target="_blank" rel="noopener"'));
});

test('footer icons are hidden from assistive tech', () => {
  const html = renderNewsletter(fullIssue());
  const svgs = html.match(/<svg[^>]*>/g) || [];
  assert.equal(svgs.length, 3);
  for (const s of svgs) assert.match(s, /aria-hidden="true" focusable="false"/);
});

test('sections are h2 and group eyebrows are h3, with no visual change', () => {
  const html = renderNewsletter(fullIssue());
  assert.ok(!/<h3 id=/.test(html) && !/<h1/.test(html));
  assert.match(html, /<h2 id="research" style="margin:0; font-family: Verdana/);
  assert.match(html, /<h3 style="margin:0; font-family: Verdana[^"]*text-transform: uppercase;[^"]*">Research Brief<\/h3>/);
  assert.match(html, /<h3 style="margin:0 0 9px; font-family: Verdana[^"]*">Working Papers<\/h3>/);
});

test('meta and author lines carry a line-height like every other paragraph', () => {
  const html = renderNewsletter(fullIssue());
  const metas = html.match(/<p style="[^"]*color: #5C5C5C;"/g) || [];
  assert.ok(metas.length >= 4);
  for (const m of metas) assert.match(m, /line-height: 1\.4;/, m);
});

test('an item with no title is skipped, and a section left with nothing renders no tab and no spacer', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'r1', group: 'brief', fields: { title: '  ', url: 'https://example.org/x', summary: 'Headless.' } },
    { id: 'r2', group: 'brief', fields: { title: 'Real one', summary: 'Fine.' } },
  ];
  issue.sections.opportunities.enabled = true;
  issue.sections.opportunities.items = [{ id: 'o1', group: 'funding', fields: { title: '', meta: 'Deadline' } }];
  const html = renderNewsletter(issue);
  assert.ok(!/Headless\./.test(html) && !/<a href="https:\/\/example\.org\/x"[^>]*><\/a>/.test(html));
  assert.ok(html.includes('Real one'));
  assert.ok(!/>Opportunities<\/h2>/.test(html) && !/href="#opportunities"/.test(html), 'empty section and its nav entry gone');
  assert.equal(count(html, '<!-- spacer -->'), 2, 'one spacer before the one real section, one before the footer');
});

test('a two-paragraph blurb renders as two paragraphs', () => {
  const issue = fullIssue();
  issue.sections.research.items[0].fields.summary = 'First paragraph.\n\nSecond paragraph.';
  const html = renderNewsletter(issue);
  assert.match(html, /<p style="margin:0 0 8px; line-height: 1\.5;[^"]*">First paragraph\.<\/p>\s*<p style="margin:0; line-height: 1\.5;[^"]*">Second paragraph\.<\/p>/);
});

test('emphasis that spans a markdown link renders as one bold run', () => {
  const html = renderProse('**see [x](https://a.b) now** and *[y](https://c.d)*');
  assert.match(html, /<strong>see <a href="https:\/\/a\.b"[^>]*>x<\/a> now<\/strong>/);
  assert.match(html, /<em><a href="https:\/\/c\.d"[^>]*>y<\/a><\/em>/);
  assert.ok(!/\*/.test(html), 'no stray asterisks');
});

// ─── Link hygiene: scheme-less URLs and the export check ─────────────────────

test('a URL typed without a scheme is linked as https', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'a', group: 'brief', fields: { title: 'Www', summary: 's', url: 'www.edworkingpapers.com/ai26-1234' } },
    { id: 'b', group: 'brief', fields: { title: 'Bare', summary: 's', url: 'erc.cehd.tamu.edu/briefs/1' } },
    { id: 'c', group: 'brief', fields: { title: 'Word', summary: 's', url: 'Rolling' } },
    { id: 'd', group: 'brief', fields: { title: 'Script', summary: 's', url: 'javascript:alert(1)' } },
  ];
  const html = renderNewsletter(issue);
  assert.ok(html.includes('href="https://www.edworkingpapers.com/ai26-1234"'));
  assert.ok(html.includes('href="https://erc.cehd.tamu.edu/briefs/1"'));
  assert.ok(!/href="[^"]*Rolling/.test(html) && !/javascript:/.test(html));
  assert.match(html, /<span[^>]*>Word<\/span>/);
});

// ─── Spacing and measure (Kate, 2026-09-03: items 1 and 2 of the open list) ──
test('items in a group sit closer together than the next group label', () => {
  const html = renderNewsletter(issueOf('sample-real.md')); // several items per group
  assert.ok(!/padding: 24px 24px 0 24px;/.test(html), 'old 24px eyebrow gap gone');
  assert.ok((html.match(/padding: 32px 24px 0 24px;/g) || []).length >= 2, 'later group labels sit 32px below the last item');
  assert.match(html, /padding: 18px 24px 0 24px;/, 'first label under a tab keeps 18px');
  const dividers = html.match(/<td style="padding: \d+px 48px 0 40px;"><div style="border-top/g) || [];
  assert.ok(dividers.length >= 3);
  for (const d of dividers) assert.match(d, /padding: 12px 48px/, d);
  assert.ok(!/padding: 1[46]px 48px 0 40px;">\n<p/.test(html), 'items after a divider start 12px below it');
});

test('item text and the intro end 48px from the right edge of the 640px sheet', () => {
  const issue = fullIssue();
  issue.sections.events.items[0].group = 'featured'; // so the featured-events rule renders
  const html = renderNewsletter(issue);
  assert.ok(!/padding: \d+px (24|80)px 0 40px;/.test(html), 'no item cell still uses the old right padding');
  assert.ok((html.match(/padding: \d+px 48px 0 40px;/g) || []).length >= 8, 'item cells use the 48px right padding');
  assert.match(html, /padding: 24px 48px 30px 24px;/, 'intro cell too');
  assert.match(html, /padding: 16px 48px 0 24px;/, 'the featured-events rule ends at the same edge');
});

test('the masthead is served from the desk repo; an issue can still override it (Kate, 2026-09-08)', () => {
  const html = renderNewsletter(fullIssue());
  assert.ok(html.includes('src="https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/builder/images/newsletter-masthead.png"'));
  assert.ok(!html.includes('i.ibb.co/tPqcyQw2'));
  const custom = renderNewsletter({ ...fullIssue(), headerImageUrl: 'https://example.org/banner.png' });
  assert.ok(custom.includes('src="https://example.org/banner.png"'));
});

// ─── Sep 8 amendments (Kate): no stamp border; EdTalk headshots beside the title ──
const EDTALK_BLURB = 'Join us for an ERC EdTalk with Dr. Melanie Kinskey, "Supporting Teachers to Integrate Socioscientific Issues in Elementary Science."\n\nPlease RSVP soon so we can plan seating and catering. The form also lets you join our listserv and, for hybrid events, indicate that you will attend via Zoom; we will send the link to those who select it.';
function edtalkIssue(summary = EDTALK_BLURB, title = 'ERC EdTalk with Dr. Melanie Kinskey') {
  const issue = createEmptyIssue();
  issue.sections.spotlight.enabled = true;
  issue.sections.spotlight.items = [
    { id: 's1', group: 'events', fields: { title, date: 'Sep 11, 2026', time: '11:30am', location: 'Rudder 401', summary, image: FLYER } },
  ];
  return issue;
}
const widthOf = html => { const m = html.match(/flyer\.png" alt="[^"]*" width="(\d+)"/); return m ? Number(m[1]) : null; };
const rowOf = html => { const i = html.indexOf('<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"'); return i < 0 ? '' : html.slice(i, html.indexOf('</table>', i)); };

test('an EdTalk headshot sits beside the title as well as the text, up to 160px wide', () => {
  const html = renderNewsletter(edtalkIssue());
  const stamp = html.indexOf(`<img src="${FLYER}`);
  const title = html.indexOf('ERC EdTalk with Dr. Melanie Kinskey');
  assert.ok(stamp > 0 && stamp < title, 'picture first, then the title inside the text cell');
  assert.match(rowOf(html), /ERC EdTalk with Dr\. Melanie Kinskey/, 'the title lives in the two-cell row');
  assert.equal(widthOf(html), 160, 'the Kinskey text is tall enough for the full 160');
  assert.match(html, /<td valign="top" width="174" style="width:174px;/, 'cell = 160 + 14, no border to count');
});

test('an EdTalk with less text gets a smaller headshot; with no blurb, none at all', () => {
  const w = widthOf(renderNewsletter(edtalkIssue('One sentence about the talk.')));
  assert.ok(w >= 40 && w < 160, `title + date line + one line of blurb: a small headshot, got ${w}`);
  const none = renderNewsletter(edtalkIssue(''));
  assert.equal(stampPositions(none).length, 0, 'no blurb, no picture (the Sep 3 rule stands)');
  assert.match(none, /ERC EdTalk with Dr\. Melanie Kinskey/);
});

test('other spotlight events keep the title above the picture and the 96px ceiling', () => {
  const html = renderNewsletter(edtalkIssue(EDTALK_BLURB, 'Brown Bag with Dr. Melanie Kinskey'));
  const stamp = html.indexOf(`<img src="${FLYER}`);
  const title = html.indexOf('Brown Bag with Dr. Melanie Kinskey');
  assert.ok(title > 0 && title < stamp, 'title first, then the picture');
  assert.equal(widthOf(html), 96);
});

test('an editable EdTalk render keeps the title and picture hooks inside the row', () => {
  const html = renderNewsletter(edtalkIssue(), { editable: true });
  assert.match(rowOf(html), /<img [^>]*data-edit-field="image"/);
  assert.match(rowOf(html), /data-edit-field="title"/);
});
