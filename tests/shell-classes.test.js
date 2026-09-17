import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Audit round two, d1 and d2: a rule written for one element must not catch
// another that shares its class, and every page that draws the sidebar must
// have the rules the sidebar's markup relies on.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const scripts = dir => readdirSync(new URL(`../${dir}`, import.meta.url)).filter(f => f.endsWith('.js')).map(f => read(`${dir}/${f}`)).join('\n');

test('the skip link\'s class belongs to the skip link alone', () => {
  const cls = read('index.html').match(/<a class="([^"]+)" href="#main">/)?.[1];
  assert.ok(cls, 'index.html has a skip link');
  // A script may look the link up by its selector; none may give the class to an element it builds.
  const literals = (scripts('js') + scripts('builder/js')).match(/(['"`])(?:(?!\1).)*\1/g) ?? [];
  const given = literals.filter(lit => lit.includes(cls) && !/^.[.#]/.test(lit));
  assert.deepEqual(given, [], `no script builds an element with class ${cls}`);
});

test('sr-only and the skip link live in the stylesheet every page loads', () => {
  const sidebar = read('css/sidebar.css');
  assert.match(sidebar, /\.sr-only\s*\{[^}]*clip/);
  assert.match(sidebar, /\.skip-to-main\s*\{/);
  for (const page of ['index.html', 'builder/index.html', 'builder/archive.html']) {
    assert.match(read(page), /css\/sidebar\.css/, `${page} loads the sidebar stylesheet`);
  }
});
