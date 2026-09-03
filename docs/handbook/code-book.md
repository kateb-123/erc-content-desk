# Code Book

Source of truth for the shipped CSS. Values copied verbatim from `css/styles.css` (desk) and `builder/css/styles.css` (builder). Fonts: Outfit (headings/buttons/pills), Karla (body). One accent blue across both apps: `#1d6ea5`, hover `#19608f`, pressed `#14507a`.

---

## 1. Design tokens

### Desk — `css/styles.css` `:root`

| token | value | role |
|---|---|---|
| `--ink` | `#1c2229` | primary text |
| `--muted` | `#55606c` | secondary text, labels |
| `--line` | `#dbdfe5` | borders, hairlines |
| `--bg` | `#fbfbfd` | page background |
| `--accent` | `#1d6ea5` | primary actions, active pill, links |
| `--tint` | `#eaf2f8` | accent wash — focus ring, active-here pill, info-panel |
| `--ok` | `#1d6f4f` | success text |
| `--err` | `#a32d2d` | destructive / error text |
| `--radius` | `8px` | control corner radius |

### Builder — `builder/css/styles.css` `:root` (`--bp-*`)

| token | value | role |
|---|---|---|
| `--bp-primary` | `#1d6ea5` | primary action, active step |
| `--bp-primary-hover` | `#19608f` | primary hover |
| `--bp-primary-active` | `#14507a` | primary pressed |
| `--bp-primary-tint` | `#eaf2f8` | tinted fills, focus ring |
| `--bp-citron` | `#1d6f4f` | success |
| `--bp-citron-deep` | `#185d42` | completed text |
| `--bp-citron-tint` | `#e3efe8` | success fill |
| `--bp-citron-tint-hover` | `#d8e8df` | success fill hover |
| `--bp-ocean` | `#1d6ea5` | alias of primary |
| `--bp-teal` | `#14507a` | deep accent |
| `--bp-destructive` | `#a32d2d` | delete / remove |
| `--bp-ink` | `#1c2229` | headings |
| `--bp-body` | `#1c2229` | body text |
| `--bp-muted` | `#55606c` | secondary text |
| `--bp-faint` | `#76828f` | tertiary text, inactive pill |
| `--bp-ghost` | `#a7b1bc` | placeholder, disabled text |
| `--bp-page` | `#fbfbfd` | page background |
| `--bp-card-border` | `#dbdfe5` | card border |
| `--bp-line` | `#dbdfe5` | hairline / border |
| `--bp-hairline` | `#eef1f5` | faint divider, toolbar bg |
| `--bp-input-border` | `#dbdfe5` | input border |
| `--bp-row-hover` | `#f4f8fb` | row / secondary-button hover |
| `--bp-heading-font` | `'Outfit', 'Segoe UI', sans-serif` | headings, buttons, pills |
| `--bp-body-font` | `'Karla', 'Segoe UI', sans-serif` | body |
| `--bp-focus-ring` | `0 0 0 3px var(--bp-primary-tint)` → `0 0 0 3px #eaf2f8` | focus box-shadow |

---

## 2. Components

Desk base button + primary
```css
button { font: inherit; font-family: Outfit, "Segoe UI", sans-serif; font-weight: 600; padding: .5rem 1rem; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; color: var(--ink); cursor: pointer; }
button:hover:not(:disabled) { border-color: var(--ink); }
button:disabled { opacity: .5; cursor: default; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
```

Builder `.btn` + `.btn-primary`
```css
.btn { font-family: var(--bp-heading-font); font-size: 13.6px; font-weight: 600; padding: 9px 22px; border: 1px solid transparent; border-radius: 8px; cursor: pointer; transition: background 0.15s, box-shadow 0.15s, opacity 0.15s; letter-spacing: 0; }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-primary { background: var(--bp-primary); color: #fff; }
.btn-primary:not(:disabled):hover { background: var(--bp-primary-hover); }
.btn-primary:not(:disabled):active { background: var(--bp-primary-active); box-shadow: none; }
```

