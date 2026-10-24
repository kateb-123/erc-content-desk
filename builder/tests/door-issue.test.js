// builder/tests/door-issue.test.js: three builder fixes from the intent
// audit, each Kate's yes (Oct 23, 2026).
// INT-16: Next issue's Open the builder carries its issue and the builder
//   opens on it, which pulls it; a draft for another issue still asks first.
// INT-17: Remove is the red ghost word in the Outline, as on the desk.
// INT-2: the Outline says the draft is kept in this browser only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEmptyIssue } from '../js/model.js';
import { doorIssueOf, doorPick } from '../js/auto-pull.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const app = read('builder/js/app.js');
const css = read('builder/css/styles.css');

function draft(date, titles = []) {
  const issue = createEmptyIssue();
  issue.date = date;
  for (const [n, title] of titles.entries()) {
    issue.sections.headlines.items.push({ id: `desk_r${n}`, group: 'texas', fields: { title, url: `https://x.org/${n}` } });
    issue.sections.headlines.enabled = true;
  }
  return issue;
}

test('the door\'s issue is read from ?issue=, a real date from today on', () => {
  const today = '2026-10-23';
  assert.equal(doorIssueOf('?issue=2026-10-27', today), '2026-10-27');
  assert.equal(doorIssueOf('?x=1&issue=2026-10-27', today), '2026-10-27', 'among other parameters');
  assert.equal(doorIssueOf('?issue=2026-10-23', today), '2026-10-23', 'an issue that sends today');
  assert.equal(doorIssueOf('?issue=2026-10-13', today), '', 'a past issue, from an old link');
  assert.equal(doorIssueOf('?issue=2026-02-30', today), '', 'no such day');
  assert.equal(doorIssueOf('?issue=October%2027', today), '', 'not an ISO date');
  assert.equal(doorIssueOf('', today), '');
  assert.equal(doorIssueOf(undefined, today), '');
});

test('the door\'s issue is picked the way the Issue list picks it', () => {
  const iso = '2026-10-27';
  assert.equal(doorPick(null, iso), 'fresh', 'nothing open: the issue opens empty and pulls');
  assert.equal(doorPick(draft('October 27, 2026', ['A']), iso), 'stay', 'already on it');
  assert.equal(doorPick(draft('October 13, 2026', ['A']), iso), 'ask', 'a draft for another issue asks first');
  assert.equal(doorPick(draft('October 13, 2026'), iso), 'redate', 'an empty draft takes the date, as the list does');
  assert.equal(doorPick({ ...draft('October 27, 2026', ['A']), sample: 'practice' }, iso), 'fresh', 'a sample is never kept');
  assert.equal(doorPick(draft('October 13, 2026', ['A']), ''), 'none', 'no door issue');
});

test('the builder opens on the door\'s issue once the draft question is settled', () => {
  assert.match(app, /doorIssueOf\(location\.search, todayCentral\(\)\)/, 'read once, from the address');
  assert.match(app, /history\.replaceState\(/, 'and taken off the address, so a reload never asks again');
  // No saved draft: straight to the issue. A saved one: the banner answers first.
  assert.match(app, /if \(savedIssue\) showRestoreBanner\(savedIssue\);\s*else takeDoorIssue\(\);/);
  assert.match(app, /openDraft\(saved\);\s*takeDoorIssue\(\);/, 'Restore, then the door\'s issue');
  assert.match(app, /if \(!takeDoorIssue\(\) && state\.step === 'triage'\) renderTriage\(\);\s*setWizardStatus\('Discarded\.'\);/, 'Discard, then the door\'s issue');
  // The replace ask stays up across the Outline's redraws until it is answered.
  assert.match(app, /if \(doorAsk\) \{[^}]*askNewIssue\(doorAsk\)/);
});

test('Next issue\'s door names its issue', () => {
  assert.match(read('js/issue-ui.js'), /door\.href = `\/builder\/\?issue=\$\{issue\}`;/);
});

test('the Outline\'s Remove is red at rest, the desk\'s red ghost word (INT-17)', () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, sel]) => /\.outline-remove\b/.test(sel));
  for (const [, sel, body] of rules) assert.doesNotMatch(body, /color:\s*var\(--text-secondary\)/, `gray Remove in: ${sel.trim()}`);
  assert.match(css, /\.ghost-btn--danger \{ color: var\(--button-danger-secondary\); \}/);
  assert.match(app, /button\(' Remove', 'ghost-btn ghost-btn--danger outline-remove'/);
});

test('the Outline says the draft is saved in this browser only (INT-2)', () => {
  assert.match(app, /'This draft is saved in this browser only\.'/);
  assert.match(app, /dateSelect\.setAttribute\('aria-describedby', savedLine\.id\)/, 'read with the Issue list');
  assert.match(css, /\.triage-field-help \{/);
});

test('the builder page asks for the new script and styles', () => {
  const page = read('builder/index.html');
  assert.ok(Number(page.match(/css\/styles\.css\?v=(\d+)/)[1]) >= 70);
  assert.ok(Number(page.match(/js\/app\.js\?v=(\d+)/)[1]) >= 70);
});

test('a pick from the Issue list answers the door\'s ask for good: it does not come back on the next Outline draw (review, Oct 23)', () => {
  assert.match(app, /dateSelect\.addEventListener\('change', \(\) => \{\n\s*scheduleNote\.replaceChildren\(\);[^\n]*\n\s*doorAsk = '';/);
  assert.match(app, /function openSample\(def\) \{[\s\S]{0,400}?doorAsk = '';/);
});
