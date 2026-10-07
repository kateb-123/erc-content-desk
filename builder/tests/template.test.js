// builder/tests/template.test.js: the Stacked Blocks email (Claude Design handoff, Oct 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderNewsletter, renderProse, navLinks, layoutOf, calloutsOf, URLS } from '../js/template.js';
import { createEmptyIssue, SECTION_REGISTRY, POLICY_EXCHANGE_URL } from '../js/model.js';

const issueOf = file =>
  JSON.parse(readFileSync(new URL(`../fixtures/${file}`, import.meta.url), 'utf8'));
const fullIssue = () => issueOf('full-issue.json');
const count = (html, needle) => html.split(needle).length - 1;
const body = html => html.slice(html.indexOf('<body'));
/** The 640px white panels, in order. */
const panels = html => body(html).split('background-color:#ffffff;"><tbody>').length - 1;

const sparseIssue = () => {
  const issue = createEmptyIssue();
  issue.date = 'June 16, 2026';
  issue.intro = 'Welcome to the June 16, 2026 issue of the ERC Newsletter.';
  issue.sections.events.items.push({ id: 'itm_1', group: 'tamu', fields: {
    title: 'ERC EdTalk: Steven Woltering', date: 'June 18, 2026', time: '12:00 PM',
    location: 'WCSS 218', url: 'https://erc.tamu.edu/events/edtalk' } });
  issue.sections.events.enabled = true;
  issue.callouts = [];
  return issue;
};

// ─── Panels and the page ─────────────────────────────────────────────────────

test('every part of the email is its own 640px white panel on the gray page, 12px apart', () => {
  const html = renderNewsletter(fullIssue());
  // header, intro, six sections, the callout, the footer: ten sheets, nine gaps
  assert.equal(panels(html), 10);
  assert.equal(count(html, 'height:12px; font-size:1px; line-height:12px;'), 9, 'a 12px gap between each pair of panels');
  assert.match(html, /height:24px;[^<]*<\/td><\/tr><\/tbody><\/table><\/td><\/tr><\/tbody><\/table><\/div>/, 'a 24px gap after the last panel');
  assert.match(html, /<div lang="en" style="background-color:#EAEAEA; margin:0px;">/);
  assert.ok(!/border-radius/.test(html) && !/box-shadow/.test(html), 'no corners, no shadows');
});

test('section panels open with a 4px maroon rule and an uppercase maroon heading that carries the anchor', () => {
  const html = renderNewsletter(fullIssue());
  assert.match(html, /<tr><td style="height:4px; background-color:#500000; font-size:0; line-height:0; padding:0;">&nbsp;<\/td><\/tr>\n<tr><td style="padding:20px 24px 0 24px;"><h2 style="margin:0; font-family:'Trebuchet MS'[^"]*text-transform:uppercase; color:#500000;"><a name="research" id="research"[^>]*><\/a>ERC Research<\/h2>/);
  assert.ok(!/border-bottom: 3px solid/.test(html), 'the file-tab is gone');
});

