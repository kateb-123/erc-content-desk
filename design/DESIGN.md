# Design spec: ERC Content Desk + Newsletter Builder

One look across both apps. This file is the source of truth for style decisions —
read it before any UI work. There are no mockups: verification is a screenshot from
the running sandbox (`localhost:4173`, serves `/builder/` too), approved by Kate
before deploy.

## Tokens

Canonical values. Mirrored in code at `css/styles.css` `:root` (desk) and
`builder/css/styles.css` `:root` (builder, prefixed `--bp-`).

| Token | Value | Use |
|---|---|---|
| accent | `#1d6ea5` | the one brand color — filled buttons, links, active pills |
| accent hover / active | `#19608f` / `#14507a` | button states |
| tint | `#eaf2f8` | ERC/held row highlight, focus halo, soft fills |
| ink | `#1c2229` | body text |
| muted | `#55606c` | secondary text, quiet labels |
| line | `#dbdfe5` | borders, hairlines |
| page | `#fbfbfd` | page background (both apps) |
| ok | `#1d6f4f` | success |
| err | `#a32d2d` | destructive text/links (Delete, Remove) |
| amber alert | bg `#fdf3d7`, text `#6b4e00`, line `#f2e3ae` | needs-attention bubbles, alerts, and the needs-a-rewrite row tint (`--amber-bg`, `--amber`, `--amber-line` since Sep 15; the old second amber `#fdf5dd` is gone) |
| hover fill | `rgba(29,110,165,.05)` | row hover, layered over whatever tint the row has (`--hover`) |
| accent deep | `#14507a` | the active shade as text: New badge, picked chip, Adding chip (`--accent-deep`) |

The builder's `--bp-*` tokens mirror these values (unified in the Sep 2, 2026
uniformity pass: `--bp-ink`, `--bp-card-border`, and `--bp-input-border` all
resolve to the desk values now). Since Sep 16 the builder also carries the desk's
sidebar (`css/sidebar.css`, shared), so its `:root` mirrors the desk names that
stylesheet reads (`--side-bg`, `--ink`, `--muted`, `--line`, `--accent`, `--tint`,
`--accent-deep`, `--ok`, `--hover`). It names its own alert colors too (`--bp-amber-bg`, `--bp-amber`,
`--bp-amber-line`, `--bp-tint-ink`, `--bp-destructive-tint`, `--bp-destructive-line`,
`--bp-citron-line`), and its finished steps sit on `--side-bg` like every other quiet
surface (style audit, Sep 16). `#19608f` is the accent's HOVER shade only,
never a resting color.

Maroon `#500000` is FORBIDDEN in-app — it lives only in the newsletter email
template and the public Exchange site.

## Type

- **Outfit** — headings (h1 1.35rem/700 screen titles), buttons at 600, pills at 700.
- **Karla** — body. Both via Google Fonts. No other faces without approval.

## Shape

- Radii: **8px** controls/inputs · **12px** cards/tables · **999px** pills/chips/badges.
- Focus: accent border + `0 0 0 3px` tint halo (quiet — louder highlights were rejected).
- Active nav pill shadow: `0 2px 10px rgba(29,110,165,.35)`.
- Every page's first line (a screen title, Home's stat cards, the builder's title,
  Past newsletters' title) sits 44px from the top of the window; on the desk the
  status line keeps its one-line slot above it, so a message never moves the page
  (style audit, Sep 16).
- Sort and Finalize share one list row and one card: titles wrap at .88rem with the
  source or type under them in .78rem, the chosen row sits on the tint, and the card
  (1.25rem × 1.4rem padding) stays in view while the list scrolls. The builder's step
  titles sit one size under its page title (1.1rem against 1.35rem).
