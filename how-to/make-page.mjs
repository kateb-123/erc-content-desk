// Writes a plain how-to page: node how-to/make-page.mjs <slug> <title> <lede> <body.html>
// The handoff pages (Oct 22, 2026) share this shell so each is only its words.
// Since the look of Oct 23 (Kate's pick A) the shell is a desk page: the
// sidebar at the left (js/howto-sidebar.js: the desk's, with its counts,
// lighting All how-tos at its foot), one reading column on the gray page,
// styled by how-to/howto.css.
// The index is the slug "." (how-to/index.html).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [slug, title, lede, bodyFile] = process.argv.slice(2);
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const body = readFileSync(bodyFile, 'utf8');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${esc(title)} · ERC Content Desk</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230b6bde'/%3E%3Cpath d='M9 16.5l4.5 4.5L23 11.5' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />
  <!-- The desk's own sheets, at index.html's versions: bump them together. -->
  <link rel="stylesheet" href="/css/tokens.css?v=12" />
  <link rel="stylesheet" href="/css/shell.css?v=10" />
  <link rel="stylesheet" href="/how-to/howto.css?v=4" />
</head>
<body>
  <a class="skip-to-main" href="#main">Skip to content</a>
  <!-- The desk's sidebar and its counts, built by /js/howto-sidebar.js: a how-to lights All how-tos at its foot. -->
  <nav class="sidebar" aria-label="Desk"></nav>
  <main class="ht-page" id="main">
    <h1>${esc(title)}</h1>
    <p class="ht-lede">${esc(lede)}</p>
${body}
  </main>
  <script type="module" src="/js/howto-sidebar.js?v=2"></script>
  <script type="module" src="/js/problem-mount.js?v=4"></script>
</body>
</html>
`;
mkdirSync(`how-to/${slug}`, { recursive: true });
writeFileSync(`how-to/${slug}/index.html`, html);
console.log(`how-to/${slug}/index.html`);