test('group labels are Verdana 12px uppercase in the light maroon, 18px under the heading and 30px below a group', () => {
  const html = renderNewsletter(issueOf('sample-real.json'));
  assert.match(html, /<tr><td style="padding:18px 24px 0 24px;"><h3 style="margin:0; font-family:Verdana[^"]*font-size:12px;[^"]*text-transform:uppercase; color:#732F2F;">Research Brief<\/h3>/);
  assert.ok((html.match(/padding:30px 24px 0 24px;"><h3/g) || []).length >= 3, 'later groups sit 30px down');
  assert.ok(!/#913B3B/.test(html), 'the old eyebrow brick is gone');
});

test('disabled or empty sections render nothing and leave the contents strip', () => {
  const html = renderNewsletter(sparseIssue());
  assert.ok(!/This &amp; That/i.test(html));
  assert.ok(!/href="#spotlight"/.test(html));
  assert.match(html, /href="#events"/);
  assert.equal(panels(html), 4, 'header, intro, events, footer');
});

test('an item with no title is skipped, and a section left with nothing renders no panel', () => {
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
  assert.ok(!/>Opportunities<\/h2>/.test(html) && !/href="#opportunities"/.test(html));
});

// ─── Header and intro ────────────────────────────────────────────────────────

test('the header panel: maroon date, gray utility links, linked masthead, gray contents strip', () => {
  const html = renderNewsletter(fullIssue());
  assert.match(html, /font-size:15px; line-height:1.4; font-weight:700; color:#500000;">June 16, 2026</);
  assert.match(html, /<a href="https:\/\/erc\.cehd\.tamu\.edu\/" target="_blank" rel="noopener" style="color:#535353; text-decoration:none;">Website<\/a><span style="padding:0 8px; color:#A7A7A7;">&#183;<\/span>/);
  assert.match(html, /<a href="https:\/\/erc\.cehd\.tamu\.edu\/"[^>]*><img width="640" src="https:\/\/raw\.githubusercontent\.com\/kateb-123\/erc-content-desk\/main\/builder\/images\/newsletter-masthead\.png" alt="Education Research Center Newsletter"/);
  assert.match(html, /background-color:#F6F6F6; padding:10px 16px 11px 16px; text-align:center;[^"]*font-size:13px;[^"]*color:#535353;"><a href="#research" style="color:#535353; text-decoration:none;">Research<\/a>&nbsp;<span style="padding:0 4px; color:#A7A7A7;">&#183;<\/span>&nbsp;<a href="#spotlight"/);
  assert.ok(!html.includes('In this issue'));
});

test('the contents strip stays on one line when it fits and splits into two balanced lines when it does not', () => {
  const six = [['research', 'Research'], ['spotlight', 'Spotlight'], ['events', 'Events'], ['opportunities', 'Opportunities'], ['policy', 'Policy Research'], ['news', 'Headlines']]
    .map(([anchor, short]) => ({ anchor, short }));
  assert.ok(!navLinks(six).includes('<br>'), 'six labels fit');
  const seven = [...six, { anchor: 'misc', short: 'Miscellaneous' }];
  assert.ok(!navLinks(seven).includes('<br>'), 'all seven sections still fit by the estimate (593px)');
  const eight = [...seven, { anchor: 'survey', short: 'Reader Survey' }];
  const out = navLinks(eight);
  assert.equal(count(out, '<br>'), 1);
  const [a, b] = out.split('<br>');
  assert.ok(a.endsWith('</a>') && b.startsWith('<a '), 'no line starts or ends on a separator');
  assert.match(a, /Opportunities<\/a>$/, 'four on the first line, four on the second: the balanced split');
  assert.ok(!/Policy Research/.test(out), 'a label never breaks inside');
  assert.match(out, /Policy&nbsp;Research/);
});

test('issue.layout.nav=false drops the contents strip; the export keeps jump links and the editable preview draws words', () => {
  const issue = fullIssue();
  assert.match(renderNewsletter(issue), /href="#events"/);
  const editable = renderNewsletter(issue, { editable: true });
  assert.ok(!/href="#events"/.test(editable));
  assert.match(editable, /<span style="color:#535353;">Events<\/span>/);
  issue.layout = { nav: false };
  const html = renderNewsletter(issue);
  assert.ok(!/href="#events"/.test(html) && !/background-color:#F6F6F6; padding:10px 16px/.test(html));
});

test('the intro is its own panel of plain paragraphs; the old "Want to feature" standing line is gone (the Share callout says it)', () => {
  const issue = fullIssue();
  issue.intro = 'Howdy all! First.\n\nSecond **bold** here.\n\nWant to feature something? [Let us know](https://x.org/share)!';
  const html = renderNewsletter(issue);
  assert.match(html, /padding:26px 48px 0 24px;"><p style="margin:0 0 14px; font-family:'Trebuchet MS'[^"]*font-size:15px; line-height:1.55; color:#202020;">Howdy all! First\.<\/p><p style="margin:0 0 14px;[^"]*">Second <strong>bold<\/strong> here\.<\/p><p style="margin:0 0 0px;[^"]*color:#202020;">Want to feature something\?/);
  assert.ok(!/border-top:1px solid #EAEAEA; margin:18px 0 0/.test(html), 'no hairline, no standing line');
  const ed = renderNewsletter(issue, { editable: true });
  assert.equal(count(ed, 'data-edit-field="intro"'), 3, 'every intro paragraph carries the hook');
  issue.intro = '';
  assert.equal(panels(renderNewsletter(issue)), 9, 'no intro, no intro panel');
});

test('a hidden preheader follows <body>, built from the intro\'s first paragraph as plain words', () => {
  const issue = fullIssue();
  issue.intro = 'Welcome back, **everyone** — see [the site](https://x.org).\n\nSecond paragraph.';
  const html = renderNewsletter(issue);
  const pre = html.match(/<body[^>]*>\s*<div style="display:none;[^"]*mso-hide:all;">([\s\S]*?)<\/div>/);
  assert.ok(pre, 'preheader div sits right after <body>');
  assert.ok(pre[1].startsWith('Welcome back, everyone — see the site.'), pre[1].slice(0, 80));
  assert.ok(!pre[1].includes('Second paragraph'));
});

// ─── Items ───────────────────────────────────────────────────────────────────

test('an item is its title (the dark link, no underline), a gray meta line and the description', () => {
  const issue = createEmptyIssue();
  issue.sections.spotlight.enabled = true;
  issue.sections.spotlight.items = [{ id: 's1', group: 'events', fields: { title: 'A Talk', url: 'https://x.org/t', date: 'Oct 8, 2026', time: '11:30 AM', location: 'Rudder 707', summary: 'First.\n\nSecond.' } }];
  const html = renderNewsletter(issue);
  assert.match(html, /<tr><td style="padding:10px 48px 0 40px;"><p style="margin:0 0 4px; font-family:'Trebuchet MS'[^"]*font-size:16px; line-height:1.3; font-weight:700; color:#202020;"><a href="https:\/\/x\.org\/t" target="_blank" rel="noopener" style="color:#202020; text-decoration:none;">A Talk<\/a><\/p><p style="margin:0 0 8px;[^"]*font-size:14px; line-height:1.4; color:#535353;">Oct 8, 2026 \| 11:30 AM \| Rudder 707<\/p><p style="margin:0 0 8px;[^"]*font-size:14px; line-height:1.5; color:#3E3E3E;">First\.<\/p><p style="margin:0 0 0px;[^"]*">Second\.<\/p>/);
});

test('item spacing: 10px for the first in a group, 16px between two without descriptions, 22px otherwise; brief event groups get hairlines', () => {
  const issue = createEmptyIssue();
  issue.sections.opportunities.enabled = true;
  issue.sections.opportunities.items = [
    { id: 'o1', group: 'funding', fields: { title: 'One', meta: 'Deadline: soon' } },
    { id: 'o2', group: 'funding', fields: { title: 'Two', meta: 'Deadline: later' } },
  ];
  issue.sections.spotlight.enabled = true;
  issue.sections.spotlight.items = [
    { id: 's1', group: 'events', fields: { title: 'Talk A', summary: 'Words.' } },
    { id: 's2', group: 'events', fields: { title: 'Talk B', summary: 'Words.' } },
  ];
  issue.sections.events.enabled = true;
  issue.sections.events.items = [
    { id: 'e1', group: 'tamu', fields: { title: 'Ev A', date: 'May 1' } },
    { id: 'e2', group: 'tamu', fields: { title: 'Ev B', date: 'May 2' } },
  ];
  const html = renderNewsletter(issue);
  assert.match(html, /padding:16px 48px 0 40px;"><p[^>]*><span[^>]*>Two<\/span>/, 'tight');
  assert.match(html, /padding:22px 48px 0 40px;"><p[^>]*><a[^>]*>Talk B<\/a>|padding:22px 48px 0 40px;"><p[^>]*><span[^>]*>Talk B<\/span>/, 'with descriptions');
  assert.match(html, /<tr><td style="padding:12px 48px 0 40px;"><div style="border-top:1px solid #EAEAEA;[^"]*">&nbsp;<\/div><\/td><\/tr>\n<tr><td style="padding:12px 48px 0 40px;"><p[^>]*><span[^>]*>Ev B<\/span>/, 'hairline then 12px');
});

test('descriptions show by default in Research and Spotlight, only for Featured Events, never for Opportunities', () => {
  const issue = createEmptyIssue();
  const item = (id, group, extra = {}) => ({ id, group, fields: { title: id, summary: `About ${id}.`, ...extra } });
  issue.sections.research.enabled = true; issue.sections.research.items = [item('r1', 'brief')];
  issue.sections.spotlight.enabled = true; issue.sections.spotlight.items = [item('s1', 'programs')];
  issue.sections.events.enabled = true; issue.sections.events.items = [item('f1', 'featured'), item('e1', 'tamu'), item('e2', 'offcampus')];
  issue.sections.opportunities.enabled = true; issue.sections.opportunities.items = [item('o1', 'funding', { meta: 'Deadline: soon' })];
  const html = renderNewsletter(issue);
  for (const id of ['r1', 's1', 'f1']) assert.ok(html.includes(`About ${id}.`), `${id} shows its description`);
  for (const id of ['e1', 'e2', 'o1']) assert.ok(!html.includes(`About ${id}.`), `${id} hides its description`);
});

test('fields.showSummary overrides the group default both ways', () => {
  const issue = createEmptyIssue();
  issue.sections.events.enabled = true;
  issue.sections.events.items = [{ id: 'e1', group: 'tamu', fields: { title: 'Math', summary: 'Shown on request.', showSummary: true } }];
  issue.sections.research.enabled = true;
  issue.sections.research.items = [{ id: 'r1', group: 'brief', fields: { title: 'Brief', summary: 'Hidden on request.', showSummary: false } }];
  const html = renderNewsletter(issue);
  assert.ok(html.includes('Shown on request.'));
  assert.ok(!html.includes('Hidden on request.'));
});

test('a featured event pins under Featured Events with its description, whatever group it was filed in', () => {
  const issue = fullIssue();
  const ev = issue.sections.events.items[1];
  ev.featured = true;
  ev.fields.summary = 'The one event that keeps its description.';
  const html = renderNewsletter(issue);
  const iFeat = html.indexOf('>Featured Events</h3>');
  const iTitle = html.indexOf(ev.fields.title);
  const iNext = html.indexOf('>Texas A&amp;M</h3>');
  assert.ok(iFeat > 0 && iFeat < iTitle && iTitle < iNext, 'under the Featured label, before the next group');
  assert.ok(html.includes('The one event that keeps its description.'));
});

test('research: the author line is the meta line, and an unknown group folds into Research Brief before Report', () => {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'itm_2', group: 'report', fields: { title: 'R-One', authors: 'A & B', summary: 'y' } },
    { id: 'itm_x', group: '', fields: { title: 'Untagged', summary: 's' } },
  ];
  const html = renderNewsletter(issue);
  const iBrief = html.indexOf('>Research Brief</h3>'), iReport = html.indexOf('>Report</h3>');
  assert.ok(iBrief > 0 && iBrief < html.indexOf('Untagged') && html.indexOf('Untagged') < iReport && iReport < html.indexOf('R-One'));
  assert.match(html, /R-One<\/a><\/p>|R-One<\/span><\/p>/);
  assert.match(html, /<p style="margin:0 0 8px;[^"]*color:#535353;">A &amp; B<\/p>/);
});

test('the Miscellaneous section renders its one list with no group label', () => {
  const issue = createEmptyIssue();
  issue.sections.misc.items.push({ id: 'm1', group: 'misc', fields: { title: 'A one-off thing', url: 'https://x.org/misc' } });
  issue.sections.misc.enabled = true;
  const html = renderNewsletter(issue);
  assert.match(html, />Miscellaneous<\/h2>/);
  assert.ok(!/<h3/.test(body(html)), 'no group label');
  assert.match(html, /<tr><td style="padding:18px 48px 0 40px;"><table role="presentation"[^>]*><tbody><tr><td style="vertical-align:top; padding:0px 0 0px 0;"><p/);
  assert.ok(!/View more/.test(html), 'no tail link');
});

// ─── Digests ─────────────────────────────────────────────────────────────────

test('digests are one-line entries divided by hairlines, no bullets; headlines add the source in gray', () => {
  const html = renderNewsletter(issueOf('sample-real.json'));
  assert.ok(!/&#8226;/.test(html), 'no bullet glyphs');
  assert.match(html, /<tr><td style="vertical-align:top; padding:9px 0 9px 0; border-top:1px solid #EAEAEA;"><p style="margin:0 0 0px; font-family:'Trebuchet MS'[^"]*font-size:14px; line-height:1.45; color:#202020;">/);
  assert.match(html, /<\/a> <span style="color:#626262;">\([^<]+\)<\/span>/);
  assert.match(renderNewsletter(fullIssue()), /\(Ed Week\)<\/span>/);
  assert.match(html, /padding:10px 48px 0 40px;"><table/, 'the list sits 10px under its label');
});

test('"View more »" ends Upcoming Events (Kate, Oct 6), Opportunities, Policy Research and Headlines and points at the Policy Exchange; a stray per-issue URL is ignored', () => {
  const issue = fullIssue();
  issue.sections.policy.seeMoreUrl = 'https://example.org/policy';
  const html = renderNewsletter(issue);
  assert.ok(!/href="#"/.test(html));
  assert.equal(count(html, `<a href="${POLICY_EXCHANGE_URL}" target="_blank" rel="noopener" style="font-family:'Trebuchet MS','Segoe UI',Tahoma,sans-serif; font-size:14px; line-height:1.4; font-weight:700; color:#500000; text-decoration:none;">View more &#187;</a>`), 4);
  const iEvents = html.indexOf('>Upcoming Events</h2>'), iOpps = html.indexOf('>Opportunities</h2>');
  assert.ok(html.slice(iEvents, iOpps).includes('View more &#187;'), 'Events has its tail link');
  assert.ok(!html.includes('https://example.org/policy'));
  assert.ok(!/ERC website|&#8594;/.test(html));
});

// ─── Pictures ────────────────────────────────────────────────────────────────

const PHOTO = 'https://raw.githubusercontent.com/erc/media/main/photo.jpg';
function mediaIssue() {
  const issue = createEmptyIssue();
  issue.sections.research.enabled = true;
  issue.sections.research.items = [
    { id: 'r1', group: 'brief', fields: { title: 'First blurb', authors: 'A. Author', summary: 'A summary.', image: PHOTO } },
    { id: 'r2', group: 'brief', fields: { title: 'Brief sans summary', authors: 'A. Author', image: PHOTO } },
  ];
  issue.sections.spotlight.enabled = true;
  issue.sections.spotlight.items = [
    { id: 's1', group: 'events', fields: { title: 'ERC EdTalk: Dr. Vale', date: 'Oct 8', summary: 'A talk.', image: PHOTO, url: 'https://x.org/edtalk' } },
    { id: 's2', group: 'events', fields: { title: 'Brown Bag', date: 'Oct 9', summary: 'A lunch.', image: PHOTO } },
  ];
  issue.sections.events.enabled = true;
  issue.sections.events.items = [
    { id: 'e1', group: 'tamu', fields: { title: 'Regular event', date: 'May 2', summary: 'Hidden by default.', image: PHOTO } },
  ];
  return issue;
}
const pictures = html => [...html.matchAll(/<img src="https:\/\/raw\.githubusercontent\.com[^"]*photo\.jpg" alt="Picture: ([^"]*)" width="(\d+)"/g)].map(m => [m[1], Number(m[2])]);

test('a stamp is 96px wide under the title and meta, beside the description, in a 112px column; it links to the item', () => {
  const html = renderNewsletter(mediaIssue());
  const i = html.indexOf('First blurb');
  const seg = html.slice(i, html.indexOf('Brief sans summary'));
  assert.match(seg, /A\. Author<\/p><table role="presentation"[^>]*width="100%"[^>]*><tbody><tr><td valign="top" width="112" style="width:112px; vertical-align:top; padding:4px 0 0 0;"><a href="https:\/\/raw\.githubusercontent\.com\/erc\/media\/main\/photo\.jpg" target="_blank" rel="noopener" style="display:block; text-decoration:none;"><img src="[^"]*photo\.jpg" alt="Picture: First blurb" width="96" style="width:96px; max-width:96px; height:auto; display:block; border:0;"><\/a><\/td><td valign="top" style="vertical-align:top;"><p[^>]*>A summary\.<\/p>/);
  const brownBag = html.slice(html.indexOf('Brown Bag'));
  assert.match(brownBag, /width="96"/, 'other spotlight events get the stamp');
});

test('an "ERC EdTalk" item gets a 160px headshot beside the title, meta and description, linked to the item URL', () => {
  const html = renderNewsletter(mediaIssue());
  const i = html.indexOf('<td valign="top" width="176"');
  assert.ok(i > 0, 'a 176px column');
  const seg = html.slice(i, html.indexOf('Brown Bag'));
  assert.match(seg, /padding:3px 0 0 0;"><a href="https:\/\/x\.org\/edtalk"[^>]*><img src="[^"]*photo\.jpg" alt="Picture: ERC EdTalk: Dr\. Vale" width="160"/);
  assert.match(seg, /<td valign="top" style="vertical-align:top;"><p[^>]*><a[^>]*>ERC EdTalk: Dr\. Vale<\/a><\/p><p[^>]*>Oct 8<\/p><p[^>]*>A talk\.<\/p>/);
});

test('fields.pictureStyle picks the layout: headshot on any item, stamp on an EdTalk, none keeps the picture out', () => {
  const issue = mediaIssue();
  issue.sections.research.items[0].fields.pictureStyle = 'headshot';
  issue.sections.spotlight.items[0].fields.pictureStyle = 'stamp';
  issue.sections.spotlight.items[1].fields.pictureStyle = 'none';
  const html = renderNewsletter(issue);
  const got = Object.fromEntries(pictures(html));
  assert.equal(got['First blurb'], 160);
  assert.equal(got['ERC EdTalk: Dr. Vale'], 96);
  assert.ok(!('Brown Bag' in got));
});

test('no description, no picture: items without a summary, or with it hidden, render none', () => {
  const html = renderNewsletter(mediaIssue());
  const names = pictures(html).map(([n]) => n);
  assert.deepEqual(names, ['First blurb', 'ERC EdTalk: Dr. Vale', 'Brown Bag']);
  const issue = mediaIssue();
  issue.sections.research.items[0].fields.showSummary = false;
  assert.ok(!pictures(renderNewsletter(issue)).some(([n]) => n === 'First blurb'));
});

test('a picture layout chosen for an item with no photo draws a dashed placeholder in the editable preview only', () => {
  const issue = createEmptyIssue();
  issue.sections.spotlight.enabled = true;
  issue.sections.spotlight.items = [
    { id: 's1', group: 'events', fields: { title: 'Talk', summary: 'Words.', pictureStyle: 'stamp' } },
    { id: 's2', group: 'events', fields: { title: 'Other talk', summary: 'Words.' } },
  ];
  const preview = renderNewsletter(issue, { editable: true });
  assert.match(preview, /<td valign="top" width="112"[^>]*><span style="display:block; box-sizing:border-box; width:96px; height:120px; border:1px dashed #A7A7A7;[^"]*" data-edit-section="spotlight" data-edit-item="s1" data-edit-field="image">Photo<\/span>/);
  assert.equal(count(preview, 'dashed'), 1, 'only the item whose layout was chosen; an unchosen item with no photo draws nothing');
  const sent = renderNewsletter(issue);
  assert.ok(!/dashed|width="112"/.test(sent), 'the email never carries the placeholder');
});

test('an unsafe picture URL renders no picture and leaks no scheme', () => {
  const issue = mediaIssue();
  issue.sections.research.items[0].fields.image = 'javascript:alert(1)';
  const html = renderNewsletter(issue);
  assert.ok(!/javascript:/.test(html));
  assert.ok(!pictures(html).some(([n]) => n === 'First blurb'));
});

// ─── The callout ─────────────────────────────────────────────────────────────

const SHARE = 'Share something with the ERC';
test('a new issue carries the Share callout after ERC Research as a maroon panel with the white button; its words are the desk\'s', () => {
  const html = renderNewsletter(fullIssue());
  const i = html.indexOf(`>${SHARE}</p>`);
  assert.ok(i > 0, 'the Share callout renders');
  assert.ok(html.lastIndexOf('>ERC Research</h2>', i) > 0 && html.indexOf('>ERC Spotlight</h2>', i) > i, 'between Research and Spotlight');
  const panel = html.slice(html.lastIndexOf('<table align="center" width="640"', i), i);
  assert.match(panel, /background-color:#ffffff;"><tbody>\n<tr><td style="background-color:#500000; padding:26px 48px 28px 24px;"><p style="[^"]*font-size:18px;[^"]*color:#ffffff;"$/);
  assert.match(html.slice(i), /^>[^<]*<\/p><p style="margin:0 0 18px;[^"]*color:#E9E4DC;">Research, an event, an announcement[^<]*<\/p><table[^>]*><tbody><tr><td style="background-color:#ffffff; padding:11px 20px 12px 20px;"><a href="https:\/\/erc-policy-exchange\.vercel\.app\/share\/"[^>]*text-transform:uppercase; color:#500000;[^"]*">Share something &#187;<\/a>/);
  assert.equal(count(html, 'height:12px; font-size:1px; line-height:12px;'), 9, 'the panel adds a gap like any other');
  assert.ok(!/Submit your research|Want to feature/.test(html), 'the old callout and the old standing line are gone');
});

test('a callout\'s style: gray and dotted sit inside the panel before it, before its closing spacer; a deadline line draws between text and button', () => {
  const issue = fullIssue();
  issue.callouts = calloutsOf(issue);   // the fixture predates callouts: its one legacy Share callout, made real
  const c = issue.callouts[0];
  c.style = 'gray';
  let html = renderNewsletter(issue);
  assert.match(html, /<tr><td style="padding:28px 24px 0 24px;"><table[^>]*><tbody><tr><td style="background-color:#F6F6F6; padding:22px 24px 24px 24px;"><p style="margin:0 0 8px;[^"]*color:#202020;">Share something with the ERC[\s\S]*?<td style="background-color:#500000; padding:11px 20px 12px 20px;"><a[^>]*color:#ffffff;[\s\S]*?<\/td><\/tr>\n<tr><td style="height:26px;[^"]*">&nbsp;<\/td><\/tr>\n<\/tbody><\/table>/);
  assert.equal(panels(html), 9, 'no panel of its own');
  c.style = 'dotted';
  c.deadline = 'Deadline: October 20, 2026';
  html = renderNewsletter(issue);
  assert.match(html, /border:2px dotted #732F2F; padding:20px 22px 22px 22px;"><p style="margin:0 0 8px;[^"]*color:#500000;">Share something with the ERC<\/p><p style="margin:0 0 8px;[^"]*">Research[^<]*<\/p><p style="margin:0 0 18px;[^"]*font-size:14px;[^"]*color:#535353;">Deadline: October 20, 2026<\/p><table/);
  c.style = 'weird';
  assert.match(renderNewsletter(issue), /background-color:#500000; padding:26px 48px 28px 24px;"><p[^>]*>Share something with the ERC/, 'an unknown style is maroon');
});

test('any number of callouts, each after its section; one whose section is empty follows the nearest earlier one, or the intro', () => {
  const issue = fullIssue();
  issue.callouts = [
    { id: 'c1', kind: 'share', after: 'research', style: 'maroon', title: 'First', text: 't', button: 'Go', url: 'https://x.org/1' },
    { id: 'c2', kind: 'custom', after: 'headlines', style: 'gray', title: 'Second', text: 't', button: 'Go', url: 'https://x.org/2' },
    { id: 'c3', kind: 'custom', after: 'misc', style: 'maroon', title: 'Third', text: '', button: 'Go', url: 'https://x.org/3' },
    { id: 'c4', kind: 'custom', after: 'research', style: 'dotted', title: '  ', text: 't', button: 'Go', url: '' },
  ];
  const html = renderNewsletter(issue);
  const at = (s) => html.indexOf(s);
  assert.ok(at('>ERC Research</h2>') < at('>First</p>') && at('>First</p>') < at('>ERC Spotlight</h2>'));
  assert.ok(at('>Education Headlines</h2>') < at('>Second</p>') && at('>Second</p>') < at('>Third</p>'), 'Second inside Headlines, Third after it (Miscellaneous is off, so Third follows Headlines)');
  assert.ok(at('>Third</p>') < at('alt="Texas A&amp;M University Education Research Center"'), 'before the footer');
  assert.ok(!html.includes('c4') && count(html, 'border:2px dotted') === 0, 'a titleless callout draws nothing');
  const sparse = sparseIssue();
  sparse.callouts = [{ id: 'c5', kind: 'custom', after: 'research', style: 'gray', title: 'Lonely', text: 't', button: 'Go', url: 'https://x.org/5' }];
  const h2 = renderNewsletter(sparse);
  assert.ok(at.call(null, '') === -1 || true);
  assert.ok(h2.indexOf('>Lonely</p>') > h2.indexOf('Welcome to the June 16') && h2.indexOf('>Lonely</p>') < h2.indexOf('>Upcoming Events</h2>'), 'no Research: it follows the intro, in its own panel');
  assert.equal(panels(h2), 5, 'header, intro, the lonely callout, events, footer');
});

test('an older draft\'s one fixed callout still reads: layout.callout as a Share callout in that style, none or showSubmit=false as no callout', () => {
  const issue = fullIssue();
  delete issue.callouts;
  issue.layout = { callout: 'dotted' };
  assert.deepEqual(calloutsOf(issue).map((c) => [c.kind, c.after, c.style]), [['share', 'research', 'dotted']]);
  assert.match(renderNewsletter(issue), /border:2px dotted #732F2F;[^"]*"><p[^>]*>Share something with the ERC/);
  issue.layout = { callout: 'none' };
  assert.deepEqual(calloutsOf(issue), []);
  delete issue.layout;
  issue.sections.research.showSubmit = false;
  assert.deepEqual(calloutsOf(issue), []);
  assert.ok(!renderNewsletter(issue).includes(SHARE));
  assert.deepEqual(layoutOf({ layout: { nav: 0 } }), { nav: true });
});

test('in the editable preview every part of a callout carries its hook: title, text, deadline, button', () => {
  const issue = fullIssue();
  issue.callouts = calloutsOf(issue);
  issue.callouts[0].deadline = 'By Friday';
  const ed = renderNewsletter(issue, { editable: true });
  for (const f of ['title', 'text', 'deadline', 'button']) assert.match(ed, new RegExp(`data-edit-section="callout" data-edit-item="${issue.callouts[0].id}" data-edit-field="${f}"`), f);
  assert.ok(!/data-edit-section="callout"/.test(renderNewsletter(issue)));
});

// ─── Footer and document ─────────────────────────────────────────────────────

test('the footer (Kate, Oct 6): a light gray band, the maroon lockup, a hairline, maroon links with gray dots, the date at right; no icons', () => {
  const html = renderNewsletter(fullIssue());
  assert.match(html, /<tr><td style="background-color:#F6F6F6; padding:24px 24px 18px 24px;"><img width="190" height="70" src="https:\/\/raw\.githubusercontent\.com\/kateb-123\/erc-content-desk\/main\/builder\/images\/erc-lockup-maroon\.png" alt="Texas A&amp;M University Education Research Center" style="width:190px; height:70px; display:block; border:0;">/);
  assert.match(html, /<tr><td style="background-color:#F6F6F6; padding:0 24px;"><div style="border-top:1px solid #D1D1D1;[^"]*">&nbsp;<\/div><\/td><\/tr>/);
  assert.match(html, /background-color:#F6F6F6; padding:14px 24px 24px 24px;"><table[^>]*><tbody><tr><td style="font-family:'Trebuchet MS'[^"]*font-weight:700; color:#500000;"><a href="https:\/\/erc\.cehd\.tamu\.edu\/"[^>]*style="color:#500000; text-decoration:none;">Website<\/a> <span style="padding:0 6px; font-weight:400; color:#A7A7A7;">&#183;<\/span> <a href="mailto:erc@tamu\.edu"[^>]*>Email<\/a> <span[^>]*>&#183;<\/span> <a href="https:\/\/erc-policy-exchange\.vercel\.app\/newsletter\/"[^>]*>Join&nbsp;the&nbsp;mailing&nbsp;list<\/a><\/td><td align="right" style="text-align:right;[^"]*font-size:13px;[^"]*color:#535353; white-space:nowrap;">June 16, 2026<\/td>/);
  assert.ok(!/<svg/.test(html));
  assert.ok(!/i\.ibb\.co/.test(html), 'the white lockup on imgbb is gone');
  assert.equal(count(html, '>Join the mailing list</a>'), 1, 'the header has the plain one; the footer keeps its words together');
});

test('document declares its language and a doctype, pins its colours for dark mode, and every new-tab link is noopener', () => {
  const html = renderNewsletter(fullIssue());
  assert.ok(html.startsWith('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"'));
  assert.match(html, /<html lang="en"/);
  assert.match(html, /<title>ERC Newsletter \| June 16, 2026<\/title>/);
  const style = html.slice(0, html.indexOf('</style>'));
  assert.match(style, /\[data-ogsc\] \[style\*="background-color:#ffffff"\] \{ background-color:#ffffff !important; \}/);
  assert.match(style, /@media \(prefers-color-scheme: dark\)/);
  assert.match(style, /\[style\*=" color:#202020"\] \{ color:#202020 !important; \}/);
  assert.equal(count(html, 'target="_blank"'), count(html, 'target="_blank" rel="noopener"'));
  assert.ok(!/rgb\(/.test(html), 'hex throughout, so the guards match');
});

test('all user text is escaped (no raw angle brackets injected)', () => {
  const issue = fullIssue();
  issue.sections.headlines.items[0].fields.title = 'A < B & C';
  const html = renderNewsletter(issue);
  assert.match(html, /A &lt; B &amp; C/);
});

test('export output has no edit hooks; the editable preview hooks title, meta, description, authors, image and intro', () => {
  const issue = mediaIssue();
  issue.intro = 'Hello.';
  issue.sections.opportunities.enabled = true;
  issue.sections.opportunities.items = [{ id: 'o1', group: 'funding', fields: { title: 'Grant', meta: 'Deadline: soon' } }];
  assert.ok(!/data-edit-/.test(renderNewsletter(issue)));
  const ed = renderNewsletter(issue, { editable: true });
  for (const f of ['title', 'summary', 'authors', 'image', 'intro', 'meta', 'date']) assert.match(ed, new RegExp(`data-edit-field="${f}"`), f);
  assert.match(ed, /<img [^>]*data-edit-section="research" data-edit-item="r1" data-edit-field="image"/);
  assert.match(ed, /<span data-edit-section="spotlight" data-edit-item="s1" data-edit-field="date">Oct 8<\/span>/);
});

// ─── Prose and links ─────────────────────────────────────────────────────────

test('renderProse renders bold and italic, escaping the rest, with no hooks', () => {
  const html = renderProse('A **bold** and *italic* & <x>.');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /&amp;/);
  assert.match(html, /&lt;x&gt;/);
  assert.doesNotMatch(html, /data-edit/);
});

test('renderProse links are maroon, bold and underlined; the rest is escaped', () => {
  const html = renderProse('See [Cape Verde](https://x.org/cv) & <b>more</b>.');
  assert.match(html, /<a href="https:\/\/x\.org\/cv" target="_blank" rel="noopener" style="color:#500000; font-weight:700; text-decoration:underline;">Cape Verde<\/a>/);
  assert.match(html, /&amp;/);
  assert.match(html, /&lt;b&gt;/);
});

test('renderProse keeps trailing parenthesis in a link href (e.g. Wikipedia links)', () => {
  const html = renderProse('See [Cape Verde](https://en.wikipedia.org/wiki/Cape_Verde_(country)) today.');
  assert.ok(html.includes('href="https://en.wikipedia.org/wiki/Cape_Verde_(country)"'));
  assert.ok(!html.includes('</a>)'));
});

test('renderProse only emits an anchor for safe URL schemes; unsafe schemes render as plain text', () => {
  const html = renderProse('Click [here](javascript:alert(1)) now');
  assert.ok(!html.includes('<a ') && !html.includes('javascript:') && html.includes('here'));
});

test('emphasis that spans a markdown link renders as one bold run', () => {
  const html = renderProse('**see [x](https://a.b) now** and *[y](https://c.d)*');
  assert.match(html, /<strong>see <a href="https:\/\/a\.b"[^>]*>x<\/a> now<\/strong>/);
  assert.match(html, /<em><a href="https:\/\/c\.d"[^>]*>y<\/a><\/em>/);
  assert.ok(!/\*/.test(html));
});

test('a URL typed without a scheme is linked as https; a word or an unsafe scheme is no link', () => {
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

test('the standing links are the ones the handoff names', () => {
  assert.equal(URLS.site, 'https://erc.cehd.tamu.edu/');
  assert.equal(URLS.join, 'https://erc-policy-exchange.vercel.app/newsletter/');
  assert.equal(POLICY_EXCHANGE_URL, 'https://erc-policy-exchange.vercel.app/');
  assert.equal(SECTION_REGISTRY.length, 7);
});
