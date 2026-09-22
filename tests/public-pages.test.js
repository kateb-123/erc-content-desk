import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The two public pages on the desk's own address (Kate, Sep 22): the share
// form and the listserv sign-up, standalone, outside the Exchange.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('/submit posts the share form to the desk, marked public, behind the bot check', () => {
  const html = read('submit/index.html');
  assert.match(html, /fetch\('\/api\/submit'/);
  assert.match(html, /fetch\('\/api\/listserv'/);   // the add-me box
  assert.match(html, /fetch\('\/api\/newsletter-image'/);
  assert.match(html, /public: true/);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(html, /<title>Submit content to the ERC/);
});

test('/listserv posts the sign-up to the desk, marked public, behind the bot check', () => {
  const html = read('listserv/index.html');
  assert.match(html, /fetch\('\/api\/listserv'/);
  assert.match(html, /public: true/);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(html, /<title>Join the ERC newsletter/);
});

test('both pages wear the outward look, not the desk theme', () => {
  for (const page of ['submit/index.html', 'listserv/index.html']) {
    const html = read(page);
    assert.match(html, /css\/public\.css/);
    assert.doesNotMatch(html, /css\/tokens\.css/);
  }
});
