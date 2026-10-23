// tests/report-problem.test.js: Report a problem (the handoff, Oct 22, 2026): a corner
// button that posts to Kate's Google Form; hidden until the form's pre-filled link is set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrefill, problemBody, PROBLEM_FORM_URL } from '../js/report-problem.js';

const LINK = 'https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform?usp=pp_url&entry.111=WHAT&entry.222=PAGE&entry.333=WHO';

test('no form yet: nothing to post to, so the button never shows', () => {
  assert.equal(parsePrefill(''), null);
  assert.equal(parsePrefill('not a url'), null);
  assert.equal(parsePrefill('https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.1=PAGE'), null, 'no WHAT question, no button');
  assert.equal(typeof PROBLEM_FORM_URL, 'string');
});

test('the pre-filled link gives the address to post to and the three answer keys', () => {
  assert.deepEqual(parsePrefill(LINK), {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSexample/formResponse',
    fields: { what: 'entry.111', page: 'entry.222', who: 'entry.333' },
    open: LINK,
  });
});

test('the answers go in as the form takes them', () => {
  const body = problemBody({ what: 'The draft stopped', page: 'https://erc-content-desk.vercel.app/#briefs/x', who: 'Kathy' }, parsePrefill(LINK).fields);
  assert.equal(body.toString(), 'entry.111=The+draft+stopped&entry.222=https%3A%2F%2Ferc-content-desk.vercel.app%2F%23briefs%2Fx&entry.333=Kathy');
});

test('the desk\'s own form link is set and gives all three answer keys (Oct 23)', () => {
  const form = parsePrefill(PROBLEM_FORM_URL);
  assert.ok(form, 'the button shows');
  assert.match(form.action, /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/);
  assert.ok(form.fields.what && form.fields.page && form.fields.who);
});

// Kate, Oct 23: the corner button covered working controls (Skip for now on Sort, a Pick from
// row on Highlight, the builder's edit card). Her pick A: a quiet word in the top bar, before
// Sign out, and her words for it.
test('the help button reads "I need help!" and sits in the top bar, not over the page (Oct 23)', async () => {
  const { HELP_LABEL } = await import('../js/report-problem.js');
  assert.equal(HELP_LABEL, 'I need help!');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/report-problem.js', import.meta.url), 'utf8');
  assert.match(src, /querySelector\('header\.topbar'\)/, 'mounts into the page\'s top bar');
  assert.match(src, /MutationObserver/, 'goes back in when the bar is rebuilt');
  const css = readFileSync(new URL('../css/problem.css', import.meta.url), 'utf8');
  const top = css.match(/\.problem-top \{[^}]*\}/)?.[0] ?? '';
  assert.ok(top, 'the top bar button has its own rule');
  assert.doesNotMatch(top, /position:\s*fixed/, 'it does not float over the page');
});
