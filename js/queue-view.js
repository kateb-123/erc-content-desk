/**
 * Pure view helpers for the Home queue table: sorting and formatting dates.
 * View state only — callers keep the state; nothing here touches the Sheet.
 */
import { typeDisplay } from './schema.js';
import { pendingRows, circlebackRows } from './workflow.js';
import { todayCentral } from './today.js';

/**
 * What the Home queue table lists: everything still waiting, circle-backs last.
 * `justDeleted` is the set of ids deleted from the table since the page opened —
 * those rows STAY listed, wearing their Deleted state, so a mis-click on the
 * trash can is undoable on the spot. Rows trashed on an earlier visit stay gone.
 */
export function queueRows(rows, justDeleted = new Set()) {
  const listed = [...pendingRows(rows), ...circlebackRows(rows)];
  const seen = new Set(listed.map(r => r.id));
  return [...listed, ...rows.filter(r => justDeleted.has(r.id) && !seen.has(r.id))];
}

const KEYS = {
  title: r => r.headline || r.link || '',
  type: r => (r.type ? typeDisplay(r.type) : ''),
  submitted: r => String(r.submitted_at ?? ''),
};

/** One column's comparator: its values as text, an empty one last whichever
 *  way the column is sorted. */
function compareBy(key, direction) {
  const flip = direction === 'desc' ? -1 : 1;
  return (a, b) => {
    const left = key(a).toLowerCase();
    const right = key(b).toLowerCase();
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return flip * left.localeCompare(right);
  };
}

/** Non-mutating sort; empty keys sink to the end in either direction. */
export function sortRows(rows, column, direction) {
  return rows.slice().sort(compareBy(KEYS[column], direction));
}

/** By when it was submitted, for every list that stands in date order. */
export const bySubmitted = direction => compareBy(KEYS.submitted, direction);


/** One link, whichever way it was typed: scheme, www and a trailing slash do
 *  not make a different page. Case is folded too; a same-page match is what
 *  we want, not a byte match. */
function linkKey(link) {
  return String(link ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
}

/**
 * The row already waiting in the queue with this link, if any (audit round
 * two, e19): { id, title, when } for the form's "Already in the queue" ask,
 * or null. Only what is still waiting counts (new and parked rows); a kept
 * row is out of the queue, and Sort's Needs a fix catches the rest.
 */
export function queueMatch(link, rows, todayIso) {
  const key = linkKey(link);
  if (!key) return null;
  const hit = [...pendingRows(rows), ...circlebackRows(rows)].find(r => linkKey(r.link) === key);
  if (!hit) return null;
  return { id: hit.id, title: hit.headline || hit.link || '(untitled)', when: isoToShort(hit.submitted_at, todayIso) };
}

/**
 * After a row action the pressed control is gone from the rebuilt table; this
 * is the key of the control now in its place: Delete's
 * Undo, and Undo's trash can (Remove's, on Next newsletter). '' when the key
 * has no partner, so the caller falls back.
 */
export function partnerFocusKey(key, action = 'delete') {
  const m = /^(delete|remove|undo):(.+)$/.exec(String(key ?? ''));
  if (!m) return '';
  return m[1] === 'undo' ? `${action}:${m[2]}` : `undo:${m[2]}`;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The one date format for the desk's tables and meta lines: '2026-08-26' ->
 * 'Aug 26' when that is this year, 'Aug 26, 2025' otherwise, so age is never
 * hidden. With no today the year is always said. A timestamp works; anything
 * unparseable -> ''.
 */
export function isoToShort(iso, todayIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  const name = SHORT_MONTHS[Number(m[2]) - 1];
  if (!name) return '';
  const day = `${name} ${Number(m[3])}`;
  return m[1] === String(todayIso ?? '').slice(0, 4) ? day : `${day}, ${m[1]}`;
}

/** The last issue that went out (Kate, Oct 8: the queue holds "what was
 *  submitted from the last newsletter until now"): the newest send date not
 *  after today, the send day itself included, as Ready to add counts it. */
export function lastIssueSent(schedule, today) {
  return [...(schedule ?? [])].filter(d => d && d <= today).sort().at(-1) ?? '';
}

/** The day a row came in, in College Station; '' when it carries none. */
const addedOn = row => {
  const t = Date.parse(String(row.submitted_at ?? ''));
  return Number.isNaN(t) ? '' : todayCentral(new Date(t));
};

/**
 * The Content queue hub (Kate's drawn map, Oct 6, 2026): everything ever
 * submitted, newest first, deleted items left out, each saying where it
 * stands now: Waiting (new or skipped on Sort), Kept, On the Exchange, In
 * the <date> issue (an item can be both of the last two). An outside
 * submission (it came with an email, from the public form) is tagged and
 * shows no name and no email: the page is open. The search reads the title,
 * the link where there is no title, and the source, any case. With `since`
 * (an ISO day) only what came in on or after that day in College Station is
 * listed: the queue's Since the last issue tab (Kate, Oct 8).
 * Returns [{ id, title, meta, where: [words], outside }].
 */
export function contentQueue(rows, { today = '', term = '', since = '' } = {}) {
  const want = String(term ?? '').trim().toLowerCase();
  return rows
    .filter(r => r.status !== 'trashed')
    .filter(r => !since || addedOn(r) >= since)
    .filter(r => !want || [r.headline || r.link, r.source].some(v => String(v ?? '').toLowerCase().includes(want)))
    .sort(bySubmitted('desc'))
    .map(r => {
      const outside = Boolean(String(r.submitter_email ?? '').trim());
      const where = [];
      if (r.status === 'new' || r.status === 'circleback') where.push('Waiting');
      else {
        if (String(r.published_at ?? '').trim()) where.push('On the Exchange');
        if (String(r.newsletter_issue ?? '').trim()) where.push(`In the ${isoToShort(r.newsletter_issue, today)} issue`);
        if (!where.length) where.push('Kept');
      }
      const meta = [r.type ? typeDisplay(r.type) : 'No type', String(r.source ?? '').trim(), !outside && r.submitter && `added by ${r.submitter}`, isoToShort(r.submitted_at, today)]
        .filter(Boolean).join(' · ');
      return { id: r.id, title: r.headline || r.link || '(untitled)', meta, where, outside };
    });
}
