// tests/sort-howto-kinds.test.js: the owner's two picks from round two of the
// Sort how-to's options (Oct 24, 2026). Keep or delete is layout B, flashcards:
// one slide, a real item drawn as Content Sort's card asks "Keep or delete?",
// Content Sort's own Keep and Delete answer (K and D too), then Right or Not
// quite, the card stamped, its group lit among the six. Sources is layout D's
// slide: three tinted bands of source chips, each with its kept rate, the
// sources sheet, and Add a source, which opens the Content queue's real form.
// make-deck.mjs draws both from how-to/sort/deck.json, and desk-guide.txt keeps
// every rule as words, so the team's Claude can still answer "should I keep
// this?". The conference rule is the owner's: a conference on education policy
// or research, and its call for proposals, is kept; a job, an award, or a
// teaching or trade conference is deleted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TYPE_ORDER, subtypesFor, typeDisplay } from '../js/schema.js';
import { openedScreen, opensSourceForm, SOURCE_FORM_HASH } from '../js/shell-view.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const deck = JSON.parse(read('how-to/sort/deck.json'));
const page = read('how-to/sort/index.html');
const guide = read('how-to/desk-guide.txt');
const chapter = id => deck.chapters.find(c => c.id === id);
const fc = chapter('keep').slides.find(s => s.kind === 'flashcards');
const src = chapter('sources').slides.find(s => s.kind === 'sources');
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
const lower = s => (/^[A-Z](?![A-Z&])/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const slideOf = kind => page.slice(page.indexOf(`<div class="slide kind kind-${kind}"`), page.indexOf('<!-- =====', page.indexOf(`<div class="slide kind kind-${kind}"`)));
const sortGuide = (() => {
  const from = guide.indexOf('\n# Sort the queue\n');
  return guide.slice(from, guide.indexOf('\n# ', from + 1));
})();

test('Keep or delete is the Content Sort still, then one flashcard slide in place of the two word slides', () => {
  assert.deepEqual(chapter('keep').slides.map(s => s.kind ?? (s.steps ? 'words' : 'still')), ['still', 'flashcards']);
  assert.equal(chapter('keep').slides[0].shot, 'sort', 'the still of Content Sort stays first');
  assert.deepEqual(chapter('sources').slides.map(s => s.kind ?? 'other'), ['sources'], 'Sources is one slide, the bands');
  assert.doesNotMatch(page, /<h3 id="h-keep-\d-\d">(Keep|Delete) when<\/h3>|<h3 id="h-sources-0-\d">(A clear rule|Nearly every time)<\/h3>/, 'the word slides are gone');
  for (const id of ['scraper', 'card', 'finalize', 'fix']) assert.ok(chapter(id).slides.every(s => !s.kind), `${id} keeps its slides as they are`);
});

test('the six groups, in her names, three a side, each with its short line and its rules', () => {
  assert.deepEqual(fc.groups.map(g => [g.verdict, g.name]), [
    ['keep', 'Tests or changes a policy'], ['keep', 'Policy events and money'], ['keep', 'Ours or added by hand'],
    ['delete', 'Not education policy'], ['delete', 'Not news we share'], ['delete', 'Already in the queue'],
  ]);
  assert.equal(new Set(fc.groups.map(g => g.id)).size, 6, 'each group its own id');
  for (const g of fc.groups) {
    assert.ok(g.line.trim() && g.line.length <= 70, `${g.name}: a short line`);
    assert.ok(g.rules.length >= 1 && g.rules.every(r => /[.”]$/.test(r.trim())), `${g.name}: its rules, each a sentence`);
  }
});

test('the conference rule is the owner\'s: policy and research conferences and their calls are kept; jobs, awards, teaching and trade conferences go', () => {
  const words = g => [g.line, ...g.rules].join(' ');
  const events = fc.groups.find(g => g.name === 'Policy events and money');
  assert.match(events.line, /conferences/, 'the short line names conferences among what is kept');
  assert.ok(events.rules.includes('It is a conference on education policy or research, or its call for proposals.'));
  const notNews = fc.groups.find(g => g.name === 'Not news we share');
  assert.match(notNews.line, /jobs, awards, teaching or trade conferences/);
  assert.ok(notNews.rules.some(r => r.startsWith('It is a job, an award, or a teaching or trade conference.')));
  for (const g of fc.groups.filter(x => x.verdict === 'delete')) {
    assert.doesNotMatch(words(g).replace(/teaching or trade conferences?/g, ''), /conference/i, `${g.name}: only teaching and trade conferences are deleted`);
  }
  assert.doesNotMatch(JSON.stringify(deck) + page + guide, /conferences deleted|Policy webinars, calls, grants|Opinion, roundups, jobs, conferences/, 'the round-two checker\'s rewrite never ships');
});

test('the 2026 OEP Conference is a Keep card under Policy events and money, its host as the source', () => {
  const events = fc.groups.find(g => g.name === 'Policy events and money');
  const oep = fc.cards.find(c => c.title.startsWith('2026 OEP Conference'));
  assert.ok(oep, 'the OEP card');
  assert.equal(oep.title, '2026 OEP Conference: Arkansas Education, What We Know, What We\'re Learning, What\'s Next');
  assert.equal(oep.source, 'Office for Education Policy', 'the host, never the inbox it came through');
  assert.deepEqual([oep.verdict, oep.group, oep.type, oep.subtype], ['keep', events.id, 'event', 'Off-Campus']);
  const nctm = fc.cards.find(c => c.title.includes('National Council of Teachers of Mathematics'));
  assert.deepEqual([nctm.verdict, nctm.group], ['delete', fc.groups.find(g => g.name === 'Not news we share').id], 'a teaching conference is deleted');
  assert.match(nctm.why, /teaching conference/i);
});

test('every card is a real item drawn as Content Sort draws it, lights a group on its own side, and shows no date or name', () => {
  assert.ok(fc.cards.length >= 9 && fc.cards.length <= 12, `a short run of cards (${fc.cards.length})`);
  const byId = new Map(fc.groups.map(g => [g.id, g]));
  for (const c of fc.cards) {
    assert.deepEqual(Object.keys(c).sort(), ['group', 'host', 'source', 'subtype', 'title', 'type', 'verdict', 'why'], `${c.title}: no date, deadline or who added it`);
    assert.ok(TYPE_ORDER.includes(c.type), `${c.title}: a desk type`);
    assert.ok(c.subtype === '' ? subtypesFor(c.type).length === 0 : subtypesFor(c.type).includes(c.subtype), `${c.title}: a subtype of its type`);
    assert.ok(byId.has(c.group), `${c.title}: a group`);
    assert.equal(byId.get(c.group).verdict, c.verdict, `${c.title}: its group is on its own side`);
    assert.match(c.host, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/, `${c.title}: the link as its domain`);
    assert.ok(c.why.trim() && c.why.length <= 32, `${c.title}: why, in a few words`);
    assert.doesNotMatch([c.source, c.why].join(' '), /inbox|Kate|Kathy|added by|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|ahead/i, `${c.title}: no inbox, name or date`);
  }
  for (const g of fc.groups) assert.ok(fc.cards.some(c => c.group === g.id), `${g.name} lights for at least one card`);
  assert.equal(new Set(fc.cards.map(c => c.title + c.source)).size, fc.cards.length, 'each card once');
});

test('the page draws the flashcard slide from the data: the six groups as words, the cards as data with Content Sort\'s lines', () => {
  const slide = slideOf('flashcards');
  assert.ok(slide.length > 0, 'a flashcard slide on the page');
  assert.match(slide, /^<div class="slide kind kind-flashcards" role="group" aria-roledescription="slide">/);
  assert.match(slide, /<p class="cap sr-only">/, 'its caption for the deck\'s spoken line');
  assert.match(slide, /<div class="foot"><\/div>/, 'Back and Next move to its foot like every slide');
  for (const g of fc.groups) {
    assert.ok(slide.includes(`<li class="fc-g is-${g.verdict}" data-group="${g.id}"><span class="fc-gname">${esc(g.name)}</span><span class="fc-more">: `), `${g.name} in the legend`);
  }
  assert.ok(slide.includes('Keep<span class="sr-only"> when</span></h3>') && slide.includes('Delete<span class="sr-only"> when any of these is true</span></h3>'), 'the two heads, as the guide reads them');
  const data = JSON.parse(slide.match(/<script type="application\/json" class="fc-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.length, fc.cards.length);
  data.forEach((c, i) => {
    const want = fc.cards[i];
    assert.equal(c.kicker, [typeDisplay(want.type), want.subtype].filter(Boolean).join(' · '), 'the type over the title, as Content Sort writes it');
    assert.deepEqual([c.title, c.source, c.host, c.verdict, c.group, c.why], [want.title, want.source, want.host, want.verdict, want.group, want.why]);
  });
  assert.doesNotMatch(slide.replace(/<script[\s\S]*?<\/script>/g, ''), /Financing the AI Buildout/, 'the cards are data the script draws, not words on the page');
});

test('the flashcard script: Content Sort\'s Keep and Delete, then Right or Not quite, the stamp, the lit group and Next card', () => {
  const script = page.match(/\/\/ ---- Keep or delete, as flashcards[\s\S]*?<\/script>/)?.[0] ?? '';
  assert.ok(script, 'the flashcard script is inline in the page');
  assert.ok(page.indexOf('// ---- The deck:') < page.indexOf('// ---- Keep or delete, as flashcards'), 'after the deck\'s own script');
  assert.match(script, /'primary sc-keep', 'Keep'/, 'Keep, as Content Sort fills it');
  assert.match(script, /'linkish trash-link sc-delete', ' Delete'/, 'Delete, Content Sort\'s red word');
  assert.match(script, /'Keep \(K\)'/);
  assert.match(script, /'Delete \(D\)'/);
  assert.match(script, /'sc-key'/, 'each shows its key');
  assert.match(script, /'Keep or delete\?'/);
  assert.match(script, /'Right' : 'Not quite'/);
  assert.match(script, /'Next card'/);
  assert.match(script, /fc-stamp/);
  assert.match(script, /classList\.toggle\('is-lit'/);
  assert.match(script, /textContent = /, 'card words go in as text, never as markup');
  assert.doesNotMatch(script, /innerHTML/);
});

test('K and D answer only while the flashcard slide is on screen, never while typing or in a dialog, and the arrows stay the deck\'s', () => {
  const script = page.match(/\/\/ ---- Keep or delete, as flashcards[\s\S]*?<\/script>/)?.[0] ?? '';
  assert.match(script, /e\.altKey \|\| e\.ctrlKey \|\| e\.metaKey/);
  assert.match(script, /slide\.classList\.contains\('is-on'\)/, 'only while its slide is up');
  assert.match(script, /onScreen\(\)/, 'and on screen');
  assert.match(script, /input, textarea, select, \[contenteditable\]/, 'never while typing');
  assert.match(script, /dialog\[open\]/, 'not while the How-tos panel is open');
  assert.doesNotMatch(script, /Arrow(Left|Right)|preventDefault\(\);\s*show\(/, 'the deck keeps its arrow keys');
});

test('the two kinds move nothing on their own, so reduced motion holds them still', () => {
  const kinds = page.match(/<style data-kinds>([\s\S]*?)<\/style>/)?.[1] ?? '';
  assert.ok(kinds, 'the kinds\' styles, in a sheet of their own after the newsletter how-to\'s');
  const outside = kinds.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n {4}\}/g, '');
  assert.doesNotMatch(outside, /animation|transition/, 'any motion waits for no-preference');
  assert.doesNotMatch(kinds.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,8}\b|rgba?\(/i, 'tokens only');
});

test('Sources: three tinted bands, the rates in order, a rule for each one to read', () => {
  assert.equal(src.cap, 'How often each was kept, Sep 3 to Oct 20');
  assert.deepEqual(src.bands.map(b => [b.verdict, b.name]), [['keep', 'Usually kept'], ['read', 'Read each one'], ['delete', 'Usually deleted']]);
  const rate = s => s.kept / s.of;
  for (const b of src.bands) {
    for (const s of b.sources) assert.ok(Number.isInteger(s.kept) && Number.isInteger(s.of) && s.kept <= s.of && s.of > 0, `${s.name}: kept of decided`);
    const rates = b.sources.map(rate);
    assert.deepEqual(rates, [...rates].sort((x, y) => y - x), `${b.name}: most kept first`);
  }
  const [kept, mixed, gone] = src.bands.map(b => b.sources.map(rate));
  assert.ok(Math.min(...kept) > Math.max(...mixed) && Math.min(...mixed) > Math.max(...gone), 'the bands do not overlap');
  assert.ok(src.bands[1].sources.every(s => s.rule), 'each one to read says how');
  for (const name of ['CALDER', 'Texas Tribune', 'EdWorkingPapers', 'K-12 Dive', 'NBER', 'Urban Institute', 'Texas Public Radio', 'KUT', 'PBS NewsHour', 'Federal Register', 'WestEd']) {
    assert.ok(src.bands.some(b => b.sources.some(s => s.name === name)), `${name} kept its place`);
  }
  assert.doesNotMatch(JSON.stringify(src), /ECS|Statesman/, 'switched off in the scraper on Oct 22');
});

test('the Sources slide: its line beside the title, a band each with its chips, the sheet in a new tab and Add a source', () => {
  const slide = slideOf('sources');
  assert.ok(slide.length > 0, 'a Sources slide on the page');
  assert.ok(slide.includes(`<p class="cap kind-head">${src.cap}</p>`), 'the line beside the part\'s title');
  for (const b of src.bands) {
    assert.match(slide, new RegExp(`<section class="sb-band is-${b.verdict}"[^>]*>\\s*<h3 class="sb-name"[^>]*><span class="sb-icon">`), `${b.name} is a band`);
    for (const s of b.sources) {
      const name = s.full ? `<abbr title="${esc(s.full)}">${esc(s.name)}</abbr>` : esc(s.name);
      assert.ok(slide.includes(`<li class="sb-chip"><b>${name}</b> <span class="sb-n">${s.kept} of ${s.of}</span>`), `${s.name}'s chip`);
    }
  }
  assert.ok(slide.includes('<a class="sb-sheet" href="https://docs.google.com/spreadsheets/d/19gAAU4OTxGrfYqitBS3Nx9KjfIbE4qW_7C51Lq_pZhw/edit" target="_blank" rel="noopener">Open the sources sheet'), 'the sheet, in a new tab');
  assert.ok(slide.includes(`<a class="sb-add" href="/${SOURCE_FORM_HASH}">`), 'Add a source opens the Content queue\'s form');
  assert.ok(slide.includes('Add a source</a>'));
});

test('the desk guide keeps every rule as words: the six groups with their lines and rules, each band with its sources', () => {
  assert.ok(sortGuide.includes('\n## Keep when\n') && sortGuide.includes('\n## Delete when any of these is true\n'), 'the two heads');
  for (const g of fc.groups) {
    const line = `- ${g.name}: ${lower(g.line)}. ${g.rules.map(plain).join(' ')}`;
    assert.ok(sortGuide.includes(line), `${g.name}, its line and its rules, on one line:\n${line}`);
  }
  assert.ok(sortGuide.includes(plain(fc.cap)), 'the caption, with how often each kind is kept');
  assert.ok(sortGuide.includes(`\n${src.cap}\n`), 'what the rates are');
  for (const b of src.bands) {
    assert.ok(sortGuide.includes(`\n## ${b.name}\n`), `${b.name} as a head`);
    for (const s of b.sources) {
      const line = `- ${s.name}${s.full ? ` (${s.full})` : ''} ${s.kept} of ${s.of}${s.rule ? ` · ${s.rule}` : ''}`;
      assert.ok(sortGuide.split('\n').includes(line), `the guide lists ${line}`);
    }
  }
  assert.ok(sortGuide.includes('Open the sources sheet (https://docs.google.com/spreadsheets/d/19gAAU4OTxGrfYqitBS3Nx9KjfIbE4qW_7C51Lq_pZhw/edit)'));
  assert.ok(sortGuide.includes('Add a source (https://erc-content-desk.vercel.app/#queue/add-source)'));
  assert.doesNotMatch(sortGuide, /Keep or delete\?|Next card|KeepK|DeleteD/, 'the flashcards\' buttons are not words to read');
});

test('/#queue/add-source opens the Content queue with Add a source open, read once as the page opens', () => {
  assert.equal(SOURCE_FORM_HASH, '#queue/add-source');
  assert.equal(openedScreen(SOURCE_FORM_HASH), 'queue');
  assert.equal(opensSourceForm('#queue/add-source'), true);
  for (const other of ['#queue', '', null, '#sort', '#queue/add-sourcex']) assert.equal(opensSourceForm(other), false, String(other));
  const app = read('js/app.js');
  assert.match(app, /if \(opensSourceForm\(location\.hash\)\) openSourceForm\(\);\nconst openedAt = openedScreen\(location\.hash\);/, 'read as the page opens, before the first paint, which writes #queue back');
  assert.match(app, /const asked = opensSourceForm\(location\.hash\);\n\s+if \(asked\) \{ openSourceForm\(\); history\.replaceState\(null, '', screenHash\('queue'\)\); \}/, 'a link followed later opens it too, and the address goes back to #queue');
  assert.match(app, /else if \(asked\) render\(\);/, 'already on the queue, it draws the form');
  const ui = read('js/queue-ui.js');
  assert.match(ui, /export function openSourceForm\(\) \{\n\s+source = \{ open: true, answer: null \};\n\s+sourcePanel = null;\n\s+focusName = true;\n\s+revealForm = true;\n\}/);
  assert.match(ui, /if \(focusName\) \{\n\s+focusName = false;\n\s+sourcePanel\.querySelector\('#qs-name'\)\?\.focus\(\{ preventScroll: true \}\);/, 'its Name field focused as it draws');
  assert.match(ui, /sourcePanel\.scrollIntoView\(\{ block: 'nearest' \}\);/, 'the form brought into view');
  assert.match(ui, /if \(loadFailed\) revealSourceForm\(\);/, 'once the rows are in, or could not be read');
  assert.match(ui, /list\.replaceChildren\(\.\.\.\(shown\.length[^\n]*\n  revealSourceForm\(\);\n\}/, 'after the list, when the page has its height');
});

test('the form opened from its address takes focus every way it opens: its slot shows first, and after a screen switch Name takes focus back from the heading', () => {
  const ui = read('js/queue-ui.js');
  const draw = ui.slice(ui.indexOf('function drawScraper'), ui.indexOf('export function renderQueue'));
  const shows = draw.indexOf('slot.hidden = !slot.firstChild;');
  const focuses = draw.indexOf("sourcePanel.querySelector('#qs-name')?.focus({ preventScroll: true });");
  assert.ok(shows > 0 && focuses > shows, 'a field in a hidden slot cannot take focus, so the slot shows before Name is focused (a link followed on the queue left it in the body)');
  const app = read('js/app.js');
  const from = app.indexOf("window.addEventListener('hashchange'");
  const onHash = app.slice(from, app.indexOf('\n});', from));
  assert.match(onHash, /else if \(asked\) render\(\);\n\s+\/\/[^\n]*\n\s+if \(asked\) document\.getElementById\('qs-name'\)\?\.focus\(\{ preventScroll: true \}\);$/, 'a link followed from another page switches screens, whose heading takes focus; Name takes it back');
});

test('a rule\'s dot sits centered between the count and the rule, as layout D draws it', () => {
  const kinds = page.match(/<style data-kinds>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const chipGap = kinds.match(/\.sb-chip \{[^}]*column-gap: (var\(--spacing-\d\d\))/)?.[1];
  assert.ok(chipGap, 'the chip spaces its parts by a gap');
  const esc = s => s.replace(/[()]/g, '\\$&');
  assert.match(kinds, new RegExp(`\\.sb-rule \\{[^}]*display: inline-flex;[^}]*gap: ${esc(chipGap)}`), 'the dot and the rule by the chip\'s own gap, not a bare space after a wider gap (the dot read lopsided, hugging the rule)');
});

// The scraper slide's pins (the owner, Oct 25): pins 1 and 2 sat on the
// buttons' words in the still ("Run th(1)craper", "Add a(2)ource"), and 3 on
// the last run's words. capture.mjs now sets a pin at its control's top right
// corner or just beside it, and the slide's pins are the capture's.
import { pinPoint } from '../how-to/pin-point.mjs';

test('pinPoint: the middle by default, 10px in from the left, the top right corner, or just outside the left edge', () => {
  const box = { x: 100, y: 200, width: 160, height: 40 };
  assert.deepEqual(pinPoint(box), { x: 180, y: 220 });
  assert.deepEqual(pinPoint(box, 'left'), { x: 110, y: 220 }, 'as before');
  assert.deepEqual(pinPoint(box, 'corner'), { x: 260, y: 200 });
  assert.deepEqual(pinPoint(box, 'before'), { x: 82, y: 220 });
  assert.match(read('how-to/capture.mjs'), /import \{ pinPoint \} from '\.\/pin-point\.mjs';/, 'the capture places its pins by it');
});

test('the scraper slide pins its two buttons at their corners and the last run beside its words', () => {
  const shot = JSON.parse(read('how-to/sort/shots.json')).find(s => s.name === 'scraper');
  assert.deepEqual(shot.pins.map(p => p.at), ['corner', 'corner', 'before']);
  const m = JSON.parse(read('how-to/sort/shots/scraper.json'));
  assert.deepEqual(m.pins.map(p => p.label), shot.pins.map(p => p.label));
  const [run, add, last] = m.pins;
  assert.ok(run.y < last.y && add.y === run.y, 'the buttons\' corners share a line above the last run');
  assert.ok(last.x < 5, 'the last run\'s pin sits at the left of its words');
  const html = read('how-to/sort/index.html');
  const slide = html.slice(html.indexOf('src="shots/scraper.png"'));
  const pins = [...slide.matchAll(/class="pin(?: up)?" style="--x:(-?[\d.]+);--y:(-?[\d.]+)" aria-label="([^"]*)"/g)].slice(0, 3);
  assert.deepEqual(pins.map(p => [+p[1], +p[2]]), m.pins.map(p => [p.x, p.y]), 'the built slide carries the capture\'s pins');
});
