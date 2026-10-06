/**
 * A feed's tail on a summary (Kate, Oct 6: "Fix the more. idk why that is
 * there? we want those abstracts"). Feeds cut a paper's summary short and end
 * it with their own link word ("… more →"), or sign it ("The post … appeared
 * first on …"); a scrape that takes the feed's summary takes the tail too.
 * The tail never belongs to the item. The Exchange already hides it on
 * display (its cleanBlurb); the desk takes it off when an item is read.
 */
const POST_TAIL = /\s*The post [\s\S]*? appeared first on [\s\S]*$/;
const MORE_TAIL = /\s*(?:read\s+)?more\s*(?:→|->|&rarr;|›|»|&raquo;|>>)\s*$/i;
const CUT_END = /(?:…|\.\.\.|\[…\]|\[\.\.\.\])\s*$/;

/** { text, changed, cut }: the text without the tail, whether a tail came
 *  off, and whether the text was cut short (it ends in an ellipsis). */
export function cutFeedTail(value) {
  const before = String(value ?? '').trim();
  const text = before.replace(POST_TAIL, '').replace(MORE_TAIL, '').trim();
  return { text, changed: text !== before, cut: CUT_END.test(text) };
}

const squash = s => String(s ?? '').toLowerCase().replace(CUT_END, '').replace(/[^a-z0-9]+/g, '');

/** Whether `full` begins the way the cut text does: the same paper's
 *  abstract, not some other page text. */
export function sameStart(cut, full) {
  const head = squash(cut).slice(0, 60);
  return head.length >= 12 && squash(full).startsWith(head);
}

/** The description the desk should hold, or null when it is fine as it is:
 *  the tail off, and a research summary the feed cut short swapped for the
 *  page's whole abstract (`description`) when that begins the same way. The
 *  reader and scripts/fix-cut-abstracts.js both ask this. */
export function fixedBlurb({ type, blurb }, description = '') {
  const tail = cutFeedTail(blurb);
  if (!tail.changed && !tail.cut) return null;
  const whole = tail.cut && type === 'research' && String(description).length > tail.text.length && sameStart(tail.text, description);
  const next = whole ? String(description).trim() : tail.text;
  return next === String(blurb ?? '').trim() ? null : next;
}
