/**
 * The Exchange's highlight (Kate, Sep 23): its home page shows a few items in
 * a big card, each with a photo, and she picks them by hand at Publish, up to
 * six, new or already live, in her order. Since Sep 24 the Exchange keeps its
 * own picks in data/featured.json (its admin door's file: pins, one-off
 * cards, hidden items, the hero card chosen for an item), and the desk
 * writes its picks there as the pins (Sep 30; data/highlights.json, the
 * desk's own file before, is read by nothing):
 *
 *   { "pins": [ { "key": "<link>", "until": "YYYY-MM-DD", "image": "...",
 *                 "title": "...", "summary": "..." } ],
 *     "cards": [...], "hidden": [...], "heroes": [...] }
 *
 * A pin shows until its `until` day. `image` is her upload for that pick,
 * absent when the item's own picture (the infographic column) is the one to
 * show; `title` and `summary` are the card's words (Kate, Sep 30), written
 * for an event or an opportunity, absent otherwise. The other lists are the
 * Exchange's own and pass through untouched. Pure helpers only; the network
 * calls live in hub.js.
 */
import { parseCsv } from '../../js/hub-csv.js';
import { toHubRow } from '../../js/hub-csv.js';
import { wantsCardWords, fitTitle, fitSummary } from '../../js/card-words.js';

export const MAX_HIGHLIGHTS = 6;
export const FEATURED_PATH = 'data/featured.json';
/** A pin with no date of its own shows this long (the Exchange hides a pin
 *  past its `until`, so every pin needs one). */
export const PIN_DAYS = 14;

const clean = v => String(v ?? '').trim();
/** A picture address the page can load: http(s) only. */
const imageUrl = v => (/^https?:\/\//i.test(clean(v)) ? clean(v) : '');
const isoDay = v => (/^\d{4}-\d{2}-\d{2}$/.test(clean(v)) ? clean(v) : '');
const list = v => (Array.isArray(v) ? v : []);

export function addDays(iso, n) {
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return '';
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** The live CSV as rows keyed by its header line. */
export function hubRows(csvText) {
  const cells = parseCsv(csvText);
  if (cells.length < 2) return [];
  const header = cells[0].map(clean);
  return cells.slice(1).map(row => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])));
}

/** One pick as the desk holds it, from a pin or from the browser. */
function pickOf(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const link = clean(entry.link ?? entry.key);
  if (!link) return null;
  return { link, image: imageUrl(entry.image), until: isoDay(entry.until), title: clean(entry.title), summary: clean(entry.summary) };
}

/** The Exchange's file as it stands, leniently: nothing, or junk, means no
 *  pins; the other lists ride along as they are. */
