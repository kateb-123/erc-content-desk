/**
 * The front page (Kate's wireframes, Sep 17): the share form on the left,
 * and on the right the three lanes with their counts and the newest items.
 * The form is mounted once and left alone on re-renders, so typing is never
 * wiped; the right column redraws its facts.
 */
import { renderSubmitForm } from './submit-form.js';
import { faIcon } from './icons.js';
import { laneCounts, recentlyAdded } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { LANES, openedScreen } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

function lane(item, onGoTo) {
  const a = el('a', 'lane');
  a.href = item.href;
  a.dataset.key = item.key;
  a.addEventListener('click', event => { event.preventDefault(); onGoTo(openedScreen(new URL(a.href, location.href).hash)); });
  const words = el('span', 'lane-words');
  words.append(el('span', 'lane-name', item.label));
  a.append(words, el('span', 'lane-count'), faIcon('arrow-right'));
  return a;
}

function recentRow(row, today) {
  const box = el('div', 'recent-row');
  box.append(el('div', 'recent-title', row.headline || row.link || '(untitled)'));
  const when = isoToShort(row.submitted_at, today);
  box.append(el('div', 'recent-meta', [row.submitter, when].filter(Boolean).join(' · ')));
  return box;
}

export function renderHome(container, props) {
  const { rows, schedule, today, loaded, loadFailed, onGoTo, onSubmitted, onRefresh, knownLinks } = props;
  // The words, the form and the lanes paint at once; only the counts and
  // the newest items wait on the Sheet read.
  let page = container.querySelector('.home-page');
  if (!page) {
    page = el('div', 'home-page');
    const main = el('div', 'home-main');
    main.append(el('h2', 'home-title', 'Share something with the ERC'));
    const mount = el('div', 'home-form');
    renderSubmitForm(mount, { onSubmitted, knownLinks });
    main.append(mount);
    const side = el('aside', 'home-side');
    const lanes = el('div', 'lanes');
    for (const item of LANES) lanes.append(lane(item, onGoTo));
    const recent = el('section', 'home-block');
    recent.append(el('p', 'block-label', 'Recently added'), el('div', 'recent'));
    side.append(lanes, recent);
    page.append(main, side);
    container.replaceChildren(page);
  }

  // The lanes' counts once the rows are in; Newsletter names the next issue.
  const issue = nextIssueDate(schedule, today);
  const counts = loaded ? laneCounts(rows, issue) : null;
  for (const a of page.querySelectorAll('.lane')) {
    const key = a.dataset.key;
    a.querySelector('.lane-count').textContent = counts ? String(counts[key]) : '';
    if (key === 'newsletter') {
      const words = a.querySelector('.lane-words');
      const sub = words.querySelector('.lane-sub') ?? words.appendChild(el('span', 'lane-sub'));
      sub.textContent = issue ? `Next issue ${isoToShort(issue, today)}` : 'No issue scheduled';
    }
  }

  // The four newest items, or why there are none.
  const recent = page.querySelector('.recent');
  if (!loaded) recent.replaceChildren(loadFailed ? tryAgain(onRefresh) : el('p', 'recent-meta', 'Loading'));
  else {
    const latest = recentlyAdded(rows, 4);
    recent.replaceChildren(...(latest.length ? latest.map(r => recentRow(r, today)) : [el('p', 'recent-meta', 'Nothing yet.')]));
  }
}
