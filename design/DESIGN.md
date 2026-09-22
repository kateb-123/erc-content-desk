# Design spec: ERC Content Desk + Newsletter Builder

One look across both apps. This file is the source of truth for style decisions:
read it before any UI work. The mockups are Kate's wireframes of Sep 17 in
`design/mockups/` (five pages and their 1280 by 900 renders): verification is a
screenshot from the running sandbox (`localhost:4173`, serves `/builder/` too)
matched against them with `scripts/visual-diff.mjs`, approved by Kate before
deploy.

## The system: the Sep 22 refresh on Carbon's bones

Both apps wear the refresh Claude Design drew on Sep 22, 2026 from Kate's
sketch of that morning, on the structure IBM Carbon gave them on Sep 17
(Kate's picks, Sep 22: the whole desk and the builder at once, navy fills
everywhere, the Queue an open list). A cream page ground `#f6f3ec` with
white boxes on it; warm greys for ink, lines and quiet text; Archivo for the
UI and Lora for page titles and big numerals; 2px corners on buttons, fields
and boxes, 12px on pills; navy `#1e416b` fills on the desk as on the
builder, so the two apps no longer differ by accent; uppercase 12px
micro-labels with .7px tracking, and section headers as a label over a 2px
orange rule; an ink wash (`rgba(35,32,27,.045)`) for inner surfaces instead
of Carbon's grey layers. Still binding from the palette of Sep 17: orange
`#ff8200` only marks (the 2px section rules, the lit tab's bar, the 3px bar on
a chosen row, the progress bars), it never fills a button and never carries
text (2.5:1 on white); the status colours are citrine, UT Globe blue for
"needs doing", crimson and slate; no maroon in-app; no shadows anywhere;
colour is never the only signal. The tokens live in `css/tokens.css`, the
one file where a colour, a size or a face is written down; they keep
Carbon's names with the refresh's values, so the stylesheets read as they
did. The two drawn screens (the team's Submit content page and Content Sort)
are recreated to the handoff; every other page takes the same tokens and
faces.

The Carbon rules of Sep 17 that this replaces: IBM Plex Sans as the one
family; the white page ground; radius 0; the desk's ink fills with orange
marks against the builder's navy; grey `#f4f4f4` layers inside cards; no
uppercase anywhere.

## Tokens

Carbon names, the refresh's values (Sep 22). Reference them, never a literal:
the census allows a hex only in `css/tokens.css`. The rows below name the
role; the value is in the file.

| Token | Value | Use |
|---|---|---|
| `--background` | `#ffffff` | the page (both apps), the top bar's ground |
| `--layer-02` / `--border-subtle-01` | `#ffffff` / `#c6c6c6` | a card, a list, a table, the receipt, the busy popup: a white box with a hairline (`--layer`, `--layer-line`; pick C, Sep 17) |
| `--layer-01` | `#f4f4f4` | a grey box inside a card: Finalize's edit box, decided Sort rows, table header rows, the builder's edit stage |
| `--layer-accent-01` | `#e0e0e0` | table header rows, progress tracks, the edit stage |
| `--accent-10` / `--accent-20` | the desk `#fff4ea` / `#ffdfc7`, the builder `#eef1f5` / `#d8e0ea` | row hover and tinted rows (`--row-hover`, `--tint`); the chosen row (`--selected`, in `--accent-deep` text with a 3px `--border-interactive` bar) |
| `--accent-alpha` | the accent at 6% | the hover wash on quiet buttons and menu rows (`--hover`), layered over any tint |
| `--field-01` / `--field-02` | `#f4f4f4` / `#ffffff` | fields: white on a layer, grey on the page |
| `--text-primary` / `--text-secondary` / `--text-helper` / `--text-placeholder` | `#161616` / `#525252` / `#6f6f6f` / `#a8a8a8` | ink (`--ink`), quiet text (`--muted`), helper lines, placeholders (placeholders are decoration, never the only label) |
| `--border-subtle-00` / `--border-subtle-01` | `#e0e0e0` / `#c6c6c6` | hairlines on the page (`--line`) and inside a layer (`--line-in`); dividers only |
| `--border-strong-01` | `#8d8d8d` | the line under a field, dashed drop zones, tag outlines: anything interactive holds 3:1 |
| `--button-primary` / `-hover` / `-active` | the desk ink `#161616` / `#393939` / `#525252` (`--orange-fill`, the fills under orange marks); the builder `#1e416b` / `#153154` / `#0b2341` (`--navy-fill`, `--navy-60/70/80`) | the filled buttons (`--accent`, `--accent-deep`). Each app's `:root` maps Carbon's blue tokens (button, tertiary, link, focus, interactive, highlight, the New tag) to its ramp's profile in tokens.css; IBM blue `#0f62fe` is Carbon's default and appears nowhere on screen. Navy step 60 is 10.4:1 on white, so it fills, lines and links under a white label. Orange never darkens and at 2.5:1 cannot carry text, so on the desk it marks and does not fill: `--orange-mark` (`#ff8200`) draws the 3px bars, the tab line and the progress bars, the fills are ink and the lines and links Carbon's grey `#525252` (`--orange-line`, `--orange-link`); steps 60 to 80 are drawn nowhere but the loader's last dots |
| `--button-secondary` / `-hover` | `#393939` / `#474747` | the builder's Back, Save to the archive, Download: Carbon's dark grey beside a primary |
| `--button-disabled` / `--text-on-color-disabled` | `#c6c6c6` / `#8d8d8d` | a locked Keep: full opacity, grey fill |
| `--link-primary` / `-hover` | the desk grey `#525252` / ink, the builder navy 60 / 70 | links and the quiet action words |
| `--focus` | the desk grey `#525252`, the builder navy 60 | the 2px focus ring, drawn inside the control |
| `--support-error` / `--button-danger-secondary` | `#b3123c` | crimson: destructive words (`--err`) and the error note's bar |
| `--support-success` / `--text-success` | `#cedc00` / `#4f5500` | Alliance citrine as an icon (`--ok-mark`) and the toggle when on / the dark citrine as text (`--ok`), since citrine is 1.5:1 on white |
| `--support-warning` / `--text-warning` | `#006c93` / `#006c93` | UT's Globe blue, needs doing as an icon, the triangle (`--warn-mark`) and as text (`--warn`); the warning tab. The palette's purple read as Halloween beside orange; Carbon's warning yellow held the job from Sep 15 to Sep 17 |
| `--support-info` | `#3d4a57` | slate, the info note's bar and icon (Carbon's blue collided with navy) |
| `--notification-*-background` / `-border` | info `#f0f2f4`, success `#f7f9e0`, warning `#e8f2f6`, error `#fceef2`; the border is the role's colour at 30% | inline notes: the info panel, the fix panel, the link ask, the builder's status boxes; text on them is `--text-primary` |
| `--tag-background-*` / `--tag-color-*` | gray `#e0e0e0`/`#161616`, blue the accent's 20 under the desk's grey or the builder's navy 80, review `#cce4ed`/`#004a66` | tags: a fact, New, a duplicate (needs review, so it wears the review blue); the queue count |
| `--accent-30` to `--accent-80` | the app's ramp | the sliding-dots loader; `--accent-30` is Publish's held segment |
| `--background-inverse` / `--link-inverse` | `#393939` / the accent's step 30 | the builder's Undo toast |
| `--overlay` | `#16161680` | the dim behind the busy popup and the tutorial |
| `--spacing-01` to `--spacing-10` | 2, 4, 8, 12, 16, 24, 32, 40, 48, 64px | every gap, pad and margin; 16 is the default; 10px is a bug |

