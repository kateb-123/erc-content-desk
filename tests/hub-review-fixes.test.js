import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exchangeStatus } from '../js/exchange-view.js';
import { listservStatus } from '../js/listserv-view.js';
import { hubCards } from '../js/home-panel.js';

// The review of the six hubs (Oct 6): what it found, held here.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tokens = read('css/tokens.css');
const css = read('css/styles.css');

/** A token's hex, following var() chains through tokens.css. */
function hex(name) {
  const m = tokens.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`no ${name}`);
  const v = m[1].trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? hex(ref[1]) : v;
}
function contrast(a, b) {
  const lum = h => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const rule = sel => css.match(new RegExp(`${sel.replace(/[.*]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const prop = (body, p) => body.match(new RegExp(`${p}:\\s*var\\((--[\\w-]+)\\)`))?.[1];

test('the On the Exchange tag reads at 4.5:1 or better on its green tint', () => {
  const body = rule('.badge-live');
  const ink = prop(body, 'color'), ground = prop(body, 'background');
  assert.ok(contrast(hex(ink), hex(ground)) >= 4.5, `${ink} on ${ground}`);
});

test('a Forthcoming line is real words, so it reads at 4.5:1 on the white page', () => {
  const ink = prop(rule('.forthcoming'), 'color');
  assert.ok(contrast(hex(ink), hex('--background')) >= 4.5, ink);
});

test('a hub card draws one focus ring, on the card, none on its name', () => {
  assert.match(rule('a.desk-card-go:focus-visible'), /box-shadow:\s*none/);
});

test("the Exchange's last update is the later of the site's own and the desk's last publish", () => {
  const rows = [{ status: 'kept', published_at: '2026-10-06T21:30:00Z' }, { status: 'kept', published_at: '2026-09-20T15:00:00Z' }];
  // 21:30 UTC on Oct 6 is still Oct 6 in College Station.
  assert.equal(exchangeStatus({ rows, today: '2026-10-07', loaded: true, preview: null, hubUpdated: '2026-10-01' }).updated, 'Oct 6');
  assert.equal(exchangeStatus({ rows: [], today: '2026-10-07', loaded: true, preview: null, hubUpdated: '2026-10-01' }).updated, 'Oct 1');
  const card = hubCards({ rows, schedule: [], today: '2026-10-07', loaded: true, hubUpdated: '2026-10-01' }).find(c => c.key === 'exchange');
  assert.equal(card.foot, 'Live · updated Oct 6');
});

test('a sign-up count that failed says so, never Checking forever', () => {
  assert.deepEqual(listservStatus({ error: true }, '2026-10-07'), { form: "Couldn't check just now", last: '', waiting: null, note: '', retry: true, updated: '' });
  const card = hubCards({ rows: [], schedule: [], today: '2026-10-07', loaded: true, signups: { error: true } }).find(c => c.key === 'listserv');
  assert.equal(card.count, null);
  assert.equal(card.foot, '');
  assert.match(read('js/listserv-ui.js'), /Try again/);
});

test('the sign-in keeps what was typed when the page redraws under it', () => {
  const src = read('js/auth-ui.js');
  assert.match(src, /const typed = container\.querySelector\('#signin-password'\)\?\.value \?\? ''/);
  assert.match(src, /field\.value = typed/);
});

test('the Exchange and Listserv hubs keep the keyboard\'s place, and a Copy link its word, across a redraw', () => {
  for (const file of ['js/exchange-ui.js', 'js/listserv-ui.js']) {
    const src = read(file);
    assert.match(src, /focusKeyIn\(container\)/, file);
    assert.match(src, /restoreFocus\(container, focusKey/, file);
  }
  assert.match(read('js/listserv-ui.js'), /container\.querySelector\('\.ql-copy'\) \?\? copyLinkButton\(FORM\)/);
});
