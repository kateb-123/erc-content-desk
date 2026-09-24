import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANES, pageTitle } from '../js/shell-view.js';
import { deskCards } from '../js/home-panel.js';

// Audit, Sep 23: the Exchange's page had two names, Policy Exchange in the top
// bar and on the front page's card, Publish to Exchange on the page itself. It
// has the lane's one now. publish-ui.js builds the DOM, so its title is read
// from the file.
const src = readFileSync(new URL('../js/publish-ui.js', import.meta.url), 'utf8');

test("the Exchange's page wears the lane's name on the page, in the tab and on the front page's card", () => {
  const lane = LANES.find(l => l.key === 'exchange').label;
  assert.equal(lane, 'Policy Exchange');
  assert.equal(src.match(/screenHead\('([^']+)', 'publish'/)?.[1], lane);
  assert.equal(pageTitle('publish'), `${lane} · ERC Content Desk`);
  assert.equal(deskCards({ counts: null, issue: null, today: '' }).find(c => c.key === 'exchange').label, lane);
  assert.doesNotMatch(src, /Publish to Exchange/, 'the old name is gone from the file');
});

// Kate, Sep 23: one name everywhere, so Finalize's doors say it too.
test("Finalize's doors to the Exchange say Policy Exchange", async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/finalize-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Go to Publish/);
  assert.match(src, /'Go to Policy Exchange'/);
});