Maroon `#500000` is FORBIDDEN in-app; it lives only in the newsletter email
template and the public Exchange site.

## Type

- **Archivo** at 400, 500 and 600 for the UI; **Lora** at 500 for every page
  title and the big numerals (a lane's count, the issue date). Both from
  Google Fonts; IBM Plex Sans is gone (Sep 22).
- The scale, as `css/tokens.css` writes it: the page title 34/43 Lora with
  -.2px tracking; a card title 21/28 600; a section title 20/27 600; the lede
  and prose 16/25; body 15/23; meta 13/19; the micro-label 12/16, uppercase
  with .7px tracking (field labels at 500 in the helper grey, section labels
  at 600 in ink); a big numeral 24/30 Lora. Buttons are 15px at 500 on a
  fill, 400 in an outline; a lit tab is 600.
- Body copy is left-aligned, never centred or justified. Numbers are digits.

## Shape

- **2px corners** (`--radius`) on buttons, fields, boxes, notes and the busy
  popup (Sep 22; square from Sep 17 to 22). Bars and the progress tracks stay
  square. Pills are 12px (`--radius-pill`): tags, counts; the toggle and the
  loader's dots are round.
- **White boxes with a hairline on the cream ground.** A card, a list or a
  table is `--layer-02` white with a 1px `--layer-line` hairline; a box inside
  a card (Finalize's edit box, a quote box, the list head) is the ink wash
  `--layer-01` with no border. Rows divide with `--line-in`, lift to
  `--wash-hover` on hover, and the chosen one sits on `--wash-row` in ink at
  600 with a 3px orange bar on the left. Fields are transparent with a 1px
  `--layer-line` rule under them; the one big link field is `--field-01` cream
  with a 2px `--border-strong-01` rule. Orange means "this one"; the wash
  means "a surface".
- **Buttons.** 40px tall (32px in a screen head or a section head, 48px for the
  builder's export trio), 16px side padding, the label left. A primary is the
  app's fill (ink on the desk, navy in the builder) with its icon in a 64px right slot (48px on the small size); with no
  icon the slot goes. Everything beside a primary is Carbon's tertiary: the
  outline (grey on the desk, navy in the builder) that fills on hover (Cancel, the doors, Quick add, the builder's Next
  and Start the next issue). The builder's Back and archive buttons are
  Carbon's secondary, the dark grey fill. A Save inside an open card whose
  edits are already live is a ghost word (audit round two, Sep 17).
  Quiet words (Edit, Delete, Skip, Undo, Cancel in a panel) are ghost buttons:
  32px, a `--background-hover` fill on hover. No press scale. On the desk,
  where links and quiet words are grey like secondary text, a word that acts
  with no icon wears an underline (View info, Change, Verify link, Undo,
  Re-check), so it never reads as text; Edit and Delete carry their icons,
  Skip and Cancel stay muted (design critique, Sep 18).
- **Fields.** 40px, on the field surface, a `--border-strong-01` line under them
  and nothing else; the focus ring replaces the line. Labels are label-01 above.
- **Tabs.** A page's tabs (Sort content's Sort and Finalize, Newsletter's Next
  issue and Past issues) sit under its title in one row under a hairline: 40px,
  quiet text with a round count, a 2px `--border-interactive` bar under the lit
  one (it keeps that look under the mouse), a `--border-strong-01` bar on hover;
  a fact about the page may sit at the row's right ("Oldest has waited N
  days"). They are read as tabs: one tab stop, Left and Right move between
  them, Home and End jump (audit round two, Sep 17).
- **Folds.** Every fold opens from a chevron on its left, pointing right when
  shut and down when open: the front page's bulk door, Finalize's No rewrite
  needed, Next issue's Past items. A chevron means a fold and nothing else
  (audit round two, Sep 17).
- **Notes.** Every panel that speaks is Carbon's inline notification: a
  `--notification-*-background`, a 1px `-border`, a 3px left bar in the
  `--support-*` colour, the matching icon, `--text-primary` words. Info for the
  View info panel; warning for Sort's card questions (the link, a duplicate),
  Send early?, the builder's restore banner and its Replace the archived issue?
  ask; success and error for the builder's upload, pull, save and export
  results. An error note that can be retried carries a ghost Retry, and a
  success that ends a task stays (Saved to the archive, with Open Past
  newsletters), never a toast that fades (audit round two, Sep 17).
- **Focus.** `outline: 2px solid var(--focus); outline-offset: 2px`, the ring
  in ink 2px outside the control, no halo (Sep 22; inside the control before).
- **Steps.** The builder's wizard is Carbon's progress indicator: four equal
  steps under a hairline, a 20px circle at each one's left; reached steps turn
  the line the accent's, the current step fills its circle and goes 600, a finished one
  shows a check and keeps it when you go back. The whole step is the target,
  40px tall. A step that needs a pulled issue is drawn in `--text-disabled`
  with a disabled circle, and pressing it says why on the line right under the
  steps. A date alone opens nothing: a step opens once a pull brought items
  (audit round two, Sep 17).
- Every page's first line sits 24px under the top bar (Kate's wireframes,
  Sep 17); on the desk the status line keeps its one-line slot above it, so a
  message never moves the page.
- Sort and Finalize share one list row and one card: titles at 14/18 with the
  source or type under them at label-01, and the card stays in view while the
  list scrolls.
- The desk's nav is a top bar across every page (Kate's wireframes, Sep 17;
  the sidebar of Sep 16 to 17 is gone): 56px on the page ground under a
  hairline, 40px sides. On the left a breadcrumb (no mark: the wireframe's
  placeholder square read as a checkbox; the tab icon carries the mark): the desk's name (always a link home), then the lane the page is
  in, then the page where one stands under its lane (the builder and Past
  issues under Newsletter). On the right the two other lanes as quiet links
  (`--text-secondary`, `--text-primary` on hover, no underline); the front
  page, which lists all three lanes itself, shows none. Links switch screens
  in place on the desk and are plain links on the builder's pages. The
  addresses are the lanes' names: /#sort, /#newsletter, /#exchange (the old
  ones still land). The content sits in a 1280px column, 24px under the bar,
  the way the wireframes frame it; the desk's status line keeps its one-line
  slot at the top of that column.

