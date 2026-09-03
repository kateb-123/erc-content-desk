# Handbook reference set — design

Four reference documents for the ERC Content Desk + Newsletter Builder. Four agents generate them in parallel, each reading the live code read-only and writing one file. Home: `docs/handbook/`. Wave 1 of the shared-drive handoff; the drive move itself is deferred.

## Documents

### 1. `words.md` — every user-facing string
- **Source:** every string rendered to a person across both apps — desk `js/`, `index.html`, `submit.html`, and user-facing `error`/`errors`/`warnings` strings in `api/`; builder `builder/js/`, `builder/index.html`, `builder/archive.html`, and the email template's standing text in `builder/js/template.js`.
- **Content:** every distinct string, deduplicated across both apps. An assembled string appears once with the moving part in `[brackets]`.
- **Excludes:** comments, console logs, class/variable names, tests, fixture/sample data, and any location or context.
- **Format:** grouped by kind — Headings, Buttons, Links, Statuses, Errors, Empty states, Badges, Email standing text. No paths, no commentary.

### 2. `code-book.md` — how it's built
- **Source:** `css/styles.css`, `builder/css/styles.css`, both HTML heads, and the JS that defines component structure and behavior.
- **Content:** design tokens (CSS custom properties with resolved values); component styles (buttons, pills, badges, cards, inputs, info panel, amber bubble, loader) as the actual rules; responsive and wrap rules (flex-wrap patterns, breakpoints); every `@keyframes` and transition with exact duration and easing; the `?v=` cache-buster convention.
- **Format:** labeled code blocks. One label line per block. No essays.

### 3. `brand-book.html` — what it looks like
- **Source:** the live CSS (tokens + component rules) — the source of truth for colors and components.
- **Content:** color swatches with hex and role; type-scale specimens; each component rendered as it actually appears, labeled by its action-vocabulary name and meaning; radii, focus ring, nav pills, badges.
- **Format:** one self-contained HTML page in the desk's own fonts and tokens, light/dark aware. No code shown. No emoji — real Font Awesome or drawn SVG only.

### 4. `connections.md` — what runs it
- **Source:** `package.json`, deploy config, `api/_lib/` env references, `apps-script/`, git remotes, README.
- **Content:** every account and service this project depends on — GitHub repos (kateb-123: erc-content-desk, erc-policy-exchange; erc-kate: erc-tools), the Vercel project, the Google Sheet + Apps Script web app, the Anthropic API. Per service: what it holds, which token or secret authorizes it (**name only**), what reads and writes it. A dependency table (what feeds what) and a one-line "if this account goes away" note per row.
- **Scope:** only services this project uses. No unrelated accounts or emails.

## Execution
- Four agents launched together, model chosen per task.
- Each reads the repo read-only and writes exactly one output file — distinct outputs, so no collision and no worktree isolation needed.
- After all four land: one verify pass — read each against the live code, fix drift, cut any slop.

## Hard rules (every agent)
- **No AI-slop text.** No intros, no preamble restating a heading, no "this document provides," no hedging, no filler. Data as tables and lists. Every line earns its place.
- **Never print a secret value.** Env-var and token names only.
- **Exact values from source.** No rounding, no inventing, no memory — read the code.

## Acceptance
- Four files in `docs/handbook/`.
- Each matches the live code (verify pass).
- `words.md`: no duplicates, no locations.
- `brand-book.html`: renders, no emoji, matches live component styling.
- `connections.md`: every service listed, no secret values.
- Kate reviews and approves.
