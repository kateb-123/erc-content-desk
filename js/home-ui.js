/**
 * Home, the team's main page: four stat cards on top (the queue count, the
 * next newsletter, Exchange updated, the last newsletter), then the shared
 * submit form, and the queue table folded at the bottom (a details, its own
 * chevron). Every way elsewhere is in the top bar. The form and the fold are mounted once and left alone on
 * re-renders, so typing is never wiped and the fold stays the way it was
 * left; the strip and the table inside the fold rebuild.
 */
import { renderSubmitForm } from './submit-form.js';
import { dotsLoader, faIcon } from './icons.js';
import { renderQueueTable } from './queue-ui.js';
import { queueBadgeCount, issueSummary, issueTally } from './home-panel.js';
import { nextIssueDate } from './schedule.js';
import { isoToShort } from './queue-view.js';
import { EXCHANGE_URL, ARCHIVE_PATH } from './shell-view.js';
import { el, tryAgain } from './ui-aids.js';

/**
 * What a stat tile shows for a value: a real value is
 * loud; waiting, a failed read and an empty fact are quiet words, so "Unknown"
 * never wears the display size a date does.
 */
export function statWords({ waiting, failed, value, empty }) {
  if (failed) return { text: "Couldn't load", quiet: true };
  if (waiting) return { text: '…', quiet: true };
  return value ? { text: value, quiet: false } : { text: empty, quiet: true };
}

/**
 * One stat card: an icon, a label, the value in the
 * deep accent, on the tint. An href makes it a link out; an onClick makes
 * it a button; neither makes it a plain card. The cue glyph at the label's
 * right says what the tile does before the mouse arrives: a chevron for the
 * fold, an arrow for a screen, the box-and-arrow for a new tab.
 */
function stat({ icon, label, words, unit, href, onClick, controls, expanded, cue }) {
  const node = el(href ? 'a' : onClick ? 'button' : 'div', 'stat');
  if (href) { node.href = href; node.target = '_blank'; node.rel = 'noreferrer'; }
  if (onClick) { node.type = 'button'; node.addEventListener('click', onClick); }
  if (controls) { node.setAttribute('aria-controls', controls); node.setAttribute('aria-expanded', String(Boolean(expanded))); }
  node.append(faIcon(icon));
  const lab = el('span', 'stat-label', label);
  if (cue) lab.append(faIcon(cue));
  node.append(lab);
  const v = el('span', `stat-value${words.quiet ? ' is-empty' : ''}`, words.text);
  if (unit && !words.quiet) v.append(' ', el('small', '', unit));
  node.append(v);
  if (href) node.append(el('span', 'sr-only', ' (opens in a new tab)'));
  return node;
}

export function renderHome(container, props) {
  const {
    rows, schedule, today, loaded, loadFailed, hubUpdated, lastIssue,
    onGoTo, onSubmitted, onRefresh, onDeleteFromQueue, knownLinks,
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
    renderSubmitForm(mount, { onSubmitted, knownLinks });
    grid.append(formSide);
    // The fold: a native details, closed on arrival, whose open state lives in
    // the DOM (the element is never rebuilt, so a data re-render keeps it).
    const fold = el('details', 'queue-fold');
    fold.id = 'home-queue';
    fold.append(el('summary'), el('div', 'queue-body'));
    fold.addEventListener('toggle', () => container.querySelector('.stat[aria-controls="home-queue"]')?.setAttribute('aria-expanded', String(fold.open)));
    container.replaceChildren(strip, grid, fold);
  }

  // ── The stats: four cards on the tint. ──
  // A card with nothing to show says so in a word, never a dash;
  // a card whose read failed says that. The two outer cards have their
  // own reads and show them as soon as they land.
  const sheet = { waiting: !loaded && !loadFailed, failed: loadFailed && !loaded };
  const issue = nextIssueDate(schedule, today);
  const count = loaded ? String(queueBadgeCount(rows)) : '·';   // the queue card and the fold's heading share it
  strip.replaceChildren(
    stat({
      icon: 'inbox', label: 'In the queue', cue: 'chevron-down',
      words: statWords({ ...sheet, value: loaded ? count : '', empty: '0' }), unit: 'waiting',
      controls: 'home-queue',
      expanded: container.querySelector('.queue-fold')?.open ?? false,
      onClick: () => {
        // Open the fold and put the reader on it; no smooth
        // scroll for anyone who asked for less motion.
        const fold = container.querySelector('.queue-fold');
        fold.open = true;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        fold.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        const summary = fold.querySelector('summary');
        summary.focus({ preventScroll: true });
        container.querySelector('.stat[aria-controls="home-queue"]')?.setAttribute('aria-expanded', 'true');
      },
    }),
    stat({
      icon: 'paper-plane', label: 'Next newsletter', cue: 'arrow-right',
      words: statWords({ ...sheet, value: isoToShort(issue, today), empty: 'Not set' }),
      unit: loaded && issue ? issueTally(issueSummary(rows, issue).inIssue) : '',
      onClick: () => onGoTo('issue'),
    }),
    stat({
      icon: 'globe', label: 'Exchange updated', cue: 'arrow-up-right-from-square',
      words: statWords({ waiting: hubUpdated === null, failed: false, value: isoToShort(hubUpdated, today), empty: 'Unknown' }),
      href: EXCHANGE_URL,
    }),
    stat({
      icon: 'envelope-open-text', label: 'Last newsletter', cue: 'arrow-up-right-from-square',
      words: statWords({ waiting: lastIssue === null, failed: false, value: isoToShort(lastIssue, today), empty: 'None yet' }),
      href: ARCHIVE_PATH,
    }),
  );

  // ── The queue, folded at the bottom. The summary is the heading. ──
  const summary = container.querySelector('.queue-fold summary');
  const badge = el('span', 'queue-badge', count);
  if (loaded) badge.append(el('span', 'sr-only', ' waiting'));
  summary.replaceChildren(faIcon('chevron-down'), el('h2', '', 'In the queue'), badge);
  const body = container.querySelector('.queue-body');
  if (!loaded) body.replaceChildren(loadFailed ? tryAgain(onRefresh) : dotsLoader());
  else renderQueueTable(body, { rows, today, onRefresh, onDelete: onDeleteFromQueue });
}