## Icons

Font Awesome 7.3.1 Free via cdnjs; setup in `.font-awesome.md` (read it first).
FA is for small glyph accents; the hand-drawn inline SVGs (drawn check, sliding-dots
loader) stay. Icon elements always carry `aria-hidden="true"`.

## Action vocabulary (the uniformity contract)

Every action element in either app matches this table: same word, same icon, same
look, everywhere it appears.

| Action | Icon | Look | Means |
|---|---|---|---|
| **Keep and next** (Sort) / **Keep** (Finalize) | ✓ `fa-check` | the primary: the app's fill, the check in its right slot (the ONE per card) | accept into the pipeline and move to the next item / accept the rewrite |
| **Skip for now** | none | muted ghost button | park it (status stays `circleback` underneath); it sinks to the bottom of Sort's list with a grey Skipped tag, and its card has Keep and next and Delete (Kate, Sep 18) |
| **Delete** | `fa-trash-can` | red ghost button | trash the ITEM for good (any screen, any time); the row stays listed greyed with Undo for the visit on Sort, Finalize and Next issue's Past items (design audit, Sep 17) |
| **Edit** | `fa-pen` | ghost button in the link colour | the same inline edit on Finalize, under a row on Newsletter's Next issue (In this issue and Ready to add) and inside an open row on Publish (Kate, Sep 22: an edit button on each part of the pipeline; the Exchange is append-only, so an edit after an item is live changes the desk, not the site); persists on Save: the fields the type uses, then Link and Media, on the grey edit box; any way out of an edited form holds with "Save or cancel this edit first." Sort's card has no Edit: every field on it is edited in place and saves as you leave it (Kate, Sep 18) |
| **Use original** | `fa-rotate-left` | muted ghost button | reject the rewrite, keep the Sheet text |
| **Remove** | `fa-trash-can` | red ghost button | take OUT of the newsletter issue (returns to the pool); shares Delete's icon by Kate's explicit pick; on Next issue and in the builder the row stays listed with Undo (Sep 17) |
| **Verify link ↗ → Confirm / Change** | `fa-triangle-exclamation` | warning note, one ask | open the source, then stamp it good or paste a new link; a link that needs no check shows as itself with Change beside it |
| **View info / Hide info** | none | a word in the link colour beside every screen/step title | opens the tinted instruction panel |
| **Re-check** | none | a link in Publish's lede | force a fresh hub check |
| **Add media** → Replace / Remove media | none | a small ghost word under the card's fields, then Replace and the muted Remove word | attach a picture or PDF flyer to any item (Sort's card and Finalize's Edit; newsletter items in the builder), the URL rides the row’s infographic column into the email |
| **Add** | none | a small tertiary on each row of Next issue's Ready to add | put the item in the issue; the status line says "Added: title" with Undo (Sep 18) |
| **Keep with fields empty → Keep anyway / Fill it in** | `fa-triangle-exclamation` on the note | warning note in the Keep button's place, one ask (Kate, Sep 22: ask, then let them keep) | pressing Keep and next on a typed item whose fields are still empty (an event's date, time or location, an opportunity's deadline) says "Still missing: Date, Location."; Keep anyway keeps it (K does too), Fill it in puts the cursor in the first empty field. Nothing is blocked, since some items have no date yet |
| **Send early? → Confirm / Cancel** | fa-clock on the note | warning note, one ask (same as Verify link) | adding an event that belongs to a later issue, the words stay bare, the bubble carries the icon |
| Door buttons (Go to Publish, Go to Newsletter, the receipt's door) | → `fa-arrow-right` | Carbon's tertiary button with the arrow in its right slot (Sep 15, option A; square since Sep 17), right of the screen head | move along the pipeline; the one filled button on a screen is then always its decision |
| **Top bar** (ERC Content Desk / the lane / the page; the two other lanes on the right) | none | a 56px bar under a hairline; crumb links in the ink, lane links quiet | every way around the desk (Kate's wireframes, Sep 17): the brand leads home, a lane opens its page in place, the builder's pages crumb under Newsletter |
| **Keep the rest (N)** | ✓ `fa-check` | the small dark-grey button, Carbon's secondary (Kate, Sep 17: a sweep across a list is grey, the one decision on a card is the primary), right of Finalize's head while rewrites wait to be checked | keep every rewrite still to check. Sort's Keep the rest went with its sections (Kate, Sep 18: "Drop it") |
| **Send it to** ERC Newsletter only | none | one checkbox on Sort's card (Kate, Sep 22; two boxes, Newsletter and Policy Exchange, from Sep 18) | where the item goes once kept: unticked it waits in the newsletter's pool at once AND on Publish, ticked it waits in the newsletter's pool and never reaches Publish; a spotlight event comes ticked. Nowhere is not a state, so Keep and next no longer locks on it |
| **Dismiss all** | `fa-trash-can` | red ghost word at the right of a group's head on Sort | deletes every row in that group in one change, with one Undo ("Dismissed N. Undo"). The groups (Kate, Sep 22): Past, an event whose date has gone or an opportunity whose deadline has passed, and Already live, a link the live Exchange already has (the same check Publish runs, asked for quietly on arrival); they sit under the skipped rows, each row tagged, and a row in both is Already live |
| **Undo** (Sort) | none | the status line's word after a decision; a greyed row's own Undo | Keys on Sort (Sep 17): up and down move, K keeps, S skips, D deletes, U undoes; the buttons' tooltips name them. A decision says itself in the status line ("Kept: title. Undo"), the card moves to the next item and takes focus; Undo says what it undid |
| **Download the CSV** → **Download the CSV again** | `fa-download` | the primary in Publish's head, then a ghost word beside the Publish button | the copy of the Adding rows in the hub's own columns, saved before anything is sent (Kate, Sep 22: the CSV comes first); Publish appears only once it has been downloaded, and a changed Adding list asks for a fresh copy. The receipt's Download the CSV again is the whole hub file after the write |
| **Publish N to the Exchange → Confirm / Cancel** | `fa-triangle-exclamation` on the ask | the primary, then one warning note in its place | the one ask before the append-only write to the public site (design audit b6, Sep 17), at body-01 with the count and "live" in 600; Keep the rest on Finalize gets "Kept N rewrites. Undo" instead of an ask |

The front page is Kate's own (her answer, Sep 22): the title Desk, the lede
"What waits on each page.", then five cards in a grid of white boxes: Submit
content (the team's page), Content Sort, Newsletter and Policy Exchange,
each a name, a line of what it holds and the count as a Lora numeral with an
arrow, the orange bar on hover; and Documentation, greyed, Forthcoming. The
top bar shows no lane links there.

The team's page, Submit content at /#team (Kate's sketch and the handoff,
Sep 22; `design/mockups/submit-content.png`, the handoff itself in
`design/refresh-sep22/`): the page head, then two columns. Left, the share
form in a white box, then Queue, a section head over the orange rule with
"N waiting · newest first" and every waiting item as a read-only row in its
own scroll. Right, two white boxes: Quick links (the public share page, the
listserv sign-up, the Policy Exchange, each a link that opens in a new tab
with its address under it and Copy link, which says Copied for two seconds)
and Desk work (Content Sort and Newsletter as door rows with their counts as
Lora numerals and an arrow, a 3px orange bar on hover; Newsletter opens in
its own window). The top bar shows only Policy Exchange on the right. The
Sort page is Content Sort everywhere since Sep 22.

The front page of Sep 17 to 22 (Kate's wireframes; `design/mockups/index.png`) was the
share form on the left and a 360px column on the right, 56px in from the
sides. The form puts the link first as the one big field (52px, on
`--field-01`, a 2px line under it, "We will pull the title and description if
we can."), then the title, the description, the type as a segmented row
(square words joined by hairlines, the picked one in the app's fill), then
the initials, the Spotlight ask and Add to the queue (48px) on one row, with
the bulk door folded under. The column holds a box of the three lanes (name,
the count at 20/28 light, an arrow; Newsletter names the next issue under
its name). Each lane counts the work waiting on its page (design critique,
Sep 18): Sort the queue, Newsletter what waits to be added to the next
issue, Policy Exchange what Publish would add (from the live Exchange
check, which the front page asks for quietly), then Recently added (the four newest items with who and
when). The stat tiles and the queue fold of Sep
15 to 17 are gone; the queue is worked on Sort.

Sort content (Kate's wireframes, Sep 17, and her answers, Sep 18;
`design/mockups/sort.png`) is one page with two tabs, Sort and Finalize,
each with its count; the Sort tab's row says how long the oldest item has
waited. Sort is one list, 420px, down the left: a grey head ("N waiting",
"Newest first"), then the waiting items newest first (the kept items that
lost their type among them), then the skipped ones newest first, each with a
grey Skipped tag, then the Past and Already live groups (Sep 22), each
with a Dismiss all, and last, greyed, what was kept or deleted this visit with
its Undo. A row is the title with source · added by who · when; the chosen
one sits on the selected layer with its 3px bar and its title at 600. On the
right the card, kept in view while the list scrolls, one white box split by
a vertical rule (the handoff, Sep 22). Left, the item as it reads: the
source as an uppercase label with the fact tags (New, Spotlight requested,
External submission, In a past issue, Past, Already live) and the position
("1 of 15") at the right; the title as the heading, edited in place; one
meta line, when and by whom, then the link as its domain with Change
beside it; a Globe-blue note for each question (Check the link, Possible
duplicate); the description as prose, a field while Edit is open, with Edit
and Add media under it; then the fields the type uses, two to a row. Right,
the decisions: the type as a stack (the Type label turns blue while there is
none) with the picked type's subtypes as chips, ERC Newsletter only as one
box with "Skips the Policy Exchange" under it, then Keep and next full
width, Skip for now under it, a rule, and Delete. A row's tag (Skipped,
Past, Already live) sits at the row's right. Every field saves as you
leave it, and a redraw never drops what you are typing. The View info panel,
the section tabs and Needs a fix are gone (Sep 18).

Newsletter (Kate's wireframes, Sep 17, and her answers, Sep 18 and 22;
`design/mockups/newsletter.png`) is the hub, opened in its own window from
the team page, one page with three tabs, Next issue, Schedule and Past
issues (Schedule since Sep 22: each upcoming send date as a Lora numeral
with how far off it is, Next on the first, and how many items are stamped
for it; a date opens its issue on Next issue; read only, the dates stay on
the Sheet's schedule tab); it took in Next newsletter, Send to Newsletter and Past
newsletters. Next issue: on the left, In this issue with Quick add beside it
and the count at the right, the items by section in the builder's order and
under its names (numbered, the title at 600, type · source, Remove), then
Ready to add (what Sort kept with Newsletter ticked, newest first, a later
issue's events at the bottom saying which issue, each with Add), then the
Past items fold (what the issue has outrun, with Delete). On the right, a
420px column: This issue (the date at 32/40 light, "Sends in N days", quiet
links to the later issues), the builder door (the app's fill, 48px, the
arrow at the right), and Last issue. Order, the opening note and the email
preview stay in the builder (her answers); subscribers and open rates are not
shown (no data). Past issues lists the archive newest first; each opens the
email as it went out. builder/archive.html now lands on /#past.

Blue means "needs doing", nowhere else on the screen (Kate's palette and her
pick, Sep 17; the palette's purple read as Halloween beside orange, and
Carbon's warning yellow held the job from Sep 15). A row the card has a
question about leads its title with a blue triangle
(`fa-triangle-exclamation`); a missing type turns the Type label and its row
blue. Keep and next stays locked in Carbon's disabled grey until the type
and the link are settled and the item has somewhere to go, and its tooltip
says which. Spotlight requested is a grey fact tag like External submission.

Placement grammar: tools (Edit) pair with Delete far LEFT of a card footer; the
decision pair (secondary then primary) sits RIGHT; the position counter sits alone
top-right; **one filled button per card**, everything else quiet. Any in-flight
button DISAPPEARS; nothing is re-pushable.

## Motion

All CSS/vanilla; `prefers-reduced-motion` kills everything. Carbon's clock:
`--duration-fast-01` 70ms for a colour, `--duration-fast-02` 110ms for a move,
nothing over `--duration-moderate-02` 240ms, and nothing decorative moves.

- Decision: NO motion (Kate, Sep 9; the slide and the shrink were both
  rejected). The decided row greys in place at the bottom of the list with
  Undo; that is what records the decision.
- Screen switch: ±16px directional slide, 110ms `--ease-standard`.
- Confirmations: SVG check draws itself, 240ms.
- Loading: the sliding-dots track on the app's accent ramp (`--accent-30` to
  `--accent-50`), label under the track with typed trailing dots; mini variant
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

- No new fonts, icon sets, or UI libraries without approval. Archivo and Lora
  are the two faces (Sep 22).
- No maroon in-app.
- No corner but `--radius` 2px, `--radius-pill` 12px on tags and counts, and round on the toggle and the loader's dots.
- No shadows at all (Kate, Sep 2; Carbon agrees): layers separate things, and
  focus is an outline.
- No hex outside `css/tokens.css`; no size off the spacing scale.
- Navy fills on both apps and orange as marks on both (Kate, Sep 22: "navy
  everywhere"); the desk and the builder no longer differ by accent. Orange is
  never darkened and never fills a button.
- Colour is never the only signal: a status colour ships with its icon and a word.
- Nothing is "done" without a screenshot from the running sandbox.

## The public pages, /submit and /listserv

Two standalone pages on the desk's own address (Kate, Sep 22: "I want those in addition"), the share form and the listserv sign-up, the same forms as the Policy Exchange's share and sign-up pages, which stay. They post same-origin to /api/submit, /api/newsletter-image and /api/listserv, marked `public: true` so the bot check (Cloudflare Turnstile) gates them like the Exchange's pages; the widget's hostnames in Cloudflare must include the desk's address. Their stylesheet is `css/public.css`. Deliberately NOT the desk theme: it wears the ERC's outward maroon, the listserv sign-up's look (Work Sans/Open Sans, white card with the 3px #500000 border and hard offset shadow, uppercase maroon button), because it faces the public alongside the newsletter and the hub. It never links into the desk. Uniformity audits should hold it against the sign-up page, not against the desk tokens.
