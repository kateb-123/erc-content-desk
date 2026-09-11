/**
 * Sort: one stream, one card at a time — untyped last, otherwise the
 * newsletter's type order, oldest first within a group. Keep / Skip /
 * Trash by click only (no keyboard shortcuts — Kate's call, Aug 31). The
 * section row is a jump point; the type pickers hide behind "change".
 */
import { duplicateFlags, linkCheckState, reshareFlags, missingFields } from './workflow.js';
import { TYPE_ORDER, TYPE_LABELS, subtypesFor, isValidSubtype, typeIsFlat } from './schema.js';
import { isoToDisplay } from './rows-to-issue.js';
import { safeHref, withScheme } from './links.js';
import { sortStream, sortCounts, streamFrom, sectionOf, isErc, readerQueue, dupeBadgeText, isNewToday } from './sort-view.js';
import { buildImageControl } from './item-image.js';
import { titleWithInfo } from './screen-info.js';
import { faIcon, forwardIcon } from './icons.js';

let editOpenId = null;   // sort card with its inline edit open (view state)

const FILTER_LABELS = [
  // 'Needs a type', not 'To review': it counts only untyped items, and a
  // first-timer read the old name as "everything waiting" (usability run F24).
  ['', 'All'], ['untyped', 'Needs a type'], ['erc', 'ERC'], ['erc_event', 'ERC events'],
  ['research', 'Research'],
  ['event', 'Events'], ['opportunity', 'Opportunities'], ['headline', 'Headlines'],
];
const FILTER_KEYS = FILTER_LABELS.map(([k]) => k);

// How a card you decided this session presents itself when you scroll back to
// it: its own stamp, and the two decisions you did NOT make (Kate, Sep 9).
const DECIDED = {
  kept: { label: 'Kept', icon: 'check', cls: 'is-kept', others: ['circleback', 'trash'] },
  circleback: { label: 'Skipped', icon: null, cls: 'is-skipped', others: ['keep', 'trash'] },
  trashed: { label: 'Deleted', icon: 'trash-can', cls: 'is-deleted', others: ['keep', 'circleback'] },
};

let fixOpenId = null;   // card id whose type pickers are open via "change"
let lastFilter = null;  // detects a section jump so the card area slides like the screens do

// A decision moves no pixels (Kate, Sep 9): the card swaps for the next one at
// once and the parked sliver on the left ticks over. On a 95-item session even a
// 260ms exit is half a minute of watching, and the sliver already records what
// you did — the card does not need to perform it.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The inline editor (Title, Description, Link, and Media on ERC items). Shared by
 *  the card and the headline list, so a field never exists in only one place.
 *  `read` returns what is typed, for a decision to carry (Kate, Sep 9). */
