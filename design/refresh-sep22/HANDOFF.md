# Handoff: ERC Content Desk refresh — Submit content + Content Sort

## Overview

Two screens of the ERC Content Desk, restyled off IBM Carbon and restructured to
Kate's Sep 22 sketch:

1. **Submit content** (was the front page, "Share something with the ERC") — the
   team's submit form, plus three public Quick links, two doors into the working
   apps, and a read-only view of the queue.
2. **Content Sort** (was "Sort content") — the triage queue with its two tabs,
   Sort and Finalize. The review card is rebuilt in two columns.

The pipeline itself is unchanged: a link lands in the queue, Sort gives it a
type and a destination, Finalize checks the ERC-voice rewrite, then it goes to
the Newsletter or the Policy Exchange.

## About the design files

`designs/Submit content.dc.html` and `designs/Content Sort.dc.html` are **design
references written in HTML**. They are prototypes of the intended look and
behaviour — not production code to lift. They render through a small runtime
(`designs/support.js`, which must sit beside them) that is part of the design
tool, not part of the desk.

The task is to **recreate these designs in the desk's existing environment**:
vanilla JavaScript modules, no build step, no framework, with the values living
in `design-system/tokens.css` and the markup in the desk's own stylesheets. Do
not port the runtime, the `<x-dc>` wrapper, the `{{ }}` template holes or the
`sc-for` / `sc-if` elements — they are authoring conveniences. Read them as
"repeat this row per item" and "render this when true".

Both files open directly in a browser if you want to click through them.

## Fidelity

**High fidelity.** Final colours, type, spacing and interaction behaviour. Every
value in this README is the value in the design; recreate it to the pixel using
the desk's own CSS. Stand-in content (queue items, sources, dates, URLs) is
placeholder data — wire it to the real queue. Anything in square brackets, e.g.
`[SOURCE]`, is a value the desk does not have yet.

## What this refresh changes about the design system

The refresh deliberately breaks several rules in `design-system/DESIGN.md`.
Those rules need updating, not enforcing:

| Was (Carbon, Sep 17) | Now |
|---|---|
| IBM Plex Sans 300/400/600, one family | **Archivo** 400/500/600 for UI, **Lora** 500 for page titles and big numerals (both Google Fonts) |
| White page ground | **Cream** page ground `#f6f3ec`; cards and lists are white boxes on it |
| Radius 0 on everything but tags | **2px** on buttons, fields and boxes; 12px on pills |
| Desk fills are ink, navy belongs to the builder | **Navy `#1e416b` fills on the desk too** (primary buttons, the picked type chip) |
| Group labels sentence case, no uppercase anywhere | **Uppercase 12px/.7px tracking** micro-labels, and section headers sit over a **2px orange rule** |
| Grey Carbon layers (`--layer-01` `#f4f4f4`) inside cards | An **ink wash** (`rgba(35,32,27,.045)`) for inner surfaces |
| Carbon's inline notification tints | Kept for the "needs doing" note only: Globe blue `#e8f2f6` on a `#006c93` bar |

Unchanged and still binding: **orange only marks** — it never fills a button and
never carries text (2.5:1 on white); **no maroon in-app**; **no shadows
anywhere**; colour is never the only signal (a status colour always ships with
its icon and a word); every value lives in one tokens file.

`theme-tokens.css` in this bundle is the new value set, written in the same
spirit as `design-system/tokens.css`. Merge it in and repoint the stylesheets.

## Naming changes

