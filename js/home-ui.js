/**
 * Home, the team's main page (Kate's Sep 15 sketch, layout A): a stats strip
 * on top — last issue, Exchange updated, next newsletter, the queue count —
 * then the shared submit form with the six quick links in the right rail
 * (Sort, Newsletter builder, the next issue with its quick add, Policy
 * Exchange, Share an item, Listserv sign-up; Kate's list and order, Sep 15),
 * and the queue table folded at the bottom (a details, its own chevron; Kate, Sep 15:
 * "just queue on the bottom and you can expand it out"). Home is the front
 * door, so the header's tabs are hidden on it (app.js sets body.is-front).
 * The form and the fold are mounted once and left alone on re-renders, so
 * typing is never wiped and the fold stays the way it was left; the strip,
 * the rail and the table inside the fold rebuild.
 */
import { renderSubmitForm } from './submit-form.js';
import { dotsLoader, faIcon } from './icons.js';
import { renderQueueTable } from './queue-ui.js';
import { queueBadgeCount, shareLine, signupLine, issueSummary, issueLine } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { plainError } from './sheet-client.js';

const EXCHANGE_URL = 'https://erc-policy-exchange.vercel.app/';
// The public share and sign-up pages live in the Policy Exchange hub — a
// separate origin from the desk on purpose: nothing on them can lead back here.
const SHARE_PATH = 'https://erc-policy-exchange.vercel.app/share/';
const SIGNUP_PATH = 'https://erc-policy-exchange.vercel.app/newsletter/';
const BUILDER_PATH = '/builder/';

// The latest render, so the next-issue card can repaint itself after a quick
// add without a fresh Sheet read; and the card's own state across those
// repaints (null, or { kind: 'busy' | 'ok' | 'error', text, link }).
let last = null;
let quickAddState = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** One fact on the strip. With an href it is a link out (the Exchange). */
function fact(label, value, href) {
  const node = el(href ? 'a' : 'div', 'strip-fact');
  if (href) {
    node.href = href;
    node.target = '_blank';
    node.rel = 'noreferrer';
  }
  node.append(el('span', 'strip-label', label));
  node.append(el('span', 'strip-value', value));
  return node;
}

/** A Copy button that puts one line on the clipboard and says so for a moment. */
function copyButton(text) {
  const copy = el('button', 'mini-btn', 'Copy');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = "Can't copy";
    }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  });
  return copy;
}

function openButton(href) {
  const open = el('a', 'mini-btn', 'Open ↗');
  open.href = href;
  open.target = '_blank';
  open.rel = 'noreferrer';
  return open;
}

/** The text half of a quick link: an icon, a title, a quiet line under it. */
function quickText(icon, title, desc) {
  const text = el('span', 'quick-text');
  text.append(el('span', 'quick-title', title));
  text.append(el('span', 'quick-desc', desc));
  return [faIcon(icon), text];
}

/** A quick link that goes to a desk screen. */
function quickGo(icon, title, desc, onClick) {
  const btn = el('button', 'quick-link');
  btn.type = 'button';
  btn.append(...quickText(icon, title, desc));
  btn.addEventListener('click', onClick);
  return btn;
}

/** A quick link that opens another site in a new tab. */
function quickOut(icon, title, desc, href) {
  const a = el('a', 'quick-link');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.append(...quickText(icon, title, desc));
  return a;
}

/** A quick link the team hands on: Open the page, or Copy a line with its link. */
function quickShare(icon, title, desc, href, line) {
  const card = el('div', 'quick-link');
  card.append(...quickText(icon, title, desc));
  const acts = el('span', 'quick-acts');
  acts.append(openButton(href), copyButton(line));
  card.append(acts);
  return card;
}

/**
 * The next-issue card: the date, one line of counts, and quick add (Kate's
 * pick A, Sep 15): paste a link, it lands in this issue, skipping Sort. The
 * Add button disappears while it works; the note under the box carries the
 * outcome.
 */
