/**
 * The Content queue hub (Kate's drawn map, Oct 6, 2026): everything ever
 * submitted, newest first, each saying where it stands now, with a search by
 * title or source; outside submissions tagged From outside, never with a
 * name or an email (the page is open). Content Sort hangs under it, behind
 * the password: its door sits at the page's right with how many wait. The
 * page is built once and only the list redraws, so the search keeps its
 * typing. Since Oct 8 it opens on what came in since the last issue went
 * out, with Everything as a second tab (Kate: "the queue has too many
 * items"; her pick of a second tab). Since Oct 19 the scraper's block sits
 * under the Sort door (Kate: "a button that will run the scraper"): Run the
 * scraper starts a run on GitHub, the line under it says what the last run
 * found and opens the files in Drive, and while a run is on the button goes
 * and the line shimmers. Open, like the page: counts and a folder only.
 * Since Oct 24 (the owner's pick "feeds run on their own") Add a source sits
 * beside it: a short form, the name, the address, what kind and what it
 * posts; the desk looks for the feed, writes a row to the Scraper sources
 * Sheet and says what happened in plain words.
 */
import { contentQueue, lastIssueSent, isoToShort, scraperStatus, sourceAnswer, sourceFormProblem, SOURCE_KINDS, SOURCE_TYPES } from './queue-view.js';
import { tabBar } from './page-head.js';
import { sortList } from './sort-view.js';
import { finalizeWaiting } from './finalize-view.js';
import { hubHead, HUB_LEDES } from './hub-head.js';
import { faIcon } from './icons.js';
import { el, button, busyLine, tryAgain, focusKeyIn, restoreFocus } from './ui-aids.js';

let term = '';   // the search, for the visit
let tab = 'since';   // the open tab, for the visit: since the last issue, or all
// Add a source, for the visit: whether its form is open, and the answer to
// the last one added. The open form is kept across redraws, so typing survives.
let source = { open: false, answer: null };
let sourcePanel = null;
let lastDraw = null;   // the block's last draw, so the form's own redraws use the newest status

const WHERE_CLASS = { Waiting: 'badge badge-waiting', Kept: 'badge', 'On the Exchange': 'badge badge-live' };
const whereClass = word => WHERE_CLASS[word] ?? 'badge badge-new';   // In the <date> issue

function queueRow(entry) {
  const row = el('div', 'qh-row');
  const words = el('div', 'qh-words');
  const title = el('div', 'qh-title', entry.title);
  if (entry.outside) title.append(' ', el('span', 'badge badge-new qh-outside', 'From outside'));
  words.append(title, el('div', 'qh-meta', entry.meta));
  const where = el('div', 'qh-where');
  for (const word of entry.where) where.append(el('span', whereClass(word), word));
  row.append(words, where);
  return row;
}

function build(container, onGoTo) {
  const page = el('div', 'queue-hub');
  const split = el('div', 'qh-split');
  const main = el('div', 'qh-main');
  const bar = el('div', 'qh-bar');
  const count = el('span', 'qh-count');
  count.setAttribute('role', 'status');
  const search = el('input', 'qh-search');
  search.type = 'search';
  search.placeholder = 'Search by title or source';
  search.setAttribute('aria-label', 'Search the queue by title or source');
  search.value = term;
  bar.append(count, search);
  main.append(bar, el('div', 'qh-list'));

  const side = el('aside', 'qh-side');
  const door = el('a', 'sort-door qh-door');
  door.href = '/#sort';
  door.addEventListener('click', event => { event.preventDefault(); onGoTo('sort'); });
  const doorWords = el('span', 'door-words');
  doorWords.append(el('span', 'door-name', 'Content Sort'), el('span', 'door-note'));
  door.append(faIcon('lock'), doorWords, faIcon('arrow-right'));
  const scraperBox = el('div', 'qh-scraper');
  scraperBox.append(el('h3', 'section-label hub-label', 'Scraper'), el('div', 'qh-scraper-body'));
  side.append(door, el('p', 'qh-side-note', 'Password protected.'), scraperBox);

  split.append(main, side);
  page.append(hubHead('Content queue', HUB_LEDES.queue), el('div', 'qh-tabs'), split);
  container.replaceChildren(page);
  return page;
}

/** The form, built once per opening. On Add it says what it is waiting on,
 *  then hands the answer to the block, or keeps itself and what was typed
 *  with the desk's refusal under the button. */
