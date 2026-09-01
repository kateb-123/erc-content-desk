import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import { renderNewsletter } from '../builder/js/template.js';
import { defaultSection, groupFor, issueFromPicks, issueForPull, stagedCounts, isoToDisplay } from '../js/rows-to-issue.js';

const pub = o => blankRow({
  status: 'kept', published_at: '2026-08-26T00:00:00.000Z', ...o,
});

test('isoToDisplay turns an ISO date into newsletter prose', () => {
  assert.equal(isoToDisplay('2026-10-01'), 'October 1, 2026');
  assert.equal(isoToDisplay('2026-10'), '2026-10');
  assert.equal(isoToDisplay(''), '');
  assert.equal(isoToDisplay('not a date'), 'not a date');
});

test('defaultSection follows the map, spotlight flag wins', () => {
  assert.equal(defaultSection(pub({ type: 'research', subtype: 'ERC Research' })), 'research');
  assert.equal(defaultSection(pub({ type: 'event', subtype: 'A&M' })), 'events');
  assert.equal(defaultSection(pub({ type: 'event', subtype: 'A&M', spotlight_request: true })), 'spotlight');
  assert.equal(defaultSection(pub({ type: '', subtype: '' })), '');
});

test('issueFromPicks places picked rows into their (possibly overridden) sections', () => {
  const rows = [
    pub({ id: 'a', type: 'event', subtype: 'Webinar-Online', headline: 'Webinar', link: 'https://x.org', blurb: 'B', date: '2026-09-10' }),
    pub({ id: 'b', type: 'headline', subtype: 'Texas', headline: 'News', link: 'https://y.org' }),
    pub({ id: 'c', type: 'research', subtype: 'Report', headline: 'Unpicked' }),
  ];
  const issue = issueFromPicks(rows, [
    { id: 'a', sectionKey: 'events' },
    { id: 'b', sectionKey: 'spotlight' },   // manual override via "move to…"
  ], { date: 'September 1, 2026', intro: 'Hi' });
  assert.equal(issue.sections.events.items.length, 1);
  assert.equal(issue.sections.events.items[0].fields.title, 'Webinar');
  assert.equal(issue.sections.events.items[0].group, 'offcampus');
  assert.equal(issue.sections.events.items[0].fields.date, 'September 10, 2026');
  assert.equal(issue.sections.spotlight.items.length, 1);
  assert.equal(issue.sections.spotlight.items[0].group, 'thisandthat');
  assert.equal(issue.sections.policy.enabled, false);
  assert.equal(issue.date, 'September 1, 2026');
  assert.equal(issue.intro, 'Hi');
});

test('the ported template renders an issue built from picks', () => {
  const rows = [
    pub({
      id: 'headline-1',
      type: 'headline', subtype: 'Texas', headline: 'TEFA passes 100,000 awards',
      link: 'https://x.test', blurb: 'Body text.', source: 'Texas Tribune',
    }),
    pub({
      id: 'opportunity-1',
      type: 'opportunity', subtype: 'Call for Proposals', headline: 'AERA call for papers',
      deadline: '2026-09-09', blurb: 'Submit by the deadline.',
    }),
  ];

  const issue = issueFromPicks(rows, [
    { id: 'headline-1', sectionKey: 'headlines' },
    { id: 'opportunity-1', sectionKey: 'opportunities' },
  ], { date: 'August 2026', intro: 'Welcome back.' });

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
    blankRow({ id: 'b', status: 'kept', headline: 'Spotlight event', link: 'https://x.org/b', blurb: 'E.',
      type: 'event', subtype: 'A&M', spotlight_request: true, newsletter_issue: '2026-09-01' }),
    blankRow({ id: 'c', status: 'kept', headline: 'Other issue', link: 'https://x.org/c',
      type: 'headline', subtype: 'Texas', newsletter_issue: '2026-10-06' }),
    blankRow({ id: 'd', status: 'kept', headline: 'Unstamped', link: 'https://x.org/d', type: 'headline', subtype: 'Texas' }),
    blankRow({ id: 'e', status: 'kept', headline: 'Stamped but untyped', link: 'https://x.org/e', newsletter_issue: '2026-09-01' }),
  ];
  const issue = issueForPull(rows, '2026-09-01');
  assert.equal(issue.date, '2026-09-01');
  assert.deepEqual(issue.sections.research.items.map(i => i.fields.title), ['ERC brief']);
  assert.equal(issue.sections.research.items[0].group, 'brief');
  assert.deepEqual(issue.sections.spotlight.items.map(i => i.fields.title), ['Spotlight event']);
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
