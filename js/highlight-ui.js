/**
 * The highlight step on Publish (Kate, Sep 23; her pick A): what the
 * Exchange's home page shows now on the left, what it will show once this
 * publish lands on the right, with the order and the photos set there, and
 * under the two a table of everything that could go in. The picks belong to
 * publish-ui.js; this draws them and hands changes back through onChange.
 */
import { faIcon } from './icons.js';
import { buildImageControl } from './item-image.js';
import { typeDisplay } from './schema.js';
import { MAX_PICKS, LIVE_PER_SECTION, bandAfter, addPick, removePick, movePick, setPhoto, candidates, whenLine, sectionFilters, filterCandidates, trimLive, searchCandidates } from './highlight-view.js';
import { el, button } from './ui-aids.js';

// The Pick from table's filter and search (Kate, Sep 23: "so we can find
// events quickly"; the whole list "is a lot"), kept for the visit. View state only.
let sectionFilter = 'all';
let searchTerm = '';

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const PHOTO_WORDS = { add: 'Add photo', replace: 'Replace photo', remove: 'Remove photo' };

function metaLine(item, today) {
  return [item.type ? typeDisplay(item.type) : '', whenLine(item, today)].filter(Boolean).join(' · ');
}

/** The picture spot: the photo, or the triangle where one is still missing. */
function photoSpot(photo) {
  if (photo) {
    const img = el('img', 'hl-thumb');
    img.src = photo;
    img.alt = '';
    return img;
  }
  const none = el('span', 'hl-nophoto');
  none.title = 'No photo';
  none.append(faIcon('triangle-exclamation'));
  return none;
}

function row(item, n, today, from) {
  const li = el('li', 'hl-row');
  li.append(el('span', 'hl-num', String(n)), photoSpot(item.photo));
  const words = el('div', 'hl-words');
  words.append(el('span', 'hl-title', item.headline || item.link));
  const meta = el('span', 'hl-meta', metaLine(item, today));
  if (from) meta.append(document.createTextNode(`${meta.textContent ? ' · ' : ''}${from}`));
  if (!item.photo) meta.append(document.createTextNode(meta.textContent ? ' · ' : ''), el('span', 'hl-warn', 'No photo'));
  words.append(meta);
  li.append(words);
  return li;
}

function box(title, note) {
  const wrap = el('div', 'hl-box');
  const head = el('h4', '', title);
  if (note) head.append(el('span', 'hl-note', note));
  wrap.append(head);
  return wrap;
}

/**
 * props: { now, adding, hub, picks, today, onChange }
 *   now: the picks as the Exchange holds them (the check's own, described)
 *   adding: the desk rows going out; hub: the live rows that can be picked
 */
export function renderHighlights(container, { now, adding, hub, picks, today, onChange }) {
  const ctx = { adding, hub };
  const after = bandAfter(picks, ctx);
  const change = next => { if (next !== picks) onChange(next); };

  const head = el('div', 'section-head hl-head');
  head.append(el('h3', 'section-label', 'Highlight'), el('span', 'section-note', 'Up to 6 · each needs a photo'));
  container.append(head);

  const cols = el('div', 'hl-cols');

  // Left: what the home page shows this minute.
  const nowBox = box('Now');
  if (!now.length) nowBox.append(el('p', 'hl-empty', 'No picks yet.'));
  else {
    const list = el('ol', 'hl-list');
    now.forEach((item, i) => list.append(row(item, i + 1, today)));
    nowBox.append(list);
  }
  cols.append(nowBox);

  // Right: what it will show once this publish lands, in her order.
  const afterBox = box('After this publish', `${after.length} of ${MAX_PICKS}`);
  if (!after.length) afterBox.append(el('p', 'hl-empty', 'Nothing picked.'));
  else {
    const list = el('ol', 'hl-list');
    after.forEach((item, i) => {
      const li = row(item, i + 1, today, item.from === 'adding' ? 'adding now' : item.from === 'live' ? 'live' : 'no longer on the site');
      const tools = el('div', 'hl-tools');
      // Her photo for this pick; the row's own shows when she has none.
      const control = buildImageControl(item.image, value => change(setPhoto(picks, item.link, value)),
        { words: { ...PHOTO_WORDS, add: item.photo ? 'Replace photo' : 'Add photo' } });
      tools.append(control.el);
      const up = button('', 'hl-arrow', { focus: `hl-up:${item.link}`, icon: 'chevron-up', onClick: () => change(movePick(picks, item.link, -1)) });
      up.setAttribute('aria-label', 'Move up');
      up.disabled = i === 0;
      const down = button('', 'hl-arrow', { focus: `hl-down:${item.link}`, icon: 'chevron-down', onClick: () => change(movePick(picks, item.link, 1)) });
      down.setAttribute('aria-label', 'Move down');
      down.disabled = i === after.length - 1;
      tools.append(up, down, button('Remove', 'linkish skip-link', { focus: `hl-out:${item.link}`, onClick: () => change(removePick(picks, item.link)) }));
      li.append(tools);
      list.append(li);
    });
    afterBox.append(list);
  }
  cols.append(afterBox);
  container.append(cols);

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
          const add = button('Highlight', 'linkish', { focus: `hl-in:${item.link}`, onClick: () => change(addPick(picks, item.link)) });
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
      foot.textContent = !term && hidden > 0 ? `Newest ${LIVE_PER_SECTION} a section. Search for the ${hidden} older.` : '';
    }
    redraw();
    return from;
  }
}
