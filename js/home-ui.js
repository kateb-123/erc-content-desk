/**
 * Home, the team's main page (Kate's Sep 15 sketch, layout A): a stats strip
 * on top — last issue, Exchange updated, next newsletter, the queue count —
 * then the shared submit form with the four quick links in the right rail
 * (Content sort, Newsletter, Share something, Listserv sign-up), and the
 * queue table folded under the strip's count. Home is the front door, so the
 * header's tabs are hidden on it (app.js sets body.is-front). The form is
 * mounted once and left alone on re-renders so typing is never wiped; the
 * strip and the rail rebuild.
 */
import { renderSubmitForm } from './submit-form.js';
import { dotsLoader, faIcon } from './icons.js';
import { renderQueueTable } from './queue-ui.js';
import { queueBadgeCount, shareLine, signupLine } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';

const EXCHANGE_URL = 'https://erc-policy-exchange.vercel.app/';
// The public share and sign-up pages live in the Policy Exchange hub — a
// separate origin from the desk on purpose: nothing on them can lead back here.
const SHARE_PATH = 'https://erc-policy-exchange.vercel.app/share/';
const SIGNUP_PATH = 'https://erc-policy-exchange.vercel.app/newsletter/';
const BUILDER_PATH = '/builder/';

// The queue table is folded until the strip's count is clicked (Kate, Sep 15:
// "idk if i like it below"; her pick: keep it, folded). View state, so a data
// re-render keeps it open once opened.
let queueOpen = false;

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

export function renderHome(container, {
  rows, schedule, today, loaded, hubUpdated, lastIssue,
  onGoTo, onSubmitted, onRefresh, onDeleteFromQueue,
}) {
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
    const queue = el('section', 'queue-section');
    queue.id = 'home-queue';
    container.replaceChildren(strip, grid, queue);
  }

  // ── The stats strip: one line of facts. ──
  const dash = v => (!loaded ? '…' : (v || '—'));
  strip.replaceChildren();
  strip.append(fact('Last issue', dash(isoToShort(lastIssue, today))));
  strip.append(fact('Exchange updated', dash(isoToShort(hubUpdated, today)), EXCHANGE_URL));
  strip.append(fact('Next newsletter', dash(isoToShort(nextIssueDate(schedule, today), today))));

  const queueFact = el('button', 'strip-fact strip-queue');
  queueFact.type = 'button';
  queueFact.setAttribute('aria-expanded', String(queueOpen));
  queueFact.setAttribute('aria-controls', 'home-queue');
  queueFact.append(el('span', 'strip-label', 'In the queue'));
  const queueSide = el('span', 'strip-side');
  queueSide.append(el('span', 'queue-badge', loaded ? String(queueBadgeCount(rows)) : '·'));
  queueSide.append(el('span', 'strip-label', 'waiting'));
  queueSide.append(faIcon(queueOpen ? 'chevron-up' : 'chevron-down'));
  queueFact.append(queueSide);
  queueFact.addEventListener('click', () => {
    queueOpen = !queueOpen;
    renderHome(container, {
      rows, schedule, today, loaded, hubUpdated, lastIssue,
      onGoTo, onSubmitted, onRefresh, onDeleteFromQueue,
    });
    if (queueOpen) container.querySelector('.queue-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  strip.append(queueFact);

  // ── The quick links, four in the rail (the sketch's list, in its order). ──
  const rail = container.querySelector('.quick-rail');
  rail.replaceChildren(
    quickGo('layer-group', 'Content sort', 'Work the queue', () => onGoTo('sort')),
    quickOut('envelope', 'Newsletter', "Kathy's builder", BUILDER_PATH),
    quickShare('share-nodes', 'Share something', 'The public share page', SHARE_PATH, shareLine(SHARE_PATH)),
    quickShare('user-plus', 'Listserv sign-up', 'The sign-up page', SIGNUP_PATH, signupLine(SIGNUP_PATH)),
  );

  const queueSection = container.querySelector('.queue-section');
  queueSection.hidden = !queueOpen;
  if (!queueOpen) return;
  if (!loaded) queueSection.replaceChildren(dotsLoader());
  else renderQueueTable(queueSection, { rows, schedule, today, onRefresh, onDelete: onDeleteFromQueue });
}
