// Writes how-to/desk-guide.txt: every how-to's words in one plain file, for
// Kathy to give Claude (Kate, Oct 23: "guidance on giving it to claude on
// kathys end to ask questions"). Run after any how-to changes:
//   node how-to/make-guide.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { TYPES, TYPE_ORDER, typeDisplay } from '../js/schema.js';
import { PUBLIC_LINKS } from '../js/public-links.js';
import { GUIDES } from '../js/howto-index.js';

const SITE = 'https://erc-content-desk.vercel.app';

// Every guide the How-tos panel lists, in its order, by its own title (Oct 24),
// so the guide and the panel never drift.
const PAGES = GUIDES.map(g => [g.title, g.href]);

const text = (html, href = '') => html
  .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<header[\s\S]*?<\/header>/gi, '').replace(/<nav[\s\S]*?<\/nav>/gi, '')
  // A whole script in a box (the Google scripts, Oct 26) is the repository's
  // file, hundreds of lines: the guide says where the box is instead. A few
  // lines in no file (the checkAccess helper) stay, as words.
  .replace(/<pre class="code-pre"[^>]*\bdata-file="([^"]*)"[^>]*\bdata-lines="(\d+)"[^>]*\bdata-part="([^"]*)"[^>]*>[\s\S]*?<\/pre>/gi,
    (_, file, lines, part) => `\n\nThe whole script, ${file} (${lines} lines), is in a box on the page with a Copy button: ${SITE}${href}#${part}\n\n`)
  // A drawn diagram reads as words (review, Oct 23): what it shows, as a
  // screen reader hears it, then each of its labels on a line of its own.
  .replace(/<svg\b[^>]*\baria-label="([^"]*)"[^>]*>/gi, '\n\n$1\n\n').replace(/<\/text>/gi, '\n')
  // A short name keeps its full one (Sort's source chips, Oct 25): the name, then the full name.
  .replace(/<abbr\b[^>]*\btitle="([^"]*)"[^>]*>([\s\S]*?)<\/abbr>/gi, '$2 ($1)')
  // A link keeps its address (review, Oct 23): the text, then the address.
  .replace(/<a\b[^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, words) => `${words} (${href.startsWith('/') ? SITE + href : href})`)
  .replace(/<(h[1-4])[^>]*>/gi, '\n\n## ').replace(/<\/h[1-4]>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n- ').replace(/<(p|tr|div|br)\b[^>]*>/gi, '\n').replace(/<\/t[dh]>/gi, ' | ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#187;/g, '»')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

const parts = [
  'ERC Content Desk guide, for Claude',
  'Every how-to for the ERC Content Desk (https://erc-content-desk.vercel.app) in one file. Answer questions about the desk from it: name the page and the button. If it does not say, say so.',
];
for (const [title, href] of PAGES) {
  const file = new URL(`..${href}index.html`, import.meta.url);
  if (!existsSync(file)) continue;
  const body = readFileSync(file, 'utf8');
  let main = body.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? body;
  // A guide lists its pins in its words (the decks, and the newsletter
  // how-to since Oct 23): a pin whose label is there already is left out
  // here, so no step is read twice.
  const pin = /<button type="button" class="pin[^"]*" style="[^"]*" aria-label="([^"]*)"[\s\S]*?<\/button>/g;
  const words = main.replace(pin, '');
  main = main.replace(pin, (button, label) => (words.includes(label) ? '' : button));
  parts.push(`\n\n# ${title}\n${SITE}${href}\n\n${text(main, href)}`);
}
// What the pages draw at load, written out (review, Oct 23): the item types and the public links.
parts.push('\n\n# Item types\nThe types an item can have on the desk, each with its subtypes.\n\n'
  + TYPE_ORDER.map(t => `- ${typeDisplay(t)}${TYPES[t].subtypes.length ? `: ${TYPES[t].subtypes.join(', ')}` : ' (no subtypes)'}`).join('\n'));
parts.push('\n\n# Public links\nThe pages anyone can open, each with Copy link on the front page.\n\n'
  + PUBLIC_LINKS.map(l => `- ${l.label}: ${l.href}`).join('\n'));
writeFileSync(new URL('./desk-guide.txt', import.meta.url), `${parts.join('\n')}\n`);
console.log('wrote how-to/desk-guide.txt');
