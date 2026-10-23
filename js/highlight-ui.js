/**
 * The highlight step on Publish (Kate, Sep 23; her pick A): what the
 * Exchange's home page shows now on the left, what it will show once this
 * publish lands on the right, with the order and the photos set there, and
 * under the two a table of everything that could go in. The picks belong to
 * highlight-page.js; this draws them and hands changes back through onChange.
 *
 * Slot by slot since Oct 23 (Kate, Oct 23, her pick C): the two sides share
 * one box, a row a place on the card, the site's pin on the left and her pick
 * on the right, so a change reads across the row and wears a Changed tag.
 */
import { faIcon, busyWords } from './icons.js';
import { buildImageControl } from './item-image.js';
import { typeDisplay } from './schema.js';
import { isoToShort } from './queue-view.js';
import { SUMMARY_MAX, TITLE_MAX, wantsCardWords } from './card-words.js';
import { MAX_PICKS, LIVE_PER_SECTION, bandAfter, addPick, removePick, movePick, setPhoto, setCardWords, setUntil, candidates, whenLine, sectionFilters, filterCandidates, trimLive, searchCandidates, slotRows } from './highlight-view.js';
import { el, button } from './ui-aids.js';

// The Pick from table's filter and search (Kate, Sep 23: "so we can find
// events quickly"; the whole list "is a lot"), kept for the visit. View state only.
let sectionFilter = 'all';
let searchTerm = '';
// The pick whose card words are open for editing (Kate, Sep 30). View state only.
let editingCard = '';