function sourceForm(box, onAddSource, redraw) {
  const form = el('form', 'qh-source');
  form.noValidate = true;
  form.setAttribute('aria-label', 'Add a source');
  const field = (id, label, input) => {
    const wrap = el('div', 'qh-source-field');
    const words = el('label', '', label);
    words.htmlFor = id;
    input.id = id;
    wrap.append(words, input);
    return wrap;
  };
  const name = el('input');
  name.type = 'text';
  name.autocomplete = 'off';
  name.maxLength = 80;
  const address = el('input');
  address.type = 'url';
  address.autocomplete = 'off';
  address.spellcheck = false;
  address.placeholder = 'https://';
  const kinds = el('fieldset', 'qh-source-kind');
  kinds.append(el('legend', '', 'What kind'));
  for (const kind of SOURCE_KINDS) {
    const option = el('label', 'check');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'qs-kind';
    radio.value = kind.key;
    radio.checked = kind.key === 'feed';
    option.append(radio, kind.label);
    kinds.append(option);
  }
  const hint = el('p', 'qh-source-hint', 'Pick Email newsletter for one that only arrives by email.');
  hint.id = 'qs-kind-hint';
  kinds.setAttribute('aria-describedby', hint.id);
  kinds.append(hint);
  const type = el('select');
  type.append(new Option('Pick one', ''), ...SOURCE_TYPES.map(t => new Option(t.label, t.key)));
  const foot = el('div', 'qh-source-foot');
  const add = el('button', 'primary', 'Add the source');
  add.type = 'submit';
  add.dataset.focus = 'source-add';
  const cancel = button('Cancel', 'btn-outline', { focus: 'source-cancel', onClick: () => close() });
  foot.append(add, cancel);
  const status = el('div', 'qh-source-status');
  form.append(field('qs-name', 'Name', name), field('qs-address', 'Address', address), kinds, field('qs-type', 'What it posts', type), foot, status);

  const inputs = [name, address, type, ...kinds.querySelectorAll('input')];
  const FIELDS = { name, address, type, kind: kinds.querySelector('input:checked') ?? name };
  const clearMarks = () => {
    for (const node of [name, address, type]) { node.classList.remove('is-invalid'); node.removeAttribute('aria-invalid'); node.removeAttribute('aria-describedby'); }
  };
  const refuse = (problem, fieldKey) => {
    clearMarks();
    const line = el('p', 'field-error qh-source-error', problem);
    line.id = 'qs-error';
    line.setAttribute('role', 'alert');
    status.replaceChildren(line);
    const target = FIELDS[fieldKey] ?? address;
    if (target !== FIELDS.kind) {
      target.classList.add('is-invalid');
      target.setAttribute('aria-invalid', 'true');
      target.setAttribute('aria-describedby', line.id);
    }
    target.focus();
  };
  const close = () => {
    source = { open: false, answer: source.answer };
    sourcePanel = null;
    redraw();
    box.querySelector('[data-focus="add-source"]')?.focus();
  };
  form.addEventListener('input', event => {
    if (event.target.classList?.contains('is-invalid')) { event.target.classList.remove('is-invalid'); event.target.removeAttribute('aria-invalid'); }
  });
  form.addEventListener('keydown', event => { if (event.key === 'Escape' && !foot.hidden) { event.preventDefault(); close(); } });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const kind = kinds.querySelector('input:checked')?.value ?? 'feed';
    const fields = { name: name.value, address: address.value, type: type.value, kind };
    const missing = sourceFormProblem(fields);
    if (missing) { refuse(missing.problem, missing.field); return; }
    clearMarks();
    // In flight the buttons go and the wait says what it is; nothing can be pressed twice.
    foot.hidden = true;
    for (const node of inputs) node.disabled = true;
    status.replaceChildren(busyLine(kind === 'email' ? 'Saving it' : 'Looking for its feed'));
    let reply;
    try {
      reply = await onAddSource(fields);
    } catch (err) {
      reply = { ok: false, error: err instanceof TypeError ? "Couldn't reach the server. Check your connection." : err.message };
    }
    for (const node of inputs) node.disabled = false;
    foot.hidden = false;
    const answer = reply?.ok ? sourceAnswer(reply.outcome) : null;
    if (!answer) { refuse(reply?.error || "Couldn't add it. Try again in a minute.", reply?.field); return; }
    source = { open: false, answer };
    sourcePanel = null;
    redraw();
    box.querySelector('.qh-source-answer')?.focus({ preventScroll: true });
  });
  return form;
}

/** The answer to the last source added: a note that stays for the visit. */
function sourceNote(answer) {
  const note = el('div', `qh-source-answer is-${answer.tone}`);
  note.setAttribute('role', 'status');
  note.tabIndex = -1;
  note.append(faIcon(answer.tone === 'success' ? 'circle-check' : 'circle-info'), el('span', '', answer.words));
  return note;
}

/** The scraper's block from its status: the buttons (Run the scraper while a
 *  run can start, and Add a source), the form or its answer, then the line,
 *  shimmering while one is on, with the Drive folder. The block is laid out
 *  once; a redraw rebuilds the buttons and the line and leaves an open form
 *  where it is, so typing and the keyboard's place survive. */
