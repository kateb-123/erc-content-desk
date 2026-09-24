import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import { renderNewsletter } from '../builder/js/template.js';
import { defaultSection, issueForPull, stagedCounts, isoToDisplay } from '../js/rows-to-issue.js';

const pub = o => blankRow({
  status: 'kept', published_at: '2026-08-26T00:00:00.000Z', ...o,
});

test('isoToDisplay turns an ISO date into newsletter prose', () => {
  assert.equal(isoToDisplay('2026-10-01'), 'October 1, 2026');
  assert.equal(isoToDisplay('2026-10'), '2026-10');
  assert.equal(isoToDisplay(''), '');
  assert.equal(isoToDisplay('not a date'), 'not a date');
});

test('defaultSection follows the map; an ERC event leads, the old spotlight flag moves nothing (Kate, Sep 22)', () => {
  assert.equal(defaultSection(pub({ type: 'research', subtype: 'ERC Research' })), 'research');
  assert.equal(defaultSection(pub({ type: 'event', subtype: 'A&M' })), 'events');
  assert.equal(defaultSection(pub({ type: 'event', subtype: 'A&M', spotlight_request: true })), 'events');
  assert.equal(defaultSection(pub({ type: 'erc_event', subtype: '' })), 'spotlight');
  assert.equal(defaultSection(pub({ type: '', subtype: '' })), '');
});

test('issueForPull places stamped rows in their default sections; the old spotlight flag is ignored', () => {
  const issue = issueForPull([
    pub({ id: 'a', type: 'event', subtype: 'Webinar-Online', headline: 'Webinar', link: 'https://x.org', blurb: 'B', date: '2026-09-10', newsletter_issue: '2026-09-01' }),
    pub({ id: 'b', type: 'headline', subtype: 'Texas', headline: 'News', link: 'https://y.org', spotlight_request: true, newsletter_issue: '2026-09-01' }),
    pub({ id: 'c', type: 'research', subtype: 'Working Paper', headline: 'A later issue', newsletter_issue: '2026-10-06' }),
  ], '2026-09-01');
  assert.equal(issue.sections.events.items.length, 1);
  assert.equal(issue.sections.events.items[0].fields.title, 'Webinar');
  assert.equal(issue.sections.events.items[0].group, 'offcampus');
  assert.equal(issue.sections.events.items[0].fields.date, 'September 10, 2026');
  assert.equal(issue.sections.spotlight.items.length, 0);
  assert.deepEqual(issue.sections.headlines.items.map(i => i.fields.title), ['News']);
  assert.equal(issue.sections.policy.enabled, false);
});

test('a row with an infographic carries it as the item picture', () => {
  const erc = o => pub({
    type: 'research', subtype: 'ERC Research', headline: 'ERC brief',
    link: 'https://x.org', newsletter_issue: '2026-09-01', ...o,
  });
  const issue = issueForPull([erc({ id: 'erc-1', infographic: 'https://raw.example.org/img-1.png' })], '2026-09-01');
  assert.equal(issue.sections.research.items[0].fields.image, 'https://raw.example.org/img-1.png');
  const bare = issueForPull([erc({ id: 'erc-2', headline: 'No picture' })], '2026-09-01');
  assert.equal('image' in bare.sections.research.items[0].fields, false);
});

test('the builder template renders an issue built from desk rows', () => {
  const issue = issueForPull([
    pub({
      id: 'headline-1',
      type: 'headline', subtype: 'Texas', headline: 'TEFA passes 100,000 awards',
      link: 'https://x.test', blurb: 'Body text.', source: 'Texas Tribune',
      newsletter_issue: '2026-09-01',
    }),
    pub({
      id: 'opportunity-1',
      type: 'opportunity', subtype: 'Call for Proposals', headline: 'AERA call for papers',
      deadline: '2026-09-09', blurb: 'Submit by the deadline.',
      newsletter_issue: '2026-09-01',
    }),
  ], '2026-09-01');
  issue.intro = 'Welcome back.';

  const html = renderNewsletter(issue);
  assert.ok(html.includes('TEFA passes 100,000 awards'), 'headline item is missing from the HTML');
  assert.ok(html.includes('AERA call for papers'), 'opportunity item is missing from the HTML');
  assert.ok(html.includes('Welcome back.'), 'intro is missing from the HTML');
  assert.ok(html.includes('https://x.test'), 'source link is missing from the HTML');
});

test('issueForPull serves everything stamped for the issue, builder-shaped', () => {
  const rows = [
    blankRow({ id: 'a', status: 'kept', headline: 'ERC brief', link: 'https://x.org/a', blurb: 'B.',
      type: 'research', subtype: 'ERC Research', newsletter_issue: '2026-09-01' }),
    blankRow({ id: 'b', status: 'kept', headline: 'ERC event', link: 'https://x.org/b', blurb: 'E.',
      type: 'erc_event', subtype: '', newsletter_issue: '2026-09-01' }),
    blankRow({ id: 'c', status: 'kept', headline: 'Other issue', link: 'https://x.org/c',
      type: 'headline', subtype: 'Texas', newsletter_issue: '2026-10-06' }),
    blankRow({ id: 'd', status: 'kept', headline: 'Unstamped', link: 'https://x.org/d', type: 'headline', subtype: 'Texas' }),
    blankRow({ id: 'e', status: 'kept', headline: 'Stamped but untyped', link: 'https://x.org/e', newsletter_issue: '2026-09-01' }),
  ];
  const issue = issueForPull(rows, '2026-09-01');
  assert.equal(issue.date, '2026-09-01');
  assert.deepEqual(issue.sections.research.items.map(i => i.fields.title), ['ERC brief']);
  assert.equal(issue.sections.research.items[0].group, 'brief');
  assert.deepEqual(issue.sections.spotlight.items.map(i => i.fields.title), ['ERC event']);
  assert.equal(issue.sections.spotlight.items[0].group, 'events');
  // the untyped-but-stamped row lands visible in Headlines, never dropped
  assert.deepEqual(issue.sections.headlines.items.map(i => i.fields.title), ['Stamped but untyped']);
  assert.equal(issue.sections.events.enabled, false);
});

test('stagedCounts tallies stamps per issue', () => {
  const rows = [
    blankRow({ id: 'a', newsletter_issue: '2026-09-01' }),
    blankRow({ id: 'b', newsletter_issue: '2026-09-01' }),
    blankRow({ id: 'c', newsletter_issue: '2026-10-06' }),
    blankRow({ id: 'd' }),
  ];
  assert.deepEqual(stagedCounts(rows), { '2026-09-01': 2, '2026-10-06': 1 });
});

test('a webinar pulled into the newsletter carries no location (Kate, Sep 23: the newsletter already says online)', () => {
  const rows = [
    blankRow({ id: 'w', status: 'kept', type: 'event', subtype: 'Webinar-Online', headline: 'W', link: 'https://x.org/w', date: '2026-09-30', time: '1 PM CT', location: 'Zoom', newsletter_issue: '2026-10-06' }),
    blankRow({ id: 'o', status: 'kept', type: 'event', subtype: 'Off-Campus', headline: 'O', link: 'https://x.org/o', date: '2026-09-30', time: '1 PM CT', location: 'Austin', newsletter_issue: '2026-10-06' }),
  ];
  const issue = issueForPull(rows, '2026-10-06');
  const items = issue.sections.events.items;
  assert.equal(items.find(i => i.fields.title === 'W').fields.location, undefined);
  assert.equal(items.find(i => i.fields.title === 'O').fields.location, 'Austin');
});
