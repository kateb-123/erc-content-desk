// Writes a plain how-to page: node how-to/make-page.mjs <slug> <title> <lede> <body.html>
// The handoff pages (Oct 22, 2026) share this shell so each is only its words.
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
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%231d7491'/%3E%3Cpath d='M9 16.5l4.5 4.5L23 11.5' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;600;700&display=swap" />
  <link rel="stylesheet" href="/css/tokens.css?v=11" />
  <link rel="stylesheet" href="/how-to/howto.css?v=1" />
</head>
<body style="margin:0;background:var(--background)">
  <main class="ht-page">
    <p class="ht-crumb"><a href="/">ERC Content Desk</a> / <a href="/how-to/">How-tos</a></p>
    <h1>${esc(title)}</h1>
    <p class="ht-lede">${esc(lede)}</p>
${body}
  </main>
  <script type="module" src="/js/problem-mount.js?v=1"></script>
</body>
</html>
`;
mkdirSync(`how-to/${slug}`, { recursive: true });
writeFileSync(`how-to/${slug}/index.html`, html);
console.log(`how-to/${slug}/index.html`);