- The desk's nav is a sidebar down the left of every page (Kate, Sep 16, from the
  Claude Design docs: "I like the sidebar the most. but then I think keep our
  stuff"): 248px, `--side-bg`, four groups in the order of Claude Design's second
  round (Kate's pick, Sep 16): the desk, Policy Exchange, Newsletter, then **Desk
  work** (the pipeline) as a fold that remembers being shut and always opens on a
  pipeline screen. Outfit uppercase group labels carry the group's icon in the
  accent; the Karla items under them carry none and sit indented; Sort shows the
  queue count; the lit item sits on the tint in the deep accent. On a Desk work
  screen the sidebar tucks away (Kate, Sep 16, from four clickable options: "b
  when it's expanded and the button. but also the thin grey bar to the left like
  C"): a 3.5rem strip in `--side-bg` holds one outlined 36px menu button; open,
  the sidebar is back in place and pushes the page over, with a quiet close
  button on the menu button's own spot. A pick, the close button or Escape tucks
  it away; every screen starts tucked. The front door keeps its sidebar. The
  builder's pages carry the same sidebar (Kate, Sep 16, option B: "make the
  newsletter builder behave like the sort does with the menu"): the builder tucks
  it like Desk work, its header bar is gone, and a Newsletter builder title sits
  on the page with the steps under it; Past newsletters keeps it open like Home.
  The builder keeps its bubble wizard pills with numbered circles.

## Icons

Font Awesome 7.3.1 Free via cdnjs — setup in `.font-awesome.md` (read it first).
FA is for small glyph accents; the hand-drawn inline SVGs (drawn check, sliding-dots
loader) stay. Icon elements always carry `aria-hidden="true"`.

## Action vocabulary (the uniformity contract)

Every action element in either app matches this table — same word, same icon, same
look, everywhere it appears.

| Action | Icon | Look | Means |
|---|---|---|---|
| **Keep** | ✓ `fa-check` | filled accent button (the ONE per card) | accept into the pipeline / accept the rewrite |
| **Skip** | — | quiet muted word | park it (status stays `circleback` underneath); it waits under Sort's Skipped pill with Keep and Delete (Sep 15) |
| **Delete** | `fa-trash-can` | red quiet link | trash the ITEM for good (any screen, any time) |
| **Edit** | `fa-pen` | accent quiet link | inline edit, persists on Save |
| **Use original** | `fa-rotate-left` | quiet word | reject the rewrite, keep the Sheet text |
| **Remove** | `fa-trash-can` | red quiet link | take OUT of the newsletter issue (returns to the pool) — shares Delete's icon by Kate's explicit pick |
| **Verify link ↗ → Confirm / Change** | `fa-triangle-exclamation` | amber bubble, one ask | open the source, then stamp it good or paste a new link |
| **View info / Hide info** | — | accent toggle beside every screen/step title | opens the tinted instruction panel |
| **Re-check** | — | linkish in Publish's lede | force a fresh hub check |
| **Upload media** → Replace / Remove media | — | quiet outline button + muted Remove word | attach a picture or PDF flyer to an item (ERC cards in Sort; newsletter items in the builder) — the URL rides the row’s infographic column into the email |
| **Send early? → Confirm / Cancel** | fa-clock on the bubble | amber bubble, one ask (same as Verify link) | picking an event that belongs to a later issue — the words stay bare, the bubble carries the icon |
| Door buttons (Go to Finalize/Publish, Send to Newsletter, the receipt's door) | → `fa-arrow-right` | outlined accent pill, the header's Build newsletter look (Sep 15, option A), right of the screen head | move along the pipeline; the one filled button on a screen is then always its decision |
| **Sidebar items** (ERC Content Desk; Policy Exchange: Policy Exchange, Share an item, Listserv sign-up; Newsletter: Next newsletter, Newsletter builder, Past newsletters; Desk work: Sort, Finalize, Publish to Exchange, Send to Newsletter) | one FA glyph per group heading (`fa-globe`, `fa-envelope-open-text`, `fa-layer-group`), none on the items; the Desk work heading adds a chevron | plain indented rows in the sidebar, the lit one on the tint; the three hand-outs carry a small `fa-copy` icon on the right; Sort carries the queue count | every way around the desk (Kate, Sep 16). Pipeline items open the pipeline in its own window from the front door (`/#sort`, Sep 15) and switch in place inside it; outside pages open a new tab; on the builder's pages every desk page is a plain link (the pipeline still opens its window; the desk, Next newsletter at `/#issue` and the builder's own pages open in place); the copy icon hands over one sentence with the link and turns into a check for a moment |
| **Show the menu / Hide the menu** | `fa-bars` / `fa-xmark` | outlined 8px square on the thin grey strip / quiet icon on the same spot in the sidebar's top row | Desk work screens only: bring the sidebar back in place, tuck it away again (Sep 16) |
| **Keep the rest (N)** | ✓ `fa-check` | filled accent button, right of a Sort section's head | keep every listed row that has a real type and a checked link (Sep 11); one row at a time is Keep on its card (Sep 16) |

Sort is one section at a time (Sep 11 option A; Sep 15 the card stream and the
stacked All view went), drawn as a list and a card (Claude Design round two,
Kate's pick C, Sep 16). The sections sit as pills in one row on top (Needs a
fix, ERC, ERC events, Research, Events, Opportunities, Headlines, Skipped); the
screen lands on the first one that holds anything, Needs a fix first. There is
no All. Under the pills: the section's name, Undo last and Keep the rest, one
hint, then the list on the left and the card on the right (1 : 1.25). A list
row is the title with authors or source · date, plus a New badge on a row that
came in today; the chosen row sits on the tint with a chevron. The card stays in
view while the list scrolls: the type line with Change and the badges on top (as
on Finalize's card), the title, the meta line, the description, notes, Open
source · from whom, then Edit · Delete far left and Skip · Keep right. A
decision moves the card to the row now in its place; decided rows sink to the
bottom of the list, greyed (deleted ones struck through) with Undo. When a
section runs out, a dashed pane takes the card's place and names the next
section that holds anything (or Go to Finalize).

Amber means "needs doing", nowhere else on the screen (Kate, Sep 15). Needs a
fix, the one amber pill, gathers every row that cannot be kept yet (no type,
link not opened) and every possible duplicate; one amber triangle
(`fa-triangle-exclamation`) leads each of its titles, and a fixed row moves to
its section. On the card, the amber fix panel says each reason: **Needs a type**
(the types as radios, the picked type's subtypes indented under it; the subtype
pick is the save, a flat ERC Event saves on the type pick), **Check the link**
(the Verify link ask), **Possible duplicate** (which item it matches). Keep stays
locked at half strength until the type and the link are settled, and its tooltip
says which. Change on the type line opens the same radios in a plain panel with
Cancel. Skipped, last on the menu, holds every parked row of any type (option B,
Sep 15), each wearing its type as a grey badge; its card has Keep and Delete, no
Skip. Spotlight requested is a grey fact badge like External submission.

Placement grammar: tools (Edit) pair with Delete far LEFT of a card footer; the
decision pair (secondary then primary) sits RIGHT; the position counter sits alone
top-right; **one filled button per card**, everything else quiet. Any in-flight
button DISAPPEARS — nothing is re-pushable.

## Motion

All CSS/vanilla; `prefers-reduced-motion` kills everything.

- Decision: NO motion (Kate, Sep 9 — the slide and the shrink were both
  rejected). The decided row greys in place at the bottom of its section with
  Undo; that is what records the decision.
- Tab/section switch: ±16px directional slide, 180ms `cubic-bezier(0.33,1,0.68,1)`.
- Confirmations: SVG check draws itself, 350ms.
- Loading: the sliding-dots track (blue ramp `#9ec9e8` → `#14507a`), label under the
  track with typed trailing dots; mini variant inline in control rows.
- Blocking progress popup (bulk upload's Add all, Sep 10): page dimmed
  `rgba(28,34,41,.45)`, white 12px card, Outfit count `6 of 12` at body size, 8px accent bar on
  a tint track, one muted line under it. No close button, no Escape: it exists to
  stop clicking around mid-upload.
- Buttons: 150ms hover, press scale 0.98.

## Copy

Sentence case. Terse — no redundant prose, no counts in prose unless load-bearing.
No emojis in UI copy (icons are the sanctioned decoration). Same term for the same
thing everywhere (see the vocabulary table).

## Do not

- No new fonts, icon sets, or UI libraries without approval.
- No maroon in-app.
- Decorative blur shadows are OUT (Kate, Sep 2) — flat fills only; focus rings (`0 0 0 3px` tint) stay
- No hardcoded colors/radii where a token exists.
- Nothing is "done" without a screenshot from the running sandbox.

## The public /submit page

Deliberately NOT the desk theme: it wears the ERC's outward maroon — the listserv sign-up's look (Work Sans/Open Sans, white card with the 3px #500000 border and hard offset shadow, uppercase maroon button) — because it faces the public alongside the newsletter and the hub. It never links into the desk. Uniformity audits should hold it against the sign-up page, not against the desk tokens.
