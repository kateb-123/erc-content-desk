/**
 * Words that fit the Exchange's New & upcoming card (Kate, Sep 30): a pick
 * that is an event, an ERC event or an opportunity gets a summary of 180
 * characters or fewer, one or two plain sentences with the invitation first,
 * book and journal names in stars (the card draws them in italics), and its
 * title as it is unless it runs past 80 characters. The model writes them
 * (api/_lib/card-words.js); these rules fit whatever comes back, and what she
 * types by hand. Pure and browser-safe, so both sides use the one set.
 */
export const SUMMARY_MAX = 180;
export const TITLE_MAX = 80;

const CARD_TYPES = new Set(['event', 'erc_event', 'opportunity']);

export function wantsCardWords(type) {
  return CARD_TYPES.has(String(type ?? '').trim());
}

const tidy = v => String(v ?? '').replace(/\s+/g, ' ').trim();

/** The stars paired: a lone one goes; a pair the cut broke is closed. */
function pairStars(text) {
  const count = (text.match(/\*/g) || []).length;
  if (count % 2 === 0) return text;
  // A star with a word on both sides of it is an open pair the cut broke:
  // close it at the end. A star standing alone is noise: drop it.
  const last = text.lastIndexOf('*');
  const opens = /\S/.test(text[last + 1] ?? '') && (last === 0 || /\s/.test(text[last - 1]));
  return opens ? `${text}*` : `${text.slice(0, last)}${text.slice(last + 1)}`.replace(/\s{2,}/g, ' ').trim();
}

/** Cut to `max` on a sentence end when one lands past `floor`, else on a word. */
function cutTo(text, max, floor) {
  if (text.length <= max) return text;
  const head = text.slice(0, max + 1);
  let at = -1;
  for (const m of head.matchAll(/[.!?](?=\s|$)/g)) if (m.index + 1 <= max && m.index + 1 >= floor) at = m.index + 1;
  if (at > 0) return text.slice(0, at).trim();
  const space = text.lastIndexOf(' ', max);
  const cut = text.slice(0, space > 0 ? space : max).trim();
  return cut.replace(/[\s,;:(\-]+$/, '');
}

export function fitSummary(text) {
  return pairStars(cutTo(tidy(text), SUMMARY_MAX, 60));
}

export function fitTitle(text) {
  return pairStars(cutTo(tidy(text), TITLE_MAX, TITLE_MAX));
}

/** The card's words for an item: the model's where it gave them, else the
 *  item's own, both fitted. */
export function fitCardWords(words, item) {
  const title = fitTitle(tidy(words?.title) || item?.headline);
  const summary = fitSummary(tidy(words?.summary) || item?.blurb);
  return { title, summary };
}
