/**
 * The Highlight, a page of its own under Policy Exchange (Kate, Oct 23: "own
 * page is fine"; her words that night: "it always resets when you push. what
 * if I wanted to push a random day? can it have what is there and what to
 * add?"). What the Exchange's home-page card shows now, beside her picks, with
 * one Save, any day. Publish no longer carries the picks, so a publish never
 * rewrites the card, and a fresh check of the site keeps what she changed and
 * has not saved (followPicks).
 *
 * The review of Oct 23 shaped the state here: the page always redraws from
 * the props app.js handed it last (never a stale copy); a save counts only
 * once it succeeded; a card-words reply from before a Cancel or a save is
 * dropped; Save waits while card words are still being written; a typed day
 * changes the picks without a redraw, so the date field keeps its caret.
 */
import { renderHighlights } from './highlight-ui.js';
import { pickOf, followPicks, samePicks, withoutPhoto, setCardWords, setUntil, wantingWords } from './highlight-view.js';
import { howToLink } from './hub-head.js';
import { screenHead } from './screen-info.js';
import { faIcon } from './icons.js';
import { el, button, focusKeyIn, restoreFocus, busyLine } from './ui-aids.js';

let latest = null;          // the props app.js handed this page last; every redraw reads them
let picks = null;           // her picks; null until the first check lands
let pinsSeen = null;        // the site's pins her picks were last measured against
let seenFrom = null;        // the check those pins came from
let asking = false;         // the password ask is up
let focusAsk = false;       // the ask just opened: its field takes the cursor once
let typedPassword = '';     // the ask's field, kept across a redraw
let justSaved = false;      // a save succeeded: the next check's pins become her picks
let generation = 0;         // bumped by Cancel changes and by a save, so older card-words replies drop
const cardBusy = new Set();     // picks whose card words are being written (Kate, Sep 30)
const cardFailed = new Set();   // picks whose card words did not come

/** Arriving never lands on a standing ask. */
export function resetHighlightAsk() { asking = false; focusAsk = false; typedPassword = ''; }

/** props: { preview, today, busy, loaded, publishError, onSave({ password, highlights }) -> Promise<boolean>, onRecheck, cardWords(links) } */
export function renderHighlightPage(container, props) {
  latest = { container, props };
  draw();
}

const redraw = () => { if (latest) draw(); };

function draw() {
  const { container, props } = latest;
  const { preview, today, busy, loaded = true, publishError = '', onRecheck } = props;
  const focusKey = focusKeyIn(container);

  // A fresh check of the site: untouched picks follow it, changed ones stay;
  // right after a successful save, the site's new pins are her picks.
  const items = preview?.highlights?.items ?? null;
  if (items && items !== seenFrom) {
    const fresh = items.map(pickOf);
    picks = justSaved ? fresh : followPicks(picks, pinsSeen, fresh);
    if (justSaved) { justSaved = false; asking = false; generation += 1; cardBusy.clear(); cardFailed.clear(); }
    pinsSeen = fresh;
    seenFrom = items;
  }
  const pins = pinsSeen ?? [];
  const changed = Boolean(items) && !samePicks(picks ?? [], pins);
  // The ask lives only while there is something to save.
  if (!changed && !busy) { asking = false; focusAsk = false; typedPassword = ''; }

  container.replaceChildren();
  const { head, lede } = screenHead('Highlight', 'highlight',
    'Your picks show in the big card on the Exchange\'s home page until their day. Update the highlight saves them; nothing else changes the card.');
  head.append(howToLink('How to change the Policy Exchange', '/how-to/exchange/#highlight'));
  container.append(head);

  if (!preview) {
    // Still loading (the desk, or the check after a save), or the check failed.
    if (busy || !loaded) { lede.append('The big card on the Exchange\'s home page.'); container.append(busyLine('Checking the live Exchange')); return; }
    lede.append('The check failed · ');
    lede.append(button('Re-check', 'linkish', { focus: 'recheck', onClick: onRecheck }));
    return;
  }
  // What the page shows is the site as last checked; Re-check asks again.
  lede.append('The big card on the Exchange\'s home page, as last checked · ');
  const again = button('Re-check', 'linkish', { focus: 'recheck', onClick: () => { again.disabled = true; onRecheck(); } });
  if (busy) again.disabled = true;
  lede.append(again);

  const hlCtx = { adding: [], hub: preview.hub ?? [] };
  renderHighlights(container, {
    now: items ?? [], cards: preview.highlights?.cards ?? [], adding: [], hub: hlCtx.hub,
    picks: picks ?? [], getPicks: () => picks ?? [], today,
    cardBusy, cardFailed, onCardWords: askCardWords, saveBar: changed ? saveBar(hlCtx, publishError, busy) : null,
    onChange: next => {
      // A new event or opportunity pick gets its card words written now (Kate, Sep 30).
      const had = new Set((picks ?? []).map(p => p.link));
      picks = next;
      askCardWords(wantingWords(next, hlCtx).filter(link => !had.has(link)));
      redraw();
    },
    // A typed day changes the picks and the Save bar alone, so the field keeps its caret.
    onUntil: (link, day) => { picks = setUntil(picks ?? [], link, day); refreshSaveBar(container, hlCtx); },
  });
  restoreFocus(container, focusKey, null);
}

