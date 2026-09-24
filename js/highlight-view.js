/**
 * The highlight step on Publish (Kate, Sep 23): the Exchange's home page
 * shows a few items in a big card, each with a photo, and she picks them by
 * hand here, up to six, new or already live, in her order. Pure, so
 * node --test can hold it; publish-ui.js draws what these return.
 *
 * A pick is { link, image }: the item by its link, and her upload for it
 * (blank when the item's own picture is the one to show).
 */
import { toHubRow } from './hub-csv.js';
import { isoToShort } from './queue-view.js';

export const MAX_PICKS = 6;

const clean = v => String(v ?? '').trim();
const pic = v => (/^https?:\/\//i.test(clean(v)) ? clean(v) : '');

const fields = row => ({
  headline: clean(row.headline), type: clean(row.type), subtype: clean(row.subtype),
  date: clean(row.date), deadline: clean(row.deadline), source: clean(row.source), own: pic(row.infographic),
});

/** Everything that could go in: the rows going out now (as the Exchange will
 *  hold them), then what is live, each with the photo it has. */
export function candidates({ adding = [], hub = [] }) {
  const out = [];
  for (const row of adding) out.push({ link: clean(row.link), from: 'adding', ...fields(toHubRow(row)), photo: pic(row.infographic) });
  for (const row of hub) out.push({ link: clean(row.link), from: 'live', ...fields(row), photo: pic(row.infographic) });
  return out.filter(c => c.link);
}

/** The band as it will be once this publish lands: each pick with its item
 *  and the photo the card will show, her upload first, else the item's own. */
export function bandAfter(picks, { adding = [], hub = [] }) {
  const byLink = new Map(candidates({ adding, hub }).map(c => [c.link, c]));
  return picks.map(pick => {
    const link = clean(pick.link);
    const image = pic(pick.image);
    const item = byLink.get(link);
    return {
      link, image, from: item?.from ?? 'missing',
      headline: item?.headline ?? '', type: item?.type ?? '', subtype: item?.subtype ?? '',
      date: item?.date ?? '', deadline: item?.deadline ?? '', source: item?.source ?? '',
      photo: image || item?.own || '', photoIsOwn: Boolean(image),
    };
  });
}

export function addPick(picks, link) {
  const key = clean(link);
  if (!key || picks.some(p => p.link === key) || picks.length >= MAX_PICKS) return picks;
  return [...picks, { link: key, image: '' }];
}

export function removePick(picks, link) {
  return picks.filter(p => p.link !== clean(link));
}

/** One step up (-1) or down (+1); the ends stay put. */
export function movePick(picks, link, step) {
  const at = picks.findIndex(p => p.link === clean(link));
  const to = at + step;
  if (at < 0 || to < 0 || to >= picks.length) return picks;
  const next = [...picks];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

export function setPhoto(picks, link, image) {
  return picks.map(p => p.link === clean(link) ? { ...p, image: pic(image) } : p);
}

/** The picks the card would show with no picture at all. */
export function withoutPhoto(picks, ctx) {
  return bandAfter(picks, ctx).filter(b => !b.photo);
}

/** When it is: an event's date, an opportunity's deadline, in short form. */
export function whenLine(item, today = '') {
  const when = item.type === 'opportunity' ? item.deadline : item.date;
  const d = isoToShort(when, today || String(when ?? '').slice(0, 4));   // the year only when it is not this year's
  return item.type === 'opportunity' ? (d ? `closes ${d}` : '') : d;
}

/** True when nothing about the picks changed: the same links, order and photos. */
export function samePicks(a, b) {
  return a.length === b.length && a.every((p, i) => p.link === b[i].link && (p.image || '') === (b[i].image || ''));
}

/** The Pick from table's filters (Kate, Sep 23: "so we can find events
 *  quickly"): every section with how many rows it holds, All first. */
const SECTIONS = [['research', 'Research'], ['event', 'Events'], ['opportunity', 'Opportunities'], ['headline', 'Headlines']];

export function sectionFilters(list) {
  return [
    { key: 'all', label: 'All', count: list.length },
    ...SECTIONS.map(([key, label]) => ({ key, label, count: list.filter(c => c.type === key).length })),
  ];
}

export function filterCandidates(list, key) {
  return !key || key === 'all' ? list : list.filter(c => c.type === key);
}

/** The table at rest (Kate, Sep 23: the live list "is a lot"): everything
 *  going out now, then only the newest `per` live rows of each section; the
 *  list arrives newest first, so the first of each section are the newest. */
export const LIVE_PER_SECTION = 8;
export function trimLive(list, per = LIVE_PER_SECTION) {
  const seen = new Map();
  return list.filter(c => {
    if (c.from !== 'live') return true;
    const n = seen.get(c.type) ?? 0;
    seen.set(c.type, n + 1);
    return n < per;
  });
}

/** A search reaches every row, by title or source; a blank search is no search. */
export function searchCandidates(list, term) {
  const q = clean(term).toLowerCase();
  if (!q) return list;
  return list.filter(c => `${c.headline} ${c.source}`.toLowerCase().includes(q));
}
