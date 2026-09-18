/**
 * The front page (Kate's wireframes, Sep 17): the share form on the left,
 * and on the right the three lanes with their counts, the newest items, and
 * the links to hand out. The form is mounted once and left alone on
 * re-renders, so typing is never wiped; the right column redraws its facts.
 */
import { renderSubmitForm } from './submit-form.js';
import { faIcon } from './icons.js';
import { laneCounts, recentlyAdded, shareLine, signupLine } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { LANES, EXCHANGE_URL, SHARE_URL, SIGNUP_URL, openedScreen } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

// What each lane says under its name; Newsletter names the next issue.
const LANE_SUB = { sort: 'Review what has come in', exchange: 'Publish to the public site' };

// The links to hand out, each with the sentence its copy button puts on the clipboard.
const HANDOUTS = [
  { label: 'Policy Exchange', href: EXCHANGE_URL, copy: EXCHANGE_URL },
  { label: 'Share an item', href: SHARE_URL, copy: shareLine(SHARE_URL) },
  { label: 'Listserv sign-up', href: SIGNUP_URL, copy: signupLine(SIGNUP_URL) },
];

function block(label, body) {
  const section = el('section', 'home-block');
  section.append(el('p', 'block-label', label), body);
  return section;
}

function lane(item, onGoTo) {
  const a = el('a', 'lane');
  a.href = item.href;
  a.dataset.key = item.key;
  a.addEventListener('click', event => { event.preventDefault(); onGoTo(openedScreen(new URL(a.href, location.href).hash)); });
  const words = el('span', 'lane-words');
  words.append(el('span', 'lane-name', item.label), el('span', 'lane-sub'));
  a.append(words, el('span', 'lane-count'), faIcon('arrow-right'));
  return a;
}

function copyButton(item) {
  const btn = el('button', 'copy-btn');
  btn.type = 'button';
  btn.title = `Copy the link for ${item.label}`;
  btn.setAttribute('aria-label', `Copy the link for ${item.label}`);
  const icon = faIcon('copy');
  btn.append(icon);
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(item.copy);
      icon.className = 'fa-solid fa-check';
      btn.title = 'Copied';
    } catch {
      btn.title = "Can't copy";
    }
    setTimeout(() => { icon.className = 'fa-solid fa-copy'; btn.title = `Copy the link for ${item.label}`; }, 1500);
  });
  return btn;
}

function handoutRow(item) {
  const row = el('div', 'handout-row');
  const a = el('a', null, item.label);
  a.href = item.href; a.target = '_blank'; a.rel = 'noreferrer';
  a.append(' ', faIcon('arrow-up-right-from-square'), el('span', 'sr-only', ' (opens in a new tab)'));
  row.append(a, copyButton(item));
  return row;
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
  // The shell (the words, the form, the lanes) paints at once; only the
  // counts and the newest items wait on the Sheet read.
  let page = container.querySelector('.home-page');
  if (!page) {
    page = el('div', 'home-page');
    const main = el('div', 'home-main');
    const head = el('div', 'home-head');
    head.append(el('h2', '', 'Share something with the ERC'));
    head.append(el('p', 'lede', 'It goes into the queue and someone reviews it before it goes out.'));
    const mount = el('div', 'home-form');
    renderSubmitForm(mount, { onSubmitted, knownLinks });
    main.append(head, mount);
    const side = el('aside', 'home-side');
    const lanes = el('div', 'lanes');
    for (const item of LANES) lanes.append(lane(item, onGoTo));
    const handouts = el('div', 'handouts');
    for (const item of HANDOUTS) handouts.append(handoutRow(item));
    side.append(block('Desk work', lanes), block('Recently added', el('div', 'recent')), block('Links to hand out', handouts));
    page.append(main, side);
    container.replaceChildren(page);
  }

  // The lanes' facts: a count once the rows are in, the next issue's date under Newsletter.
  const issue = nextIssueDate(schedule, today);
  const counts = loaded ? laneCounts(rows, issue) : null;
  for (const a of page.querySelectorAll('.lane')) {
    const key = a.dataset.key;
    a.querySelector('.lane-sub').textContent = key === 'newsletter'
      ? (issue ? `Next issue ${isoToShort(issue, today)}` : 'No issue scheduled')
      : LANE_SUB[key];
    a.querySelector('.lane-count').textContent = counts ? String(counts[key]) : '';
  }

  // The newest items: the four latest rows, or why there are none.
  const recent = page.querySelector('.recent');
  if (!loaded) recent.replaceChildren(loadFailed ? tryAgain(onRefresh) : el('p', 'recent-meta', 'Loading'));
  else {
    const latest = recentlyAdded(rows, 4);
    recent.replaceChildren(...(latest.length ? latest.map(r => recentRow(r, today)) : [el('p', 'recent-meta', 'Nothing yet.')]));
  }
}