function drawScraper(box, s, onRunScraper, onAddSource) {
  if (!box.querySelector('.qh-scraper-actions')) box.replaceChildren(el('div', 'qh-scraper-actions'), el('div', 'qh-source-slot'), el('div', 'qh-scraper-status'));
  const actions = box.querySelector('.qh-scraper-actions');
  const slot = box.querySelector('.qh-source-slot');
  const statusBox = box.querySelector('.qh-scraper-status');
  lastDraw = { box, s, onRunScraper, onAddSource };
  const redraw = () => drawScraper(lastDraw.box, lastDraw.s, lastDraw.onRunScraper, lastDraw.onAddSource);
  const focusKey = focusKeyIn(actions);
  actions.replaceChildren();
  if (s.button) {
    actions.append(button('Run the scraper', 'btn-outline', {
      focus: 'run-scraper',
      onClick: event => { event.currentTarget.disabled = true; onRunScraper?.(); },
    }));
  }
  if (!source.open) actions.append(button('Add a source', 'btn-outline', {
    focus: 'add-source',
    onClick: () => { source = { open: true, answer: null }; redraw(); sourcePanel?.querySelector('#qs-name')?.focus(); },
  }));
  if (focusKey !== null) restoreFocus(actions, focusKey, null);
  if (source.open) {
    sourcePanel ??= sourceForm(box, onAddSource, redraw);
    if (slot.firstChild !== sourcePanel) slot.replaceChildren(sourcePanel);
  } else if (source.answer) {
    if (!slot.querySelector('.qh-source-answer')) slot.replaceChildren(sourceNote(source.answer));
  } else slot.replaceChildren();
  slot.hidden = !slot.firstChild;

  const kids = [];
  const line = s.state === 'checking' ? busyLine(s.line)
    : s.state === 'running' ? busyLine(s.line)
      : el('p', `qh-scraper-line${s.state === 'failed' || s.state === 'error' ? ' is-warn' : ''}`, s.line);
  if (s.link) {
    const open = el('a', 'qh-scraper-link', s.link.label);
    open.href = s.link.href;
    open.target = '_blank';
    open.rel = 'noopener';
    line.append(' ', open);
    if (s.files) {
      const folder = el('a', 'qh-scraper-link', s.files.label);
      folder.href = s.files.href;
      folder.target = '_blank';
      folder.rel = 'noopener';
      line.append(' · ', folder);
    }
  }
  kids.push(line);
  // The haul waits in Drive until someone drops it in (review, Oct 23).
  if (s.state !== 'off') {
    const how = el('p', 'qh-scraper-line qh-scraper-how', 'Nothing goes in by itself. Drop the files you want on ');
    const door = el('a', '', 'Add a doc or spreadsheet');
    door.href = '/#team';
    how.append(door, ', on Submit content.');
    kids.push(how);
  }
  statusBox.replaceChildren(...kids);
}

export function renderQueue(container, props) {
  const { rows, schedule, today, loaded, loadFailed, onGoTo, onRefresh, scraper, onRunScraper, onAddSource } = props;
  const page = container.querySelector('.queue-hub') ?? build(container, onGoTo);
  drawScraper(page.querySelector('.qh-scraper-body'), scraperStatus(scraper, today), onRunScraper, onAddSource);
  const list = page.querySelector('.qh-list');
  const count = page.querySelector('.qh-count');
  const search = page.querySelector('.qh-search');
  const note = page.querySelector('.qh-door .door-note');
  const tabs = page.querySelector('.qh-tabs');
  // Typing redraws the list alone, from the rows this draw was handed.
  search.oninput = () => { term = search.value; renderQueue(container, props); };

  if (!loaded) {
    count.textContent = '';
    note.textContent = '';
    tabs.replaceChildren();
    list.replaceChildren(loadFailed ? tryAgain(onRefresh) : busyLine('Loading the queue'));
    return;
  }
  const waiting = sortList(rows).live.length;
  // Finalize waits behind the same door (review, Oct 23): its count rides the note.
  const finalizing = finalizeWaiting(rows, props.verified ?? new Set());
  note.textContent = [waiting ? `${waiting} waiting` : 'Nothing waiting', finalizing ? `${finalizing} to finalize` : ''].filter(Boolean).join(' · ');
  // The last issue that went out sets the first tab's cutoff; with none yet, both tabs hold everything.
  const since = lastIssueSent(schedule, today);
  const all = contentQueue(rows, { today });
  const fresh = since ? contentQueue(rows, { today, since }) : all;
  tabs.replaceChildren(tabBar({
    label: 'Content queue', active: tab,
    tabs: [{ key: 'since', label: 'Since the last issue', count: fresh.length }, { key: 'all', label: 'Everything', count: all.length }],
    note: since ? `Last issue: ${isoToShort(since, today)}` : '',
    onGoTo: key => { tab = key; renderQueue(container, props); tabs.querySelector('[aria-selected="true"]')?.focus(); },
  }));
  const listed = tab === 'since' ? fresh : all;
  const shownSince = tab === 'since' ? since : '';
  const shown = term.trim() ? contentQueue(rows, { today, since: shownSince, term }) : listed;
  count.textContent = term.trim()
    ? `${shown.length} of ${listed.length} item${listed.length === 1 ? '' : 's'}`
    : 'Newest first';
  const empty = listed.length ? 'No matches.'
    : shownSince ? `Nothing new since the ${isoToShort(since, today)} issue.` : 'Nothing submitted yet.';
  list.replaceChildren(...(shown.length ? shown.map(queueRow) : [el('p', 'qh-empty', empty)]));
}
