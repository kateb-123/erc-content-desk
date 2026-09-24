/**
 * The Exchange's highlight (Kate, Sep 23): its home page shows a few items in
 * a big card, each with a photo, and she picks them by hand at Publish, up to
 * six, new or already live, in her order. The picks live in their own small
 * file on the Exchange, data/highlights.json, so news.csv stays append-only:
 *
 *   { "updated": "<iso time>", "items": [ { "link": "...", "image": "..." } ] }
 *
 * `image` is her upload for that pick, blank when the item's own picture (the
 * infographic column) is the one to show. Pure helpers only; the network
 * calls live in hub.js.
 */
import { parseCsv } from '../../js/hub-csv.js';
import { toHubRow } from '../../js/hub-csv.js';

export const MAX_HIGHLIGHTS = 6;
export const HIGHLIGHTS_PATH = 'data/highlights.json';

const clean = v => String(v ?? '').trim();
/** A picture address the page can load: http(s) only. */
const imageUrl = v => (/^https?:\/\//i.test(clean(v)) ? clean(v) : '');

/** The live CSV as rows keyed by its header line. */
export function hubRows(csvText) {
  const cells = parseCsv(csvText);
  if (cells.length < 2) return [];
  const header = cells[0].map(clean);
  return cells.slice(1).map(row => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])));
}

/** The file as it stands, leniently: nothing, or junk, means no picks. */
export function parseHighlights(text) {
  let data = null;
  try { data = JSON.parse(String(text ?? '')); } catch { data = null; }
  const raw = Array.isArray(data?.items) ? data.items : [];
  const items = [];
  const seen = new Set();
  for (const entry of raw) {
    const link = entry && typeof entry === 'object' ? clean(entry.link) : '';
    if (!link || seen.has(link)) continue;
    seen.add(link);
    items.push({ link, image: imageUrl(entry.image) });
    if (items.length === MAX_HIGHLIGHTS) break;
  }
  return { items, updated: clean(data?.updated) };
}

/** The file to commit: the time, then the picks in order. Pretty, so a diff reads. */
export function highlightsText(items, when = new Date().toISOString()) {
  return `${JSON.stringify({ updated: when, items: items.map(p => ({ link: p.link, image: p.image ?? '' })) }, null, 2)}\n`;
}

const linkSet = rows => new Set(rows.map(r => clean(r.link)).filter(Boolean));

/** Her picks, checked: only links the Exchange will hold (rows going out now
 *  or already live), once each, six at most, each image a real address. */
export function cleanPicks(picks, { adding = [], hub = [] }) {
  const known = new Set([...linkSet(adding), ...linkSet(hub)]);
  const items = [], dropped = [];
  const seen = new Set();
  for (const pick of Array.isArray(picks) ? picks : []) {
    const link = pick && typeof pick === 'object' ? clean(pick.link) : '';
    if (!link || seen.has(link)) continue;
    seen.add(link);
    if (!known.has(link)) { dropped.push(link); continue; }
    if (items.length < MAX_HIGHLIGHTS) items.push({ link, image: imageUrl(pick.image) });
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
    return { link, image, photo: image || (row ? imageUrl(row.infographic) : ''), from, ...(row ? fields(row) : EMPTY) };
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
