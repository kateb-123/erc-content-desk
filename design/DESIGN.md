# Design spec: ERC Content Desk + Newsletter Builder

One look across both apps. This file is the source of truth for style decisions:
read it before any UI work. There are no mockups: verification is a screenshot from
the running sandbox (`localhost:4173`, serves `/builder/` too), approved by Kate
before deploy.

## The system: IBM Carbon (Sep 17, 2026)

Both apps wear IBM Carbon v11's White theme (Kate, Sep 17, from four pictures
of Sort at four depths: "A: full Carbon"), with two amendments of the same
night: cards, lists and tables are white boxes with a hairline instead of
Carbon's grey tiles, and the chosen things wear the accent's tint ("it's all a
smidge grey", pick C of four); and each app has its own accent hue, the desk
its blue from before Carbon and the builder Carbon's teal ("a different shade
of blue, lighter, less aggressive", pick G of eight in a switcher; "we just
want a little variation"). Carbon is a square, one-family system; its rules
below replace the desk's own radii and fonts of Sep 1 to Sep 16. The tokens live in `css/tokens.css`, the one file
where a colour, a size or a face is written down; every page loads it first.
`css/styles.css` (desk), `builder/css/styles.css` (builder, `--bp-*`) and
`builder/archive.html` alias the names they use. The source is the
`ibm-carbon-template` export (tokens.json, Sep 16); nothing in tokens.css is
a design decision of ours.

## Tokens

Carbon names, White theme values. Reference them, never a literal: the census
allows a hex only in `css/tokens.css`.

| Token | Value | Use |
|---|---|---|
| `--background` | `#ffffff` | the page (both apps), the sidebar's ground |
| `--layer-02` / `--border-subtle-01` | `#ffffff` / `#c6c6c6` | a card, a list, a table, the receipt, the busy popup: a white box with a hairline (`--layer`, `--layer-line`; pick C, Sep 17) |
| `--layer-01` | `#f4f4f4` | a grey box inside a card: Finalize's edit box, decided Sort rows, table header rows, the builder's edit stage |
| `--layer-accent-01` | `#e0e0e0` | table header rows, progress tracks, the edit stage |
| `--accent-10` / `--accent-20` | the desk `#eaf2f8` / `#d5e6f2`, the builder `#d9fbfb` / `#9ef0f0` | row hover and the stat tiles (`--row-hover`, `--tint`); the chosen row and the lit menu item (`--selected`, in `--accent-deep` text with a 3px `--border-interactive` bar) |
| `--accent-alpha` | the accent at 6% | the hover wash on quiet buttons and menu rows (`--hover`), layered over any tint |
| `--field-01` / `--field-02` | `#f4f4f4` / `#ffffff` | fields: white on a layer, grey on the page |
| `--text-primary` / `--text-secondary` / `--text-helper` / `--text-placeholder` | `#161616` / `#525252` / `#6f6f6f` / `#a8a8a8` | ink (`--ink`), quiet text (`--muted`), helper lines, placeholders (placeholders are decoration, never the only label) |
| `--border-subtle-00` / `--border-subtle-01` | `#e0e0e0` / `#c6c6c6` | hairlines on the page (`--line`) and inside a layer (`--line-in`); dividers only |
| `--border-strong-01` | `#8d8d8d` | the line under a field, dashed drop zones, tag outlines: anything interactive holds 3:1 |
| `--button-primary` / `-hover` / `-active` | the desk `#1d6ea5` / `#19608f` / `#14507a` (`--desk-blue-60/70/80`); the builder `#007d79` / `#005d5d` / `#004144` (`--teal-60/70/80`) | the one accent per app (`--accent`, `--accent-hover`, `--accent-deep`): filled buttons, tertiary outlines, links, focus, the active tab bar, the lit step. Each app's `:root` maps Carbon's blue tokens (button, tertiary, link, focus, interactive, highlight, the info note, the New tag) to its `--accent-NN` ramp; IBM blue `#0f62fe` is Carbon's default and appears nowhere on screen |
| `--button-secondary` / `-hover` | `#393939` / `#474747` | the builder's Back, Save to the archive, Download: Carbon's dark grey beside a primary |
| `--button-disabled` / `--text-on-color-disabled` | `#c6c6c6` / `#8d8d8d` | a locked Keep: full opacity, grey fill |
| `--link-primary` / `-hover` | `#0f62fe` / `#0043ce` | links and the quiet action words |
| `--focus` | `#0f62fe` | the 2px focus ring, drawn inside the control |
| `--support-error` / `--button-danger-secondary` | `#da1e28` | destructive words (`--err`) and the error note's bar |
| `--support-success` / `--green-60` | `#24a148` / `#198038` | success as an icon (`--ok-mark`) / as text (`--ok`); the toggle when on |
| `--support-warning` / `--yellow-70` | `#f1c21b` / `#684e00` | needs doing as an icon, the triangle (`--amber-mark`) / as text (`--amber`); the warning tab |
| `--support-info` | `#0043ce` | the info note's bar |
| `--notification-*-background` / `-border` | info `#edf5ff`, success `#defbe6`, warning `#fcf4d6`, error `#fff1f1` | inline notes: the info panel (`--tint`), the fix panel, the link ask, the builder's status boxes; text on them is `--text-primary` |
| `--tag-background-*` / `--tag-color-*` | gray `#e0e0e0`/`#161616`, blue `#d0e2ff`/`#0043ce`, yellow `#fddc69`/`#684e00` | tags: a fact, New, a duplicate; the picked type pill; the queue count |
| `--accent-30` to `--accent-80` | the app's ramp | the sliding-dots loader; `--accent-30` is Publish's held segment (`--accent-soft`) |
| `--background-inverse` / `--link-inverse` | `#393939` / `#78a9ff` | the builder's Undo toast |
| `--overlay` | `#16161680` | the dim behind the busy popup and the tutorial |
| `--spacing-01` to `--spacing-10` | 2, 4, 8, 12, 16, 24, 32, 40, 48, 64px | every gap, pad and margin; 16 is the default; 10px is a bug |

Maroon `#500000` is FORBIDDEN in-app; it lives only in the newsletter email
template and the public Exchange site.

## Type

- **IBM Plex Sans**, the one family (Google Fonts), at 300, 400 and 600. Outfit
  and Karla are gone (Sep 17).
- The productive scale, letter-spacing included: body-01 14/20 with .16px
  tracking; label-01 12/16 with .32px for field labels, meta lines, helper text
  and group labels (sentence case, no uppercase anywhere); heading-02 16/22 600
  for card titles; heading-03 20/28 600 for section and form titles; heading-04
  28/36 400 for every page title. Buttons are 14px regular; a lit tab or the
  current step is 600.
- Body copy is left-aligned, never centred or justified. Numbers are digits.

## Shape

- **Square.** Radius 0 on buttons, fields, tiles, tables, notes, the busy popup
  and the sidebar. The only round things are tags (`--radius-tag-md` 12px at
  24px tall, `--radius-tag-lg` 16px on the 32px type pills), the queue count,
  the toggle and the loader's dots.
- **White boxes with a hairline** (pick C, Sep 17; Carbon's grey tiles before).
  A card, a list or a table is `--layer-02` with a 1px `--layer-line` hairline;
  a box inside a card (Finalize's edit box) is `--layer-01` with no border. Rows
  divide with `--line-in`, lift to `--accent-10` on hover, and the chosen one
  sits on `--accent-20` in `--accent-deep` text with a 3px accent bar on the
  left. Fields are `--field-01` grey on a white card and `--field-02` white on
  a grey box. The accent's tint means "this one"; grey means "a box".
- **Buttons.** 40px tall (32px in a screen head or a section head, 48px for the
  builder's export trio), 16px side padding, the label left. A primary is the
  blue fill with its icon in a 64px right slot (48px on the small size); with no
  icon the slot goes. Everything beside a primary is Carbon's tertiary: the blue
  outline that fills on hover (Cancel, the doors, Quick add). The
  builder's Back and archive buttons are Carbon's secondary, the dark grey fill.
  Quiet words (Edit, Delete, Skip, Undo, Cancel in a panel) are ghost buttons:
  32px, a `--background-hover` fill on hover, no underline. No press scale.
- **Fields.** 40px, on the field surface, a `--border-strong-01` line under them
  and nothing else; the focus ring replaces the line. Labels are label-01 above.
- **Tabs.** Sort's sections are Carbon tabs in one row under a hairline: 40px,
  quiet text, a 2px `--border-interactive` bar under the lit one, a
  `--border-strong-01` bar on hover; the row scrolls sideways, never wraps.
- **Notes.** Every panel that speaks is Carbon's inline notification: a
  `--notification-*-background`, a 1px `-border`, a 3px left bar in the
  `--support-*` colour, the matching icon, `--text-primary` words. Info for the
  View info panel and a plain type change; warning for Needs a fix, the link ask,
  Send early? and the builder's restore banner; success and error for the
  builder's upload and export results.
- **Focus.** `outline: 2px solid var(--focus); outline-offset: -2px`, no halo;
  the primary adds a 1px inset white ring so the ring shows on its own fill.
- **Steps.** The builder's wizard is Carbon's progress indicator: four equal
  steps under a hairline, a 20px circle at each one's left; reached steps turn
  the line blue, the current step fills its circle and goes 600, a finished one
  shows a check.
- Every page's first line (a screen title, Home's stat tiles, the builder's
  title, Past newsletters' title) sits 44px from the top of the window; on the
  desk the status line keeps its one-line slot above it, so a message never
  moves the page (style audit, Sep 16).
- Sort and Finalize share one list row and one card: titles at 14/18 with the
  source or type under them at label-01, and the card (16px padding) stays in
  view while the list scrolls.
- The desk's nav is a sidebar down the left of every page (Kate, Sep 16, from the
  Claude Design docs: "I like the sidebar the most. but then I think keep our
  stuff"), drawn as Carbon's side nav: 256px on the page ground with a hairline
  on its right, four groups in the order of Claude Design's second round (Kate's
  pick, Sep 16): the desk, Policy Exchange, Newsletter, then **Desk work** (the
  pipeline) as a fold that remembers being shut and always opens on a pipeline
  screen. Group labels are label-01 with the group's icon in `--icon-secondary`;
  the 32px rows under them carry none and sit indented; Sort shows the queue
  count; the lit row sits on `--accent-20` in `--accent-deep` at 600 with the
  3px bar. On
  a Desk work screen the sidebar tucks away (Kate, Sep 16, from four clickable
  options: "b when it's expanded and the button. but also the thin grey bar to
  the left like C"): a 48px strip holds one ghost menu button; open, the sidebar
  is back in place and pushes the page over, with a ghost close button on the
  menu button's own spot. A pick, the close button or Escape tucks it away;
  every screen starts tucked. The front door keeps its sidebar. The builder's
  pages carry the same sidebar (Kate, Sep 16, option B): the builder tucks it
  like Desk work, its header bar is gone, and a Newsletter builder title sits
  on the page with the steps under it; Past newsletters keeps it open like Home.

## Icons

Font Awesome 7.3.1 Free via cdnjs; setup in `.font-awesome.md` (read it first).
FA is for small glyph accents; the hand-drawn inline SVGs (drawn check, sliding-dots
loader) stay. Icon elements always carry `aria-hidden="true"`.

## Action vocabulary (the uniformity contract)

Every action element in either app matches this table: same word, same icon, same
look, everywhere it appears.

| Action | Icon | Look | Means |
|---|---|---|---|
| **Keep** | ✓ `fa-check` | the primary: blue fill, the check in its right slot (the ONE per card) | accept into the pipeline / accept the rewrite |
| **Skip** | none | muted ghost button | park it (status stays `circleback` underneath); it waits under Sort's Skipped pill with Keep and Delete (Sep 15) |
| **Delete** | `fa-trash-can` | red ghost button | trash the ITEM for good (any screen, any time) |
| **Edit** | `fa-pen` | blue ghost button | inline edit, persists on Save |
| **Use original** | `fa-rotate-left` | muted ghost button | reject the rewrite, keep the Sheet text |
| **Remove** | `fa-trash-can` | red ghost button | take OUT of the newsletter issue (returns to the pool); shares Delete's icon by Kate's explicit pick |
| **Verify link ↗ → Confirm / Change** | `fa-triangle-exclamation` | warning note, one ask | open the source, then stamp it good or paste a new link |
| **View info / Hide info** | none | blue word beside every screen/step title | opens the tinted instruction panel |
| **Re-check** | none | a link in Publish's lede | force a fresh hub check |
| **Add media** → Replace / Remove media | none | a small ghost word under the edit form's fields, then Replace and the muted Remove word | attach a picture or PDF flyer to any item (every item's Edit on Sort and Finalize since Sep 17, ERC only before; newsletter items in the builder), the URL rides the row’s infographic column into the email |
| **Send early? → Confirm / Cancel** | fa-clock on the note | warning note, one ask (same as Verify link) | picking an event that belongs to a later issue, the words stay bare, the bubble carries the icon |
| Door buttons (Go to Finalize/Publish, Send to Newsletter, the receipt's door) | → `fa-arrow-right` | Carbon's tertiary button with the arrow in its right slot (Sep 15, option A; square since Sep 17), right of the screen head | move along the pipeline; the one filled button on a screen is then always its decision |
| **Sidebar items** (ERC Content Desk; Policy Exchange: Policy Exchange, Share an item, Listserv sign-up; Newsletter: Next newsletter, Newsletter builder, Past newsletters; Desk work: Sort, Finalize, Publish to Exchange, Send to Newsletter) | one FA glyph per group heading (`fa-globe`, `fa-envelope-open-text`, `fa-layer-group`), none on the items; the Desk work heading adds a chevron | 32px indented rows in the sidebar, the lit one on the selected layer with a 3px blue bar; the three hand-outs carry a small `fa-copy` icon on the right; Sort carries the queue count | every way around the desk (Kate, Sep 16). Pipeline items open the pipeline in its own window from the front door (`/#sort`, Sep 15) and switch in place inside it; outside pages open a new tab; on the builder's pages every desk page is a plain link (the pipeline still opens its window; the desk, Next newsletter at `/#issue` and the builder's own pages open in place); the copy icon hands over one sentence with the link and turns into a check for a moment |
| **Show the menu / Hide the menu** | `fa-bars` / `fa-xmark` | ghost icon button on the 48px strip / the same on the same spot in the sidebar's top row | Desk work screens only: bring the sidebar back in place, tuck it away again (Sep 16) |
| **Keep the rest (N)** | ✓ `fa-check` | the small primary, right of a Sort section's head | keep every listed row that has a real type and a checked link (Sep 11); one row at a time is Keep on its card (Sep 16) |

Sort is one section at a time (Sep 11 option A; Sep 15 the card stream and the
stacked All view went), drawn as a list and a card (Claude Design round two,
Kate's pick C, Sep 16). The sections sit as Carbon tabs in one row on top (Needs a
fix, ERC, ERC events, Research, Events, Opportunities, Headlines, Skipped); the
screen lands on the first one that holds anything, Needs a fix first. There is
no All. Under the pills: the section's name, Undo last and Keep the rest, one
hint, then the list on the left and the card on the right (1 : 1.25). A list
row is the title with authors or source · date, plus a New badge on a row that
came in today; the chosen row sits on the selected layer with a chevron. The card stays in
view while the list scrolls: the type line with Change and the badges on top (as
on Finalize's card), the title, the meta line, the description, notes, Open
source · from whom, then Edit · Delete far left and Skip · Keep right. A
decision moves the card to the row now in its place; decided rows sink to the
bottom of the list, greyed (deleted ones struck through) with Undo. When a
section runs out, a dashed pane takes the card's place and names the next
section that holds anything (or Go to Finalize).

Carbon's warning yellow means "needs doing", nowhere else on the screen (Kate,
Sep 15). Needs a fix, the one warning tab, gathers every row that cannot be kept
yet (no type, link not opened) and every possible duplicate; one yellow triangle
(`fa-triangle-exclamation`) leads each of its titles, and a fixed row moves to
its section. On the card, the warning note says each reason: **Needs a type**
(the types as radios, the picked type's subtypes indented under it; the subtype
pick is the save, a flat ERC Event saves on the type pick), **Check the link**
(the Verify link ask), **Possible duplicate** (which item it matches). Keep stays
locked in Carbon's disabled grey until the type and the link are settled, and its
tooltip says which. Change on the type line opens the same radios in an info note
with Cancel. Skipped, last on the menu, holds every parked row of any type (option
B, Sep 15), each wearing its type as a grey tag; its card has Keep and Delete, no
Skip. Spotlight requested is a grey fact tag like External submission.

Placement grammar: tools (Edit) pair with Delete far LEFT of a card footer; the
decision pair (secondary then primary) sits RIGHT; the position counter sits alone
top-right; **one filled button per card**, everything else quiet. Any in-flight
button DISAPPEARS; nothing is re-pushable.

## Motion

All CSS/vanilla; `prefers-reduced-motion` kills everything. Carbon's clock:
`--duration-fast-01` 70ms for a colour, `--duration-fast-02` 110ms for a move,
nothing over `--duration-moderate-02` 240ms, and nothing decorative moves.

- Decision: NO motion (Kate, Sep 9; the slide and the shrink were both
  rejected). The decided row greys in place at the bottom of its section with
  Undo; that is what records the decision.
- Tab/section switch: ±16px directional slide, 110ms `--ease-standard`.
- Confirmations: SVG check draws itself, 240ms.
- Loading: the sliding-dots track on Carbon's blue ramp (`--blue-30` to
  `--blue-80`), label under the track with typed trailing dots; mini variant
  inline in control rows.
- Blocking progress popup (bulk upload's Add all, Sep 10): page dimmed with
  `--overlay`, a square `--layer-01` card, the count at heading-02, an 8px
  `--interactive` bar on a `--layer-accent-01` track, one muted line under it.
  No close button, no Escape: it exists to stop clicking around mid-upload.
- Buttons: 70ms colour change on hover, no press scale.

## Copy

Sentence case. Terse: no redundant prose, no counts in prose unless load-bearing.
No emojis in UI copy (icons are the sanctioned decoration). Same term for the same
thing everywhere (see the vocabulary table).

## Do not

- No new fonts, icon sets, or UI libraries without approval. IBM Plex Sans is the
  one family.
- No maroon in-app.
- No rounded corners but tags, the queue count, the toggle and the loader's dots.
- No shadows at all (Kate, Sep 2; Carbon agrees): layers separate things, and
  focus is an outline.
- No hex outside `css/tokens.css`; no size off the spacing scale.
- One accent hue per app, and that is the only way the desk and the builder
  differ: the desk its blue, the builder Carbon's teal.
- Colour is never the only signal: a status colour ships with its icon and a word.
- Nothing is "done" without a screenshot from the running sandbox.

## The public /submit page

Deliberately NOT the desk theme: it wears the ERC's outward maroon, the listserv sign-up's look (Work Sans/Open Sans, white card with the 3px #500000 border and hard offset shadow, uppercase maroon button), because it faces the public alongside the newsletter and the hub. It never links into the desk. Uniformity audits should hold it against the sign-up page, not against the desk tokens.