export function parseFeatured(text) {
  let data = null;
  try { data = JSON.parse(String(text ?? '')); } catch { data = null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const pins = [];
  const seen = new Set();
  for (const entry of list(data.pins)) {
    const pick = pickOf(entry);
    if (!pick || seen.has(pick.link)) continue;
    seen.add(pick.link);
    pins.push(pick);
  }
  return { pins, cards: list(data.cards), hidden: list(data.hidden), heroes: list(data.heroes) };
}

/** What the home page's card holds today: the pins still within their day,
 *  in the Exchange's order, six at most. */
export function nowPicks(featured, today) {
  const day = clean(today).slice(0, 10);
  return featured.pins.filter(p => p.until >= day).slice(0, MAX_HIGHLIGHTS);
}

/** The one-off cards the Exchange shows beside the pins today, made there. */
export function nowCards(featured, today) {
  const day = clean(today).slice(0, 10);
  return featured.cards
    .filter(c => c && typeof c === 'object' && clean(c.until) >= day)
    .map(c => ({ headline: clean(c.headline), label: clean(c.label) || 'ERC', until: clean(c.until) }));
}

/** The file to commit: her picks as the pins, the Exchange's own lists as
 *  they were. Pretty, so a diff on the Exchange reads. */
export function featuredText(featured, picks) {
  const pins = picks.map(p => ({
    key: p.link, until: p.until,
    ...(p.image ? { image: p.image } : {}),
    ...(p.title ? { title: p.title } : {}),
    ...(p.summary ? { summary: p.summary } : {}),
  }));
  return `${JSON.stringify({ pins, cards: featured.cards, hidden: featured.hidden, heroes: featured.heroes }, null, 2)}\n`;
}

/** The day a pin shows until when she set none: an event to its date, an
 *  opportunity to its deadline, anything else (or a day already gone) two
 *  weeks from today. */
export function defaultUntil(row, today) {
  const day = clean(today).slice(0, 10);
  const own = row?.type === 'event' ? isoDay(row.date) : row?.type === 'opportunity' ? isoDay(row.deadline) : '';
  return own && own >= day ? own : addDays(day, PIN_DAYS);
}

/** Her picks, checked: only links the Exchange will hold (rows going out now
 *  or already live), once each, six at most, each image a real address, each
 *  with its day, and the card's words only where the item gets them. */
export function cleanPicks(picks, { adding = [], hub = [], today = '' }) {
  const known = new Map([...adding.map(r => [clean(r.link), toHubRow(r)]), ...hub.map(r => [clean(r.link), r])].filter(([k]) => k));
  const items = [], dropped = [];
  const seen = new Set();
  for (const raw of Array.isArray(picks) ? picks : []) {
    const pick = pickOf(raw);
    if (!pick || seen.has(pick.link)) continue;
    seen.add(pick.link);
    const row = known.get(pick.link);
    if (!row) { dropped.push(pick.link); continue; }
    if (items.length >= MAX_HIGHLIGHTS) continue;
    const words = wantsCardWords(row.type);
    items.push({
      link: pick.link, image: pick.image, until: pick.until || defaultUntil(row, today),
      title: words ? fitTitle(pick.title) : '', summary: words ? fitSummary(pick.summary) : '',
    });
  }
  return { items, dropped };
}

const fields = row => ({
  headline: clean(row.headline), type: clean(row.type), subtype: clean(row.subtype),
  date: clean(row.date), deadline: clean(row.deadline), source: clean(row.source),
});
const EMPTY = { headline: '', type: '', subtype: '', date: '', deadline: '', source: '' };

/** Each pick with the item it names: from the rows going out now (as the
 *  Exchange will hold them), from the live file, or missing. `photo` is what
 *  the card will show: her upload, else the item's own picture. */
export function describePicks(picks, { adding = [], hub = [] }) {
  const going = new Map(adding.map(r => [clean(r.link), toHubRow(r)]));
  const live = new Map(hub.map(r => [clean(r.link), r]));
  return picks.map(pick => {
    const link = clean(pick.link);
    const image = imageUrl(pick.image);
    const row = going.get(link) ?? live.get(link);
    const from = going.has(link) ? 'adding' : live.has(link) ? 'live' : 'missing';
    return {
      link, image, until: isoDay(pick.until), title: clean(pick.title), summary: clean(pick.summary),
      photo: image || (row ? imageUrl(row.infographic) : ''), from, ...(row ? fields(row) : EMPTY),
    };
  });
}

/** The live rows the Exchange still shows, so they can be picked: no past
 *  event, no closed deadline; newest first, undated rows last. */
export function pickable(hub, today) {
  const day = clean(today).slice(0, 10);
  const past = row => {
    const when = row.type === 'event' ? row.date : row.type === 'opportunity' ? row.deadline : '';
    return Boolean(day) && Boolean(clean(when)) && clean(when).slice(0, 10) < day;
  };
  return hub
    .filter(row => clean(row.link) && !past(row))
    .map(row => ({ link: clean(row.link), ...fields(row), infographic: imageUrl(row.infographic) }))
    .sort((a, b) => (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : 0)
    .sort((a, b) => Number(!a.date) - Number(!b.date));
}

/** The desk's own rows that get a pick's photo: matched by link, and only
 *  where the row has no picture of its own. */
export function photoUpdates(picks, rows) {
  const byLink = new Map(rows.map(r => [clean(r.link), r]));
  const out = [];
  for (const pick of picks) {
    const image = imageUrl(pick?.image);
    const row = byLink.get(clean(pick?.link));
    if (image && row && !clean(row.infographic)) out.push({ ...row, infographic: image });
  }
  return out;
}