`.btn-outline` (desk)
```css
.btn-outline { background: #fff; border: 1px solid var(--line); color: var(--ink); }
.btn-outline:hover:not(:disabled) { border-color: var(--ink); }
```

`.linkish` family — quiet action words (desk)
```css
.linkish { border: none; background: none; padding: 0; color: var(--accent); cursor: pointer; font-size: .85rem; font-weight: 600; white-space: nowrap; }
.linkish .fa-solid { margin-right: .3rem; font-size: .9em; }
.linkish.skip-link, button.skip-link { color: var(--muted); }
.linkish.skip-link:hover:not(:disabled), button.skip-link:hover:not(:disabled) { color: var(--ink); }
button.trash-link, .trash-link { color: var(--err); }
.f-verify-actions .linkish .fa-solid, .trash-link .fa-solid { margin-right: .3rem; font-size: .9em; }
.edit-link { color: var(--accent); font-weight: 600; font-size: .95rem; }
.edit-link .fa-solid { margin-right: .3rem; font-size: .9em; }
```

Nav pills — `.screen-tab` (desk)
```css
.screen-tab { border: none; border-radius: 999px; background: none; padding: .45rem 1rem; color: var(--muted); font-family: Outfit, "Segoe UI", sans-serif; font-weight: 600; font-size: .85rem; }
.screen-tab:hover:not(:disabled):not(.is-active) { border: none; background: #e5edf4; color: var(--accent); }
.screen-tab.is-active { color: #fff; background: var(--accent); }
```

Nav pills — `.step-indicator` (builder; numbered via CSS counter, checkmark when completed)
```css
.step-indicator { display: flex; align-items: center; gap: 8px; font-family: var(--bp-heading-font); font-size: 12.5px; font-weight: 700; text-transform: none; letter-spacing: 0; color: var(--bp-faint); background: var(--bp-page); padding: 7px 16px 7px 9px; border-radius: 999px; border-bottom: 0; margin-bottom: 0; cursor: pointer; transition: background 0.18s, color 0.18s, box-shadow 0.18s; white-space: nowrap; position: relative; }
.step-indicator::before { counter-increment: step-counter; content: counter(step-counter); display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 700; font-family: var(--bp-heading-font); background: #dde5ec; color: var(--bp-faint); flex-shrink: 0; transition: background 0.18s, color 0.18s; }
.step-indicator.active { color: #fff; background: var(--bp-primary); border-bottom-color: transparent; }
.step-indicator.active::before { background: rgba(255, 255, 255, 0.28); color: #fff; }
.step-indicator.completed { background: #ECECEC; color: var(--bp-citron-deep); }
.step-indicator.completed::before { content: "\f00c"; font-family: "Font Awesome 7 Free"; font-size: 9px; font-weight: 900; background: #fff; color: var(--bp-citron-deep); }
```

Badges (desk) — bare = ghost fact, dupe = amber caution, star = spotlight
```css
.badge { display: inline-block; font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; margin-right: 0.4rem; background: none; border: 1px dashed var(--line); color: var(--muted); }
.badge-star { background: #fdf3d7; border-color: #f2e3ae; border-style: solid; color: var(--ink); }
.badge-dupe { background: #fdf3d7; border-color: #f2e3ae; border-style: solid; color: #6b4e00; }
```

Cards
```css
.card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 1.5rem; }                                                     /* desk base */
.sort-card { position: relative; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 1.5rem; max-width: 640px; margin: 1rem 0; }  /* desk Sort */
.wizard-step { background: #fff; border: 1px solid var(--bp-card-border); border-radius: 12px; padding: 32px 36px; }                                  /* builder step */
.edit-card { border: 1px solid var(--bp-card-border); border-radius: 12px; background: #fff; padding: 12px 10px; }                                    /* builder edit card */
```

Inputs + focus (desk)
```css
input[type="text"], input[type="url"], textarea, select { width: 100%; font: inherit; padding: .5rem .6rem; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; color: inherit; }
input[type="text"]:focus, input[type="url"]:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--tint); }
```

