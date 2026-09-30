/**
 * The model's side of the card words (Kate, Sep 30): when a highlight pick
 * is an event, an ERC event or an opportunity, /api/rewrite is asked for a
 * summary that fits the Exchange's New & upcoming card and a title that
 * does. The item is found by its link, on the desk first (the row going out
 * now, with its original text), else on the live Exchange. The fitting rules
 * are js/card-words.js, shared with the browser. Pure helpers only.
 */
import { wantsCardWords, fitCardWords, SUMMARY_MAX, TITLE_MAX } from '../../js/card-words.js';

const ORIGINAL_TEXT_CAP = 1500;
const clean = v => String(v ?? '').trim();

export const CARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['link', 'title', 'summary'],
        properties: {
          link: { type: 'string', description: 'The item link, copied exactly.' },
          title: { type: 'string', description: `The title as given, or trimmed to ${TITLE_MAX} characters when it ran past.` },
          summary: { type: 'string', description: `One or two plain sentences, ${SUMMARY_MAX} characters or fewer.` },
        },
      },
    },
  },
};

/** The items to write for: each link once, on the desk first, then live;
 *  only the card types. */
export function cardItems(links, { rows = [], hub = [] }) {
  const desk = new Map();
  for (const row of rows) {
    const link = clean(row.link);
    if (!link) continue;
    // The row on its way out ranks over a published copy of the same link.
    if (!desk.has(link) || (desk.get(link).published_at && !row.published_at)) desk.set(link, row);
  }
  const live = new Map(hub.map(r => [clean(r.link), r]));
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(links) ? links : []) {
    const link = clean(raw);
    if (!link || seen.has(link)) continue;
    seen.add(link);
    const row = desk.get(link) ?? live.get(link);
    if (!row || !wantsCardWords(row.type)) continue;
    out.push({
      link, headline: clean(row.headline), type: clean(row.type), subtype: clean(row.subtype), source: clean(row.source),
      date: clean(row.date), time: clean(row.time), location: clean(row.location), deadline: clean(row.deadline),
      blurb: clean(row.blurb), original_text: clean(row.original_text),
    });
  }
  return out;
}

export function buildCardPrompt(items) {
  const block = items.map(it => [
    `link: ${it.link}`,
    `title: ${it.headline}`,
    `type: ${it.type}${it.subtype ? ` / ${it.subtype}` : ''}`,
    it.source ? `source: ${it.source}` : '',
    it.date ? `date: ${it.date}` : '',
    it.time ? `time: ${it.time}` : '',
    it.location ? `location: ${it.location}` : '',
    it.deadline ? `deadline: ${it.deadline}` : '',
    it.blurb ? `summary:\n${it.blurb}` : '',
    !it.blurb && it.original_text ? `original text:\n${it.original_text.slice(0, ORIGINAL_TEXT_CAP)}` : '',
  ].filter(Boolean).join('\n')).join('\n\n---\n\n');
  return [
    'Each item below has been picked for the home-page card of the ERC Policy Exchange. Write the words the card shows.',
    'Return one entry per item, keyed by its exact link.',
    `summary: ${SUMMARY_MAX} characters or fewer. One or two plain sentences. The invitation or the key point first.`,
    'No lead-in such as "This study", "This event", "Join us" or "Applications are open": start with the thing itself.',
    "Keep the item's own words where they fit. Use only facts in the item; never add one.",
    'Do not restate the date, time, place or deadline: the card shows those on their own line.',
    'Wrap a book or journal name in stars, like *Educational Researcher*, so the card draws it in italics. Nothing else gets stars.',
    `title: the title as given. Only when it runs past ${TITLE_MAX} characters, trim it to ${TITLE_MAX} without losing the subject.`,
    '',
    'Items:',
    block,
  ].join('\n');
}

/** The answers, one a known link, fitted; an item the model skipped gets
 *  its own words, fitted, so every pick has something for the card. */
export function normalizeCards(parsed, items) {
  const byLink = new Map(items.map(it => [it.link, it]));
  const answered = new Map();
  const warnings = [];
  for (const entry of parsed?.cards ?? []) {
    const link = clean(entry?.link);
    if (!byLink.has(link)) { warnings.push(`Skipped an answer that matched no pick (${link || 'no link'}).`); continue; }
    if (!answered.has(link)) answered.set(link, entry);
  }
  const cards = items.map(it => ({ link: it.link, ...fitCardWords(answered.get(it.link), it) }));
  return { cards, warnings };
}
