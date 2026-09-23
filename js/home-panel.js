/** Pure helpers for the front page: the lanes' counts, the newest items and Kate's cards. */
import { readyToPublish } from './workflow.js';
import { isoToShort } from './queue-view.js';
import { splitPool } from './newsletter-view.js';
import { sortList } from './sort-view.js';

/** The three lanes' counts, each the work waiting on its page (design
 *  critique, Sep 18): Sort the queue, Newsletter what waits to be added to
 *  the next issue, Policy Exchange what Publish would add. Publish's number
 *  needs the live Exchange check (preview); until it lands, the kept rows
 *  ticked for the Exchange stand in. */
export function laneCounts(rows, { schedule, issue, today, preview }) {
  return {
    sort: sortList(rows).live.length,   // exactly what Sort's list shows
    newsletter: splitPool(rows, schedule, issue, today).live.length,
    exchange: preview ? preview.adding.length : readyToPublish(rows).length,
  };
}

/** Recently added: the newest rows first, deleted ones left out. */
export function recentlyAdded(rows, count = 4) {
  return rows.filter(r => r.status !== 'trashed')
    .sort((a, b) => String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? '')))
    .slice(0, count);
}

/** Kate's own page at the root (her answer, Sep 22): a card for the team's
 *  page, one per lane with the work waiting on it, and Documentation, which
 *  is forthcoming. `counts` is null until the rows are in. */
export function deskCards({ counts, issue, today }) {
  const n = key => (counts ? counts[key] : null);
  const next = issue ? `next issue ${isoToShort(issue, today)}` : 'no issue scheduled';
  return [
    { key: 'team', label: 'Submit content', href: '/#team', count: null, sub: 'The share form, the queue and the quick links, for the team' },
    { key: 'sort', label: 'Content Sort', href: '/#sort', count: n('sort'), sub: 'Waiting to be sorted' },
    { key: 'newsletter', label: 'Newsletter', href: '/#newsletter', count: n('newsletter'), sub: `Ready to add · ${next}` },
    { key: 'exchange', label: 'Policy Exchange', href: '/#exchange', count: n('exchange'), sub: 'Publish would add' },
    { key: 'docs', label: 'Documentation', href: null, count: null, sub: 'Forthcoming' },
  ];
}

/** The notes under the team page's Quick links (Kate, Sep 22): under the
 *  Exchange when the desk last wrote to it (the newest published_at, whatever
 *  became of the row), under the listserv the last issue that went out and
 *  the next one due, both from the schedule; '' where there is nothing to say.
 *  On a send day the issue due today is the next one, as on the Schedule tab. */
export function quickLinkNotes(rows, { schedule, today }) {
  const published = rows.map(r => String(r.published_at ?? '')).filter(Boolean).sort().at(-1) ?? '';
  const dates = [...(schedule ?? [])].sort();
  const next = dates.find(d => d >= today) ?? '';
  const last = [...dates].reverse().find(d => (next ? d < next : d <= today)) ?? '';
  const ready = splitPool(rows, schedule, next, today).live.length;
  return {
    share: '',
    listserv: [last && `Last issue ${isoToShort(last, today)}`, next && `Next ${isoToShort(next, today)}`].filter(Boolean).join(' · '),
    exchange: published ? `Updated ${isoToShort(published, today)}` : '',
    newsletter: [next && `Next issue ${isoToShort(next, today)}`,
      ready ? `${ready} ready to add` : 'nothing ready to add'].filter(Boolean).join(' · '),
  };
}
