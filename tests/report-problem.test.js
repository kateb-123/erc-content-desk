// tests/report-problem.test.js: the desk's Report a problem link (the handoff, Oct 22, 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { problemHref, PROBLEM_FORM_URL } from '../js/report-problem.js';

test('no form yet, no link: the desk never shows a dead end', () => {
  assert.equal(problemHref('/#queue', ''), '');
  assert.equal(typeof PROBLEM_FORM_URL, 'string');
});

test('the pre-filled link gets the page in place of PAGE', () => {
  assert.equal(problemHref('/#briefs/holzman-2026', 'https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.1=PAGE'),
    'https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.1=%2F%23briefs%2Fholzman-2026');
  assert.equal(problemHref('/#queue', 'https://forms.gle/abc'), 'https://forms.gle/abc', 'a plain link still works');
});
