import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// DESIGN.md: a colour is written down in css/tokens.css and nowhere else, and
// every page reads its colours through a token it loads. The census walks each
// page's stylesheets the way the browser does.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const PAGES = ['index.html', 'builder/index.html'];

/** The stylesheets a page loads, as repo paths in load order, plus its inline styles. */
function sheetsOf(page) {
  const html = read(page);
  const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
  const linked = [...html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"/g)]
    .map(m => m[1])
    .filter(href => !/^https?:/.test(href))   // Font Awesome comes from the CDN
    .map(href => (href.startsWith('/') ? href.slice(1) : dir + href));
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  return { linked, inline };
}

const defined = css => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
// A bare var(--x); var(--x, fallback) is a choice the sheet makes on purpose (the sidebar's row hover).
const used = css => new Set([...css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map(m => m[1]));

for (const page of PAGES) {
  const { linked, inline } = sheetsOf(page);

  test(`${page}: no colour literal outside css/tokens.css`, () => {
    const sources = linked.filter(p => p !== 'css/tokens.css').map(p => [p, read(p)]);
    inline.forEach((css, i) => sources.push([`${page} <style> ${i + 1}`, css]));
    for (const [name, css] of sources) {
      const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const literals = clean.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi) ?? [];
      assert.deepEqual(literals, [], `${name} writes a colour instead of reading a token`);
    }
  });

  test(`${page}: every token it reads is defined by a sheet it loads`, () => {
    assert.ok(linked.includes('css/tokens.css'), `${page} loads css/tokens.css`);
    const css = linked.map(read).concat(inline).join('\n');
    // A script may set a property on an element (the bulk table's row delay).
    const fromScripts = ['js', 'builder/js'].flatMap(dir =>
      [...read(`${dir}/${dir === 'js' ? 'submit-form.js' : 'app.js'}`).matchAll(/setProperty\('(--[\w-]+)'/g)].map(m => m[1]));
    const defs = new Set([...defined(css), ...fromScripts]);
    const missing = [...used(css)].filter(name => !defs.has(name));
    assert.deepEqual(missing, [], `${page} reads tokens nothing defines`);
  });
}