function buildEditForm(row, { onSave, onCancel }) {
    const form = el('div', 'sort-edit');
  const mkField = (label, value, rows) => {
    const wrap = el('label', 'sort-edit-field', label);
    const input = rows ? el('textarea') : el('input');
    if (rows) input.rows = rows; else input.type = 'text';
    input.value = value ?? '';
    wrap.append(input);
    form.append(wrap);
    return input;
  };
  const titleIn = mkField('Title', row.headline);
  const blurbIn = mkField('Description', row.blurb, 4);
  const linkIn = mkField('Link', row.link);
  // ERC items can carry a picture (flyer, cover) — it rides the row's
  // infographic column into the newsletter. A div, not a label: a label
  // would forward stray clicks to the upload button.
  let imgCtl = null;
  if (isErc(row)) {
    const wrap = el('div', 'sort-edit-field', 'Media');
    imgCtl = buildImageControl(row.infographic, () => {});
    wrap.append(imgCtl.el);
    form.append(wrap);
  }
  const read = () => ({
    headline: titleIn.value.trim(), blurb: blurbIn.value, link: withScheme(linkIn.value.trim()),
    ...(imgCtl ? { infographic: imgCtl.get() } : {}),
  });
  const rowBtns = el('div', 'sort-edit-actions');
  const save = el('button', 'primary', 'Save');
  save.type = 'button';
  save.addEventListener('click', () => {
    onSave(read());
  });
  const cancel = el('button', 'btn-outline', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', () => onCancel());
  rowBtns.append(save, cancel);
  form.append(rowBtns);
  return { el: form, read };
}

/** The type and subtype chips. Tapping the subtype is the save; a flat type
 *  (ERC Event) saves on the type tap. Shared by the card and the headline list. */
function buildTypePicker(row, onCommit) {
    const fix = el('div', 'type-pick');
  fix.append(el('p', 'pick-label', 'Select a type'));
  const typeChips = el('div', 'type-row');
  const subWrap = el('div', 'sub-pick');
  const subChips = el('div', 'type-row');
  const subLabel = el('p', 'pick-label');
  subWrap.append(subLabel, subChips);
  let pickedType = row.type || '';
  let pickedSub = row.subtype || '';
  // Tapping the subtype IS the save — no extra button (Kate, Sep 1).
  const commit = () => {
    fix.replaceChildren(el('p', 'pick-saved', '✓ Saved'));
    onCommit(pickedType, pickedSub);
  };
  const renderSubs = () => {
    // Name the picked type so switching (Event -> Opportunity) reads clearly.
    subLabel.textContent = pickedType ? `${TYPE_LABELS[pickedType] ?? pickedType} — now the subtype:` : '';
    subChips.replaceChildren(...subtypesFor(pickedType).map(s => {
      const b = el('button', `type-word${s === pickedSub ? ' is-picked' : ''}`, s);
      b.type = 'button';
      b.addEventListener('click', () => { pickedSub = s; commit(); });
      return b;
    }));
    subWrap.classList.toggle('is-open', Boolean(pickedType));
  };
  const renderTypes = () => {
    typeChips.replaceChildren(...TYPE_ORDER.map(t => {
      const b = el('button', `type-word${t === pickedType ? ' is-picked' : ''}`, TYPE_LABELS[t] ?? t);
      b.type = 'button';
      b.addEventListener('click', () => {
        if (pickedType !== t) { pickedType = t; pickedSub = ''; }
        // ERC Event has no subtype, so the type tap is the save; the card
        // used to wait for a subtype that does not exist (Kate, Sep 10).
        if (typeIsFlat(t)) { commit(); return; }
        renderTypes(); renderSubs();
      });
      return b;
    }));
  };
  renderTypes(); renderSubs();
  fix.append(typeChips, subWrap);
  return fix;
}

/** The amber Verify-link ask: open the source, then Confirm or Change. Shared by
 *  the card and the headline list. onVerify(newLink?) records the outcome. */
function buildLinkAlert(row, href, onVerify) {
    // One amber line. "check it" opens the source; only after she's been
  // there does "it works" appear — opening IS the verification (Kate, Sep 1).
  const alert = el('div', 'link-alert');
  const line = el('p', 'alert-line');
  const mark = el('i', 'fa-solid fa-triangle-exclamation alert-mark');
  mark.setAttribute('aria-hidden', 'true');
  line.append(mark);
  // Say why: the warning used to mean only "the desk couldn't read this",
  // and the one truly wrong link in the data carried none (F12, F20).
  line.append(' ', row.link_checked === 'mismatch' ? 'This link may open a different item.' : "The desk couldn't open this page.");
  const works = el('button', 'linkish alert-word', 'Confirm');
  works.type = 'button';
  works.addEventListener('click', () => onVerify());
  const change = el('button', 'linkish alert-word', 'Change');
  change.type = 'button';
  const changeRow = el('p', 'alert-change');
  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'paste the right link';
  const saveLink = el('button', 'linkish alert-word', 'Save');
  saveLink.type = 'button';
  change.addEventListener('click', () => { changeRow.classList.add('is-open'); input.focus(); });
  const saveFixed = () => {
    const fixed = input.value.trim();
    if (!safeHref(fixed)) { input.classList.add('is-invalid'); return; }
    onVerify(fixed);
  };
  saveLink.addEventListener('click', saveFixed);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') saveFixed(); });
  input.addEventListener('input', () => input.classList.remove('is-invalid'));
  // One ask: "Verify link" opens the source. The two outcomes — It works /
  // Change — only appear once she's been there (Kate, Sep 1).
  const after = el('span', '');
  after.append(' · ', works, ' · ', change);
  if (href) {
    after.hidden = true;
    const a = el('a', 'alert-word', 'Verify link ↗');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    a.addEventListener('click', () => { after.hidden = false; });
    line.append(' ', a);
  } else {
    // Nothing to verify — only Change makes sense.
    after.hidden = false;
    after.replaceChildren(' · ', change);
    line.append(' Missing link');
  }
  line.append(after);
  changeRow.append(input, ' ', saveLink);
  alert.append(line, changeRow);
  if (href) {
    // The whole amber box is the ask, not only the two words in it — the
    // boss clicked the box twice and nothing happened (usability run F5).
    alert.classList.add('is-clickable');
    alert.addEventListener('click', e => {
      if (e.target.closest('a, button, input')) return;
      window.open(href, '_blank', 'noreferrer');
      after.hidden = false;
    });
  }
  return alert;
}

export function renderSort(container, props) {
  const rerenderCard = () => renderSort(container, props);
  container.replaceChildren();
  const { rows, filter, sortedCount, lastDecision, onFilter, onDecide, onUndo, onGoTo, browse = 0, onBrowse, sessionDecided = new Set() } = props;
  const rerenderSelf = () => renderSort(container, props);

  const stream = sortStream(rows, sessionDecided);
  const counts = sortCounts(rows);
  const visible = streamFrom(stream, filter);

  const head = el('div', 'screen-head');
  const info = titleWithInfo('Sort', 'sort',
    'Go card by card: Keep what belongs, Skip what you are not sure about (it stays in the queue), Delete the rest. The pen edits the item in place. A card with open work — no type, an unchecked link — locks Keep until you fix it (Delete works any time).');
  head.append(info.row);
  const door = el('button', 'primary head-action', 'Go to Finalize');
  door.append(forwardIcon());
  door.addEventListener('click', () => onGoTo?.('finalize'));
  head.append(door);
  container.append(head, info.panel);

  // Browsing: ← → walks a viewing position through the stream without
  // deciding anything. Deciding acts on the card in view; the position holds.
  const idx = Math.max(0, Math.min(browse, visible.length - 1));

  // Sections are jump points into one continuous stream. The underline marks
  // where you jumped in; the darker text tracks the group you're passing
  // through as the stream flows on.
  const currentGroup = visible.length ? sectionOf(visible[idx]) : null;
  const nav = el('nav', 'sort-nav');
  for (const [key, label] of FILTER_LABELS) {
    const count = key === '' ? counts.all : counts[key];
    let cls = 'sort-filter';
    if (filter === key) cls += ' is-active';
    if (key && key === currentGroup) cls += ' is-here';
    if (key === 'untyped' && count > 0) cls += ' is-alert';   // work you have to go through
    const btn = el('button', cls, `${label} (${count})`);
    btn.type = 'button';
    btn.addEventListener('click', () => onFilter(key));
    nav.append(btn);
  }
  const main = el('div', 'sort-main');
  const body = el('div', 'sort-body');
  body.append(nav, main);
  container.append(body);
  if (lastFilter !== null && lastFilter !== filter) {
    main.classList.add(FILTER_KEYS.indexOf(filter) > FILTER_KEYS.indexOf(lastFilter)
      ? 'slide-in-right' : 'slide-in-left');
  }
  lastFilter = filter;

  if (!visible.length) {
    const waiting = readerQueue(rows).length;
    main.append(el('p', 'empty', waiting ? 'New items are being read.' : sortedCount ? 'All sorted.' : 'Nothing to sort.'));
    const undo = el('button', 'undo-link', 'Undo');
    undo.type = 'button';
    undo.disabled = !lastDecision;          // always here, live only when there's something to undo
    undo.addEventListener('click', () => onUndo());
    main.append(undo);
    return;
  }

  const row = visible[idx];
  const groupKey = sectionOf(row);
  const groupLabel = FILTER_LABELS.find(([k]) => k === groupKey)?.[1] ?? 'Needs a type';
  // Dots track the current section only — and the heading names your spot in it.
  const groupCards = visible.map((r, i) => i).filter(i => sectionOf(visible[i]) === groupKey);
  const posInGroup = groupCards.indexOf(idx) + 1;

  main.append(el('p', 'sort-group', groupLabel));
  // Undo sits under the section label, outside the card — live once anything on
  // Sort has been changed (a decision, an edit, a type pick, a link check), and
  // it walks back through them one at a time. It is ALWAYS in the layout, greyed
  // when there is nothing to undo, so the card never shifts up on a fresh stack.
  const undo = el('button', 'undo-link', 'Undo last');
  undo.type = 'button';
  undo.disabled = !lastDecision;
  undo.addEventListener('click', () => onUndo());
  main.append(undo);
  // Decided this session: the card is still here to scroll back to, wearing its
  // decision. Anything decided before today's visit never reaches the stream.
  const decided = sessionDecided.has(row.id) && row.status !== 'new' ? row.status : null;
  const card = el('div', `sort-card${decided ? ` is-decided ${DECIDED[decided].cls}` : ''}`);
  card.append(el('span', 'card-pos', `${posInGroup}/${groupCards.length}`));
  if (decided) {
    const stamp = el('span', `decided-stamp ${DECIDED[decided].cls}`, DECIDED[decided].label);
    if (DECIDED[decided].icon) stamp.prepend(faIcon(DECIDED[decided].icon));
    card.append(stamp);
  }
  const dupes = duplicateFlags(rows);
  const reshare = reshareFlags(rows, props.today ?? '');
  const badges = el('div');
  if (row.spotlight_request) badges.append(el('span', 'badge badge-star', 'Spotlight requested'));
  if (isNewToday(row, props.today)) badges.append(el('span', 'badge badge-new', 'New'));
  if (row.submitter_email) badges.append(el('span', 'badge', 'External submission'));
  // One badge, most informative first: a past newsletter share beats the dupe
  // tiers. Facts ("Already live", "In a past issue") wear the quiet ghost;
  // "Possible duplicate" is the amber caution.
  if (reshare.has(row.id)) {
    badges.append(el('span', 'badge', 'In a past issue'));
  } else if (dupes.has(row.id)) {
    const prior = rows.find(r => r.id === dupes.get(row.id));
    badges.append(prior?.published_at
      ? el('span', 'badge', 'Already live')
      : el('span', 'badge badge-dupe', dupeBadgeText(prior)));
  }
  card.append(badges);
  card.append(el('h3', '', row.headline || '(untitled)'));
  // Set while the edit panel is open, so the decision buttons below can read what
  // is typed in it. Kate, Sep 9: Keep used to decide on the ORIGINAL row and drop
  // her edit on the floor — now whichever button ends the card carries it.
  let readOpenEdit = null;
  if (editOpenId === row.id) {
    const form = buildEditForm(row, {
      onSave: changes => {
        for (const x of card.querySelectorAll('button')) x.disabled = true;
        editOpenId = null;
        props.onEditRow?.(row, changes);
      },
      onCancel: () => { editOpenId = null; rerenderCard(); },
    });
    readOpenEdit = form.read;
    card.append(form.el);
  }
  card.append(el('p', 'item-meta', [
    row.source, row.date && isoToDisplay(row.date), row.time, row.location,
    row.submitter && `from ${row.submitter}`, row.submitter_email,
  ].filter(Boolean).join(' · ')));
  if (row.blurb) card.append(el('p', 'item-blurb', row.blurb));
  if (row.note) card.append(el('p', 'item-note', `Note: ${row.note}`));

  // The filing section: quiet type line, link-check alert, pill picker.
  // No "— · —" placeholder — an untyped card's picker speaks for itself.
  const fileRow = el('div', 'file-row');
  const linkState = linkCheckState(row);
  const href = safeHref(row.link);
  // Not "has a subtype" — a flat type like ERC Event never will. Ask the schema
  // whether this type/subtype pair is complete.
  const mustFix = !row.type || !isValidSubtype(row.type, row.subtype);
  const fixOpen = mustFix || fixOpenId === row.id;

  const typeLine = el('p', 'type-line');
  if (row.type && row.subtype) {
    typeLine.append(el('span', 'type-label',
      `${TYPE_LABELS[row.type] ?? row.type} · ${row.subtype}`));
    const autoTyped = String(row.auto_filled ?? '').split(',')
      .some(f => f === 'type' || f === 'subtype');
    if (autoTyped) {
      const flag = el('span', 'auto-flag', '!');
      flag.title = 'Filed by the desk from the link/description — check it.';
      flag.setAttribute('role', 'img');
      flag.setAttribute('aria-label', 'Type was filed automatically — check it');
      typeLine.append(' ', flag);
    }
    if (!fixOpen) {
      const change = el('button', 'linkish', 'Change');
      change.type = 'button';
      change.addEventListener('click', () => { fixOpenId = row.id; rerenderSelf(); });
      typeLine.append(' ', change);
    }
  }
  // The alert strip carries the link while it needs checking.
  if (href && linkState !== 'alert') {
    const a = el('a', 'source-link', 'Open source ↗');
    a.href = href; a.target = '_blank'; a.rel = 'noreferrer';
    typeLine.append(typeLine.childNodes.length ? ' · ' : '', a);
    if (linkState === 'verified') {
      const ok = el('span', 'link-verified', ' Verified');
      ok.prepend(faIcon('check'));
      typeLine.append(' ', ok);
    }
  }
  if (typeLine.childNodes.length) fileRow.append(typeLine);

  if (linkState === 'alert') {
    fileRow.append(buildLinkAlert(row, href, newLink => {
      for (const x of card.querySelectorAll('button')) x.disabled = true;
      props.onVerifyLink?.(row, newLink);
    }));
  }

  // Two quiet notes, only when the reader came up short. Neither blocks Keep —
  // Kate decides whether to go find the detail or bin the item (Sep 9).
  const FIELD_WORDS = { date: 'date', time: 'time', location: 'location', deadline: 'deadline', authors: 'authors', medium: 'outlet' };
  const missing = missingFields(row);
  if (missing.length) {
    const note = el('p', 'card-note');
    note.append(faIcon('circle-question'));
    // Says what to do and, when the page could not be read, why (F7).
    const words = missing.map(f => FIELD_WORDS[f] ?? f).join(', ');
    const them = missing.length === 1 && missing[0] !== 'authors' ? 'it' : 'them';
    const why = row.link_checked === 'failed' ? " — the desk couldn't read the page" : '';
    note.append(` No ${words} yet${why}. Add ${them} in Finalize.`);
    fileRow.append(note);
  }
  if (String(row.needs_review ?? '').trim()) {
    const note = el('p', 'card-note');
    note.append(faIcon('circle-question'));
    const filled = String(row.auto_filled ?? '').split(',').map(f => f.trim()).filter(Boolean);
    note.append(filled.length
      ? ` The reader wasn't sure about this one — check what it filled in: ${filled.join(', ')}`
      : " The reader wasn't sure about this one — check its fields");
    fileRow.append(note);
  }

  if (fixOpen) {
    fileRow.append(buildTypePicker(row, (type, subtype) => {
      for (const x of card.querySelectorAll('button')) x.disabled = true;
      fixOpenId = null;
      props.onEditType?.(row, type, subtype);
    }));
  }

  if (fileRow.childNodes.length) card.append(fileRow);

  const actions = el('div', 'sort-actions');
  const mk = (label, cls, action) => {
    const b = el('button', cls, label);
    b.addEventListener('click', () => {
      for (const x of card.querySelectorAll('button')) x.disabled = true;
      // An open edit panel IS the row's current state — carry it into the same
      // write rather than deciding on the stale copy. Undo walks both back as one.
      const decided = readOpenEdit ? { ...row, ...readOpenEdit() } : row;
      editOpenId = null;
      onDecide(decided, action);
    });
    return b;
  };
  const editBtn = el('button', 'linkish edit-link', ' Edit');
  editBtn.type = 'button';
  editBtn.prepend(faIcon('pen'));
  editBtn.addEventListener('click', () => {
    editOpenId = editOpenId === row.id ? null : row.id;
    rerenderCard();
  });
  const trashBtn = mk(' Delete', 'linkish trash-link sort-delete', 'trash');
  trashBtn.prepend(faIcon('trash-can'));
  const circleBtn = mk('Skip', 'linkish skip-link', 'circleback');
  const keepBtn = mk(' Keep', 'btn-keep', 'keep');
  keepBtn.prepend(faIcon('check'));

  if (decided) {
    // A card you already decided this session: it says what it is, and offers the
    // two other decisions rather than repeating the one you made. Edit stays.
    actions.append(editBtn, el('span', 'decided-lead', 'Change to'));
    const others = DECIDED[decided].others.map(k => (
      k === 'keep' ? keepBtn : k === 'circleback' ? circleBtn : trashBtn));
    actions.append(...others);
  } else {
    actions.append(editBtn, trashBtn, circleBtn, keepBtn);
  }
  card.append(actions);

  // A card with open work can't be KEPT until it's fixed — but junk is junk:
  // Trash stays live no matter what (Kate, Sep 1).
  const blockers = [];
  if (mustFix) blockers.push('set a type');
  if (linkState === 'alert') blockers.push('check the link');
  if (blockers.length) {
    // The card already says what's open (alert line, type prompt) — no
    // second sentence. Keep stays locked until it's fixed; Skip only parks
    // the card, so it always works (Kate, Sep 10, usability run F4).
    keepBtn.disabled = true;
  }
  // Carousel: arrows flank the card (the card's own 1/2 counter tracks the
  // position). Browsing never decides anything — the card only changes state via
  // Keep / Skip / Delete. When the card behind you is one you just decided, the
  // ‹ arrow is joined by that card parked as a dulled sliver: the decision is
  // still on screen, which is the whole point of not letting cards disappear.
  const carousel = el('div', 'sort-carousel');
  const behind = idx > 0 ? visible[idx - 1] : null;
  const parkedRow = behind && sessionDecided.has(behind.id) ? behind : null;
  const prev = el('button', 'carousel-arrow', '‹');
  prev.type = 'button';
  prev.disabled = idx === 0;
  prev.setAttribute('aria-label', 'Previous card');
  prev.addEventListener('click', () => onBrowse?.(idx - 1));
  const next = el('button', 'carousel-arrow', '›');
  next.type = 'button';
  next.disabled = idx >= visible.length - 1;
  next.setAttribute('aria-label', 'Next card');
  next.addEventListener('click', () => onBrowse?.(idx + 1));
  // The slot is ALWAYS in the layout, invisible when nothing is parked, so the
  // first decision of a session doesn't shove the card sideways.
  const parked = el('button', `sort-parked${parkedRow ? '' : ' is-empty'}`);
  parked.type = 'button';
  if (parkedRow) {
    parked.setAttribute('aria-label', `Back to ${parkedRow.headline || 'the last card'}`);
    parked.append(el('span', '', DECIDED[parkedRow.status]?.label ?? ''));
    parked.addEventListener('click', () => onBrowse?.(idx - 1));
  } else {
    parked.disabled = true;
    parked.setAttribute('aria-hidden', 'true');
  }
  carousel.append(prev, parked, card, next);
  main.append(carousel);

}
