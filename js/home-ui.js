/**
 * Home (redesigned Sep 1): a glance row on top — Exchange updated, next
 * newsletter, queue count, the public submission page — then the shared
 * submit form with the two outward doors as cards on the right, and the
 * queue table below. The form is mounted once and left alone on re-renders
 * so typing is never wiped; the glance row and door rail rebuild.
 */
import { renderSubmitForm } from './submit-form.js';
import { renderQueueTable } from './queue-ui.js';
import { queueBadgeCount } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
/** "Aug 26" — the glance row stays slim; full dates live elsewhere. */
function shortDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const EXCHANGE_URL = 'https://kateb-123.github.io/erc-policy-exchange/';
const BUILDER_URL = '/builder/';
const SUBMIT_PATH = '/submit';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function glanceFact(label, value) {
  const card = el('div', 'glance-card');
  card.append(el('span', 'glance-label', label));
  card.append(el('span', 'glance-value', value));
  return card;
}

function doorCard(title, desc, href) {
  const a = el('a', 'door-card');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.append(el('span', 'door-title', `${title} ↗`));
  a.append(el('span', 'door-desc', desc));
  return a;
}

export function renderHome(container, { rows, schedule, today, loaded, hubUpdated, onSubmitted, onRefresh }) {
  let glance = container.querySelector('.glance-row');
  if (!glance) {
    glance = el('div', 'glance-row');
    const grid = el('div', 'home-grid');
    const formSide = el('div', 'home-form card');
    formSide.append(el('h2', '', 'Share something with the ERC'));
    formSide.append(el('p', 'lede', 'Events, research, opportunities, headlines — if it belongs in the newsletter or on the Policy Exchange, drop it here.'));
    const mount = el('div');
    formSide.append(mount);
    renderSubmitForm(mount, { onSubmitted });
    grid.append(formSide, el('aside', 'door-rail'));
    container.replaceChildren(glance, grid, el('section', 'queue-section'));
  }

  // ── The glance row: four one-line cards. ──
  glance.replaceChildren();
  glance.append(glanceFact('Exchange updated', hubUpdated ? shortDate(hubUpdated) : '—'));
  const next = nextIssueDate(schedule, today);
  glance.append(glanceFact('Next newsletter', next ? shortDate(next) : '—'));

  const queueCard = el('button', 'glance-card glance-queue');
  queueCard.type = 'button';
  queueCard.append(el('span', 'glance-label', 'Queue'));
  const queueSide = el('span', 'glance-side');
  queueSide.append(el('span', 'queue-badge', String(loaded ? queueBadgeCount(rows) : 0)));
  queueSide.append(el('span', 'glance-note', 'waiting'));
  queueCard.append(queueSide);
  queueCard.addEventListener('click', () => {
    container.querySelector('.queue-section')?.scrollIntoView({ behavior: 'smooth' });
  });
  glance.append(queueCard);

  const publicCard = el('div', 'glance-card');
  publicCard.append(el('span', 'glance-label', 'Public page'));
  const actions = el('span', 'glance-side');
  const open = el('a', 'glance-btn', 'Open ↗');
  open.href = SUBMIT_PATH;
  open.target = '_blank';
  open.rel = 'noreferrer';
  const copy = el('button', 'glance-btn', 'Copy');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(new URL(SUBMIT_PATH, window.location.origin).href);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = "Can't copy";
    }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  });
  actions.append(open, copy);
  publicCard.append(actions);
  glance.append(publicCard);

  // ── The doors, as cards on the right. ──
  const rail = container.querySelector('.door-rail');
  rail.replaceChildren(
    doorCard('Policy Exchange', 'The public hub everything publishes to.', EXCHANGE_URL),
    doorCard('Build newsletter', 'Assemble the next issue from what the desk staged.', BUILDER_URL),
  );

  renderQueueTable(container.querySelector('.queue-section'), { rows, schedule, today, onRefresh });
}
