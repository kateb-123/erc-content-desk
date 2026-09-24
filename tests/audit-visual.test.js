import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The usability audit of Sep 23, 2026, Kate's picks: the ring drawn inside
// where a list clips it, warning words on the warning tint in orange brown, a
// darker word on the locked Keep and next, and the teal tab icon.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const uncomment = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const styles = read('css/styles.css');

const tokens = Object.fromEntries([...uncomment(read('css/tokens.css')).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
/** A token's value with every var() followed down to the literal. */
function resolve(name) {
  let value = tokens[name];
  while (value?.startsWith('var(')) value = tokens[value.match(/var\((--[\w-]+)\)/)[1]];
  return value;
}

/** WCAG contrast of two #rrggbb colours. */
function contrast(a, b) {
  const lum = hex => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every declaration written for exactly this selector, one string. */
const declsOf = selector => [...uncomment(styles).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(m => m[1].split(',').map(s => s.trim()).includes(selector))
  .map(m => m[2]).join(';');

test('a warning word on the warning tint is orange brown, 4.5:1 or better', () => {
  assert.equal(tokens['--text-warning-on-tint'], '#8f3814');
  const tint = resolve('--notification-warning-background');
  assert.ok(contrast(resolve('--text-warning-on-tint'), tint) >= 4.5, 'orange brown on maize 100');
  assert.ok(contrast(resolve('--tag-color-review'), resolve('--tag-background-review')) >= 4.5, 'the Possible duplicate tag');
  // Publish's Needs a fix word, and a note in its open row, sit on the tint.
  assert.match(declsOf('.publish-table .p-fate-fix'), /color:\s*var\(--text-warning-on-tint\)/);
  assert.match(declsOf('.publish-table tr.p-notready .rewrite-note'), /color:\s*var\(--text-warning-on-tint\)/);
  // On white the orange 500 word passes, so it stays.
  assert.ok(contrast(resolve('--text-warning'), resolve('--background')) >= 4.5, 'orange 500 on white');
});

test('the locked Keep and next says its word at 4.5:1 or better, with the reason under it', () => {
  assert.equal(tokens['--text-locked'], '#4f5d6b');
  assert.ok(contrast(resolve('--text-locked'), resolve('--button-disabled')) >= 4.5);
  assert.match(declsOf('.sort-card .sc-keep:disabled'), /color:\s*var\(--text-locked\)/);
  const why = declsOf('.sc-keep-why');
  assert.match(why, /font:\s*var\(--meta-type\)/);
  assert.match(why, /color:\s*var\(--muted\)/);
  // It sits tight under Keep (the column's 12px gap less 8px), so it reads as
  // Keep's and not as the line above Skip for now.
  assert.match(why, /margin:\s*calc\(-1 \* var\(--spacing-03\)\) 0 0/);
});

test('where a list clips what is drawn outside a control, the ring is drawn inside, 2px teal', () => {
  for (const selector of ['.pill-row .type-word:focus-visible', '.sort-list .sort-row:focus-visible', '.f-list .f-list-row:focus-visible']) {
    assert.match(declsOf(selector), /box-shadow:\s*inset 0 0 0 2px var\(--color-teal-400\)/, selector);
  }
  // The lists still clip, and every other control keeps the system's ring.
  assert.match(declsOf('.pill-row'), /overflow:\s*hidden/);
  assert.match(declsOf('.sort-list'), /overflow:\s*hidden/);
  assert.match(declsOf('button:focus-visible'), /box-shadow:\s*var\(--focus-ring\)/);
});

test('the tab icon is a teal square with a white check, the same on both apps', () => {
  const icons = ['index.html', 'builder/index.html'].map(page => {
    const href = read(page).match(/<link rel="icon" href="([^"]+)"/)?.[1];
    assert.ok(href, `${page} has a tab icon`);
    assert.match(href, /%3Crect width='32' height='32' rx='4' fill='%231d7491'\/%3E/, `${page}: the teal square`);
    assert.match(href, /%3Cpath d='M9 16\.5l5 5 9-11' fill='none' stroke='%23ffffff' stroke-width='3\.4'/, `${page}: the white check`);
    return href;
  });
  assert.equal(icons[0], icons[1]);
});

// Kate, Sep 23: the picked type is filled teal, so the teal ring vanishes on
// it; there the ring is a 2px white line inside instead.
test('the picked type shows focus as a white line inside its teal fill', () => {
  assert.match(declsOf('.pill-row .type-word.is-picked:focus-visible'), /box-shadow:\s*inset 0 0 0 2px var\(--text-on-color\)/);
});

// Kate, Sep 23: "i HATE yellow outline". No focus ring anywhere is maize: the
// ring is teal, 2px, standing 2px off the control on a white gap.
test('no focus ring anywhere is yellow', () => {
  assert.equal(tokens['--focus-ring'], '0 0 0 2px var(--background), 0 0 0 4px var(--color-teal-400)');
  assert.doesNotMatch(tokens['--focus-inset'] ?? '', /maize/);
});

test("the builder's buttons show the same ring, not a 1px line in its place", async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../builder/css/styles.css', import.meta.url), 'utf8');
  const rule = css.match(/\.btn:focus-visible \{([^}]*)\}/)[1];
  assert.match(rule, /box-shadow:\s*var\(--focus-ring\)/);
});