/** The card's words as the card draws them: *stars* round a name become italics. */
function markStars(text) {
  const frag = document.createDocumentFragment();
  const parts = String(text ?? '').split(/\*([^*\n]+)\*/);
  parts.forEach((part, i) => { if (part) frag.append(i % 2 ? el('em', '', part) : document.createTextNode(part)); });
  return frag;
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const PHOTO_WORDS = { add: 'Add photo', replace: 'Replace photo', remove: 'Remove photo' };

function metaLine(item, today) {
  return [item.type ? typeDisplay(item.type) : '', whenLine(item, today)].filter(Boolean).join(' · ');
}

/** The picture spot: the photo, or the triangle where one is still missing. */
function photoSpot(photo) {
  if (photo === 'card') return el('span', 'hl-thumb hl-thumb--card');
  if (photo) {
    const img = el('img', 'hl-thumb');
    img.src = photo;
    img.alt = '';
    return img;
  }
  const none = el('span', 'hl-nophoto');
  none.append(faIcon('triangle-exclamation'));
  return none;
}

/** An item on either side of a slot: the picture, the title over its meta
 *  line, and the card's words under them. The slot carries the number. */
function row(item, today, from) {
  const line = el('div', 'hl-row');
  line.append(photoSpot(item.photo));
  const words = el('div', 'hl-words');
  // The card shows the pick's own title where it has one (trimmed to fit).
  const title = el('span', 'hl-title');
  title.append(markStars(item.title || item.headline || item.link));
  words.append(title);
  const meta = el('span', 'hl-meta', metaLine(item, today));
  const add = text => meta.append(document.createTextNode(`${meta.textContent ? ' · ' : ''}${text}`));
  if (from) add(from);
  if (item.until) add(`until ${isoToShort(item.until, today)}`);
  if (!item.photo) meta.append(document.createTextNode(meta.textContent ? ' · ' : ''), el('span', 'hl-warn', 'No photo'));
  words.append(meta);
  line.append(words);
  // The card's words (Kate, Sep 30), where the pick has them: a line of
  // their own under the title.
  if (wantsCardWords(item.type) && item.summary) {
    const card = el('p', 'hl-card');
    card.append(markStars(item.summary));
    line.append(card);
  }
  return line;
}

/** The card's words on a pick in Your picks: the wait while they are
 *  written, the words with Edit once they land, the ask when they did not
 *  come, and the small form while she edits them. */
function cardWordsOn(line, item, { busy, failed, change, ask, current }) {
  const shown = line.querySelector('.hl-card');
  if (editingCard === item.link) {
    shown?.remove();
    const form = el('form', 'hl-card-edit');
    form.noValidate = true;
    const tLabel = el('label', '', 'Card title');
    const tField = el('input');
    tField.type = 'text';
    tField.maxLength = TITLE_MAX;
    tField.value = item.title || item.headline;
    tField.dataset.focus = `hl-card-title:${item.link}`;
    tLabel.append(tField);
    const sLabel = el('label', '', 'Card summary');
    const sField = el('textarea');
    sField.value = item.summary;
    sField.dataset.focus = `hl-card-summary:${item.link}`;
    sLabel.append(sField);
    const count = el('span', 'hl-count');
    const recount = () => { const n = sField.value.trim().length; count.textContent = `${n} of ${SUMMARY_MAX}`; count.classList.toggle('is-over', n > SUMMARY_MAX); };
    sField.addEventListener('input', recount);
    recount();
    const tools = el('div', 'hl-card-tools');
    const save = button('Save', 'linkish', { focus: `hl-card-save:${item.link}` });
    save.type = 'submit';
    tools.append(save, ' \u00b7 ', button('Cancel', 'linkish skip-link', { focus: `hl-edit:${item.link}`, onClick: () => { editingCard = ''; change(current(), true); } }), count);
    form.addEventListener('submit', event => {
      event.preventDefault();
      editingCard = '';
      change(setCardWords(current(), item.link, { title: tField.value, summary: sField.value }), true);
    });
    form.append(tLabel, sLabel, tools);
    line.append(form);
    queueMicrotask(() => sField.focus({ preventScroll: true }));
    return;
  }
  if (busy) {
    const wait = el('p', 'hl-card');
    wait.append(busyWords('Writing the card'));
    line.append(wait);
    return;
  }
  if (item.summary) return;
  // No words yet: they did not come, or the pick was on the Exchange before
  // the desk wrote any. The word asks for them.
  const none = el('p', 'hl-card is-missing');
  none.append(faIcon('triangle-exclamation'), failed ? 'The card words did not come. ' : 'No card words yet. ');
  none.append(button(failed ? 'Try again' : 'Write the card', 'linkish', { focus: `hl-write:${item.link}`, onClick: () => ask([item.link]) }));
  line.append(none);
}

/** A place on the card that Update the highlight would change (Kate, Oct 23,
 *  her pick C): the tag sits after the pick's title, or after Empty. */
function setChanged(host, on) {
  const tag = host.querySelector(':scope > .hl-changed');
  if (on && !tag) host.append(el('span', 'badge badge-new hl-changed', 'Changed'));
  if (!on) tag?.remove();
}

/** A row of the slots box: the number, the site's side, her side. */
function slotRow(n, site, pick, kind = '') {
  const line = el('div', `hl-slot${kind ? ` ${kind}` : ''}`);
  const left = el('div', 'hl-site');
  const right = el('div', 'hl-pick');
  if (site) left.append(site);
  if (pick) right.append(pick);
  line.append(el('span', 'hl-slot-n', n ? String(n) : ''), left, right);
  return line;
}

/** The highlight's own Save (Kate, Oct 6) as the last row of the slots box,
 *  under her picks; null takes it away. highlight-page.js puts it right
 *  without a redraw when a typed day changes the picks. */
export function placeSaveBar(container, bar) {
  const old = container.querySelector('.hl-slot-save');
  if (!bar) { old?.remove(); return; }
  const line = slotRow(0, null, bar, 'hl-slot-save');
  if (old) old.replaceWith(line);
  else container.querySelector('.hl-cols')?.append(line);
}

/**
 * props: { now, cards, adding, hub, picks, today, cardBusy, cardFailed, onChange, onCardWords }
 *   now: the picks as the Exchange holds them (the check's own, described);
 *   cards: the one-off cards made on the Exchange beside them
 *   adding: the desk rows going out; hub: the live rows that can be picked
 *   cardBusy / cardFailed: the links whose card words are being written / did not come
 *   onCardWords(links): ask for the card's words again
 *   saveBar: the highlight's own Save, drawn under the picks when they changed
 */
export function renderHighlights(container, { now, cards = [], adding, hub, picks: drawn, getPicks = null, today, cardBusy = new Set(), cardFailed = new Set(), onChange, onUntil = null, onCardWords, saveBar = null }) {
  // Handlers read the picks as they are when pressed (getPicks), never as they
  // were when drawn: a day typed in a pick's field changes them without a redraw.
  const current = () => (getPicks ? getPicks() : drawn);
  const picks = drawn;
  // Since Oct 23 the Highlight is a page of its own (js/highlight-page.js): the
  // page's title says what it is, so no section head; live picks need no label.
  const ctx = { adding, hub };
  const after = bandAfter(picks, ctx);
  const change = (next, always = false) => { if (always || next !== current()) onChange(next); };

  // One box, slot by slot (Kate, Oct 23, her pick C): a row a place on the
  // card, what the home page shows this minute on the left, her picks in her
  // order on the right until she saves them. It keeps the name hl-cols, which
  // the how-to's screenshots look for.
  const cols = el('div', 'hl-box hl-cols');
  const pickHead = el('h4', '', 'Your picks');
  pickHead.append(el('span', 'hl-note', `${after.length} of ${MAX_PICKS}`));
  cols.append(slotRow(0, el('h4', '', 'On the site now'), pickHead, 'hl-slot-head'));

  const slots = slotRows(now, after);
  slots.forEach(({ n, site, pick: item, changed }, i) => {
    // An empty place on the site; with no pins at all the site shows its own feed.
    const siteSide = site ? row(site, today)
      : el('p', 'hl-slot-empty', i === 0 && !now.length && !cards.length ? 'No picks: the site shows its own feed.' : 'Empty');
    if (!item) {
      const none = el('p', 'hl-slot-empty', 'Empty');
      setChanged(none, changed);
      cols.append(slotRow(n, siteSide, none));
      return;
    }
    const line = row(item, today, item.from === 'missing' ? 'no longer on the site' : '');
    if (item.cardWords) cardWordsOn(line, item, { busy: cardBusy.has(item.link), failed: cardFailed.has(item.link), change, ask: onCardWords, current });
    const title = line.querySelector('.hl-title');
    setChanged(title, changed);
    const tools = el('div', 'hl-tools');
    if (item.cardWords && item.summary && editingCard !== item.link && !cardBusy.has(item.link)) {
      tools.append(button(' Edit', 'linkish edit-link', { focus: `hl-edit:${item.link}`, icon: 'pen', onClick: () => { editingCard = item.link; change(current(), true); } }));
    }
    // Her photo for this pick; the row's own shows when she has none.
    const control = buildImageControl(item.image, value => change(setPhoto(current(), item.link, value)),
      { words: { ...PHOTO_WORDS, add: item.photo ? 'Replace photo' : 'Add photo' } });
    tools.append(control.el);
    // The day it drops off the card (Kate, Oct 23): shown and set here. A typed
    // day redraws nothing, so its slot's tag is put right here.
    const dayLabel = el('label', 'hl-until');
    dayLabel.append(el('span', '', 'Until'));
    const day = el('input');
    day.type = 'date';
    day.value = item.until;
    day.min = today;
    day.dataset.focus = `hl-until:${item.link}`;
    day.addEventListener('change', () => {
      if (!onUntil) { change(setUntil(current(), item.link, day.value)); return; }
      onUntil(item.link, day.value);
      setChanged(title, slotRows(now, current())[i]?.changed ?? true);
    });
    dayLabel.append(day);
    tools.append(dayLabel);
    const up = button('', 'hl-arrow', { focus: `hl-up:${item.link}`, icon: 'chevron-up', onClick: () => change(movePick(current(), item.link, -1)) });
    up.setAttribute('aria-label', 'Move up');
    up.disabled = i === 0;
    const down = button('', 'hl-arrow', { focus: `hl-down:${item.link}`, icon: 'chevron-down', onClick: () => change(movePick(current(), item.link, 1)) });
    down.setAttribute('aria-label', 'Move down');
    down.disabled = i === after.length - 1;
    // The order and Remove travel as one group at the line's right end, so a
    // narrow line wraps them together.
    const end = el('span', 'hl-tools-end');
    end.append(up, down, button('Remove', 'linkish skip-link', { focus: `hl-out:${item.link}`, onClick: () => change(removePick(current(), item.link)) }));
    tools.append(end);
    // The tools on their own line, last, under the title and the card's words.
    line.append(tools);
    cols.append(slotRow(n, siteSide, line));
  });
  if (!slots.length) cols.append(slotRow(0, el('p', 'hl-slot-empty', cards.length ? 'No picks.' : 'No picks: the site shows its own feed.'), el('p', 'hl-slot-empty', 'Nothing picked.')));
  // The one-off cards made on the Exchange's own door sit after the pins, and
  // stay whatever she picks.
  cards.forEach((card, i) => cols.append(slotRow(0,
    row({ headline: card.headline, until: card.until, photo: 'card', cardWords: false }, today, `${card.label} card, made on the Exchange`),
    i === 0 ? el('p', 'hl-empty', `Plus ${cards.length} card${cards.length === 1 ? '' : 's'} made on the Exchange.`) : null,
    'hl-slot-card')));
  container.append(cols);
  // The highlight's own Save sits right under the picks (Kate, Oct 6).
  if (saveBar) placeSaveBar(container, saveBar);

  container.append(pickFrom());

  // Everything that could go in: the rows going out now, then the newest few
  // live rows of each section (Kate, Sep 23: the whole list "is a lot"), one
  // section at a time when she asks (the legend's own filter idiom), and a
  // search that reaches every row. Filter and search redraw the rows alone,
  // so the picks above and the keyboard's place hold still.
  function pickFrom() {
    const from = el('div', 'hl-from');
    const head = el('div', 'hl-from-head');
    head.append(el('h4', 'hl-from-label', 'Pick from'));
    const label = el('label', 'sr-only', 'Search by title or source');
    label.htmlFor = 'hl-search';
    const search = el('input', 'hl-search');
    search.type = 'search';
    search.id = 'hl-search';
    search.placeholder = 'Search';
    search.value = searchTerm;
    search.dataset.focus = 'hl-search';
    search.addEventListener('input', () => { searchTerm = search.value; redraw(); });
    head.append(label, search);
    from.append(head);
    const all = candidates(ctx);
    const filters = el('div', 'p-legend hl-filters');
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Section');
    from.append(filters);
    const table = el('table', 'queue-table hl-table');
    const thead = el('thead');
    const hr = el('tr');
    hr.append(el('th', '', 'Title'), el('th', '', 'Section'), el('th', '', 'Photo'), el('th', 'hl-act', ''));
    thead.append(hr);
    const tbody = el('tbody');
    table.append(thead, tbody);
    const scroll = el('div', 'table-scroll');
    scroll.append(table);
    const foot = el('p', 'hl-from-note');
    from.append(scroll, foot);
    const at = new Map(picks.map((p, i) => [p.link, i]));

    function redraw() {
      // The rows in reach: everything, when she is searching; the newest few
      // a section otherwise.
      const term = searchTerm.trim();
      const reach = term ? searchCandidates(all, term) : trimLive(all);
      filters.replaceChildren(...sectionFilters(reach).map(f => {
        const b = el('button', `p-legend-item${sectionFilter === f.key ? ' is-active' : ''}`);
        b.type = 'button';
        b.dataset.focus = `hl-filter:${f.key}`;
        b.setAttribute('aria-pressed', String(sectionFilter === f.key));
        b.append(f.label, el('span', 'hl-filter-count', String(f.count)));
        b.addEventListener('click', () => { sectionFilter = f.key; redraw(); from.querySelector(`[data-focus="hl-filter:${f.key}"]`)?.focus({ preventScroll: true }); });
        return b;
      }));
      const shown = filterCandidates(reach, sectionFilter);
      tbody.replaceChildren(...shown.map(item => {
        const tr = el('tr');
        const title = el('td');
        title.append(el('span', 'item-title', item.headline || item.link));
        const line = [item.from === 'adding' ? 'Adding now' : 'Live', whenLine(item, today), item.source].filter(Boolean).join(' \u00b7 ');
        title.append(el('span', 'item-source', line));
        tr.append(title, el('td', '', item.type ? typeDisplay(item.type) : ''), el('td', '', item.photo ? 'Yes' : 'None'));
        const act = el('td', 'hl-act');
        if (at.has(item.link)) act.append(el('span', 'hl-in', `In, ${ORDINAL[at.get(item.link)]}`));
        else {
          const add = button('Highlight', 'linkish', { focus: `hl-in:${item.link}`, onClick: () => change(addPick(current(), item.link)) });
          if (picks.length >= MAX_PICKS) { add.disabled = true; add.title = 'Six is the most'; }
          act.append(add);
        }
        tr.append(act);
        return tr;
      }));
      if (!shown.length) {
        const tr = el('tr');
        const td = el('td', 'hl-none', term ? 'Nothing matches.' : 'Nothing in this section.');
        td.colSpan = 4;
        tr.append(td);
        tbody.append(tr);
      }
      const hidden = all.length - reach.length;
      foot.textContent = !term && hidden > 0 ? `Search to find ${hidden} older.` : '';
    }
    redraw();
    return from;
  }
}