/** Put the Save bar right for the picks as they are, without redrawing the page. */
function refreshSaveBar(container, hlCtx) {
  const { publishError = '', busy } = latest.props;
  const changed = !samePicks(picks ?? [], pinsSeen ?? []);
  const old = container.querySelector('.hl-save');
  const bar = changed ? saveBar(hlCtx, publishError, busy) : null;
  if (old && bar) old.replaceWith(bar);
  else if (old) old.remove();
  else if (bar) container.querySelector('.hl-cols')?.after(bar);
}

/** Update the highlight, then the password: the one write of this page. */
function saveBar(hlCtx, publishError, busy) {
  const bar = el('div', 'hl-save');
  if (busy) { bar.append(busyLine('Updating the highlight')); return bar; }
  const writing = (picks ?? []).some(p => cardBusy.has(p.link));
  if (!asking) {
    const save = button('Update the highlight', 'primary hl-save-btn', { focus: 'hl-save', onClick: () => { asking = true; focusAsk = true; redraw(); } });
    // Words still being written would go out without them (review, Oct 23).
    if (writing) { save.disabled = true; save.setAttribute('aria-describedby', 'hl-wait'); }
    bar.append(save, button('Cancel changes', 'linkish quiet-link', { focus: 'hl-cancel', onClick: () => {
      picks = pinsSeen ?? [];
      generation += 1;
      cardBusy.clear();
      cardFailed.clear();
      redraw();
    } }));
    if (writing) { const wait = el('p', 'hl-save-note', 'Writing the card first.'); wait.id = 'hl-wait'; bar.append(wait); }
    return bar;
  }
  const ask = el('form', 'nl-ask p-ask hl-ask');
  ask.noValidate = true;
  const words = el('p', 'p-ask-words');
  words.append(faIcon('triangle-exclamation'), ' Update the highlight on the ', el('strong', '', 'live'), ' Exchange?');
  ask.append(words);
  const bare = withoutPhoto(picks ?? [], hlCtx).length;
  if (bare) ask.append(el('p', 'p-ask-note', `${bare} pick${bare === 1 ? ' has' : 's have'} no photo.`));
  const row = el('div', 'p-ask-row');
  const field = el('input');
  field.type = 'password';
  field.id = 'hl-password';
  field.autocomplete = 'current-password';
  field.dataset.focus = 'hl-password';
  field.value = typedPassword;
  field.placeholder = 'Password';
  field.setAttribute('aria-label', 'Password');
  if (publishError) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', 'hl-error'); }
  const ok = button('Confirm', 'linkish alert-word', { focus: 'hl-save' });
  ok.type = 'submit';
  ok.disabled = !typedPassword || (picks ?? []).some(p => cardBusy.has(p.link));
  field.addEventListener('input', () => { typedPassword = field.value; ok.disabled = !typedPassword; });
  ask.addEventListener('submit', async event => {
    event.preventDefault();
    if (!typedPassword) { field.focus(); return; }
    const password = typedPassword;
    typedPassword = '';
    ok.disabled = true;
    // The save counts only once it succeeded: a refusal, a conflict or a
    // dropped connection leaves her picks exactly as they are.
    justSaved = true;
    const saved = await latest.props.onSave({ password, highlights: picks ?? [] });
    if (!saved) { justSaved = false; redraw(); }
  });
  const no = button('Cancel', 'linkish alert-word nl-cancel', { focus: 'hl-save', onClick: () => { asking = false; typedPassword = ''; redraw(); } });
  row.append(field, ok, ' · ', no);
  ask.append(row);
  if (publishError) {
    const line = el('p', 'field-error', publishError);
    line.id = 'hl-error';
    line.setAttribute('role', 'alert');
    ask.append(line);
  }
  bar.append(ask);
  // The cursor goes to the field once, when the ask opens; a later redraw leaves it be.
  if (focusAsk) { focusAsk = false; queueMicrotask(() => field.focus({ preventScroll: true })); }
  return bar;
}

/** The model writes the card's words for these picks; they land on the picks
 *  still there, unless a Cancel or a save came first. */
async function askCardWords(links) {
  const wanted = links.filter(link => !cardBusy.has(link));
  const ask = latest?.props.cardWords;
  if (!wanted.length || !ask) return;
  const mine = generation;
  for (const link of wanted) { cardBusy.add(link); cardFailed.delete(link); }
  redraw();
  let cards = new Map();
  let failed = false;
  try {
    const data = await ask(wanted);
    cards = new Map((data.cards ?? []).map(c => [c.link, c]));
  } catch { failed = true; }
  for (const link of wanted) cardBusy.delete(link);
  if (mine !== generation) { redraw(); return; }   // cancelled or saved meanwhile: the reply is old news
  for (const link of wanted) {
    const card = cards.get(link);
    if (!failed && card && card.summary) picks = setCardWords(picks ?? [], link, card);
    else cardFailed.add(link);
  }
  redraw();
}
