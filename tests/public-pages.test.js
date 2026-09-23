import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The two public pages, the share form and the listserv sign-up, live in
// public-pages/ and deploy as a Vercel project of their own at their own
// address (Kate, Sep 22: pick A). They post to their own /api, which that
// project forwards to the desk server-side, so the desk's address appears
// nowhere a visitor can read it. The desk's own deployment never serves
// the folder.
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const FOLDER = 'public-pages';

const walk = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test('the share page posts to its own /api, marked public, behind the bot check', () => {
  const html = read(`${FOLDER}/submit/index.html`);
  assert.match(html, /fetch\('\/api\/submit'/);
  assert.match(html, /fetch\('\/api\/listserv'/);   // the add-me box
  assert.match(html, /fetch\('\/api\/newsletter-image'/);
  assert.match(html, /public: true/);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(html, /<title>Submit content to the ERC/);
});

test('the sign-up page posts to its own /api, marked public, behind the bot check', () => {
  const html = read(`${FOLDER}/listserv/index.html`);
  assert.match(html, /fetch\('\/api\/listserv'/);
  assert.match(html, /public: true/);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(html, /<title>Join the ERC newsletter/);
});

test('the human check sits above the submit button on both pages (Kate, Sep 22)', () => {
  for (const page of ['submit/index.html', 'listserv/index.html']) {
    const html = read(`${FOLDER}/${page}`);
    const check = html.indexOf('id="cf"');
    const button = html.indexOf('type="submit"');
    assert.ok(check > 0 && button > 0, `${page} has both`);
    assert.ok(check < button, `${page}: the check comes before the button`);
  }
});

test('both pages wear the outward look, not the desk theme', () => {
  for (const page of ['submit/index.html', 'listserv/index.html']) {
    const html = read(`${FOLDER}/${page}`);
    assert.match(html, /css\/public\.css/);
    assert.doesNotMatch(html, /css\/tokens\.css/);
  }
});

test('the folder is self-contained: every root-absolute link resolves inside it', () => {
  for (const page of ['submit/index.html', 'listserv/index.html']) {
    const html = read(`${FOLDER}/${page}`);
    for (const [, target] of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
      const clean = target.replace(/[?#].*$/, '');
      const file = clean.endsWith('/') ? `${clean}index.html` : clean;
      assert.ok(existsSync(new URL(`${FOLDER}${file}`, root)), `${page} links to ${target}, missing from ${FOLDER}/`);
    }
  }
});

test('nothing a visitor can read names the desk', () => {
  const files = walk(new URL(FOLDER, root).pathname).filter(f => !f.endsWith('vercel.json'));
  assert.ok(files.length >= 3, 'the folder holds the pages');
  for (const f of files) {
    if (/\.(png|jpe?g|gif|ico)$/.test(f)) continue;
    assert.doesNotMatch(readFileSync(f, 'utf8'), /erc-content-desk/, `${f} names the desk`);
  }
});

test("the folder's vercel.json forwards /api to the desk server-side, and only that", () => {
  const cfg = JSON.parse(read(`${FOLDER}/vercel.json`));
  assert.deepEqual(cfg.rewrites, [
    { source: '/api/:path*', destination: 'https://erc-content-desk.vercel.app/api/:path*' },
  ]);
  assert.equal(cfg.routes, undefined);
});

test("the desk sends the folder's addresses on to the standalone site", () => {
  // Vercel reads .vercelignore at the repository root for EVERY project built
  // from the repo, so ignoring the folder there emptied the standalone deploy
  // too (Sep 22). The desk redirects instead.
  // Two rules: Vercel's :path* pattern does not match a trailing slash, so
  // /public-pages/submit/ served the page live (Sep 22); :path(.*) does.
  const cfg = JSON.parse(read('vercel.json'));
  assert.deepEqual(cfg.redirects, [
    { source: '/public-pages', destination: 'https://erc-share.vercel.app/', permanent: false },
    { source: '/public-pages/:path(.*)', destination: 'https://erc-share.vercel.app/:path', permanent: false },
  ]);
  const lines = read('.vercelignore').split('\n').map(l => l.trim());
  assert.ok(!lines.includes(`${FOLDER}/`), 'the ignore file would empty the standalone deploy too');
});