Inputs + focus (builder)
```css
.edit-card-input, .edit-card-textarea { width: 100%; box-sizing: border-box; font-family: var(--bp-body-font); font-size: 0.9rem; color: var(--bp-body); padding: 7px 9px; border: 1px solid var(--bp-input-border); border-radius: 8px; }
.edit-card-input:focus, .edit-card-textarea:focus { outline: none; border-color: var(--bp-primary); box-shadow: 0 0 0 3px rgba(29, 110, 165, 0.18); }
.btn:focus-visible { outline: none; box-shadow: var(--bp-focus-ring); }
```

`.info-panel`
```css
.info-panel { background: var(--tint); border-radius: 8px; padding: .7rem 1rem; margin: .6rem 0 .4rem; font-size: .9rem; color: #2b4a61; max-width: 46rem; }                    /* desk */
.info-panel { background: var(--bp-primary-tint, #eaf2f8); border-radius: 8px; padding: .7rem 1rem; margin: 0 0 .9rem; font-size: .9rem; color: #2b4a61; max-width: 46rem; }    /* builder */
```

Amber bubble (desk) — one ink `#6b4e00`, fill `#fdf3d7`, border `#f2e3ae`
```css
.link-alert { margin: .6rem 0 .2rem; font-size: .85rem; color: #6b4e00; background: #fdf3d7; border: 1px solid #f2e3ae; border-radius: 8px; padding: .55rem .9rem; }
.link-alert .alert-mark { color: #6b4e00; margin-right: .15rem; font-size: .9em; }
.link-alert a { color: #6b4e00; font-weight: 600; }
.alert-btn { font-size: .8rem; padding: .25rem .7rem; background: #fff; color: #6b4e00; border: 1px solid #ecd9a0; border-radius: 999px; }
.nl-ask { display: block; width: fit-content; margin: .35rem 0 .1rem; font-size: .85rem; color: #6b4e00; background: #fdf3d7; border: 1px solid #f2e3ae; border-radius: 8px; padding: .35rem .7rem; }
```

Loader `.dots-loader` (desk; identical block in builder, both use desk blues)
```css
.dots-loader { position: relative; height: var(--dl-s, 20px); width: var(--dl-w, 250px); margin: 1.5rem auto; }
.dots-loader .dot { position: absolute; height: var(--dl-s, 20px); width: var(--dl-s, 20px); border-radius: 100%; border: 2px solid #fff; box-sizing: border-box; animation: dots-slide 3s ease-in-out infinite; }
.dots-loader .dot:nth-child(1) { background: #9ec9e8; animation-delay: .5s; }
.dots-loader .dot:nth-child(2) { background: #63a3cd; animation-delay: .4s; }
.dots-loader .dot:nth-child(3) { background: #4a8cbf; animation-delay: .3s; }
.dots-loader .dot:nth-child(4) { background: #1d6ea5; animation-delay: .2s; }
.dots-loader .dot:nth-child(5) { background: #19608f; animation-delay: .1s; }
.dots-loader .dot:nth-child(6) { background: #14507a; animation-delay: 0s; }
.dots-mini { --dl-w: 90px; --dl-s: 10px; display: inline-block; vertical-align: middle; margin: 0 8px 0 0; }
```

---

## 3. Responsive & wrap

Flex-wrap patterns
```css
.glance-row { display: flex; flex-wrap: wrap; gap: .75rem 1rem; margin-top: 1.25rem; }                       /* desk — glance cards keep needed width, drop to next line */
.glance-row > .glance-card { flex: 1 1 auto; }
.header-links { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }                             /* builder */
.app-header-inner { display: flex; align-items: baseline; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; max-width: 820px; margin: 0 auto; width: 100%; padding: 0 32px; box-sizing: border-box; }  /* builder */
```

`@media (max-width: 700px)` — desk (three separate blocks)
```css
.sort-body { display: block; }
.sort-nav { flex-direction: row; flex-wrap: wrap; margin-bottom: .8rem; }
.f-facts { border-right: none; padding: 0; }
.f-detail-cols { grid-template-columns: 1fr; }
```

`@media (max-width: 720px)` — desk
```css
.home-grid { grid-template-columns: 1fr; }
```

