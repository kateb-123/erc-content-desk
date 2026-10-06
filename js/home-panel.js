/** Pure helpers for the front page: the six hubs' cards, and the counts the team page reads. */
import { readyToPublish } from './workflow.js';
import { isoToShort } from './queue-view.js';
import { splitPool } from './newsletter-view.js';
import { sortList } from './sort-view.js';
import { issueRows, sendsIn } from './issue-view.js';
import { HUBS } from './shell-view.js';
import { PUBLIC_LINKS } from './public-links.js';

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

const hub = key => HUBS.find(h => h.key === key);
const lower = text => (text ? text[0].toLowerCase() + text.slice(1) : '');

/**
 * Kate's drawn map (Oct 6, 2026): six hub cards in her order, each with its
 * status. A card is { key, label, href, count, sub, foot }, plus `links`
 * (lines that are links of their own), `copies` (Public links' rows) and
 * `lock` (Sort is behind the password). Counts are null until the rows are
 * in; a line about something not known yet is ''.
 *   preview    the Exchange check, or null until it lands
 *   archive    the builder's archive index, or null/false
 *   hubUpdated the live site's last change, YYYY-MM-DD; '' when it did not answer, null while asked
 *   signups    { live, waiting, last } from the listserv, or null
 */
export function hubCards({ rows = [], schedule = [], today = '', loaded = false, preview = null, archive = null, hubUpdated = null, signups = null }) {
  const card = (key, rest) => ({ key, label: hub(key).label, href: hub(key).href, count: null, sub: '', foot: '', ...rest });

  // Content queue: what waits for Sort, exactly as Sort's list counts it, and how many came from outside.
  const waiting = loaded ? sortList(rows).live : [];
  const outside = waiting.filter(r => String(r.submitter_email ?? '').trim()).length;

  // Newsletter: the next send date from today on, how many are in it, and the newest issue not after today.
  const next = [...schedule].sort().find(d => d >= today) ?? '';
  const sent = Array.isArray(archive)
    ? archive.map(e => e?.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && d <= today).sort().at(-1) ?? ''
    : '';

  const signupFoot = !signups ? ''
    : !signups.live ? 'Not set up'
    : signups.last ? `Live · last sign-up ${isoToShort(signups.last, today)}` : 'Live';

  return [
    card('team', { sub: "The team's form", links: [{ label: 'How to submit content', href: '/how-to/submit-content/' }] }),
    card('queue', { count: loaded ? waiting.length : null, sub: `waiting for Sort${outside ? ` · ${outside} from outside` : ''}`, foot: 'Sort, password protected', lock: true }),
    card('newsletter', next
      ? { count: loaded ? issueRows(rows, next).length : null, sub: `in the ${isoToShort(next, today)} issue · ${lower(sendsIn(next, today))}`, foot: sent ? `Last sent ${isoToShort(sent, today)}` : '' }
      : { sub: 'No issue scheduled', foot: sent ? `Last sent ${isoToShort(sent, today)}` : '' }),
    card('listserv', { count: signups?.live && Number.isFinite(signups.waiting) ? signups.waiting : null, sub: 'to be added', foot: signupFoot }),
    card('links', { copies: PUBLIC_LINKS }),
    card('exchange', { count: loaded ? (preview ? preview.adding.length : readyToPublish(rows).length) : null, sub: 'waiting to publish', foot: hubUpdated ? `Live · updated ${isoToShort(hubUpdated, today)}` : '' }),
  ];
}

/** The lines under the team page's Quick links (Kate, Sep 22 and 23): under
 *  the Exchange when the desk last wrote to it (the newest published_at,
 *  whatever became of the row), under the Newsletter the next issue and how
 *  many items are ready to add; '' where there is nothing to say, and the row
 *  falls back to the line that says what it is. On a send day the issue due
 *  today is the next one, as on the Schedule tab. */
export function quickLinkNotes(rows, { schedule, today }) {
  const published = rows.map(r => String(r.published_at ?? '')).filter(Boolean).sort().at(-1) ?? '';
  const dates = [...(schedule ?? [])].sort();
  const next = dates.find(d => d >= today) ?? '';
  // The send dates belong to the Newsletter, which says them once; the
  // listserv row does not repeat them (Kate, Sep 23). How many are ready to
  // add is the button's own count, not a word in this line.
  return {
    share: '',
    listserv: '',
    exchange: published ? `Updated ${isoToShort(published, today)}` : '',
    newsletter: next ? `Next issue ${isoToShort(next, today)}` : '',
  };
}
