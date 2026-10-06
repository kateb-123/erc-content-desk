/**
 * The research already on the desk whose description is a feed's cut summary
 * ending in "… more →" (Kate, Oct 6: "Fix the more ... we want those
 * abstracts"): each takes its page's whole abstract when the page's begins
 * the same way, and every row loses the feed's tail. The reader does this for
 * every new item since; this is for the ones already in. Deleted rows are
 * left alone, and what came in stays in original_text.
 *
 * Dry run (reads only, changes nothing):
 *   node --env-file=.env scripts/fix-cut-abstracts.js
 * Then, to save:
 *   node --env-file=.env scripts/fix-cut-abstracts.js --write
 *
 * The Exchange's own copies of items already published are not touched: its
 * list is append-only from the desk, and it hides the tail itself.
 */
import { readAllRows, updateRows } from '../api/_lib/store.js';
import { fetchPage } from '../api/_lib/fetch-page.js';
import { cutFeedTail, fixedBlurb } from '../js/feed-tail.js';

const write = process.argv.includes('--write');
const rows = (await readAllRows()).filter(r => {
  if (r.status === 'trashed') return false;
  const tail = cutFeedTail(r.blurb);
  return tail.changed || tail.cut;
});
console.log(`${rows.length} descriptions end in a feed's tail or are cut short.`);

const changed = [];
let whole = 0;
for (const row of rows) {
  const page = row.type === 'research' && row.link ? await fetchPage(row.link) : { description: '' };
  const next = fixedBlurb(row, page.description);
  if (next === null) continue;
  const isWhole = next === page.description.trim();
  if (isWhole) whole += 1;
  changed.push({ ...row, blurb: next });
  console.log(`\n${row.headline}\n  ${isWhole ? 'whole abstract' : 'tail off'} (${next.length} characters): ${next.slice(0, 90)}${next.length > 90 ? '…' : ''}`);
}
console.log(`\n${changed.length} to change: ${whole} take the page's whole abstract, ${changed.length - whole} lose the tail only.`);

if (!write) {
  console.log('Dry run: nothing saved. Run again with --write to save.');
} else if (changed.length) {
  for (let at = 0; at < changed.length; at += 50) await updateRows(changed.slice(at, at + 50));
  console.log(`Saved ${changed.length}.`);
  await new Promise(resolve => setTimeout(resolve, 15000));   // the Sheet copy runs after each save; give it time to land
}