`@media (prefers-reduced-motion: reduce)` — desk (global near-instant reset)
```css
*, *::before, *::after {
  animation-duration: 0.01ms !important;
  animation-delay: 0ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```

`@media (prefers-reduced-motion: reduce)` — builder (targeted kills)
```css
.dots-loader .dot, .dots-text::after { animation: none !important; }
.tut-ring { transition: none !important; }
.tut-tip { animation: none !important; }
.tut-tip__next--go { animation: none !important; }
```

---

## 4. Motion

Keyframes (desk)
```css
@keyframes rise-in { from { opacity: 0; transform: translateY(4px); } }
@keyframes check-draw { to { stroke-dashoffset: 0; } }
@keyframes slide-in-r { from { opacity: 0; transform: translateX(16px); } }
@keyframes slide-in-l { from { opacity: 0; transform: translateX(-16px); } }
@keyframes settle-out { to { opacity: 0; transform: scale(0.955); } }
@keyframes dots-slide { 15% { transform: translateX(0); } 45%, 65% { transform: translateX(calc(var(--dl-w, 250px) - var(--dl-s, 20px))); } 95% { transform: translateX(0); } }
@keyframes dots-text { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75%, 100% { content: "..."; } }
```

`settle-out` — 200ms `cubic-bezier(0.33, 1, 0.68, 1)`, leaving Sort card
```css
.sort-exit-clone { position: fixed; margin: 0; pointer-events: none; z-index: 10; animation: settle-out 200ms cubic-bezier(0.33, 1, 0.68, 1) forwards; }
```

`slide-in-r` / `slide-in-l` — 180ms `cubic-bezier(0.33, 1, 0.68, 1)`, tab/section switch
```css
.slide-in-right { animation: slide-in-r 180ms cubic-bezier(0.33, 1, 0.68, 1); }
.slide-in-left { animation: slide-in-l 180ms cubic-bezier(0.33, 1, 0.68, 1); }
```

`check-draw` — 350ms `cubic-bezier(0.33, 1, 0.68, 1)`, 80ms delay, confirmation check
```css
.draw-check path { stroke-dasharray: 24; stroke-dashoffset: 24; animation: check-draw 350ms cubic-bezier(0.33, 1, 0.68, 1) 80ms forwards; }
```

`rise-in` — 180ms bulk rows (18ms stagger, capped at 20) / 200ms publish door (250ms delay)
```css
.bulk-table tr.row-in { animation: rise-in 180ms cubic-bezier(0.33, 1, 0.68, 1) both; animation-delay: calc(min(var(--i, 0), 20) * 18ms); }
.pub-done-anim .primary { animation: rise-in 200ms cubic-bezier(0.33, 1, 0.68, 1) 250ms both; }
```

`dots-slide` — 3s `ease-in-out` infinite (declared on `.dots-loader .dot`, per-dot delays in §2)

Button hover / press (desk)
```css
button { transition: border-color .15s ease-out, background-color .15s ease-out, color .15s ease-out, transform .1s ease-out; }
button:active:not(:disabled) { transform: scale(0.98); }
```

`prefers-reduced-motion` — see §3 (desk global reset; builder targeted kills).

---

## 5. Cache-busters

Convention: a `?v=N` query string on every local `css`/`js` link; bump N on change so browsers reload. Comment in `index.html`: "Bump ?v when you change the JS so browsers load the new code." CDN assets (Google Fonts, Font Awesome 7.3.1) carry no `?v` — Font Awesome is pinned by SRI `integrity` instead.

| head | asset | current |
|---|---|---|
| `index.html` (desk) | `/css/styles.css` | `?v=41` |
| `index.html` (desk) | `/js/app.js` | `?v=48` |
| `submit.html` | `/js/submit.js` | `?v=11` |
| `builder/index.html` | `css/styles.css` | `?v=36` |
| `builder/index.html` | `js/app.js` | `?v=27` |

`submit.html` has no CSS cache-buster — its styles are a self-contained inline `<style>` block (outward ERC maroon `#500000`, Work Sans / Open Sans), not the desk theme.
