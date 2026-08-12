import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import { renderNewsletter } from '../js/template.js';
import { rowsToIssue, mappedNewsletterRows, isoToDisplay } from '../js/rows-to-issue.js';

function processed(overrides) {
  return blankRow({ status: 'processed', newsletter: true, ...overrides });
}

test('isoToDisplay turns an ISO date into newsletter prose', () => {
  assert.equal(isoToDisplay('2026-10-01'), 'October 1, 2026');
  assert.equal(isoToDisplay('2026-10'), '2026-10');
  assert.equal(isoToDisplay(''), '');
  assert.equal(isoToDisplay('not a date'), 'not a date');
});

test('the issue carries the date and intro it was given', () => {
  const issue = rowsToIssue([], { date: 'August 2026', intro: 'Welcome back.' });
  assert.equal(issue.date, 'August 2026');
  assert.equal(issue.intro, 'Welcome back.');
});

test('a headline row lands in the headlines section, Texas group', () => {
  const issue = rowsToIssue([processed({
    type: 'headline', subtype: 'Texas', headline: 'TEFA passes 100,000 awards',
    link: 'https://x.test', blurb: 'Body text.', source: 'Texas Tribune',
  })], { date: 'August 2026', intro: '' });

  const section = issue.sections.headlines;
  assert.equal(section.enabled, true);
  assert.equal(section.items.length, 1);
  assert.equal(section.items[0].group, 'texas');
  assert.equal(section.items[0].fields.title, 'TEFA passes 100,000 awards');
  assert.equal(section.items[0].fields.url, 'https://x.test');
  assert.equal(section.items[0].fields.source, 'Texas Tribune');
});

test('research maps to the policy section and carries authors', () => {
  const issue = rowsToIssue([processed({
    type: 'research', subtype: 'Peer-Reviewed', headline: 'A study',
    authors: 'Li, J., & Copur-Gencturk, Y.', blurb: 'Findings.',
  })], { date: 'August 2026', intro: '' });

  const item = issue.sections.policy.items[0];
  assert.equal(item.group, 'peer');
  assert.equal(item.fields.authors, 'Li, J., & Copur-Gencturk, Y.');
});

test('an opportunity deadline becomes the meta line', () => {
  const issue = rowsToIssue([processed({
    type: 'opportunity', subtype: 'Funding & Grants', headline: 'W.T. Grant LOI',
    deadline: '2026-09-09', blurb: 'Body.',
  })], { date: 'August 2026', intro: '' });

  assert.equal(issue.sections.opportunities.items[0].fields.meta, 'Deadline: September 9, 2026');
});

test('an event carries a display date, time, and location', () => {
  const issue = rowsToIssue([processed({
    type: 'event', subtype: 'Online', headline: 'A webinar',
    date: '2026-09-15', time: '1:00 PM CT', location: 'Virtual forum', blurb: 'Body.',
  })], { date: 'August 2026', intro: '' });

  const fields = issue.sections.events.items[0].fields;
  assert.equal(fields.date, 'September 15, 2026');
  assert.equal(fields.time, '1:00 PM CT');
  assert.equal(fields.location, 'Virtual forum');
});

test('only processed, newsletter-flagged, unused rows are included', () => {
  const issue = rowsToIssue([
    processed({ type: 'headline', subtype: 'Texas', headline: 'In' }),
    blankRow({ status: 'kept', newsletter: true, type: 'headline', subtype: 'Texas', headline: 'Not processed' }),
    processed({ type: 'headline', subtype: 'Texas', headline: 'Hub only', newsletter: false, hub: true }),
    processed({ type: 'headline', subtype: 'Texas', headline: 'Already built', newsletter_used_at: '2026-08-01' }),
  ], { date: 'August 2026', intro: '' });

  const titles = issue.sections.headlines.items.map(i => i.fields.title);
  assert.deepEqual(titles, ['In']);
});

test('an unmapped type/subtype pair is skipped rather than crashing', () => {
  const issue = rowsToIssue([processed({ type: 'headline', subtype: '', headline: 'Unsorted' })], { date: 'x', intro: '' });
  assert.equal(issue.sections.headlines.items.length, 0);
});

test('mappedNewsletterRows returns exactly what the issue rendered', () => {
  const rows = [
    processed({ id: 'ok', type: 'headline', subtype: 'Texas', headline: 'Rendered' }),
    processed({ id: 'unmapped', type: 'headline', subtype: '', headline: 'Skipped' }),
    processed({ id: 'hub-only', type: 'headline', subtype: 'Texas', headline: 'Hub', newsletter: false, hub: true }),
  ];
  assert.deepEqual(mappedNewsletterRows(rows).map(r => r.id), ['ok']);
  assert.equal(rowsToIssue(rows, { date: 'x', intro: '' }).sections.headlines.items.length, 1);
});

test('sections with no items stay disabled', () => {
  const issue = rowsToIssue([processed({ type: 'headline', subtype: 'Texas', headline: 'X' })], { date: 'x', intro: '' });
  assert.equal(issue.sections.headlines.enabled, true);
  assert.equal(issue.sections.opportunities.enabled, false);
});

test('the ported template renders an issue built from rows', () => {
  const issue = rowsToIssue([
    processed({
      type: 'headline', subtype: 'Texas', headline: 'TEFA passes 100,000 awards',
      link: 'https://x.test', blurb: 'Body text.', source: 'Texas Tribune',
    }),
    processed({
      type: 'opportunity', subtype: 'Call for Proposals', headline: 'AERA call for papers',
      deadline: '2026-09-09', blurb: 'Submit by the deadline.',
    }),
  ], { date: 'August 2026', intro: 'Welcome back.' });

  const html = renderNewsletter(issue);
  assert.ok(html.includes('TEFA passes 100,000 awards'), 'headline item is missing from the HTML');
  assert.ok(html.includes('AERA call for papers'), 'opportunity item is missing from the HTML');
  assert.ok(html.includes('Welcome back.'), 'intro is missing from the HTML');
  assert.ok(html.includes('https://x.test'), 'source link is missing from the HTML');
});