function issueCard({ rows, loaded, today, issue, onQuickAdd }) {
  const card = el('div', 'quick-link issue-card');
  const head = el('div', 'issue-head');
  const title = issue ? `${isoToShort(issue, today)} issue` : 'Next issue';
  const line = !loaded ? '…' : (issue ? issueLine(issueSummary(rows, issue)) : 'No issue date scheduled');
  head.append(...quickText('paper-plane', title, line));
  card.append(head);
  if (!issue) return card;

  const form = el('form', 'quick-add');
  form.noValidate = true;
  const input = el('input');
  input.type = 'url';
  input.autocomplete = 'off';
  input.placeholder = 'Paste a link to add it';
  input.setAttribute('aria-label', `Link to add to the ${title}`);
  const add = el('button', 'mini-btn', 'Add');
  add.type = 'submit';
  form.append(input, add);
  const note = el('p', 'quick-note', `Lands in the ${title}, skipping Sort`);
  card.append(form, note);

  const s = quickAddState;
  if (s?.kind === 'busy') {
    input.disabled = true;
    input.value = s.link;
    add.hidden = true;           // in flight: nothing re-pushable
    form.append(dotsLoader(true));
    note.textContent = 'Reading it…';
  } else if (s?.kind === 'ok') {
    note.textContent = s.text;
    note.classList.add('is-ok');
  } else if (s?.kind === 'error') {
    input.value = s.link;
    note.textContent = s.text;
    note.classList.add('is-error');
  }

  input.addEventListener('input', () => {
    if (!quickAddState || quickAddState.kind === 'busy') return;
    quickAddState = null;
    note.textContent = `Lands in the ${title}, skipping Sort`;
    note.className = 'quick-note';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const link = input.value.trim();
    if (!link) {
      quickAddState = { kind: 'error', text: 'Paste a web link first.', link: '' };
      renderHome(last.container, last.props);
      last.container.querySelector('.quick-add input')?.focus();
      return;
    }
    quickAddState = { kind: 'busy', link };
    renderHome(last.container, last.props);
    try {
      const landed = await onQuickAdd(link);
      quickAddState = { kind: 'ok', text: `Added to the ${isoToShort(landed, today)} issue`, link: '' };
    } catch (err) {
      quickAddState = { kind: 'error', text: plainError(err), link };
    }
    renderHome(last.container, last.props);
  });
  return card;
}

export function renderHome(container, props) {
  last = { container, props };
  const {
    rows, schedule, today, loaded, hubUpdated, lastIssue,
    onGoTo, onQuickAdd, onSubmitted, onRefresh, onDeleteFromQueue,
  } = props;
  // The shell (form, links, headings) paints immediately — only the
  // data-backed parts wait on the ~4s Sheet read, so the page is usable at once.
  let strip = container.querySelector('.stats-strip');
  if (!strip) {
    strip = el('div', 'stats-strip');
    const grid = el('div', 'home-grid');
    const formSide = el('div', 'home-form card');
    // The team already knows what belongs here — the ask is for detail, not
    // permission. (The public share page keeps the fuller framing.)
    formSide.append(el('h2', '', 'Add to the queue'));
    formSide.append(el('p', 'lede', 'Share whatever details you have.'));
    const mount = el('div');
    formSide.append(mount);
    renderSubmitForm(mount, { onSubmitted });
    grid.append(formSide, el('aside', 'quick-rail'));
    // The fold: a native details, closed on arrival, whose open state lives in
    // the DOM (the element is never rebuilt, so a data re-render keeps it).
    const fold = el('details', 'queue-fold');
    fold.append(el('summary'), el('div', 'queue-body'));
    container.replaceChildren(strip, grid, fold);
  }

  // ── The stats strip: one line of facts. ──
  const dash = v => (!loaded ? '…' : (v || '—'));
  strip.replaceChildren();
  strip.append(fact('Last issue', dash(isoToShort(lastIssue, today))));
  strip.append(fact('Exchange updated', dash(isoToShort(hubUpdated, today)), EXCHANGE_URL));
  strip.append(fact('Next newsletter', dash(isoToShort(nextIssueDate(schedule, today), today))));

  const count = loaded ? String(queueBadgeCount(rows)) : '·';
  const queueFact = el('div', 'strip-fact');
  queueFact.append(el('span', 'strip-label', 'In the queue'));
  const queueSide = el('span', 'strip-side');
  queueSide.append(el('span', 'queue-badge', count));
  queueSide.append(el('span', 'strip-label', 'waiting'));
  queueFact.append(queueSide);
  strip.append(queueFact);

  // ── The quick links, six in the rail (Kate's list, in her order, Sep 15). ──
  const rail = container.querySelector('.quick-rail');
  rail.replaceChildren(
    quickGo('layer-group', 'Sort', 'Work the queue, then send to the newsletter', () => onGoTo('sort')),
    quickOut('envelope', 'Newsletter builder', "Kathy's tool", BUILDER_PATH),
    issueCard({ rows, loaded, today, issue: nextIssueDate(schedule, today), onQuickAdd }),
    quickShare('globe', 'Policy Exchange', 'The public hub', EXCHANGE_URL, EXCHANGE_URL),
    quickShare('share-nodes', 'Share an item', 'The public share page', SHARE_PATH, shareLine(SHARE_PATH)),
    quickShare('user-plus', 'Listserv sign-up', 'The sign-up page', SIGNUP_PATH, signupLine(SIGNUP_PATH)),
  );

  // ── The queue, folded at the bottom. The summary is the heading. ──
  const summary = container.querySelector('.queue-fold summary');
  summary.replaceChildren(faIcon('chevron-down'), el('span', '', 'In the queue'), el('span', 'queue-badge', count));
  const body = container.querySelector('.queue-body');
  if (!loaded) body.replaceChildren(dotsLoader());
  else renderQueueTable(body, { rows, schedule, today, onRefresh, onDelete: onDeleteFromQueue, bare: true });
}
