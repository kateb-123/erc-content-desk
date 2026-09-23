import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The team page's Quick links (Kate, Sep 22): the standalone share page and
// listserv sign-up at their own address, and the Exchange itself. team-ui.js
// touches the DOM, so the links are read from the file.
const src = readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8');
const href = key => src.match(new RegExp(`key: '${key}'[^\\n]*href: '([^']+)'`))?.[1];

test('Quick links point at the standalone pages and the Exchange', () => {
  assert.equal(href('share'), 'https://erc-share.vercel.app/submit/');
  assert.equal(href('listserv'), 'https://erc-share.vercel.app/listserv/');
  assert.equal(href('exchange'), 'https://erc-policy-exchange.vercel.app/');
});
