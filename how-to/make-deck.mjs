// Builds a how-to in the newsletter how-to's layout (Kate, Oct 23: "more
// visual for all the how-tos like the one for the newsletter"): the desk's
// sidebar, the page head with its door as the blue primary, the parts as the
// desk's segmented control, one slide at a time with its words on the left and
// a marked screenshot of the real desk on the right. The styles and the deck's
// script are read from how-to/newsletter/index.html, so the guides never drift.
//   node how-to/make-deck.mjs <slug>
// reads how-to/<slug>/deck.json and how-to/<slug>/shots/*.json (from
// how-to/capture.mjs) and writes how-to/<slug>/index.html.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const slug = process.argv[2];
if (!slug) { console.error('usage: node how-to/make-deck.mjs <slug>'); process.exit(1); }
const here = p => new URL(`./${p}`, import.meta.url);
const deck = JSON.parse(readFileSync(here(`${slug}/deck.json`), 'utf8'));
const model = readFileSync(here('newsletter/index.html'), 'utf8');
// A guide's pins show at rest, each one listed in the words beside it (Kate,
// Oct 23: steps 1 and 2 showed only with the mouse on the picture). The
// newsletter how-to keeps its own pins hidden until then.
const HIDDEN = `
    /* Hidden until the pointer is on the still or focus is in it; a tap shows them on a touch screen. */
    .pin { opacity: 0; pointer-events: none; }
    .shot:focus-within .pin, .shot.is-shown .pin { opacity: 1; pointer-events: auto; }
    @media (hover: hover) { .shot:hover .pin { opacity: 1; pointer-events: auto; } }
`;
const modelStyle = model.match(/<style>[\s\S]*?<\/style>/)[0];
if (!modelStyle.includes(HIDDEN)) throw new Error('the newsletter how-to\'s rule that hides the pins has changed: match it in HIDDEN, how-to/make-deck.mjs');
const style = modelStyle.replace(HIDDEN, '');
const script = model.slice(model.lastIndexOf('<script>', model.indexOf('// ---- The pins')), model.indexOf('</script>', model.indexOf('// ---- The pins')) + '</script>'.length);

const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = esc;

function shotMeta(name) {
  const metaFile = here(`${slug}/shots/${name}.json`);
  if (!existsSync(metaFile)) throw new Error(`no capture for ${slug}/${name}: run node how-to/capture.mjs ${slug}`);
  return JSON.parse(readFileSync(metaFile, 'utf8'));
}

function shotHtml(name, m) {
  const pins = (m.pins ?? []).map((p, i) => `<button type="button" class="pin${p.y > 70 ? ' up' : ''}" style="--x:${p.x};--y:${p.y}" aria-label="${attr(p.label)}"><span class="num" aria-hidden="true">${i + 1}</span><span class="tip" aria-hidden="true">${esc(p.label)}</span></button>`).join('\n              ');
  return `<div class="frame">
            <div class="shot" style="--iw:${m.iw};--ih:${m.ih};--cx:${m.cx};--cy:${m.cy};--cw:${m.cw};--ch:${m.ch}">
              <div class="crop"><div class="zoom"><img src="shots/${name}.png" width="${m.iw}" height="${m.ih}" loading="lazy" alt="${attr(m.alt)}" /></div></div>
              ${pins}
            </div>
          </div>`;
}

function notesHtml(notes = []) {
  return notes.map(n => `<p class="note${n.warn ? ' warn' : ''}"><span class="n${n.go ? ' go' : ''}">${esc(n.n ?? '')}</span><span>${n.html}</span></p>`).join('\n            ');
}

// Every pin's step in the words, under its number. A slide whose notes cover
// every pin already lists its steps; elsewhere a row is the pin's label, then
// its note when it has one. The notes with no number (a warning, the next
// button) follow.
function stepsHtml(slide, pins) {
  const notes = slide.notes ?? [];
  const numbered = n => /^\d+$/.test(String(n.n ?? ''));
  for (const n of notes) if (numbered(n) && !(+n.n >= 1 && +n.n <= pins.length)) throw new Error(`${slug}/${slide.shot}: note ${n.n} has no pin`);
  const noteFor = i => notes.find(n => numbered(n) && +n.n === i + 1);
  const listed = pins.every((_, i) => noteFor(i));
  const rows = pins.map((p, i) => {
    const note = noteFor(i);
    if (listed) return note;
    const label = esc(p.label) + (/[.!?…]$/.test(p.label) ? '' : '.');
    return { n: String(i + 1), html: note ? `${label} ${note.html}` : label };
  });
  return notesHtml([...rows, ...notes.filter(n => !numbered(n))]);
}

