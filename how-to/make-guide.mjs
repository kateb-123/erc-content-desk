// Writes how-to/desk-guide.txt: every how-to's words in one plain file, for
// Kathy to give Claude (Kate, Oct 23: "guidance on giving it to claude on
// kathys end to ask questions"). Run after any how-to changes:
//   node how-to/make-guide.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { TYPES, TYPE_ORDER, typeDisplay } from '../js/schema.js';
import { PUBLIC_LINKS } from '../js/public-links.js';

const SITE = 'https://erc-content-desk.vercel.app';

const PAGES = [
  ['How it all connects', 'pipeline'],
  ['How to submit content', 'submit-content'],
  ['How to sort', 'sort'],
  ['How to build the newsletter', 'newsletter'],
  ['How to change the Policy Exchange', 'exchange'],
  ['How to change the desk', 'change-the-desk'],
  ['How to make a research brief', 'research-briefs'],
  ['Bring back the Google scripts', 'google-scripts'],
  ['Design for the ERC', 'design'],
];

const text = html => html
  .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<header[\s\S]*?<\/header>/gi, '').replace(/<nav[\s\S]*?<\/nav>/gi, '')
  // A link keeps its address (review, Oct 23): the text, then the address.
  .replace(/<a\b[^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, words) => `${words} (${href.startsWith('/') ? SITE + href : href})`)
  .replace(/<(h[1-4])[^>]*>/gi, '\n\n## ').replace(/<\/h[1-4]>/gi, '\n')
  .replace(/<li[^>]*>/gi, '\n- ').replace(/<(p|tr|div|br)[^>]*>/gi, '\n').replace(/<\/t[dh]>/gi, ' | ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#187;/g, '»')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

const parts = [
  'ERC Content Desk guide, for Claude',
  'Every how-to for the ERC Content Desk (https://erc-content-desk.vercel.app) in one file. Answer questions about the desk from it: name the page and the button. If it does not say, say so.',
];
for (const [title, slug] of PAGES) {
  const file = new URL(`./${slug}/index.html`, import.meta.url);
  if (!existsSync(file)) continue;
  const body = readFileSync(file, 'utf8');
  const main = body.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? body;
  parts.push(`\n\n# ${title}\nhttps://erc-content-desk.vercel.app/how-to/${slug}/\n\n${text(main)}`);
}
// What the pages draw at load, written out (review, Oct 23): the item types and the public links.
parts.push('\n\n# Item types\nThe types an item can have on the desk, each with its subtypes.\n\n'
  + TYPE_ORDER.map(t => `- ${typeDisplay(t)}${TYPES[t].subtypes.length ? `: ${TYPES[t].subtypes.join(', ')}` : ' (no subtypes)'}`).join('\n'));
parts.push('\n\n# Public links\nThe pages anyone can open, each with Copy link on the front page.\n\n'
  + PUBLIC_LINKS.map(l => `- ${l.label}: ${l.href}`).join('\n'));
writeFileSync(new URL('./desk-guide.txt', import.meta.url), `${parts.join('\n')}\n`);
console.log('wrote how-to/desk-guide.txt');
