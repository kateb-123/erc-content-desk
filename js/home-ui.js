/**
 * The front page is Kate's own (her answer, Sep 22): cards for the team's
 * page, Content Sort, Newsletter and Policy Exchange with the work waiting
 * on each, and Documentation, forthcoming. The share form moved to the
 * team's page (/#team). The cards paint at once; the counts wait on the
 * Sheet read and the quiet Exchange check.
 */
import { faIcon } from './icons.js';
import { laneCounts, deskCards } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { openedScreen } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

function card(item, onGoTo) {
  const box = el(item.href ? 'a' : 'div', `desk-card${item.href ? '' : ' is-still'}`);
  box.dataset.key = item.key;
  if (item.href) {
    box.href = item.href;
    box.addEventListener('click', event => { event.preventDefault(); onGoTo(openedScreen(new URL(box.href, location.href).hash)); });
  }
  const words = el('span', 'desk-card-words');
  words.append(el('span', 'desk-card-name', item.label), el('span', 'desk-card-sub', item.sub));
  box.append(words, el('span', 'desk-card-count'));
  if (item.href) box.append(faIcon('arrow-right'));
  return box;
}

export function renderHome(container, props) {
  const { rows, schedule, today, loaded, loadFailed, preview, onGoTo, onRefresh } = props;
  let page = container.querySelector('.home-page');
  if (!page) {
    page = el('div', 'home-page');
    const head = el('div', 'page-head');
    head.append(el('h2', 'home-title', 'Desk'), el('p', 'lede', 'What waits on each page.'));
    page.append(head, el('div', 'desk-cards'), el('div', 'home-note'));
    container.replaceChildren(page);
  }
  const issue = nextIssueDate(schedule, today);
  const counts = loaded ? laneCounts(rows, { schedule, issue, today, preview }) : null;
  const grid = page.querySelector('.desk-cards');
  grid.replaceChildren(...deskCards({ counts, issue, today }).map(item => {
    const box = card(item, onGoTo);
    box.querySelector('.desk-card-count').textContent = item.count == null ? '' : String(item.count);
    return box;
  }));
  const note = page.querySelector('.home-note');
  note.replaceChildren(...(!loaded && loadFailed ? [tryAgain(onRefresh)] : []));
}
