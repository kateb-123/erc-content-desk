/** Pure helpers for the front page: the six hubs' cards. */
import { isoToShort } from './queue-view.js';
import { sortList } from './sort-view.js';
import { issueRows, sendsIn } from './issue-view.js';
import { HUBS } from './shell-view.js';
import { exchangeStatus } from './exchange-view.js';
import { PUBLIC_LINKS } from './public-links.js';
import { EMAIL_PAGES } from './email-pages.js';
import { SIGNUP_SHEET } from './listserv-view.js';

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

  const signupFoot = !signups || signups.error ? ''
    : !signups.live ? 'Not set up'
    : signups.last ? `Live · last sign-up ${isoToShort(signups.last, today)}` : 'Live';

  const exchange = exchangeStatus({ rows, today, loaded, preview, hubUpdated });

  return [
    card('team', { sub: "The team's form", links: [{ label: 'How to submit content', href: '/how-to/submit-content/' }] }),
    card('queue', { count: loaded ? waiting.length : null, sub: `waiting for Sort${outside ? ` · ${outside} from outside` : ''}`, foot: 'Sort, password protected', lock: true }),
    // The newsletter's HTML (Kate, Oct 8): three pages linked at the card's foot, never downloads.
    card('newsletter', { ...(next
      ? { count: loaded ? issueRows(rows, next).length : null, sub: `in the ${isoToShort(next, today)} issue · ${lower(sendsIn(next, today))}` }
      : { sub: 'No issue scheduled' }), foot: sent ? `Last sent ${isoToShort(sent, today)}` : '', links: EMAIL_PAGES.map(p => ({ label: p.label, href: p.href, blank: true })) }),
    // The sign-up sheet rides the card too (Kate, Oct 8), opening in a new tab.
    card('listserv', { count: signups?.live && Number.isFinite(signups.waiting) ? signups.waiting : null, sub: 'to be added', foot: signupFoot, links: [{ label: SIGNUP_SHEET.label, href: SIGNUP_SHEET.href, blank: true }] }),
    card('links', { copies: PUBLIC_LINKS }),
    card('exchange', { count: exchange.waiting, sub: 'waiting to publish', foot: exchange.site === 'Live' ? `Live · updated ${exchange.updated}` : '' }),
  ];
}
