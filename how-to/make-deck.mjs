// Builds a how-to in the newsletter how-to's layout (Kate, Oct 23: "more
// visual for all the how-tos like the one for the newsletter"): the desk's
// sidebar, the page head with its door as the blue primary, the parts as the
// desk's segmented control, one slide at a time with its words on the left and
// a marked screenshot of the real desk on the right. The styles and the deck's
// script are read from how-to/newsletter/index.html, so the guides never drift.
//   node how-to/make-deck.mjs <slug>
// reads how-to/<slug>/deck.json and how-to/<slug>/shots/*.json (from
// how-to/capture.mjs) and writes how-to/<slug>/index.html.
// Since Oct 25 a slide may be of a kind, drawn from its data across both
// columns (the owner's picks of round two for Sort the queue): "flashcards",
// a real item as Content Sort's card asking Keep or delete, and "sources",
// three tinted bands of sources with how often each was kept. Their styles and
// the flashcards' script are written into the page only when a slide uses them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { TYPE_ORDER, subtypesFor, typeDisplay } from '../js/schema.js';

const slug = process.argv[2];
if (!slug) { console.error('usage: node how-to/make-deck.mjs <slug>'); process.exit(1); }
const here = p => new URL(`./${p}`, import.meta.url);
const deck = JSON.parse(readFileSync(here(`${slug}/deck.json`), 'utf8'));
const model = readFileSync(here('newsletter/index.html'), 'utf8');
// A guide's pins show at rest, each one listed in the words beside it (Kate,
// Oct 23: steps 1 and 2 showed only with the mouse on the picture); since the
// same night the newsletter how-to does too, so its styles are copied as they
// are, and a rule there that hides the pins again stops the build.
const style = model.match(/<style>[\s\S]*?<\/style>/)[0];
if (/\.pin \{ opacity: 0/.test(style)) throw new Error('the newsletter how-to hides its pins again: a guide\'s pins show at rest (how-to/make-deck.mjs)');
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

// ---- The slide kinds (Oct 25) ----

const MARK = { keep: 'check', delete: 'trash-can', read: 'eye' };
const fa = name => `<i class="fa-solid fa-${name}" aria-hidden="true"></i>`;
// A short line after a group's name reads on, "Tests or changes a policy: research, ...", a leading ERC or A&M kept.
const onward = line => (/^[A-Z](?![A-Z&])/.test(line) ? line[0].toLowerCase() + line.slice(1) : line);
const kindsUsed = new Set();

/** Keep or delete as flashcards (her pick B): the six groups are words on the
 *  page, a side at a time, each name with its short line and its rules for a
 *  screen reader and for desk-guide.txt (without script, for everyone); the
 *  cards are data the page's script draws as Content Sort's card. */
function flashcardsHtml(chapter, slide) {
  const where = `${slug}/${chapter.id}: flashcards`;
  const groups = slide.groups ?? [];
  if (groups.length !== 6 || groups.slice(0, 3).some(g => g.verdict !== 'keep') || groups.slice(3).some(g => g.verdict !== 'delete')) throw new Error(`${where}: six groups, three to keep, then three to delete`);
  const byId = new Map(groups.map(g => [g.id, g]));
  const cards = (slide.cards ?? []).map(c => {
    if (!TYPE_ORDER.includes(c.type)) throw new Error(`${where}: ${c.title} has no desk type`);
    if (c.subtype ? !subtypesFor(c.type).includes(c.subtype) : subtypesFor(c.type).length) throw new Error(`${where}: ${c.title} has no subtype of its type`);
    if (byId.get(c.group)?.verdict !== c.verdict) throw new Error(`${where}: ${c.title} lights a group on the other side`);
    return { kicker: [typeDisplay(c.type), c.subtype].filter(Boolean).join(' · '), title: c.title, source: c.source, host: c.host, verdict: c.verdict, group: c.group, why: c.why };
  });
  if (!cards.length) throw new Error(`${where}: no cards`);
  for (const g of groups) if (!cards.some(c => c.group === g.id)) throw new Error(`${where}: no card lights ${g.name}`);
  kindsUsed.add('flashcards');
  const side = (verdict, head) => `<h3 class="fc-lh is-${verdict}">${fa(MARK[verdict])}${head}</h3>
                    <ul class="fc-gs">
                      ${groups.filter(g => g.verdict === verdict).map(g => `<li class="fc-g is-${g.verdict}" data-group="${attr(g.id)}"><span class="fc-gname">${esc(g.name)}</span><span class="fc-more">: ${esc(onward(g.line))}. ${g.rules.join(' ')}</span></li>`).join('\n                      ')}
                    </ul>`;
  // The cards ride as JSON, a "<" never closing the script early.
  const data = JSON.stringify(cards).replace(/</g, '\\u003c');
  return `<div class="slide kind kind-flashcards" role="group" aria-roledescription="slide">
          <div class="side">
            <p class="cap sr-only">${slide.cap}</p>
            <div class="kind-body">
              <div class="fc" data-flashcards>
                <div class="fc-card"></div>
                <div class="fc-dec">
                  <div class="fc-box fc-ask"></div>
                  <section class="fc-box fc-legend" aria-label="The groups">
                    ${side('keep', 'Keep<span class="sr-only"> when</span>')}
                    ${side('delete', 'Delete<span class="sr-only"> when any of these is true</span>')}
                  </section>
                </div>
                <p class="sr-only" aria-live="polite" data-fc-said></p>
                <script type="application/json" class="fc-data">${data}</script>
              </div>
            </div>
            <div class="foot"></div>${slide.links ? `\n            <p class="kind-aside">${slide.links}</p>` : ''}
          </div>
        </div>`;
}

/** Sources as three tinted bands (her pick D): each source a chip with how
 *  often it was kept, a short name keeping its full one as an abbr, the rule
 *  for each one to read; under them Add a source, which opens the Content
 *  queue's form, and the sources sheet in a new tab. */
function sourcesHtml(chapter, slide) {
  const where = `${slug}/${chapter.id}: sources`;
  const bands = slide.bands ?? [];
  if (bands.map(b => b.verdict).join() !== 'keep,read,delete') throw new Error(`${where}: three bands, kept, read each one, deleted`);
  for (const b of bands) for (const x of b.sources) {
    if (!(Number.isInteger(x.kept) && Number.isInteger(x.of) && x.of > 0 && x.kept <= x.of)) throw new Error(`${where}: ${x.name} needs kept of decided`);
    if (b.verdict === 'read' && !x.rule) throw new Error(`${where}: ${x.name} needs its rule`);
  }
  if (!slide.add?.href || !slide.sheet?.href) throw new Error(`${where}: Add a source and the sheet`);
  kindsUsed.add('sources');
  const chip = x => `<li class="sb-chip"><b>${x.full ? `<abbr title="${attr(x.full)}">${esc(x.name)}</abbr>` : esc(x.name)}</b> <span class="sb-n">${x.kept} of ${x.of}</span>${x.rule ? ` <span class="sb-rule"><span class="sb-dot" aria-hidden="true">·</span> ${esc(x.rule)}</span>` : ''}</li>`;
  const band = (b, j) => `<section class="sb-band is-${b.verdict}" aria-labelledby="h-${chapter.id}-band-${j}">
                  <h3 class="sb-name" id="h-${chapter.id}-band-${j}"><span class="sb-icon">${fa(MARK[b.verdict])}</span>${esc(b.name)}</h3>
                  <ul class="sb-chips">
                    ${b.sources.map(chip).join('\n                    ')}
                  </ul>
                </section>`;
  return `<div class="slide kind kind-sources" role="group" aria-roledescription="slide">
          <p class="cap kind-head">${slide.cap}</p>
          <div class="side">
            <div class="kind-body">
              <div class="sb-bands">
                ${bands.map(band).join('\n                ')}
              </div>
            </div>
            <div class="foot"></div>
            <p class="kind-aside"><a class="sb-add" href="${attr(slide.add.href)}">${fa('plus')}${esc(slide.add.label)}</a> <a class="sb-sheet" href="${attr(slide.sheet.href)}" target="_blank" rel="noopener">${esc(slide.sheet.label)}${fa('arrow-up-right-from-square')}</a></p>
          </div>
        </div>`;
}

// The kinds' looks: a slide across both columns, Back and Next still at the
// foot of the left one. Every value is a desk token.
const KIND_STYLE = `<style data-kinds>
    /* Slides of a kind (Oct 25, the owner's picks of round two for Sort the
       queue): flashcards for Keep or delete (B), three bands for Sources (D).
       The slide's words span both columns under the part's title, and the
       controls keep the left column's foot, so Back and Next stay put. */
    /* The body fills what a slide's words would, less the controls' 40px and the gap over them, so nothing is left to stretch the foot. */
    .js .slide.kind > .side { grid-area: 2 / 1 / 3 / 3; display: grid; grid-template-columns: subgrid; grid-template-rows: minmax(calc(var(--fh) + 2 * var(--pad) - var(--title-h) - 40px - var(--spacing-05)), auto) auto; row-gap: var(--spacing-05); }
    .js .slide.kind > .side > .kind-body { grid-area: 1 / 1 / 2 / 3; }
    .js .slide.kind > .side > .foot { grid-area: 2 / 1; align-self: end; margin: 0; padding: 0; }
    .js .slide.kind > .side > .kind-aside { grid-area: 2 / 2; align-self: center; }
    .js .slide.kind > .kind-head { grid-area: 1 / 2; align-self: start; }
    html:not(.js) .slide.kind > .side { grid-column: 1 / -1; }
    .kind-body { container: kind / inline-size; display: grid; min-width: 0; }
    .kind-head { margin: 0; font: 400 15px/26px var(--font-sans); color: var(--muted); }
    .kind-aside { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-03) var(--spacing-06); min-width: 0; margin: 0; font: var(--meta-type); color: var(--muted); }

    /* Flashcards: the card at the left as Content Sort draws it, the ask and
       the six groups in its decision column. */
    .fc { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--spacing-05); align-items: stretch; min-width: 0; }
    html:not(.js) .fc { grid-template-columns: minmax(0, 1fr); }
    html:not(.js) .fc-card, html:not(.js) .fc-ask { display: none; }
    .fc-card { container-type: inline-size; display: flex; flex-direction: column; min-width: 0; background: var(--layer); border: 1px solid var(--layer-line); border-radius: var(--radius-card); box-shadow: var(--shadow-card); overflow: hidden; }
    .fc-card.is-delete { border-color: var(--notification-error-border); }
    .fc-card.is-keep { border-color: var(--accent-20); }
    .fc-face { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; padding: var(--spacing-06) var(--spacing-06) var(--spacing-05); }
    .fc-kick { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-04); margin: 0; font: 600 14px/20px var(--font-sans); color: var(--muted); }
    .fc-pos { flex: none; font-weight: 400; color: var(--text-helper); font-variant-numeric: tabular-nums; }
    .fc-mid { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-03); margin: auto 0; padding: var(--spacing-05) 0; }
    .fc-title { margin: 0; font: 700 30px/36px var(--font-sans); letter-spacing: -.5px; color: var(--ink); overflow-wrap: break-word; }
    .fc-where { margin: 0; font: 400 15px/22px var(--font-sans); color: var(--muted); }
    .fc-host { display: inline-flex; align-items: center; height: 28px; margin: var(--spacing-02) 0 0; padding: 0 var(--spacing-03); border-radius: var(--radius-input); background: var(--layer-accent-01); color: var(--ink); font: 500 14px/20px var(--font-sans); }   /* the link's domain; not a link here, so not blue */
    .fc-stamp { flex: none; display: flex; align-items: center; gap: var(--spacing-03); min-height: 64px; margin: 0; padding: 0 var(--spacing-06); font: 700 20px/24px var(--font-sans); }
    .fc-stamp .fa-solid { flex: none; font-size: 19px; }
    .fc-stamp.is-delete { background: var(--notification-error-background); color: var(--err); border-top: 1px solid var(--notification-error-border); }
    .fc-stamp.is-keep { background: var(--accent-10); color: var(--accent-deep); border-top: 1px solid var(--accent-20); }
    .fc-stamp.is-keep .fa-solid { color: var(--accent); }
    .fc-dot { margin: 0 var(--spacing-01); font-weight: 400; color: var(--muted); }
    .fc-why { font: 500 16px/22px var(--font-sans); color: var(--ink); }
    @container (width < 480px) {
      .fc-title { font-size: 24px; line-height: 30px; letter-spacing: -.3px; }
      .fc-face { padding: var(--spacing-05); }
      .fc-stamp { min-height: 56px; padding: 0 var(--spacing-05); font-size: 18px; }
    }

    .fc-dec { display: flex; flex-direction: column; gap: var(--spacing-03); min-width: 0; }
    .fc-box { background: var(--layer); border: 1px solid var(--layer-line); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
    .fc-ask { padding: var(--spacing-04); }
    .fc-asking, .fc-done { display: flex; flex-direction: column; gap: var(--spacing-03); }
    .fc-asking[hidden], .fc-done[hidden] { display: none; }
    .fc-done { min-height: calc(20px + 44px + 36px + 2 * var(--spacing-03)); justify-content: space-between; }   /* as tall as the ask, so the groups under it hold still */
    .fc-q { margin: 0; font: 600 14px/20px var(--font-sans); color: var(--muted); }
    /* Keep and Delete as Content Sort draws them (its .sort-card rules): the
       fill full width, the red word, each with its key at its right. */
    .fc-ask button.sc-keep { width: 100%; height: 44px; justify-content: flex-start; gap: var(--spacing-03); padding: 0 var(--spacing-04) 0 var(--spacing-05); font: 600 15px/20px var(--font-sans); }
    .fc-ask button.sc-delete { width: 100%; height: 36px; justify-content: flex-start; gap: var(--spacing-03); margin: 0; padding: 0 var(--spacing-04) 0 var(--spacing-05); border: 0; border-radius: var(--radius); font: 600 14px/18px var(--font-sans); }
    .fc-ask button.sc-delete:hover:not(:disabled) { background: var(--sidebar-hover); }
    .fc-ask button.sc-delete .fa-solid { margin: 0; font-size: 14px; }
    .fc-res { display: flex; align-items: center; gap: var(--spacing-03); min-height: 44px; margin: 0; padding: 0 var(--spacing-04); border-radius: var(--radius); font: 700 16px/20px var(--font-sans); }
    .fc-res.is-right { background: var(--notification-success-background); color: var(--text-success-on-tint); }
    .fc-res.is-wrong { background: var(--notification-warning-background); color: var(--text-warning-on-tint); }
    .fc-ask button.fc-next { width: 100%; height: 40px; justify-content: flex-start; gap: var(--spacing-03); padding: 0 var(--spacing-04) 0 var(--spacing-05); font: 600 14px/18px var(--font-sans); }
    .fc-next .fa-solid { margin-left: auto; font-size: 13px; }

    .fc-legend { margin: 0; padding: var(--spacing-03) 0; }
    .fc-lh { display: flex; align-items: center; gap: var(--spacing-03); margin: 0; padding: var(--spacing-01) var(--spacing-04); font: 600 14px/20px var(--font-sans); color: var(--muted); }
    .fc-lh .fa-solid { font-size: 13px; }
    .fc-lh.is-keep .fa-solid { color: var(--accent); }
    .fc-lh.is-delete .fa-solid { color: var(--err); }
    .fc-gs { list-style: none; margin: 0; padding: 0; }
    .fc-gs + .fc-lh { margin-top: var(--spacing-03); }
    .fc-g { display: flex; align-items: center; min-height: 26px; margin: 0 var(--spacing-03); padding: 0 var(--spacing-03); border-radius: var(--radius-input); font: 400 14px/18px var(--font-sans); color: var(--ink); }
    .fc-g.is-lit.is-keep { background: var(--accent-10); color: var(--accent-deep); font-weight: 700; box-shadow: inset 3px 0 0 var(--accent); }
    .fc-g.is-lit.is-delete { background: var(--notification-error-background); color: var(--err); font-weight: 700; box-shadow: inset 3px 0 0 var(--err); }
    .js .fc-more { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }   /* the line and the rules: read aloud and in the desk guide */
    html:not(.js) .fc-g { display: block; padding: var(--spacing-02) var(--spacing-03); }
    html:not(.js) .fc-gname { font-weight: 700; }

    /* Sources: three bands in the desk's note look, the sources as chips. */
    .sb-bands { display: flex; flex-direction: column; gap: var(--spacing-04); min-width: 0; }
    .sb-band { flex: 1 1 auto; display: grid; grid-template-columns: 196px minmax(0, 1fr); align-items: center; gap: var(--spacing-05); padding: var(--spacing-04) var(--spacing-05); border: 1px solid var(--layer-line); border-radius: var(--radius); background: var(--layer); box-shadow: inset 4px 0 0 var(--border-strong-01); }
    .sb-band.is-keep { background: var(--notification-info-background); border-color: var(--notification-info-border); box-shadow: inset 4px 0 0 var(--accent); }
    .sb-band.is-delete { background: var(--notification-error-background); border-color: var(--notification-error-border); box-shadow: inset 4px 0 0 var(--err); }
    .sb-name { display: flex; align-items: center; gap: var(--spacing-03); margin: 0; font: 700 17px/22px var(--font-sans); color: var(--ink); }
    .sb-icon { display: inline-grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: var(--radius-round); background: var(--layer); font-size: 13px; }
    .sb-band.is-keep .sb-icon { color: var(--accent); }
    .sb-band.is-read .sb-icon { background: var(--layer-accent-01); color: var(--gray-700); }
    .sb-band.is-delete .sb-icon { color: var(--err); }
    .sb-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--spacing-03); }
    .sb-chip { display: flex; align-items: center; column-gap: var(--spacing-03); min-height: 32px; padding: var(--spacing-02) var(--spacing-04); background: var(--layer); border: 1px solid var(--layer-line); border-radius: var(--radius-pill); box-shadow: var(--shadow-card); font: 400 14px/20px var(--font-sans); color: var(--ink); }
    .sb-chip b { font-weight: 600; }
    .sb-chip abbr { text-decoration: none; }
    .sb-n { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .sb-rule { display: inline-flex; align-items: baseline; gap: var(--spacing-03); font-weight: 500; }   /* the dot as far from the rule as from the count */
    .sb-dot { color: var(--muted); }
    /* The two doors under the bands: Add a source as an outline button, the sheet a link. */
    .sb-add { display: inline-flex; align-items: center; gap: var(--spacing-03); height: 32px; padding: 0 var(--spacing-04); border: 1px solid var(--button-tertiary); border-radius: var(--radius); background: var(--layer-02); color: var(--text-in-outline); font: 600 14px/20px var(--font-sans); text-decoration: none; white-space: nowrap; }
    .sb-add:hover { background: var(--hover); border-color: var(--text-secondary); color: var(--text-in-outline); }
    .sb-add .fa-solid { font-size: 12px; }
    .sb-sheet { font: 500 14px/20px var(--font-sans); white-space: nowrap; }
    .sb-sheet .fa-solid { margin-left: 6px; font-size: 11px; }
    /* A narrow deck (a 1024 window): the bands stand side by side, each source a row. */
    @container kind (width < 760px) {
      .fc { grid-template-columns: minmax(0, 1fr) 248px; gap: var(--spacing-04); }
      .sb-bands { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-03); }
      .sb-band { grid-template-columns: minmax(0, 1fr); align-content: start; align-items: start; gap: var(--spacing-03); padding: var(--spacing-04); }
      .sb-name { font-size: 15px; line-height: 20px; }
      .sb-icon { width: 24px; height: 24px; font-size: 12px; }
      .sb-chips { flex-direction: column; flex-wrap: nowrap; gap: var(--spacing-02); }
      .sb-chip { flex-wrap: wrap; min-height: 28px; padding: var(--spacing-01) var(--spacing-03); border-radius: var(--radius); font-size: 13px; line-height: 18px; }
      .sb-rule { flex-basis: 100%; }   /* the rule on a line of its own, so no dot is needed before it */
      .sb-dot { display: none; }
    }
    /* A short window: the decision column tighter, so it ends where the deck's frame does. */
    @media (height < 800px) {
      .fc-ask { padding: var(--spacing-03); }
      .fc-asking, .fc-done { gap: var(--spacing-02); }
      .fc-done { min-height: calc(20px + 44px + 36px + 2 * var(--spacing-02)); }
      .fc-legend { padding: var(--spacing-02) 0; }
      .fc-g { min-height: 24px; }
      .fc-gs + .fc-lh { margin-top: var(--spacing-02); }
      .fc-mid { padding: var(--spacing-03) 0; }
    }
    @media (prefers-reduced-motion: no-preference) {
      .fc-g, .sb-add { transition: background-color var(--duration-fast-01) var(--ease-productive), color var(--duration-fast-01) var(--ease-productive); }
    }
  </style>`;

/** The flashcards' script, written into the page as it is. Content Sort's
 *  Keep and Delete ask; the answer says Right or Not quite, stamps the card
 *  and lights its group; Next card turns to the next. K and D press the
 *  buttons, as on Content Sort, only while the slide is up and on screen and
 *  never while typing; the deck keeps its arrows. Nothing moves. */
function flashcards() {
  const make = (tag, cls, words) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (words != null) node.textContent = words;
    return node;
  };
  const icon = (name) => { const i = make('i', `fa-solid fa-${name}`); i.setAttribute('aria-hidden', 'true'); return i; };
  const keyChip = (k) => { const b = make('kbd', 'sc-key', k); b.setAttribute('aria-hidden', 'true'); return b; };
  const VERB = { keep: 'Keep', delete: 'Delete' };
  const MARK = { keep: 'check', delete: 'trash-can' };
  document.querySelectorAll('[data-flashcards]').forEach((box) => {
    const slide = box.closest('.slide');
    const cards = JSON.parse(box.querySelector('.fc-data').textContent);
    const face = box.querySelector('.fc-card');
    const said = box.querySelector('[data-fc-said]');
    const groups = new Map([...box.querySelectorAll('.fc-g')].map((g) => [g.dataset.group, g]));
    const nameOf = (id) => groups.get(id)?.querySelector('.fc-gname')?.textContent ?? '';

    // The ask, Content Sort's own Keep and Delete; then the answer and Next card.
    const asking = make('div', 'fc-asking');
    const keep = make('button', 'primary sc-keep', 'Keep');
    keep.type = 'button';
    keep.title = 'Keep (K)';
    keep.append(keyChip('K'));
    const del = make('button', 'linkish trash-link sc-delete', ' Delete');
    del.type = 'button';
    del.title = 'Delete (D)';
    del.prepend(icon('trash-can'));
    del.append(keyChip('D'));
    asking.append(make('p', 'fc-q', 'Keep or delete?'), keep, del);
    const done = make('div', 'fc-done');
    const result = make('p', 'fc-res');
    const next = make('button', 'fc-next');
    next.type = 'button';
    done.append(result, next);
    box.querySelector('.fc-ask').append(asking, done);

    let at = 0;
    let answer = '';
    function draw() {
      const c = cards[at];
      face.className = `fc-card${answer ? ` is-${c.verdict}` : ''}`;
      const top = make('p', 'fc-kick');
      top.append(make('span', '', c.kicker), make('span', 'fc-pos', `${at + 1} of ${cards.length}`));
      const mid = make('div', 'fc-mid');
      mid.append(make('h3', 'fc-title', c.title), make('p', 'fc-where', c.source), make('p', 'fc-host', c.host));
      const body = make('div', 'fc-face');
      body.append(top, mid);
      face.replaceChildren(body);
      if (answer) {
        const stamp = make('p', `fc-stamp is-${c.verdict}`);
        const dot = make('span', 'fc-dot', '·');
        dot.setAttribute('aria-hidden', 'true');
        stamp.append(icon(MARK[c.verdict]), make('b', '', VERB[c.verdict]), dot, make('span', 'fc-why', c.why));
        face.append(stamp);
        const right = answer === c.verdict;
        result.className = `fc-res ${right ? 'is-right' : 'is-wrong'}`;
        result.replaceChildren(icon(right ? 'check' : 'xmark'), right ? 'Right' : 'Not quite');
        const last = at === cards.length - 1;
        next.replaceChildren(last ? 'Start over' : 'Next card', icon(last ? 'rotate-left' : 'arrow-right'));
      }
      asking.hidden = Boolean(answer);
      done.hidden = !answer;
      groups.forEach((g, id) => g.classList.toggle('is-lit', Boolean(answer) && id === c.group));
    }
    function choose(v) {
      if (answer) return;
      answer = v;
      draw();
      const c = cards[at];
      said.textContent = `${answer === c.verdict ? 'Right' : 'Not quite'}. ${VERB[c.verdict]}: ${c.why}. ${nameOf(c.group)}.`;
      next.focus({ preventScroll: true });
    }
    function turn() {
      at = (at + 1) % cards.length;
      answer = '';
      draw();
      const c = cards[at];
      said.textContent = `${at + 1} of ${cards.length}. ${c.title}. ${c.source}.`;
      keep.focus({ preventScroll: true });
    }
    keep.addEventListener('click', () => choose('keep'));
    del.addEventListener('click', () => choose('delete'));
    next.addEventListener('click', turn);

    const onScreen = () => { const r = slide.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat || e.defaultPrevented) return;
      const k = String(e.key).toLowerCase();
      if ((k !== 'k' && k !== 'd') || answer) return;
      if (!slide.classList.contains('is-on') || !onScreen()) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      const b = k === 'k' ? keep : del;
      b.focus({ preventScroll: true });
      b.click();
    });
    draw();
  });
}