- "Sort content" is now **Content Sort**, everywhere (page title, breadcrumb,
  top-bar link, the front page's door).
- The front page is now **Submit content**, breadcrumbed as
  `ERC Content Desk / Submit content`.
- The internal Policy Exchange page keeps its top-bar link but is no longer a
  door on the front page. (Open question — see the end of this file.)

---

# Screen 1 — Submit content

**Purpose.** Anyone on the team pastes a link and it lands in the queue. The
right column carries the three public links people share, and the two doors for
the people who work the queue. The Queue block below the form is read-only
visibility: did my item land, is it still waiting.

## Layout

- **Top bar**: 60px tall, on the cream ground, 1px `#e3ddd0` rule under it,
  40px side padding. Left: breadcrumb `ERC Content Desk` (600, ink, links home)
  · `/` in `#c4bcae` · `Submit content` in `#6b6156`. Right: `Policy Exchange`
  as a quiet link (`#6b6156`, ink on hover, no underline).
- **Content column**: `max-width: 1280px`, padding `28px 56px 72px`.
- **Status line**: a permanent 20px slot at the top of the column, meta type,
  `#6b6156`. Holds "Added: <title>." with an underlined **Undo** beside it. It
  always occupies its line so a message never moves the page.
- **Page head**: `margin-top: 8px`. Title `Submit content` in Lora 34/43 500,
  letter-spacing -.2px. Lede under it at 16/25 `#6b6156`, `margin: 6px 0 0`:
  "It lands in the queue and the desk sorts it before it goes out."
- **Two columns**: `display: flex; gap: 64px; align-items: flex-start;
  margin-top: 28px; flex-wrap: wrap`. Left `flex: 1 1 520px`, right
  `flex: 0 1 360px; min-width: 260px`. The page head sits above both, so the
  form box and the Quick links panel share a top edge.

## The form box (left column)

White `#ffffff`, 1px `#ded8cd`, radius 2px, padding 28px, inner
`flex-direction: column; gap: 28px`. Contains, in order:

1. **Paste a link** — label 15px 500 ink. Field 54px tall, `#f4f1e9`, 1px
   `#ded8cd` with a 2px `#8c8478` bottom edge, radius 2px, 17px text, 16px side
   padding, placeholder `https://` in `#a8a096`. Helper under it at 13/18
   `#8c8478`: "We will pull the title and description if we can."
2. **Title** — uppercase label. 40px field, no border but a 1px `#ded8cd`
   bottom rule, transparent ground, 16px text.
3. **Description** — uppercase label. Textarea 116px, same bottom-rule
   treatment, 16/24, `resize: vertical`. Helper: "Dates, abstract, the whole
   announcement. Headlines can skip this."
4. **Type** — uppercase label. A segmented row: five buttons joined by 1px
   `#ded8cd` hairlines inside a 1px `#ded8cd` box, radius 2px with
   `overflow: hidden`, `width: fit-content`. Each 40px tall, 17px side padding,
   15px label. Options: `ERC event`, `New research`, `Event`, `Opportunity`,
   `Headline`. The picked one fills navy `#1e416b` with a `#ffffff` label at
   500; clicking it again clears it.
5. **Your initials / Spotlight request / Add to the queue** — one row,
   `align-items: flex-end; gap: 32px`. Initials: 96px field, bottom rule.
   Spotlight: a 16px native checkbox, `accent-color: #23201b`, label beside it.
   The button sits `margin-left: auto`: 48px tall, 22px side padding, radius
   2px, navy fill, `#fbfaf7` label at 500.
6. **Add a doc or spreadsheet** — a fold. 32px ghost row, chevron on the LEFT
   (15px stroke icon, `rotate(0)` shut, `rotate(90deg)` open, 110ms
   `cubic-bezier(.2,0,.38,.9)`), label `#6b6156` going ink on hover. No rule
   above it. Open: a 1px dashed `#c4bcae` box, radius 2px, `#faf8f4` ground,
   24px padding, holding "Drop a spreadsheet of items, or a doc or PDF flyer."
   with a 13/19 `#8c8478` second line ("A spreadsheet adds one queue item per
   row. Everything else rides along with this submission.") and a
   **Choose a file** outline button (40px, 1px `#8c8478`, fills ink with a
   white label on hover).

> Note: the old front page had both an "Add a doc or spreadsheet" line and a
> separate bulk-upload door. They are merged into this one fold. If the bulk
> import needs its own progress popup, keep the Carbon blocking-progress
> behaviour already spec'd for "Add all".

## Queue (left column, under the form box)

Section header, then rows directly on the cream ground — no box.

- **Header**: `display: flex; align-items: baseline; justify-content:
  space-between; padding-bottom: 9px; border-bottom: 2px solid #ff8200`. Left:
  `QUEUE` in the uppercase label. Right: `13 waiting · newest first` at 13/18
  `#8c8478`.
- **Rows**: 13px vertical padding, 1px `#e3ddd0` rule under each. Title 15/21
  ink; meta 13/19 `#8c8478` — `<source> · added by <who> · <date>`.
- **Footer**: `Showing 6 of 13` at 13/18 `#8c8478`, 12px above.
- Read-only: no hover, no click target, no actions. Row count is capped
  (6 by default).

## Quick links (right column)

Same section header treatment (`QUICK LINKS` over the 2px orange rule), then
three rows, 14px vertical padding, 1px `#e3ddd0` between them, no rule after the
last. Each row: the name as a link (ink, 500, no underline, `#6b6156` on hover)
with an 12px external-link glyph, the URL under it at 13/19 `#8c8478`
(`overflow-wrap: anywhere`), and a **Copy link** button at the right — 13/19
`#6b6156`, underlined, `text-underline-offset: 2px`, ink on hover. On click it
writes the URL to the clipboard and the word becomes **Copied** for 2s.

| Name | URL (stand-in — confirm the real ones) |
|---|---|
| Submit Content to ERC | `https://erc.tamu.edu/submit` |
| Join listserve | `https://erc.tamu.edu/mailing-list` |
| ERC Policy Exchange | `https://erc.tamu.edu/policy-exchange` |

All three are public pages the team shares and links from the newsletter, so
they open in a new tab (`target="_blank" rel="noopener"`).

## Desk work (right column)

`DESK WORK` over the 2px orange rule, then two door rows in a flex column:

- 60px tall, `padding: 0 16px 0 13px`, a 3px `transparent` left border, 1px
  `#e3ddd0` rule under the first row only, no background.
- Label at 15px 500 ink, then the waiting count in **Lora 24/30 500**, then a
  16px arrow glyph stroked `#8c8478`.
- Hover: ground goes `#f7f4ed` and the left border turns `#ff8200`.
- `Content Sort` (13) links to the Sort page; `Newsletter` (8) to the
  newsletter. Counts are what waits on each page.

---

# Screen 2 — Content Sort

**Purpose.** Work the queue one item at a time: give it a type and a subtype,
settle its link, say where it goes, then keep, skip or delete it. The Finalize
tab checks the ERC-voice rewrite of each kept item.

## Layout

Top bar as on Submit content, with `Content Sort` as the current crumb and
`Newsletter` + `Policy Exchange` as the two quiet links on the right (24px gap).
Same status line, same page head (title `Content Sort`, lede "Decide what each
item is, then send it on.").

**Tabs**: `margin-top: 24px`, a row with `border-bottom: 1px solid #e3ddd0`.
Two tab buttons, 44px tall, 14px side padding, `margin-bottom: -1px` so their
bar covers the row's rule. Each carries a count pill:
`rgba(35,32,27,.07)`, radius 12px, `1px 9px` padding, 13/19, `#6b6156`. The lit
tab is ink at 600 over a **2px `#ff8200`** bottom border; the other is `#6b6156`
at 400 over a transparent one. At the row's right, a fact about the page:
`Oldest has waited 29 days`, 13/19 `#8c8478`, 12px above the baseline.

## Sort tab

`display: flex; align-items: flex-start; gap: 24px; margin-top: 24px`.

### The list (left, `flex: 0 1 420px; min-width: 320px`)

White box, 1px `#ded8cd`, radius 2px.

- **Head**: `rgba(35,32,27,.045)` ground, 1px `#e3ddd0` under, `11px 16px`
  padding. Left `13 waiting` at 15px 500; right `Newest first` 13/19 `#8c8478`.
- **Scroll region**: `max-height: 560px; overflow-y: auto`.
- **Row**: `padding: 13px 16px 13px 13px`, 1px `#e3ddd0` under, a 3px
  transparent left border, `cursor: pointer`. A 15px blue `#006c93` warning
  triangle leads the row when the card has a question about it (the exclamation
  is knocked out in the row's own ground). Title 15/21; meta 13/19 `#8c8478` —
  `<source> · added by <who> · <date>`.
- **Chosen row**: 3px `#ff8200` left border, ground `rgba(35,32,27,.06)`, title
  at 600.
- **Order**: waiting items newest first, then skipped ones (each with a grey
  `Skipped` pill at the row's right), then what was kept or deleted this visit —
  those in `#a8a096` with their own underlined **Undo** at the right.
- **Footer**: `Showing 13 of 13` at 13/19 `#8c8478`, `11px 16px`.

### The review card (right, `flex: 1 1 560px; min-width: 420px`)

One white box, 1px `#ded8cd`, radius 2px, split into two columns by a 1px
`#e3ddd0` vertical rule. `align-items: stretch`, both columns 24px padding.

**Left column** (`flex: 1 1 340px`, `gap: 18px`) — the item as it reads:

1. **Kicker row**: `align-items: baseline; justify-content: space-between`. Left:
   the source in the uppercase label (12/16, .7px, 600, ink), then any fact tags
   inline as pills (`rgba(35,32,27,.07)`, radius 12px, `2px 10px`, 13/19
   `#6b6156`) — `External submission`, `Spotlight requested`, `New`,
   `In a past issue`. Right: the position, `1 of 13`, 13/19 `#8c8478`.
2. **Title**: edited in place. A borderless input at 21/28 600, letter-spacing
   -.2px, transparent bottom border that turns `#ded8cd` on hover. Saves as you
   leave it.
3. **One meta line**, 13/19 `#8c8478`, 4px under the title:
   `<date> · added by <who>` · the **domain** as an underlined ink link with an
   11px external glyph · **Change** as a quiet underlined word. The full URL is
   deliberately not shown — the domain is what a person recognises.
4. **The question note** (when the item has one): Globe blue. Ground `#e8f2f6`,
   1px `#006c934d`, a 3px `#006c93` left bar, `14px 16px` padding, the 16px blue
   triangle, a 15px 500 title, a 14/21 `#6b6156` line under it, and a
   **Confirm** outline button (32px, 1px `#8c8478`, fills ink on hover) at the
   right. The three questions: `Check the link` / "Open the source and stamp it
   good, or paste a new link."; `Possible duplicate` / "Another queue item
   points at the same story."; `No type yet` / "Pick a type so the desk knows
   where this belongs."
5. **Description**: the uppercase label, then the text as **prose** at 16/25,
   not a field — `padding: 6px 8px 6px 0`, `cursor: text`, ground
   `rgba(35,32,27,.035)` on hover. Clicking it (or the **Edit** word) swaps in a
   128px textarea: 1px `rgba(35,32,27,.14)`, ground `rgba(35,32,27,.045)`,
   radius 2px, 16/25, `10px 12px` padding. Blur returns it to prose. With no
   description the prose reads "No description yet." in `#8c8478`.
   Under the block, two quiet underlined words 16px apart: **Edit** (becomes
   **Done** while editing) and **Add media**.

**Right column** (`flex: 0 1 300px; min-width: 260px`, `gap: 22px`) — the
decisions:

1. **Type**: uppercase label, which turns `#006c93` while the item has no type.
   Then the five options as a vertical stack, `gap: 6px`: 38px tall, 12px side
   padding, text left, 1px `#ded8cd`, radius 2px, 15px. The picked one fills
   navy `#1e416b` with a `#ffffff` label at 500 and a navy border.
2. **Subtype** (only once a type is picked): the type's subtypes as wrapping
   chips, 32px tall, 12px side padding, 1px `#ded8cd`, radius 2px, 14px; picked
   fills navy. The subtype pick is the save.
   - ERC event → Events, This & That
   - New research → Report, Working paper, Brief, Miscellaneous
   - Event → A&M, Texas, National
   - Opportunity → Grant, Fellowship, Job, Call for papers
   - Headline → Texas, National
3. **Send it to**: uppercase label, then two rows (`gap: 10px`). Each is a 16px
   checkbox (`accent-color: #1e416b`, `margin-top: 3px`) beside a two-line
   label: the name at 15px ink, then what it means at 13/19 `#8c8478` —
   "Waits in the next issue's pool" and "Waits on Publish". Both ticked by
   default.
4. A flexible spacer, then the **decision stack** (`gap: 10px`):
   **Keep and next** — 48px, full width, navy fill, `#ffffff` label at 500,
   `justify-content: space-between` with a 16px check glyph at the right,
   `#153154` on hover. **Skip for now** — 40px, full width, ghost, text left,
   `#6b6156` going ink on a `#f3f2f0` ground.
5. A 1px `#e3ddd0` rule, 14px, then **Delete** — a 32px crimson `#b3123c` ghost
   with the 14px trash glyph, underlined on hover. Tools far from the decision
   pair, one filled button on the card.

**Keep and next is locked** (`#e0dad0` fill, `#a8a096` label,
`cursor: not-allowed`) until the item has a type, has somewhere to go, and its
link question is settled. Its tooltip says which: "Pick a type, settle the
link, and give it somewhere to go."

## Finalize tab

- **Head row**: `<N> of <total> kept items need an ERC-voice description` at
  15px, and a **Rewrite N descriptions** primary at the right (40px, navy).
  When nothing is pending the line reads "Every kept item has an ERC-voice
  description." and the button is gone.
- **List** (420px, same box): head `Needs a rewrite` at 15px 500 on the wash.
  Rows carry the blue triangle, title 15/21, meta 13/19 (`Event · A&M`,
  `New research · Report`). Chosen row as on the Sort tab. Empty state:
  "Nothing waiting on a rewrite." at 14/21 `#8c8478`.
- **The fold**: a full-width row, 1px `#e3ddd0` above, chevron on the left,
  `No rewrite needed` and a count pill at the right; `#f3f2f0` on hover. Open,
  it lists those items indented to 32px.
- **Card**: meta line 13/19, title 20/27 600, source 13/19, then the text in a
  quote box — ground `rgba(35,32,27,.045)`, a 3px `rgba(35,32,27,.22)` left bar,
  `14px 16px` padding, the uppercase label `ORIGINAL` (or `ERC VOICE` once
  kept), text 15/23. Footer over a 1px `#e3ddd0` rule: **Edit** (pen glyph,
  ink ghost) and **Delete** (crimson ghost) at the left, **Keep** (48px navy,
  check glyph) at the right while a rewrite is pending.

---

## Interactions & behaviour

**Submit content**
- Typing in the link field enables **Add to the queue** once a type is also
  picked; until then it is the disabled grey.
- Submitting prepends the item to the Queue list, writes
  `Added: <title>.` plus **Undo** to the status line, and clears the form.
  Undo removes that item again and reports `Removed from the queue.`
- **Copy link** writes to the clipboard and flips its own label to `Copied`
  for 2 seconds. Only the clicked row changes.
- The fold toggles; its chevron rotates 90° over 110ms.

**Content Sort**
- Clicking a list row opens it in the card (and drops out of description-edit
  mode).
- Picking a type clears the subtype and clears a `No type yet` question.
  **Confirm** on a note clears that question.
- **Keep and next** / **Skip for now** / **Delete** move the item to that
  status, advance the card to the next waiting item, and write
  `Kept: <title>.` / `Skipped: …` / `Deleted: …` with **Undo** to the status
  line. No motion on the decision — the row greys in place at the bottom of the
  list. That is what records it.
- A greyed row's own **Undo** returns it to waiting and selects it.
- **Keyboard** (Sort tab, ignored while a field has focus): ↑/↓ move the
  selection, `K` keeps, `S` skips, `D` deletes, `U` undoes.
- Tabs switch in place. **Rewrite N descriptions** clears every pending rewrite
  at once and reports it in the status line.
- Finalize's **Keep** accepts one rewrite; **Delete** removes the item.

**Motion.** 70ms on a colour, 110ms on a move, `cubic-bezier(.2,0,.38,.9)`,
nothing over 240ms, nothing decorative. `prefers-reduced-motion` kills all of
it. No press scale. No shadows — layers separate things and focus is an outline:
`2px solid #23201b`, `outline-offset: 2px`.

**Responsive.** Desktop only, designed at 1280px. Both pages reflow by wrapping
their columns (the right column drops under the left) but no phone layout is
specified.

## State

**Submit content**: `link`, `title`, `type`, `spotlight`, `queue[]`,
`status`, `showUndo`, `lastAdded`, `foldOpen`, `copied` (which row, cleared on
a 2s timer).

**Content Sort**: `tab`, `items[]` (each with `status` of
`waiting | skipped | kept | deleted`), `selId`, `status`, `showUndo`,
`lastUndo`, `editDesc`, and for Finalize `fin[]` (each with `needs`),
`finSel`, `foldOpen`.

Each item: `id, title, source, by, date, link, desc, type, sub, nl, px, tags[],
warn` where `warn` is `null | "link" | "dup" | "type"`, `nl`/`px` are the two
Send-it-to ticks. Field edits patch the item as you leave the field; a redraw
must never drop what is being typed.

## Design tokens

See `theme-tokens.css` — every colour, face, size and duration used by both
screens, written to drop into `design-system/tokens.css`.

## Assets

No images. Every glyph is an inline SVG stroked in `currentColor`: the external
link arrow, the row/door arrow, the fold chevron, the check, the trash can, the
pen, and the filled warning triangle. Font Awesome is no longer needed for these
two screens — if the rest of the desk still loads it, the same glyphs (`fa-check`,
`fa-trash-can`, `fa-pen`, `fa-triangle-exclamation`, `fa-arrow-right`,
`fa-chevron-right`) can be used instead. Fonts come from Google: Archivo
400/500/600 and Lora 500.

## Files in this bundle

- `designs/Submit content.dc.html` — screen 1
- `designs/Content Sort.dc.html` — screen 2
- `designs/support.js` — the design tool's runtime; needed only to open the two
  files in a browser, not to be ported
- `theme-tokens.css` — the new value set

## Open questions for the team

1. **The internal Policy Exchange page** has no door on Submit content any more
   (the sketch gave it only a public Quick link). It is reachable from the top
   bar. Confirm that is enough, or add it as a third door.
2. **The three public URLs** in Quick links are stand-ins.
3. **The Queue block** is read-only and capped at 6 rows. Decide whether it
   should show everything with its own scroll.
4. **"Add a doc or spreadsheet"** now covers both the single attachment and the
   bulk spreadsheet import. Confirm they are one flow.
5. **The other screens** — Newsletter, the builder's four steps, the Policy
   Exchange page — are still on the Carbon look. They will need the same pass.
