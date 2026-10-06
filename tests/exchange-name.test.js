import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUBS, pageTitle } from '../js/shell-view.js';
import { hubCards } from '../js/home-panel.js';

// Audit, Sep 23: the Exchange's page had two names, Policy Exchange in the top
// bar and on the front page's card, Publish to Exchange on the page itself. It
// has the lane's one now. publish-ui.js builds the DOM, so its title is read
// from the file.
const src = readFileSync(new URL('../js/publish-ui.js', import.meta.url), 'utf8');

test("the Exchange's hub wears its one name in the bar, in the tab and on the front page's card", () => {
  const hub = HUBS.find(h => h.key === 'exchange').label;
  assert.equal(hub, 'Policy Exchange');
  assert.equal(pageTitle('exchange'), `${hub} · ERC Content Desk`);
  assert.equal(hubCards({ rows: [], schedule: [], today: '', loaded: false }).find(c => c.key === 'exchange').label, hub);
  assert.doesNotMatch(src, /Publish to Exchange/, 'the old name is gone from the file');
});

// Kate's drawn map (Oct 6): Publish is a page of its own under the Policy
// Exchange hub, the way the builder sits under Newsletter, so it is named
// for what it does, and the hub keeps the one name.
test('Publish is its own page under Policy Exchange, named Publish', () => {
  assert.equal(src.match(/screenHead\('([^']+)', 'publish'/)?.[1], 'Publish');
  assert.equal(pageTitle('publish'), 'Publish · ERC Content Desk');
});

// Kate, Sep 23: one name everywhere, so Finalize's doors say it too.
test("Finalize's doors to the Exchange say Policy Exchange", async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/finalize-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Go to Publish/);
  assert.match(src, /'Go to Policy Exchange'/);
});