function slideHtml(chapter, slide, i) {
  if (slide.kind === 'flashcards') return flashcardsHtml(chapter, slide);
  if (slide.kind === 'sources') return sourcesHtml(chapter, slide);
  if (slide.kind) throw new Error(`${slug}/${chapter.id}: no slide kind ${slide.kind}`);
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
  <link rel="stylesheet" href="/css/styles.css?v=194" />
  <link rel="stylesheet" href="/css/shell.css?v=10" />
  <script>document.documentElement.classList.add('js');</script>
  <!-- Built by how-to/make-deck.mjs from ${slug}/deck.json; the styles and script are the newsletter how-to's. -->
  ${style}${kindsUsed.size ? `\n  ${KIND_STYLE}` : ''}
</head>
<body>
  <a class="skip-to-main" href="#main">Skip to content</a>
  <!-- The desk's sidebar and its counts, built by /js/howto-sidebar.js: a how-to lights All how-tos at its foot. -->
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

  ${script}${kindsUsed.has('flashcards') ? `
  <script>
    // ---- Keep or delete, as flashcards: a real card asks, Keep or Delete answers, its group lights ----
    (${flashcards})();
  </script>` : ''}
  <script type="module" src="/js/howto-sidebar.js?v=2"></script>
  <script type="module" src="/js/problem-mount.js?v=4"></script>
</body>
</html>
`;
writeFileSync(here(`${slug}/index.html`), html);
console.log(`wrote how-to/${slug}/index.html`);
