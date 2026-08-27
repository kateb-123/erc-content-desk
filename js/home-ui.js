/**
 * Home: the shared submit form (70) plus the links panel (30). The form is
 * mounted once and left alone on re-renders so typing is never wiped; only
 * the panel side rebuilds.
 */
import { renderSubmitForm } from './submit-form.js';
import { queueGlance } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { isoToDisplay } from './rows-to-issue.js';

const EXCHANGE_URL = 'https://kateb-123.github.io/erc-policy-exchange/';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function goButton(label, key, onGoTo) {
  const btn = el('button', 'panel-link', label);
  btn.addEventListener('click', () => onGoTo(key));
  return btn;
}

export function renderHome(container, { rows, schedule, today, loaded, onGoTo, onSubmitted }) {
  let panel = container.querySelector('.home-panel');
  if (!panel) {
    const grid = el('div', 'home-grid');
    const formSide = el('div', 'home-form card');
    formSide.append(el('h2', '', 'Share something with the ERC'));
    formSide.append(el('p', 'lede', 'Events, research, opportunities, headlines — if it belongs in the newsletter or on the Policy Exchange, drop it here.'));
    const mount = el('div');
    formSide.append(mount);
    renderSubmitForm(mount, { onSubmitted });
    panel = el('aside', 'home-panel');
    grid.append(formSide, panel);
    container.replaceChildren(grid);
  }

  panel.replaceChildren();
  const next = nextIssueDate(schedule, today);
  panel.append(el('p', 'panel-label', 'Next issue'));
  panel.append(el('p', 'panel-next', next ? isoToDisplay(next) : '—'));

  const queueItem = el('div', 'panel-item');
  queueItem.append(goButton('Queue', 'queue', onGoTo));
  if (loaded) queueItem.append(el('div', 'panel-glance', queueGlance(rows)));
  panel.append(queueItem);

  for (const [label, key] of [['Sort', 'sort'], ['Finalize', 'finalize'], ['Publish', 'publish']]) {
    const item = el('div', 'panel-item');
    item.append(goButton(label, key, onGoTo));
    panel.append(item);
  }

  panel.append(el('hr'));

  const exchange = el('a', 'panel-link', 'Policy Exchange ↗');
  exchange.href = EXCHANGE_URL;
  exchange.target = '_blank';
  exchange.rel = 'noreferrer';
  const exchangeItem = el('div', 'panel-item');
  exchangeItem.append(exchange);
  panel.append(exchangeItem);

  const buildItem = el('div', 'panel-item');
  buildItem.append(goButton('Build newsletter ↗', 'build', onGoTo));
  buildItem.append(el('div', 'panel-glance', 'pulls from the same items'));
  panel.append(buildItem);
}