function slideHtml(chapter, slide, i) {
  if (slide.steps) {
    const groups = slide.steps.map((g, j) => `<section class="steps" aria-labelledby="h-${chapter.id}-${i}-${j}">
              <h3 id="h-${chapter.id}-${i}-${j}">${esc(g.title)}</h3>
              <ol>
                ${g.items.map(it => `<li>${it}</li>`).join('\n                ')}
              </ol>${g.links ? `\n              <p class="links">${g.links}</p>` : ''}
            </section>`).join('\n            ');
    return `<div class="slide words" role="group" aria-roledescription="slide">
          <div class="side">
            <p class="cap">${slide.cap}</p>
            ${notesHtml(slide.notes)}
            <div class="foot"></div>
          </div>
          <div class="text">
            ${groups}
          </div>
        </div>`;
  }
  const m = shotMeta(slide.shot);
  return `<div class="slide" role="group" aria-roledescription="slide">
          <div class="side">
            <p class="cap">${slide.cap}</p>
            ${stepsHtml(slide, m.pins ?? [])}
            <div class="foot"></div>
          </div>
          ${shotHtml(slide.shot, m)}
        </div>`;
}

const chips = deck.chapters.map(c => `<a href="#${c.id}">${c.step ? `<span class="step" aria-hidden="true">${c.step}</span>` : ''}${esc(c.name)}</a>`).join('\n      ');
const chapters = deck.chapters.map(c => `<!-- ===== ${esc(c.name)} ===== -->
      <section class="chapter" id="${c.id}" data-name="${attr(c.name)}" aria-labelledby="h-${c.id}">
        <h2 class="pane-title" id="h-${c.id}">${c.step ? `<span class="step" aria-hidden="true">${c.step}</span><span class="sr-only">Step ${c.step}: </span>` : ''}${esc(c.name)}</h2>

        ${c.slides.map((s, i) => slideHtml(c, s, i)).join('\n\n        ')}
      </section>`).join('\n\n      ');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${esc(deck.title)} · ERC Content Desk</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230b6bde'/%3E%3Cpath d='M9 16.5l5 5 9-11' fill='none' stroke='%23ffffff' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <!-- The desk's own sheets, at index.html's versions: bump them together. -->
  <link rel="stylesheet" href="/css/tokens.css?v=12" />
  <link rel="stylesheet" href="/css/styles.css?v=190" />
  <link rel="stylesheet" href="/css/shell.css?v=8" />
  <script>document.documentElement.classList.add('js');</script>
  <!-- Built by how-to/make-deck.mjs from ${slug}/deck.json; the styles and script are the newsletter how-to's. -->
  ${style}
</head>
<body>
  <a class="skip-to-main" href="#main">Skip to content</a>
  <!-- The desk's sidebar, built by /js/shell-ui.js: a how-to lights All how-tos at its foot. -->
  <nav class="sidebar" aria-label="Desk"></nav>

  <div class="howto-main">
  <header class="howto-head">
    <div>
      <p class="eyebrow">How to</p>
      <h1>${esc(deck.h1)}</h1>
      <p class="lede">${esc(deck.lede)}</p>
    </div>${deck.open ? `
    <a class="open" href="${attr(deck.open.href)}" target="_blank" rel="noopener">${esc(deck.open.label)}<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>` : ''}
  </header>

  <main class="page" id="main">
    <nav class="chips" aria-label="Parts">
      ${chips}
    </nav>

    <div class="deck" role="region" aria-roledescription="carousel" aria-label="${attr(deck.h1)}">
      <div class="progress" aria-hidden="true"><span></span></div>
      <p class="sr-only" aria-live="polite" data-said></p>

      ${chapters}

      <section class="styles" hidden aria-hidden="true"><div class="sg-where"></div></section>

      <div class="controls" role="group" aria-label="Slides">
        <button type="button" class="go back"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i>Back</button>
        <div class="dots"></div>
        <button type="button" class="go next">Next<i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
      </div>
    </div>${deck.below ? `\n    ${deck.below}` : ''}
  </main>
  </div>

  ${script}
  <script type="module">
    import { renderSidebar } from '/js/shell-ui.js';
    renderSidebar(document.querySelector('.sidebar'), { screen: 'howto' });
  </script>
  <script type="module" src="/js/problem-mount.js?v=4"></script>
</body>
</html>
`;
writeFileSync(here(`${slug}/index.html`), html);
console.log(`wrote how-to/${slug}/index.html`);
