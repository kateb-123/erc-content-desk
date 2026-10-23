/**
 * The Highlight, a page of its own under Policy Exchange (Kate, Oct 23: "own
 * page is fine"; her words that night: "it always resets when you push. what
 * if I wanted to push a random day? can it have what is there and what to
 * add?"). What the Exchange's home-page card shows now, beside her picks, with
 * one Save, any day. Publish no longer carries the picks, so a publish never
 * rewrites the card, and a fresh check of the site keeps what she changed and
 * has not saved (followPicks).
 */
import { renderHighlights } from './highlight-ui.js';
import { pickOf, followPicks, samePicks, withoutPhoto, setCardWords, wantingWords } from './highlight-view.js';
import { howToLink } from './hub-head.js';
import { screenHead } from './screen-info.js';
import { faIcon } from './icons.js';
import { el, button, focusKeyIn, restoreFocus, busyLine } from './ui-aids.js';

let picks = null;           // her picks; null until the first check lands
let pinsSeen = null;        // the site's pins her picks were last measured against
let seenFrom = null;        // the check those pins came from
let asking = false;         // the password ask is up
let typedPassword = '';     // the ask's field, kept across a redraw
let justSaved = false;      // a save went out: the next check's pins become her picks
const cardBusy = new Set();     // picks whose card words are being written (Kate, Sep 30)
const cardFailed = new Set();   // picks whose card words did not come

/** Arriving never lands on a standing ask. */
export function resetHighlightAsk() { asking = false; typedPassword = ''; }

/** props: { preview, today, busy, publishError, onSave({ password, highlights }), onRecheck, cardWords(links) } */
export function renderHighlightPage(container, props) {
  const { preview, today, busy, publishError = '', onSave, onRecheck } = props;
  const rerender = () => renderHighlightPage(container, props);
  const focusKey = focusKeyIn(container);
  // A fresh check of the site: untouched picks follow it, changed ones stay;
  // right after a save, the site's new pins are her picks.
  const items = preview?.highlights?.items ?? null;
  if (items && items !== seenFrom) {
    const fresh = items.map(pickOf);
    picks = justSaved ? fresh : followPicks(picks, pinsSeen, fresh);
    if (justSaved) { justSaved = false; asking = false; }
    pinsSeen = fresh;
    seenFrom = items;
  }
  const pins = pinsSeen ?? [];
  container.replaceChildren();

  const { head, lede } = screenHead('Highlight', 'highlight',
    'Your picks show in the big card on the Exchange\'s home page until their day. Update the highlight saves them; nothing else changes the card.');
  lede.append('The big card on the Exchange\'s home page. Each pick needs a photo.');
  head.append(howToLink('How to change the Policy Exchange', '/how-to/exchange/'));
  container.append(head);

  if (busy && !preview) { container.append(busyLine('Checking the live Exchange')); return; }
  if (!preview) {
    const failed = el('p', 'lede');
    failed.append('The check failed · ');
    failed.append(button('Re-check', 'linkish', { focus: 'recheck', onClick: onRecheck }));
    container.append(failed);
    return;
  }

  const hlCtx = { adding: [], hub: preview.hub ?? [] };
  const changed = !samePicks(picks ?? [], pins);
  renderHighlights(container, {
    now: preview.highlights?.items ?? [], cards: preview.highlights?.cards ?? [], adding: [], hub: hlCtx.hub, picks: picks ?? [], today,
    cardBusy, cardFailed, onCardWords: askCardWords, saveBar: changed ? saveBar() : null,
    onChange: next => {
      // A new event or opportunity pick gets its card words written now (Kate, Sep 30).
      const had = new Set((picks ?? []).map(p => p.link));
      picks = next;
      askCardWords(wantingWords(next, hlCtx).filter(link => !had.has(link)));
      rerender();
    },
  });
  restoreFocus(container, focusKey, null);

  /** Update the highlight, then the password, the one write of this page. */
  function saveBar() {
    const bar = el('div', 'hl-save');
    if (busy) { bar.append(busyLine('Updating the highlight')); return bar; }
    if (!asking) {
      bar.append(
        button('Update the highlight', 'primary hl-save-btn', { focus: 'hl-save', onClick: () => { asking = true; rerender(); } }),
        button('Cancel changes', 'linkish quiet-link', { focus: 'hl-cancel', onClick: () => { picks = pins; cardBusy.clear(); cardFailed.clear(); rerender(); } }),
      );
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
    ok.disabled = !typedPassword;
    field.addEventListener('input', () => { typedPassword = field.value; ok.disabled = !typedPassword; });
    ask.addEventListener('submit', event => {
      event.preventDefault();
      if (!typedPassword) { field.focus(); return; }
      const password = typedPassword;
      typedPassword = '';
      ok.disabled = true;
      justSaved = true;
      onSave({ password, highlights: picks ?? [] });
    });
    const no = button('Cancel', 'linkish alert-word nl-cancel', { focus: 'hl-save', onClick: () => { asking = false; typedPassword = ''; rerender(); } });
    row.append(field, ok, ' · ', no);
    ask.append(row);
    if (publishError) {
      justSaved = false;   // refused: her picks stay as they are
      const line = el('p', 'field-error', publishError);
      line.id = 'hl-error';
      line.setAttribute('role', 'alert');
      ask.append(line);
    }
    bar.append(ask);
    if (focusKey !== 'hl-password') queueMicrotask(() => field.focus({ preventScroll: true }));
    return bar;
  }

  /** The model writes the card's words for these picks; they land on the picks still there. */
  async function askCardWords(links) {
    const wanted = links.filter(link => !cardBusy.has(link));
    if (!wanted.length || !props.cardWords) return;
    for (const link of wanted) { cardBusy.add(link); cardFailed.delete(link); }
    rerender();
    try {
      const data = await props.cardWords(wanted);
      const cards = new Map((data.cards ?? []).map(c => [c.link, c]));
      for (const link of wanted) {
        cardBusy.delete(link);
        const card = cards.get(link);
        if (card && card.summary) picks = setCardWords(picks ?? [], link, card);
        else cardFailed.add(link);
      }
    } catch {
      for (const link of wanted) { cardBusy.delete(link); cardFailed.add(link); }
    }
    rerender();
  }
}
