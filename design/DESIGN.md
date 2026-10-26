# Design spec: ERC Content Desk + Newsletter Builder

One look across both apps. This file is the source of truth for style decisions:
read it before any UI work. The mockups are Kate's pick A of Oct 23 in
`design/mockups/` (`a-front-page` and `a-sort`, each an HTML page and its 1280
by 970 render); her greyscale wireframes of Sep 17 are there too, for the
layouts. Verification is a screenshot from the running sandbox
(`localhost:4173`, serves `/builder/` too) matched against them with
`scripts/visual-diff.mjs`, approved by Kate before deploy.

## The look: Kate's pick A (Oct 23)

On Oct 23, 2026 Kate asked for the desk to stop looking basic: "make it look
like we paid a company a billion dollars to make it". Not TAMU's look (the
Aggie template is for what the desk sends out; the desk is where things come
in), not like an AI tool, "a little like a phone app but only for web". Of four
looks drawn on the front page and Sort (A Native, B Studio, C Widgets, D
Newsroom) she picked **A, Native**: the desk as a Mac app.

- **A gray sidebar** down the left of every desk page, the height of the
  window, still while the page scrolls: the desk's name on a blue tile with a
  white check; Home; the hubs by step under the front page's own group names
  (Bring it in: Submit content, Content queue, Content Sort; Send it out:
  Newsletter, Listserv, Policy Exchange; Research: Research briefs), each with
  a line icon in the blue and, at its right in gray, what waits there: Sort's
  count, the next send date, the sign-ups, what waits to publish, the briefs in
  progress, and a lock on the two password pages. Where you are is a gray pill;
  a page under a hub (Publish, the Highlight, the builder, a brief) marks its
  hub. At its foot, over a hairline: All how-tos, I need help! and Sign out
  while a sign-in holds. It replaces the navy top bar and its breadcrumb, and
  it stays on a sign-in page (the bar of Sep 23 showed the name alone there;
  a sidebar that came and went would jump the page).
- **The computer's own face**: San Francisco on a Mac, Segoe UI on Windows. No
  web font loads.
- **A light gray page with white boxes on it.** 12px corners on a grouped list
  or a card, 8px on buttons and notes, 7px on fields and the sidebar's rows; a
  shadow only under a panel that floats.
- **One blue**, `#0b6bde` (5.0:1 on white), for everything you can press: the
  filled button, links, the focus ring, the chosen row, the sidebar's icons.
  Orange for what needs doing, green for done, red for an error, each a darker
  step when it is words.
- **Labels are sentence case**, 13px semibold in the quiet gray: no caps, no
  tracking, no rule under them. Hairlines divide.
- **Her line rules for rows** (Oct 23), for the front page and Sort: one line
  per kind of fact, the first fact darker, and a line never wraps. Sort's list
  rows lead with the source, or an event's date or a deadline (her call, Oct
  23: "source first, like the mockup"; a row that needs a fix leads with its
  problem in orange words), the date it came in at the right; Sort's card shows the byline under the title and "Added
  ... by ..." at its foot.

The U-M Library look of Sep 23 to Oct 23 that this replaces: a white page under
a 56px navy bar with a breadcrumb; teal `#1d7491` for everything interactive
and maize `#ffcb05` for the brand's rule under labels and table heads; Mulish,
with Crimson Text for large titles; 2px corners on fields and 4px on buttons
and boxes; uppercase 14px labels with 1.25px tracking. Its ramps stay at the
foot of `css/tokens.css` (`--color-blue-400` and the rest), read only by the
old top bar's rules, which no page draws: the how-tos wear the desk's look,
sidebar and all, since Oct 23. The Sep 22 refresh
before it: the cream ground `#f6f3ec`; Archivo and Lora; orange `#ff8200` as
the only mark.

## Tokens

Carbon's names, pick A's values (Oct 23). Reference them, never a literal: the
census allows a hex only in `css/tokens.css`. The rows below name the role; the
value is in the file.

| Token | Value | Use |
|---|---|---|
| `--gray-*` / `--blue-*` / `--orange-*` / `--green-*` / `--red-*` | pick A's ramps | the source values; every token below reads one of them |
| `--background` | gray 100 `#f5f5f7` | the page, both apps |
| `--sidebar-bg` / `--sidebar-line` / `--sidebar-current` / `--sidebar-hover` / `--sidebar-muted` | gray 200 `#ededf0` / black at 7% / 7.5% / 5% / gray 650 `#636366` | the sidebar: its ground, its edge and the rule over its foot, where you are, a row under the mouse, its group names and counts (5.1:1) |
| `--sidebar-w` | 232px | the sidebar's width |
| `--layer-02` / `--border-subtle-01` | `#ffffff` / gray 300 `#e5e5ea` | a card, a list, a table, the receipt, the busy popup: a white box with a 1px hairline (`--layer`, `--layer-line`) |
| `--layer-01` | gray 75 `#f7f7f9` | a quiet box inside a card, table heads (`--wash`) |
| `--layer-accent-01` | gray 150 `#f2f2f5` | pills, counts, progress tracks |
| `--accent-10` / `--accent-20` | blue 50 `#e7f0fc` / blue 100 `#cfe1f9` | tinted rows; the chosen row is blue 50 (`--selected`) in `--accent-deep` blue 700 with a 4px blue bar |
| `--accent-alpha` | the blue at 6% | the hover wash on quiet buttons and menu rows |
| `--field-01` / `--field-02` | `#ffffff` | fields, boxed by `--border-strong-01` |
| `--text-primary` / `--text-secondary` / `--text-helper` / `--text-placeholder` | gray 900 `#1d1d1f` / gray 600 `#6e6e73` / gray 600 / gray 500 `#8e8e93` | ink (`--ink`), quiet text (`--muted`, 5.1:1 on white and 4.6:1 on the page), helper lines, placeholders (decoration, never the only label) |
| `--border-subtle-00` / `--border-subtle-01` | gray 300 `#e5e5ea` | hairlines on the page (`--line`) and inside a layer (`--line-in`); dividers only |
| `--border-strong-01` | gray 500 `#8e8e93` | a field's rule, 3.3:1 so a field reads as one; dashed drop zones |
| `--border-interactive` | gray 300 | the how-tos' rule under their heads (maize until Oct 23); the desk draws none |
| `--button-primary` / `-hover` / `-active` | blue 500 `#0b6bde` / 600 `#0a5fc6` / 700 `#0853ae` | the filled buttons (`--accent`), both apps |
| `--button-secondary` / `-hover` | gray 800 `#3a3a3c` / gray 850 `#2c2c2e` | the graphite fill: the builder's Save to the archive and Download |
| `--button-disabled` / `--text-on-color-disabled` / `--text-locked` | gray 300 / gray 500 / `#48484a` | a locked control: full opacity, gray fill; the locked Keep's word at 7.3:1 |
| `--link-primary` / `-hover` | blue 500 / blue 700 | links |
| `--focus` / `--focus-inset` / `--focus-ring` | blue 500 / blue 500 / the ring as one shadow | a 2px blue ring standing 2px off the control on a white gap (never yellow, Kate, Sep 23), drawn as a box-shadow so it never moves the page. Programmatic focus (`[tabindex="-1"]`) draws none |
| `--support-error` / `--button-danger-secondary` | red 600 `#d70015` | destructive words (`--err`, 5.4:1) and the error note's bar |
| `--support-success` / `--text-success` | green 500 `#2fa854` / green 700 `#1e7e3a` | done as an icon (`--ok-mark`) / as words (`--ok`) |
| `--support-warning` / `--text-warning` | orange 500 `#d9620b` / orange 600 `#b54708` | needs doing as an icon, the triangle (`--warn-mark`) / as words (`--warn`) |
| `--support-info` | blue 500 | the info note's bar and icon |
| `--notification-*-background` / `-border` | info blue 50, success green 50, warning orange 50, error red 50; the border the role's color at 30% | inline notes; words on them are `--text-primary` |
| `--text-success-on-tint` / `--text-warning-on-tint` | green 800 `#1a6b31` / `#7a3300` | a word on those tints (5.9:1, 8.4:1) |
| `--tag-background-*` / `--tag-color-*` | gray: gray 150 / gray 700; blue: blue 50 / blue 700; review: orange 50 / `#7a3300` | tags: a fact, New, a duplicate |
| `--radius-card` / `--radius` / `--radius-input` / `--radius-pill` | 12px / 8px / 7px / 999px | a grouped list or a card / buttons, notes, menus / fields and sidebar rows / pills |
| `--shadow-card` / `--shadow-menu` | a 2px whisper / a soft 24px drop | under a grouped list / under a panel that floats (I need help!'s) |
| `--background-inverse` / `--link-inverse` | gray 900 / blue 300 `#6ea6ec` | the builder's Undo toast; the how-tos' tips |
| `--overlay` | `#00000040` | the dim behind the busy popup and the tutorial |
| `--spacing-01` to `--spacing-10` | 2, 4, 8, 12, 16, 24, 32, 40, 48, 64px | every gap, pad and margin; 16 is the default. Page gutters are 40px (`--gap-56`), 16px on mobile |

Maroon `#500000` is FORBIDDEN in-app; it lives only in the newsletter email
template and the public Exchange site.

## Type

- **The computer's own face** (`--font-sans`: `-apple-system`,
  `BlinkMacSystemFont`, "SF Pro Text", "Segoe UI", `system-ui`): San Francisco
  on a Mac, Segoe UI on Windows. No web font loads; Mulish and Crimson Text went
  on Oct 23, Archivo and Lora on Sep 23.
- The scale, as `css/tokens.css` writes it: the page title 34/41 at 700,
  tracked -0.6px; a card title 20/26 at 600; a section title 17/24 at 600; the
  lede, prose and body 15/22; meta 13/18; the label 13/18 at 600 (500 over a
  field), sentence case with no tracking; a big numeral 28/34 at 600. The
  sidebar's rows are 14/18, its group names 12/16 at 600, its counts 13px in
  tabular figures. Buttons are 700; a lit tab is 700 over a 2px blue bar.
- Body copy is left-aligned, never centered or justified. Numbers are digits.

## Shape

- **Corners**: 12px (`--radius-card`) on a grouped list or a card; 8px
  (`--radius`) on buttons, boxes, notes and the busy popup; 7px
  (`--radius-input`) on fields and the sidebar's rows. Bars and the progress
  tracks stay square. Pills are fully round (`--radius-pill`): tags, counts,
  the toggle.
- **White boxes with a hairline on a gray page.** A card, a list or a table is
  `--layer-02` white with a 1px `--layer-line` hairline; a box inside a card
  (Finalize's edit box, a quote box, the list head) is `--layer-01`, gray 75,
  with no border. Rows divide with `--line-in`, lift to `--wash-hover` on
  hover, and the chosen one sits on blue 50 in blue 700 at 600 with a 4px blue
  bar on the left. Blue means "this one" or "you can press this"; gray means
  "a surface".
- **Buttons.** 40px tall (32px in a screen head or a section head, 48px for the
  builder's export trio), 16px side padding, the label left at 700. A primary is
  the blue fill, the same on both apps, with its icon in a 64px right slot (48px
  on the small size); with no icon the slot goes. Everything beside a primary is
  the outline: white with a gray 350 rule, lifting to gray 75 with a darker
  rule on hover (Cancel, the doors, Quick add, the builder's Back and Start the
  next issue). Since Oct 23 (her pick A) the builder's Next is the blue primary
  and Back the outline; Save to the archive and Download are the graphite fill. A Save inside an open card whose
  edits are already live is a ghost word (audit round two, Sep 17).
  Quiet words (Edit, Delete, Skip, Undo, Cancel in a panel) are ghost buttons:
  32px, a `--background-hover` fill on hover. No press scale. On the desk,
  where links and quiet words are gray like secondary text, a word that acts
  with no icon wears an underline (View info, Change, Verify link, Undo,
  Re-check), so it never reads as text; Edit and Delete carry their icons,
  Skip and Cancel stay muted (design critique, Sep 18).
- **Fields.** 40px, white, boxed by a 1px `--border-strong-01` rule with 7px
  corners, 12px side padding; the focus ring sits outside it. Labels are the
  sentence-case label above.
- **Tabs.** A page's tabs (Sort content's Sort and Finalize, Newsletter's Next
  issue and Past issues) sit under its title in one row under a hairline: 40px,
  quiet text with a round count, a 2px blue bar under the lit one (it keeps
  that look under the mouse), a `--border-strong-01` bar on hover;
  a fact about the page may sit at the row's right ("Oldest has waited N
  days"). They are read as tabs: one tab stop, Left and Right move between
  them, Home and End jump (audit round two, Sep 17).
- **Folds.** Every fold opens from a chevron on its left, pointing right when
  shut and down when open: the front page's bulk door, Finalize's No rewrite
  needed, Next issue's Past items. A chevron means a fold and nothing else
  (audit round two, Sep 17).
- **Notes.** Every panel that speaks is the system's callout: a
  `--notification-*-background`, a 1px `-border`, a 4px left bar in the
  `--support-*` color, the matching icon, `--text-primary` words. Info for the
  View info panel; warning for Sort's card questions (the link, a duplicate),
  Send early?, the builder's restore banner and its Replace the archived issue?
  ask; success and error for the builder's upload, pull, save and export
  results. An error note that can be retried carries a ghost Retry, and a
  success that ends a task stays (Saved to the archive, with Open Past
  newsletters), never a toast that fades (audit round two, Sep 17).
- **Focus.** `box-shadow: var(--focus-ring)`: a 2px blue ring standing 2px
  off the control on a white gap, drawn as a shadow so it never moves the
  page. Never yellow (Kate, Sep 23: "i HATE yellow outline"; the system's
  maize-inside-neutral ring lasted one day). Where a list clips it, it is drawn
  inside instead. Programmatic focus, which the card takes after a decision,
  draws no ring.
- **Steps.** The builder's wizard is Carbon's progress indicator: four equal
  steps under a hairline, a 20px circle at each one's left; reached steps turn
  the line the accent's, the current step fills its circle and goes 600, a finished one
  shows a check and keeps it when you go back. The whole step is the target,
  40px tall. A step that needs a pulled issue is drawn in `--text-disabled`
  with a disabled circle, and pressing it says why on the line right under the
  steps. A date alone opens nothing: a step opens once a pull brought items
  (audit round two, Sep 17).
- Every page's first line sits 32px from the top of the window, beside the
  sidebar; on the desk the status line keeps its one-line slot above it, so a
  message never moves the page.
- Sort and Finalize share one list row and one card: titles at 14/18 with the
  source or type under them at label-01. One scrollbar, the page's (Kate,
  Sep 23: "two scrollbars fighting"): the card neither pins nor scrolls inside
  itself, and a card that changes while out of view is brought back to the top
  of the window.
- The desk's nav is the sidebar (Kate's pick A of the looks, Oct 23), built by
  `js/shell-ui.js` from `NAV` in `js/shell-view.js` on every desk page: the
  desk, the builder, the email's three pages. It replaced the top bar of Sep 17
  to Oct 23 and its breadcrumb (the desk, the hub, the page under it); the
  sidebar of Sep 16 to 17 was a different one, of lanes. Its links switch
  screens in place on the desk and are plain links elsewhere; a click meant for
  a new tab stays one. What waits at each item comes from the front page's own
  rows (`hubCards`), so the two always agree; off the desk only the locks
  show. The addresses: /#team, /#queue, /#sort, /#finalize, /#newsletter,
  /#schedule, /#past, /#listserv, /#exchange (the hub), /#publish,
  /#highlight, /#briefs. The content sits in a 1280px column beside it; the
  desk's status line keeps its one-line slot at the top of that column. Under
  760px wide the sidebar sits above the page.
- **The page's corner** (Kate, Oct 24; see "The page's corner" at the end):
  at the top right of every page with the sidebar, in the status line's row,
  today's date as a small gray line and the How-tos button just right of it,
  staying put while the page scrolls. The How-tos panel is the one place a
  page links its how-to.

## Icons

Font Awesome 7.3.1 Free via cdnjs; setup in `.font-awesome.md` (read it first).
FA is for small glyph accents; the hand-drawn inline SVG check stays. Icon elements always carry `aria-hidden="true"`.

## Action vocabulary (the uniformity contract)

Every action element in either app matches this table: same word, same icon, same
look, everywhere it appears.

| Action | Icon | Look | Means |
|---|---|---|---|
| **Keep and next** (Sort) / **Keep** (Finalize) | ✓ `fa-check` | the primary: the app's fill, the check in its right slot (the ONE per card) | accept into the pipeline and move to the next item / accept the rewrite |
| **Skip for now** | none | muted ghost button | park it (status stays `circleback` underneath); it sinks to the bottom of Sort's list with a gray Skipped tag, and its card has Keep and next and Delete (Kate, Sep 18) |
| **Delete** | `fa-trash-can` | red ghost button | trash the ITEM for good (any screen, any time); the row stays listed grayed with Undo for the visit on Sort, Finalize and Next issue's Past items (design audit, Sep 17) |
| **Edit** | `fa-pen` | ghost button in the link color | the same inline edit on Finalize, under a row on Newsletter's Next issue (In this issue and Ready to add) and inside an open row on Publish (Kate, Sep 22: an edit button on each part of the pipeline; the Exchange is append-only, so an edit after an item is live changes the desk, not the site); persists on Save: the fields the type uses, then Link and Media, on the gray edit box; any way out of an edited form holds with "Save or cancel this edit first." Sort's card has no Edit: every field on it is edited in place and saves as you leave it (Kate, Sep 18) |
| **Use original** | `fa-rotate-left` | muted ghost button | reject the rewrite, keep the Sheet text |
| **Remove** | `fa-trash-can` | red ghost button | take OUT of the newsletter issue (returns to the pool); shares Delete's icon by Kate's explicit pick; on Next issue and in the builder the row stays listed with Undo (Sep 17) |
| **Verify link ↗ → Confirm / Change** | `fa-triangle-exclamation` | warning note, one ask | open the source, then stamp it good or paste a new link; a link that needs no check shows as itself with Change beside it |
| **View info / Hide info** | none | a word in the link color beside every screen/step title | opens the tinted instruction panel |
| **Re-check** | none | a link in Publish's lede | force a fresh hub check |
| **Add media** → Replace / Remove media | none | a small ghost word under the card's fields, then Replace and the muted Remove word | attach a picture or PDF flyer to any item (Sort's card and Finalize's Edit; newsletter items in the builder), the URL rides the row’s infographic column into the email |
| **Add** | none | a small tertiary on each row of Next issue's Ready to add | put the item in the issue; the status line says "Added: title" with Undo (Sep 18) |
| **Keep with fields empty → Keep anyway / Fill it in** | `fa-triangle-exclamation` on the note | warning note in the Keep button's place, one ask (Kate, Sep 22: ask, then let them keep) | pressing Keep and next on a typed item whose fields are still empty (an event's date, time or location, an opportunity's deadline) says "Still missing: Date, Location."; Keep anyway keeps it (K does too), Fill it in puts the cursor in the first empty field. Nothing is blocked, since some items have no date yet |
| **Send early? → Confirm / Cancel** | fa-clock on the note | warning note, one ask (same as Verify link) | adding an event that belongs to a later issue, the words stay bare, the bubble carries the icon |
| Door buttons (Go to Publish, Go to Newsletter, the receipt's door) | → `fa-arrow-right` | Carbon's tertiary button with the arrow in its right slot (Sep 15, option A; square since Sep 17), right of the screen head | move along the pipeline; the one filled button on a screen is then always its decision |
| **Top bar** (ERC Content Desk / the hub / the page) | none | a 56px bar under a hairline; crumb links in the ink | the way back up (Kate's wireframes, Sep 17; crumbs alone since Oct 6): the brand leads home, a hub's crumb opens its page in place, the builder's pages crumb under Newsletter |
| **Keep the rest (N)** | ✓ `fa-check` | the small dark-gray button, Carbon's secondary (Kate, Sep 17: a sweep across a list is gray, the one decision on a card is the primary), right of Finalize's head while rewrites wait to be checked | keep every rewrite still to check. Sort's Keep the rest went with its sections (Kate, Sep 18: "Drop it") |
| **Send it to** ERC Newsletter only | none | one checkbox on Sort's card (Kate, Sep 22; two boxes, Newsletter and Policy Exchange, from Sep 18) | where the item goes once kept: unticked it waits in the newsletter's pool at once AND on Publish, ticked it waits in the newsletter's pool and never reaches Publish; a campus event comes ticked: an Event with the A&M subtype, another unit's, the one thing held off the Exchange by default (Kate, Sep 22); ERC's own events go everywhere, and the old Spotlight request flag moves nothing. Nowhere is not a state, so Keep and next no longer locks on it |
| **Dismiss all** | `fa-trash-can` | red ghost word at the right of a group's head on Sort | deletes every row in that group in one change, with one Undo ("Dismissed N. Undo"). The groups (Kate, Sep 22): Past, an event whose date has gone or an opportunity whose deadline has passed, and Already live, a link the live Exchange already has (the same check Publish runs, asked for quietly on arrival); they sit under the skipped rows, each row tagged, and a row in both is Already live |
| **Undo** (Sort) | none | the status line's word after a decision; a grayed row's own Undo | Keys on Sort (Sep 17): up and down move, K keeps, S skips, D deletes, U undoes; the buttons' tooltips name them. A decision says itself in the status line ("Kept: title. Undo"), the card moves to the next item and takes focus; Undo says what it undid |
| **Copy saved in Drive** (the receipt's line) | none | a line on the receipt with the file's name as a link; **Download the CSV** as a ghost word only when the copy failed | since Oct 22 (Kate: "can it just get saved to the google drive?") the publish itself files the whole list after the write in the team drive, ERC Content Desk / Policy Exchange, named erc-exchange-<date>-<time>.csv, through the Sheet's script; no download step before Publish any more. From Sep 22 to Oct 22 the CSV came first: Download the CSV as the primary, Publish only once it had been downloaded, and the receipt's Download the CSV again |
| **Publish N to the Exchange → Confirm / Cancel** | `fa-triangle-exclamation` on the ask | the primary, then one warning note in its place | the one ask before the append-only write to the public site (design audit b6, Sep 17), at body-01 with the count and "live" in 600; Keep the rest on Finalize gets "Kept N rewrites. Undo" instead of an ask |

SUPERSEDED Oct 23 by her pick E, a grouped list with a Public links menu
(see "The design review (Oct 23)" at the end). The front page was Kate's drawn map (Oct 6; her six hubs, see "The six hubs"
below): the title Content Desk, the lede "What waits in each hub.", then six
white cards, three to a row on a laptop, in her order: Submit content,
Content queue, Newsletter, Listserv, Public links, Policy Exchange. A card is
its name with the arrow, the count as a big numeral, what it counts, and a
line at its foot; the teal bar on hover. The name is the card's link,
stretched over the whole box, so a card's own links (Copy link) stay links
and never nest. Public links opens nothing: each row is
a public page, opening in a new tab, with Copy link. Documentation went: each
how-to sits in its hub. The cards of Sep 22 to Oct 6 (Submit content,
Content Sort, Newsletter, Policy Exchange and a Documentation card) are gone.

The team's page, Submit content at /#team: since Oct 6 (her answer) the form
in a white box, at a reading width, with the bulk door, and "The team's
form." in the lede, nothing else; its how-to is in the How-tos panel (Oct
24). The Team submit page, which has no sidebar and so no panel, keeps "How to
submit content" as its lede. Its Queue fold went to the Content queue
hub, its Quick links to the Public links card (`js/public-links.js`, in her
drawing's order: the Exchange, Submit content, Join listserv; no row ever
shows its address; the team's how-to drew its Links to share, in Kate's set D
icons, from the same list until the trim of Oct 24), and its filled doors with the top bar's
lanes. The Sort page is Content Sort everywhere since Sep 22.

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
waited. Sort is one list, 420px, down the left: a gray head ("N waiting",
"Newest first"), then the waiting items newest first (the kept items that
lost their type among them), then the skipped ones newest first, each with a
gray Skipped tag, then the Past and Already live groups (Sep 22), each
with a Dismiss all, and last, grayed, what was kept or deleted this visit with
its Undo. A row is the title with source · added by who · when; the chosen
one sits on the selected layer with its 3px bar and its title at 600. On the
right the card, kept in view while the list scrolls, one white box split by
a vertical rule (the handoff, Sep 22). Left, the item as it reads: the
source as an uppercase label with the fact tags (New,
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
`design/mockups/newsletter.png`) is the hub, opened in place (since Sep 23; a new window before) from
the team page, one page with three tabs, Next issue, Schedule and Past
issues (Schedule since Sep 22: each upcoming send date as a big numeral
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

Orange means "needs doing", nowhere else on the screen (the system's warning
color, Sep 23; UT's Globe blue held the job from Sep 17, and Carbon's warning
yellow before that). A row the card has a question about leads its title with
an orange triangle (`fa-triangle-exclamation`); a missing type turns the Type
label and its row orange. It is the only orange on the screen, so it cannot be
read as an accent. Keep and next stays locked in Carbon's disabled gray until the type
and the link are settled and the item has somewhere to go, and its tooltip
says which. The Spotlight request checkbox and its tag went on Sep 22: ERC Spotlight is fed by the ERC event type, and anything else is moved there by hand in the builder.

Placement grammar: tools (Edit) pair with Delete far LEFT of a card footer; the
decision pair (secondary then primary) sits RIGHT; the position counter sits alone
top-right; **one filled button per card**, everything else quiet. Any in-flight
button DISAPPEARS; nothing is re-pushable.

## Motion

All CSS/vanilla; `prefers-reduced-motion` kills everything. Carbon's clock:
`--duration-fast-01` 70ms for a color, `--duration-fast-02` 110ms for a move,
nothing over `--duration-moderate-02` 240ms, and nothing decorative moves.

- Decision: NO motion (Kate, Sep 9; the slide and the shrink were both
  rejected). The decided row grays in place at the bottom of the list with
  Undo; that is what records the decision.
- Screen switch: ±16px directional slide, 110ms `--ease-standard`.
- Confirmations: SVG check draws itself, 240ms.
- Loading: shimmering words (Kate, Sep 23, her pick of nine; the sliding dots
  of Sep 1 are gone, "i hate those so much now"). Every wait says what it is
  ("Reading 2 new items…", "Adding…", "Checking the live Exchange…") in the
  quiet gray, and a soft blue light sweeps across the words (`.busy-words`,
  `busyWords()` in js/icons.js, `busyLine()` in js/ui-aids.js for a panel).
  Reduced motion and forced colors hold them still as plain words.
- Blocking progress popup (bulk upload's Add all, Sep 10): page dimmed with
  `--overlay`, a square `--layer-01` card, the count at heading-02, an 8px
  `--interactive` bar on a `--layer-accent-01` track, one muted line under it.
  No close button, no Escape: it exists to stop clicking around mid-upload.
- Buttons: 70ms color change on hover, no press scale.

## Copy

Sentence case. Terse: no redundant prose, no counts in prose unless load-bearing.
No emojis in UI copy (icons are the sanctioned decoration). Same term for the same
thing everywhere (see the vocabulary table).

## Do not

- No new fonts, icon sets, or UI libraries without approval. The computer's own
  face is the one face (Oct 23); the sidebar's line icons are drawn in
  `js/icons.js`, Font Awesome stays for the small glyphs in the pages.
- No maroon in-app.
- No corner but `--radius-card` 12px, `--radius` 8px, `--radius-input` 7px and
  round pills.
- No shadow but the 2px whisper under a grouped list (`--shadow-card`) and the
  drop under a panel that floats (`--shadow-menu`): layers separate things,
  and focus is a ring (Kate, Sep 2: no shadows; pick A, Oct 23, brings these two).
- No hex outside `css/tokens.css`; no size off the spacing scale.
- One blue on both apps (Oct 23; teal from Sep 23); the desk and the builder
  do not differ by accent. No maize, no navy in the desk or the how-tos,
  which wear the desk's look, sidebar and all.
- Color is never the only signal: a status color ships with its icon and a word.
- Nothing is "done" without a screenshot from the running sandbox.

## The how-to deck (Sep 30)

Since Oct 23 it wears the desk's look (see the end of this file): the
sidebar, the head with its blue door, the parts as the segmented control.
The navy band, its maize rule and white button below are its Sep 30 look;
Links to share went in the trim of Oct 24 (at the end of this file).

The team's how-to lives on the desk's open side at `/how-to/submit-content/`
(Kate, Sep 30: "it should live in vercel, on the content desk page, for how to
documents"), a static page beside the app, no password, linked from her email.
It was a deck for an afternoon; her calls the same day: "move away from the
slides a little", a page that SCROLLS with a JUMP MENU (sticky, the section
in view lit; it began at the page's side and moved to a row under the band
when she found the page "scrunched and not 1 column": the content is ONE
COLUMN, 1120px wide), and under a heading "just the slides if needed". The
cover became a navy band, the bar's color extended, with the eyebrow's
maize rule and a white button (her C of four), then one row 140px tall,
the words left and the button right ("header is still too big", twice). Three sections, hers: Add content, two slides under the desk's own
tabs, Add one item and Bulk add items (her wireframe answers: named tabs
above, not Back and Next; each slide a white box in two columns, the words
in the left third and the recording in the right two thirds, "the words
column wider" than her first 1:3; the Claude note under the steps; "the
spreadsheet is best", its columns are the desk's own; the templates download
from the page; every item needs a link), each with its steps, one "Claude"
info note and a RECORDING of the real desk in the sandbox (`fill-in.webm`,
`bulk.webm`), muted, looping, playing only while on screen and its slide is
up, Play and Pause under it, still under reduced motion, a swipe on a phone
moving between the slides; Item types (her name), one
table under a maize rule, her pick D of five: a bold row per type named as
the form names it, then an indented row per subtype, each with a plain line
under "Use it for" (her: the first lines were "lame") and the newest example
of its kind on the Exchange right now, fetched from the Exchange's public
news.csv at load, so it never goes stale; no name on the page ("no mention
of Kate"); and Links to share, the team
page's own Quick links rows (since Oct 6 the desk's public links, imported
from `js/public-links.js`), Copy link and Copied live. No After you click section and no practice form: "they're not
idiots". Steps only, and only where the screen does not already say it.
Sample content is obviously fake, in Aggie names (Howdy Policy Trivia Night).

## The newsletter how-to (Sep 30, evening)

Since Oct 23 it wears the desk's look too; the band and its white button
below are its Sep 30 look, and Open Newsletter is the blue door in its head.

The second how-to, `/how-to/newsletter/`, for whoever builds an issue
(Kate: "Kathy, and whoever builds an issue when she is out"; no name on
the page). The submit page's pattern with her one change, "can we do them
a tabs?", her pick B of three: no jump row and no scrolling sections, but
THREE TABS under the band in the desk's own tab idiom, Where items come
from, Build the issue and Send and archive, and inside Build the issue a
second, smaller row with a tab per builder step named as the builder names
it, Review, Outline and Preview & Edit (since Oct 7 the builder has three
steps: Outline, Preview & Tweak, Save & Export). One slide behind each tab, five in
all, the steps in the left third and a recording of the real desk in the
sandbox in the right two thirds (`next-issue.webm`, `review.webm`,
`outline.webm`, `edit.webm`, `export.webm`, muted, looping, playing only
while on screen with its tab up), a swipe on a phone moving between the
tabs of the box it lands in. The band's white button is Open Newsletter,
to /#newsletter, where an issue starts. No Claude note: the builder never
calls it (her call, "No Claude note on this page"). The one line outside
the slides sits under the builder's tabs: "Every fix in Preview & Edit,
never in Outlook, so the archive matches what went out." Next issue opens
it first in the How-tos panel, at Outline; the builder, at its step (Oct 24).
Until then Next issue linked it as a quiet underlined word, "How to build an
issue", beside "The email: read me".

## The six hubs (Oct 6)

Kate's hand-drawn map of the desk ("crazy vision", Oct 6, 2026) and her
answers to nine questions, asked one at a time, then a wireframe: six hubs,
each a card on the front page and a page of its own. The page heads read the
same: the hub's name as the title and one line under it.

- **Submit content** (/#team): the form (above); its how-to is in the How-tos panel.
- **Content queue** (/#queue): everything ever submitted, newest first,
  deleted items left out, each wearing where it stands: Waiting (the review
  tint), Kept (gray), In the <date> issue (blue), On the Exchange (green),
  the word always saying it. A search by title or source. An outside
  submission (it came with an email) is tagged From outside and shows no name
  or email: the page is open. On the right, Content Sort's filled door with a
  lock and how many wait, and "Password protected". Its guide, Sort the
  queue, leads the How-tos panel (Oct 24; How to sort and How it all connects
  sat under the Scraper block from Oct 22).
  Since Oct 19 (Kate: "a button that will run the scraper", the haul in
  Drive "so it's available to everyone") a Scraper block sits under the
  door: Run the scraper, an outline button, starts the scraper's run on
  GitHub; the line under it says what the last run found ("Last run Oct 19:
  22 events, 32 research, 152 headlines, 17 opportunities.") with Open the
  files, the run's folder in the shared drive, in a new tab; while a run is
  on the button goes and the line shimmers with the start time; a failed run
  says so in the warning color with the button back. The haul lands twice
  in Drive (her pick, Oct 19: "a new sheet based on the scrape, by the
  newsletter send out dates", one Sheet with a tab per issue): the run's
  spreadsheets in a folder named by date, for the bulk door, and every row
  on the tab of the issue the run feeds in the Newsletter scrapes Sheet,
  newest issue first, so the line reads "Last run Oct 19, for the Oct 27
  issue: …" with Open the sheet, then "the files". Runs between two send
  dates stack on the coming issue's tab, the Run column saying which day;
  a link already on the tab is never written twice and the script never
  removes a row, so what the team deletes by hand stays deleted (Kate,
  Oct 20). Nothing enters the queue by itself: the team reads the tab, and
  drops the files it wants on the bulk door, as before. Counts and links
  only, since the page is open.
  Since Oct 24 (the owner's pick "feeds run on their own", Option 2 of
  `.superpowers/tmp/oct23-options/data/sources.md`) Add a source sits beside
  Run the scraper, an outline button that gives way to a short form in a
  white box: Name, Address, What kind (Site or feed, or Email newsletter,
  with "Pick Email newsletter for one that only arrives by email."), What it
  posts (the scraper files every item under one of its four types), then
  Add the source (blue) and Cancel. While the desk looks, the buttons go and
  the wait shimmers ("Looking for its feed", "Saving it"). The answer is a
  note that stays for the visit: green "Added. The scraper reads its feed
  from next Monday."; blue "Saved, but it has no feed, so the scraper cannot
  read it yet." and "Saved as an email newsletter. The scraper cannot read
  email." A refusal (a duplicate, a private address, the sheet not connected
  yet) is the red line under the buttons, the form and what was typed kept.
  The row goes to the Scraper sources Sheet; each run reads its switched-on
  feeds as plain feeds (`docs/handbook/connections.md`, "Add a source").
  Sort the queue's The scraper pins it and says the one thing the screen
  does not: it only adds, and a source it added stops when its Switched on
  cell says no; the scraper's built-in sources still need code.
  Since Oct 8 (Kate: "the queue has too many items. It should just be what
  was submitted from the last newsletter until now"; her pick of a second
  tab): the desk's tab row under the head, Since the last issue (opens
  first) and Everything, each with its count, and "Last issue: <date>" at the
  row's right. The cutoff is Ready to add's: the newest send date not after
  today, by College Station's date of submission. The search filters the open
  tab; an empty first tab says "Nothing new since the <date> issue."
- **Newsletter** (/#newsletter): unchanged (her answer); its status, the
  next send, how many are in it and the last sent, rides its card.
  The newsletter's HTML (Kate, Oct 8; her map's "HTML design files"):
  three links at the card's foot, the read me first, never downloads (her words: "the builder
  has the most recent html template right now. that's what we should be
  using ... they can all link in vercel"). Blank template
  (/newsletter/template/, every section and callout with placeholder words,
  builder/fixtures/blank-issue.json) and Sample issue (/newsletter/sample/,
  the builder's own practice issue) are each the email drawn in a sheet by
  js/email-page.js through builder/js/template.js the moment the page
  opens, with Copy HTML in the head; Read me (/newsletter/read-me/) says what
  the two are, lists what the builder changes in an issue (her note: "some
  of those things you can do in the builder"), and keeps Claude Code for big
  style changes to builder/js/template.js alone; one email is never edited
  outside the builder. All three crumb
  under Newsletter as The email.
- **Listserv** (/#listserv): the sign-up form's status, its last sign-up, its
  link with Copy link; how many wait to be added, counted since the desk
  began keeping a copy of each sign-up (her pick: `/api/listserv` keeps one
  in a `signups` table once the script has taken it, made only by
  `scripts/ensure-schema.js`, run by hand). Counts and dates only, never a
  name or an address. Since Oct 8 (Kate: "a button or something that links
  to the google sheet"): a filled door, Open the sign-up sheet, opening in a
  new tab, under an Adding people label, with her three steps under it (Add
  the people on Sheet 1 to the listserv; Move their rows from Sheet 1 to
  Sheet 2; Clear Sheet 1); the card carries the sheet as a link. The address
  sits in the code (her pick; the sheet's own sharing guards it). The count
  is Sheet 1's own row count (her pick, "Count Sheet 1 live"), asked of the
  sign-up sheet's script as the page opens (`?action=count`,
  apps-script/listserv-count.gs); when it does not answer, the numeral is
  blank and the note says so with Try again. The day Sheet 1 is seen cleared
  is the day the listserv was last updated (her note: "when the sheet 1 goes
  from a count to 0 that means it was updated"): the desk's copy stamps its
  rows beyond the newest N as added, and the box says "Last updated <date>." Downloading
  the sign-ups in the listserv's format, her map's Forthcoming item, was
  DROPPED (Kate, Oct 8): Sheet 1 is the list to add from.
- **Public links**: the card alone, Copy link on each row.
- **Policy Exchange** (/#exchange): the site's status (Live, or that it did
  not answer), when it last changed (`/api/publish?updated=1`, its own function until Oct 21), the live link, how
  many wait to publish; Publish opens from it as a page of its own,
  /#publish, titled Publish, the way the builder sits under Newsletter. The
  code, the handoff and where the logins are kept are forthcoming; the logins
  themselves never go on a page or in this public repo.

Her red Forthcoming items show as quiet gray lines with a clock, each to be
built in a round of its own.

## The seventh hub: Research briefs (Oct 20 and 21)

Kate's go (Oct 20, 2026; `docs/research-briefs-handoff.md`): the
research-brief pipeline, journal article to published brief, joins the desk
as a seventh hub, **Research briefs** (/#briefs), hers alone behind the same
lock as Sort (`LOCKED_SCREENS` holds briefs and brief). Her four answers:
the first slice is the status queue, the paper and her notes, Claude's
whole-markdown draft with figures flagged, and the markdown and author Word
doc to download; the author round stays a Word doc by email; Kate only; built
here. Then (Oct 21, one question at a time): the files live in a folder a
brief on the TEAM drive, `ERC Content Desk/ERC Research Briefs/<lastname>-<year>-<topic>` (her folders, Oct 21),
written and read through the Sheet's own Apps Script (briefFolder, saveFile
with a folderId, listFiles, getFile; the folder's id is the script's
`BRIEFS_FOLDER_ID` property); the twelfth function slot came from folding
the Exchange's last-changed check into `/api/publish?updated=1`; her edits
come back as a paste box or a dropped .md; a repeating author gets a topic
word. Her picks of six drawn layouts: **A**, the hub as a full-width table,
one row a brief, with a stepper across the seven stages (Paper and notes,
Draft, Your proof, With author, Approved, HTML, Live; the last two round
two, their dots dashed) and a Waits for column in words ("Your Grammarly
pass · drafted Oct 20, 1,480 words"; "Dr. Bowen's edits · sent Oct 2, 18
days"), New brief as the primary at the head opening the form above the
table (the paper as a PDF up to 3 MB, the author's last name, year and topic
word naming the folder, the paper's title, authors, journal, the author of
record, her notes); and **D**, a brief's own page (/#briefs/<id>) as the
stepper across the top with dates under the steps, then only the stage it
is at as one box, with the folder's files beside it, each a link into Drive.
The stepper is the builder's progress indicator idiom: a 20px dot and a
line, teal for done and now, the current dot ringed; in the table only the
current step is named (the full row read "a bit busy", her pick A of three
quieter rows, Oct 21), on the brief's page every step is. The front page's card
is the seventh, locked, counting what is not live ("3 · in progress · 1
with an author") only once her sign-in has read the list. Round 1 (Oct 21)
built the hub, New brief, the paper stage with Save notes, the card and the
lock; the draft, her proof and the author round are the next rounds, and a
brief past the paper stage says so on its page.

- **New brief in her order** (Kate, Oct 22: "you should have to upload the
  paper and notes, then it reads and fills out the byline before it moves
  onto content"): the form opens with two file fields side by side, the
  paper as a PDF and her notes as a .md or .txt, both needed (`notesFile` in
  `js/briefs-view.js` takes the notes file's text; a KB count and a word
  count sit under them). Create the brief is locked and says why on the line
  under it (`createLock`: "Choose the paper and your notes first.", "Choose
  your notes file first.", "Reading the paper first."). Choosing the PDF
  reads its first two pages in the browser (pdf.js 4.10.38 from cdnjs,
  loaded only then; `js/paper-read.js`), sends that text to `/api/briefs` as
  `read`, and the model names the paper (`api/_lib/paper-fields.js`: title,
  authors, journal, year, the first author's last name, nothing invented, no
  journal for a working paper). The byline then appears under the files,
  filled where its boxes were empty (the year only while it held the
  default), with "Read from the paper: title, authors, journal, year, last
  name. Check them." in a status line, and the cursor in the topic word; a
  failed read says so there and she types them. The form keeps every box and
  both files across redraws (a refusal, Creating…), the desk's rule that a
  redraw never drops what you are typing. On the brief's page the notes box
  keeps its own file field under it, "Or your notes as a file".
- **Notes as text, Word or pasted** (Kate, Oct 22: "what if someone wants to
  upload a word doc? so text, word or .md? or a copy paste option?"): the
  notes file field takes a .md, .txt or Word .docx (`notesKind`); a text file
  is read in the browser, a Word file goes to `/api/briefs` as `notes-text`
  and the desk's Word reader (mammoth, the bulk upload's) hands back markdown
  with its escapes removed (`plainMarkdown`), up to 2 MB, the original kept
  beside notes.md as `notes-original.docx`. Under the field, "Paste instead"
  is a quiet word that opens the box "Your notes, as words"; the box also
  appears filled once a file is read, so she sees what the desk got and can
  fix it, and its words are the notes ("31 words from nagro-notes.docx", "10
  words, pasted"). Create's lock reads "Choose your notes file, or paste
  them, first." The brief's page takes the same three kinds in its own file
  field.
## Her notes after the hubs (Oct 6)
- **The draft stage, round 2** (Kate, Oct 22, her Go on the drawn stage; the
  wireframe was three moments of the brief's page): at Paper and notes a
  primary, Write the draft ("A few minutes. Reads the whole paper, plans the
  pages, writes the brief."). The browser then drives the desk's steps one
  call at a time (`/api/briefs` `draft`; `js/brief-draft.js` holds the steps,
  the prompts from the July brief builder with STYLE-GUIDE and the voice, and
  her notes steering every call): Read the paper (the deep read, as a document
  so the model sees the tables; `extract.json`), Plan the pages (the Bowen
  page plan with its measured capacities and a suggested title;
  `page-plan.md`), the eight sections each with the ones before it, Check the
  draft against the paper, Put the files together (`brief-draft.md` in the
  Bowen shape, `brief-for-grammarly.md` as words alone, `figures.md`, the row's
  words and title). The running box lists every step: a green check once
  done, the busy words with a turning circle while it runs, a quiet circle
  before; "Stay on the page while it writes. If you leave, Continue picks up
  where it stopped."; a failed step says so in red with Try the step again.
  Done, the stage is Your proof and the box is the Draft: the body-prose
  count with its band as a pill (review tint under the floor or over the
  cap, gray in the band), the three downloads and Redraft (starts
  over from the read; since Oct 23 it asks first, "This replaces brief-draft.md
  and your edits in it." with Write it again and Cancel) on one row, then the brief itself as reading text,
  her pick A of three (Oct 22: "easier to read like just on the webpage"):
  `js/markdown-lite.js` draws the desk's own markdown, every character
  escaped, at a 720px measure with the maize rule under each section title
  and the cover lines folded into one quiet line; Tables and
  figures in the paper (the first two flagged Rework in the review tint,
  the rest Prose, "cut out, in the folder" once the browser has rendered
  the page with pdf.js and filed `figure-<label>-p<page>.png`), Numbers the
  paper disagrees with itself on (each with the warning triangle, where it is
  and what the draft used), What the check could not settle, and the next
  line to her proof. The hub's table says which step a drafting brief is on.
  New brief gained a Brief author box, remembered on that computer and named
  on the draft's cover (Kate Barnes by default until Oct 23; since then it starts
  empty and Create asks for it). The review's fixes (Oct 22):
  each model call names its own clock (the read 45 s, a step 250 s, no
  retry, under the function's 300 s); Write it again clears the old run's
  sections, flags, result and crops, so the new draft is never told not to
  repeat the one it replaces, and the running box shows the read as now the
  moment it is pressed; the one draft running is the newest, a brief left
  mid-step stops at its next step; Write the draft carries the notes typed
  on the page and a redraw keeps them; a failed restart or crop says so on
  the proof box and in the status line, a crop the desk refused reads "not
  cut out" on its row, and a page too big as a picture is drawn smaller
  until it fits; the crop's name is held to the door's rule; the form says
  when the paper and a Word file would not fit one upload; a draft's end
  refreshes the page without blanking it; the crops wait has busy words.
- **The Draft box, lean (Kate, Oct 22, night; her pick A of four, after "too wordy and too much" and "i don't like the check things").** One row of tools: the word count and its pill ("512 words", "788 short", "In range", "212 over"), then Draft, Grammarly copy and Page plan as download words, then Redraft. Then the brief as reading text, then one section named for the proposal ("Figure 1"): "Paper, p. N" with the paper's cut beside "Brief" with the proposed table or chart, and nothing after it. The check's notes and the number conflicts go to check-notes.md in the folder, always written so a redraft replaces them. The running box names each step plainly whatever its state (Read the paper, Plan the pages, Table or chart, the sections, Check against the paper, Put the files together), says "Keep this page open." and offers Continue or Try again; a failed Redraft's Try again starts the redraft over. The pair stacks when its box is under 640px, and the brief page stacks below 1024px. The draft's prompts carry VOICE.md and REPORTING.md, which Kate approved section by section that day (docs/briefs/, filed beside STANDARDIZATION.md on the team drive).
- **Theirs and the proposal** (Kate, Oct 22: "i want to see their figure
  and the proposed new one before it goes off to the author"; her picks:
  the model marks it and the desk cuts it, layout A, the plan picks a chart
  or a table per paper, D1 maroon bars, no edits until round 3). The deep
  read marks a box around each table or figure on its page; the browser
  draws that page with pdf.js and keeps the box with a small margin, so a
  cut is the table or figure, not the page, and files it in the brief's
  `figures` folder. A step after the plan, "Proposing the brief's table or
  chart", builds the brief's one visual as the plan names it: Table 1, or
  Figure 1, a bar chart when its point is a trend or a comparison of 2 to 8
  groups and the paper prints the values, always with its numbers as a
  table (`proposed-visual.md`, one name so a rerun replaces it); it marks
  its own source's page and box, so the pair beside it is always its source
  (the review, Oct 22: an exact-words match had paired another table), and
  each bar keeps its value as the paper prints it; the findings mark its
  place by that name. On the Draft box, under the brief, a section
  named for it holds the pair at equal width, In the paper on the left (the
  cut, opening the file in Drive), Proposed for the brief on the right (the
  table in the desk's table idiom, or the chart with "The chart's numbers"
  under it), then "Kept: ... Left out: ..."; the other cuts follow as rows,
  280px each, with their label, caption and pill. The chart is drawn by
  `js/brief-visual.js` in the printed brief's colors from the Texas A&M
  brand guide, Aggie Maroon bars and Dark Gray words in Open Sans, the
  value on each bar, upright columns for short labels and full-width bars
  under each name for long ones, and filed as `proposed-figure-1.png` for
  the author's Word doc: the brief's maroon, not the desk's, the way the
  email template keeps its own. A cut not made says so with Cut them out,
  or Try the cuts again after a failure; the cuts run under the draft with
  the busy words in that spot, so she keeps her place; a page the paper does
  not have is refused, never cut from the last page. The figures folder needs the
  latest Code.gs pasted and deployed; until then the cuts land beside the
  draft, and the page finds them there.


- **The highlight's own Save**: once the picks change, Update the highlight
  and Cancel changes sit right under the Now and After boxes, whatever waits
  to publish. It asks the password once and writes the pins alone
  (`/api/publish` with `only: 'highlight'`); a pick not on the Exchange yet
  stays picked and goes up with the next publish, and the page says so.
- **No pause on Next issue**: Add, Remove, Delete and their Undo change the
  row at once and queue the write, the way Sort's decisions do; the server
  answers once the database has a save and writes the Sheet mirror after
  (`waitUntil`).
- **Quick add's Date**: a Date field under the type for every type, Deadline
  for an opportunity; optional, the reader fills it from the page when blank.
  The team's form has none.
- **Source**: the organization that hosts, publishes or funds an item, by its
  plain name ("New York Times", not "New York Times Education"), never the
  newsletter, digest or inbox it was found in; the reader is told so and
  such a source is dropped.
- **Ready to add, new only**: research and headlines count only if added
  since the last issue went out (the newest send date before the issue being
  built, not after today); older ones wait in Past items as "From before the
  <date> issue", with Delete. Events and opportunities keep their own rules.
- **Save at the top**: every edit box with a Save has Save and Cancel at its
  top too: the desk's edit form, the builder's item, callout and
  Introduction cards.

## The public pages

The share form and the listserv sign-up live in `public-pages/`, a Vercel project of their own at an address of their own (Kate's pick A, Sep 22), beside the Policy Exchange's copies at /share/ and /newsletter/. Never on the desk's address: the desk has no password, and a public page on it is a door into it (copies at the desk's /submit and /listserv were built and taken down the same hour on Sep 22; Kate: "I don't want others to backspace from submit and see everything"). The pages post to their own `/api`, which the folder's `vercel.json` forwards to the desk server-side, so the desk's address is written nowhere a visitor can read, and the desk's own deployment sends the folder's addresses on to the standalone site (a redirect in the desk's `vercel.json`; an ignore line would empty the standalone deploy too, since Vercel reads `.vercelignore` at the repository root for every project built from the repo). Each call carries `public: true`, which the bot check honours as "gate me"; the project's hostname must be on the Turnstile widget's list in Cloudflare or the human check will not load. The sandbox serves the folder on port 4174 with the same forward. The public share page is deliberately NOT the desk theme: it wears the ERC's outward maroon, the listserv sign-up's look (Work Sans/Open Sans, white card with the 3px #500000 border and hard offset shadow, uppercase maroon button), because it faces the public alongside the newsletter and the hub. It never links into the desk. Uniformity audits should hold it against the sign-up page, not against the desk tokens.

## After the audit (Sep 23)

Kate's answers to the usability audit, each one decided by her:

- **Today** is College Station's date (`js/today.js`, America/Chicago), never UTC.
  Since Oct 24 every page with the sidebar shows it at its top right,
  "Saturday, Oct 24" (`todayWords`).
- **Focus** where a list clips what is drawn outside a control (the type
  picker, the Sort and Finalize list rows) is drawn inside instead: 2px teal,
  and on the picked, teal-filled type a 2px white line. Everywhere else the
  teal ring stands.
- **Warning words on the maize tint** are orange brown `#8f3814`
  (`--text-warning-on-tint`, 7.3:1); orange 500 stays for warning words on white.
- **A locked Keep and next** says why on a line tight under it ("Set a type
  first", "Check the link first"), and its label is `--text-locked` `#4f5d6b`.
- **The tab icon** is a teal square with a white check, on both apps.
- **Source on Sort** shows only when it is not the ERC's own: blank or "ERC"
  shows nothing; "added by" stays.
- **One name**, "Policy Exchange", for the lane, the page and Finalize's doors.
- **The builder**: a removed item stays grayed in place with its own Undo until
  the step is left; the Issue list hides past dates but keeps a draft's own;
  Discard keeps the draft in the desk's database for 90 days, listed under
  Recently discarded on the first step with Restore (the `drafts` table, made
  only by `scripts/ensure-schema.js`, run by hand); an item added by hand
  goes to Content Sort's queue too, stamped for the issue, "added by the builder".
- Left as they are, by her word: the front page's counts stay blank while they
  load, nothing is added for screen readers, and Sort is never laid out for a
  phone.
- **The fields a kind of item shows** (Kate, Sep 23, evening: "if it's a
  webinar, there won't be a spot for location"): a webinar (an Event with the
  Webinar-Online subtype) has no Location on Sort's card, the edit form, the
  facts panel or the Keep ask, and none reaches the newsletter or the site
  (`hasLocation` in `js/schema.js`; the newsletter's group already says
  online, the Exchange has its tab). Research and headlines have a Date spot
  (the publication date the Exchange sorts by, which the reader already reads),
  never required. Keep no longer asks a headline for an Outlet (`medium`),
  a column nobody types.


## The sign-in and the highlight (Sep 23, evening)

**Sep 30: the sign-in is OFF** (Kate: "turn off the password", her pick of
"the sign-in only"). **Oct 6: Content Sort is locked again, alone** (her
drawn map: "Sort, password protected (Kate only)", and her pick "Sort only,
as drawn"): `LOCKED_SCREENS` in `js/auth-view.js` holds sort and finalize;
every other page opens to anyone with the address, and the password also
lives on at Publish's Confirm, the one write to the public site. The
Finalize rewrite (`/api/rewrite` with ids) asks for the sign-in again; the
Exchange card's words (`card`) stay open, since Publish is. The sign-in's
way back under its box is the Content queue now. The lock guards the pages
and the model call; `/api/sheet` stays open, as the team's own pages write
through it. The paragraphs
below describe the lock as built on Sep 23.

- **The desk password** (Kate: "password protected for just me, Kate"). The
  front page, Content Sort (both tabs) and Publish draw the sign-in in their
  place until the session holds; the team's page, the Newsletter and the
  builder stay open. The sign-in is her pick B: a bare page, the brand alone
  in the bar, one white box in the middle of the window with the page's name
  at card-title size, the Password field and the teal Sign in, and nothing
  else to read ("you're soooo text heavy"); a refusal is the red line under
  the field, and the ask stays. Under the box, Submit content in the quiet
  gray, for anyone who landed there. One sign-in lasts a day on that
  computer, as an HttpOnly cookie signed by the password
  (`api/_lib/session.js`; `/api/auth` is answered by `middleware.js` at the
  edge, since `api/` holds the Hobby plan's twelve functions). The server
  refuses the Exchange check, the publish and the rewrite without it. Sign
  out is a quiet word at the top bar's right end while the sign-in holds.
  The password is `DESK_PASSWORD` on Vercel, set by Kate; unset, the locked
  pages stay shut and say so.
- **Publish's ask** carries the password too ("Type the desk password to
  confirm"): the field, then Confirm and Cancel on one row, a refusal in red
  under them, and the ask stays until the password is right. Confirm is the
  one write to the public site, so it is the one place the password is asked
  twice.
- **The highlight** (Kate: "if it is in the highlight (hero thing) it needs
  a photo"). The Exchange's home page shows a few items in a big card; she
  picks them by hand at Publish, up to six, new or already live, in her
  order. Her pick A, under the table: a section head, Highlight, over the
  maize rule ("Up to 6 · each needs a photo"), then two white boxes side by
  side, Now (what the home page shows this minute) and After this publish
  ("n of 6"), each a numbered list with the picture at 48 by 32 on the left
  and the title over a meta line (type · when · adding now or live); a pick
  with no photo shows the warning triangle in the picture's spot and "No
  photo" in the meta. The After box carries the tools: Add photo or Replace
  photo (the item-image control in photo words), up and down arrows, Remove.
  Under the boxes, Pick from: a table of everything that could go in, the
  rows going out now first, then what is live, each with Highlight as a ghost
  word or "In, 3rd" once picked, under a section filter in the legend's own
  idiom (All, Research, Events, Opportunities, Headlines, a count on each;
  Kate: "so we can find events quickly"). At rest the table holds the rows
  going out now and the newest 8 live rows a section (Kate, of the whole
  list: "it's a lot"); a search box at the head's right, by title or source,
  reaches every row, and a meta line under the table says how many the
  search would reach. The ask names the picks without a photo
  ("1 highlight has no photo.") and lets her through ("Ask, then allow").
  With nothing to publish and the picks changed, the primary is Update the
  highlight and the ask says so; the status line answers "Highlight updated:
  N items." The picks ride the write to the Exchange's own
  `data/featured.json` as its pins (Sep 30; `docs/exchange-highlights.md`),
  so `news.csv` stays append-only, and Now reads the same file, so it shows
  what the card holds this minute, the one-off cards made on the Exchange
  after the pins; her photo for a pick also lands on the row's own picture
  where the row had none, and the receipt says "Highlight: N items."
- **The card's words** (Kate, Sep 30): a pick that is an event, an ERC event
  or an opportunity gets a summary that fits the New & upcoming card, 180
  characters or fewer, one or two plain sentences, the invitation first, no
  lead-in, a book or journal name in stars (the card draws them in italics),
  and its title as it is unless it ran past 80 characters. The model writes
  them the moment she presses Highlight (`/api/rewrite` with `card`, the
  same function as Finalize's rewrite; the rules that fit what comes back
  are `js/card-words.js`): the row says "Writing the card…" in the busy
  words, then the summary on a line of its own under the pick, with Edit (the
  pen) opening Card title and Card summary fields and a count ("85 of 180"),
  Save and Cancel as quiet words. A pick that was on the Exchange before the
  desk wrote any words, or whose words did not come, says so with the
  triangle and a Write the card or Try again word. Research and headlines
  get none: the card shows them as they are. Every pin carries the day it
  shows until ("until Oct 8" in the meta): hers from the Exchange, else an
  event's date, an opportunity's deadline, else two weeks.

## The design review (Oct 23)

Kate's last day. Three reviews ran on the whole desk, the builder and the
how-tos: impeccable (visual and technical craft), Intent's evaluate (every
job walked end to end, a newcomer working from the how-tos alone) and
Intent's articulate (every instruction against her writing rule). Her
calls, one question at a time; the desk goes to the team after today.

- **Computer only, the how-tos too** ("you wont ever do things on a phone").
  The public pages still have to work on phones.
- **I need help!** (her words; pick A of three): Report a problem is a quiet
  word at the top bar's right end, before Sign out, drawn like it; the panel
  opens under the bar. The corner button covered Skip for now, a Pick from row
  and the builder's edit card. It still posts to her Google Form; it is not
  Claude.
- **Highlight, slot by slot** (her pick C of four): one box, the site's pin
  on the left and her pick on the right at each slot, a Changed tag where
  Update the highlight would change that place; a pick reads title, card
  words, then its tools (photo, Until, arrows, Remove) on a line of their own;
  Save under the picks; Until is plain words. This replaces pick A's Now and
  After boxes.
- **The front page, grouped** (her pick E: "E is perfect"): one list per
  step under plain group heads, Bring it in (Submit content, Content queue),
  Send it out (Newsletter, Listserv, Policy Exchange) and Research (Research
  briefs: everyone sees it, the password is asked on entering); Public links
  leaves the list for a vertical menu at the right, its three public rows with
  Copy link, then a Team submit page row with a pin. The Team submit page
  (/team-submit/) is the team's form alone, no desk menus, to open in its own
  tab and pin. The card grid of Oct 6 to 23 is gone.
- **The builder**: Next the teal primary, Back the outline; the edit card's
  shadow went for the hairline (no shadows); a draft drops what the desk
  removed, deleted or moved to another issue each time the builder opens, so a
  Remove on Next issue no longer ships (edits on the desk still do not reach a
  draft; make them in the builder).
- **Small fixes**: Title and Description say (optional) on the team's form
  and Quick add; Quick add's button names its issue ("Add to the Oct 27
  issue"); Keep says "Pick a subtype first" when only the subtype is missing;
  a long title wraps on the Sort card; the bulk fold's chevron points right;
  a link with no class is teal; Crimson Text no longer loads; the sign-in and
  the how-tos say the password is in READ ME FIRST - ERC handoff (the password
  itself never appears; since the trim of Oct 24 only Who to ask says where,
  and every guide that asks for it links there).
- **How-tos**: every step listed beside its picture, pins at rest; Submit
  content re-recorded on today's page.
- **Said plainly instead of rebuilt** (her picks, for today): the builder's
  draft is saved in one browser only; Finalize's unkept rewrites live in the open
  tab. Her name is no default anywhere after today (Brief author starts empty).
- **Left as they are, by her word**: the brief's later stages, the restore
  ask, Undo lasting one visit, her personal help form, the brief as reading
  text, no date on the team's form.


## The look, pick A (Oct 23, evening)

After the review Kate picked a new look for the whole desk (The look, at the
top of this file). It lands in three steps on a branch, each checked in the
sandbox before anything goes live:

1. **The look and the sidebar** (done): the tokens in `css/tokens.css`,
   the computer's own face, the sidebar on the desk, the builder and the
   email's pages, labels in sentence case, hairlines for the maize rules, the
   blue tab icon. I need help! moves from the top bar into the sidebar's foot,
   before Sign out, and its panel opens beside the sidebar; the team's own
   page keeps it in the corner (a how-to kept it in its bar until the how-tos
   took the sidebar, the same day). The builder's step
   card is white on the gray page with soft corners. Every other screen keeps
   its layout and takes the new look through the tokens.
2. **The front page** as A's grouped lists, with the line rules (done):
   the title and its lede at the left of the head (How it all connects, a
   white button at its right until Oct 24, is in the How-tos panel); each
   group a white list with 12px corners; a row is the hub's icon on a pale
   blue tile, its name, one line for what the count counts (that first fact
   darker: "waiting for Sort", then "· 1 from outside" in gray), one for its
   status (the lock where the password is, a green dot beside Live), its own
   links in blue, the count (gray when it is 0) and a chevron. No line wraps;
   a cut line shows itself in full on hover. The schedule warning is a note
   of its own under the Newsletter row. Public links keeps its three rows,
   each with Copy link as a blue pill, and the Team submit page under them;
   under 1200px wide the menu drops below the lists.
3. **Content Sort** in A's layout (done; Finalize shares its list and card):
   the page runs edge to edge beside the sidebar under a 56px toolbar band
   (the title, Sort and Finalize as a segmented control, the status line on
   one line in the band, "Oldest has waited N days" at the right); a 300px
   white list pane, rows with soft corners and no rules, the chosen row a
   solid blue fill with white words (a border too in high contrast); the card
   one white box (type and subtype with the fact tags and "N of M", the title,
   the byline, source and date, the link on a pill with Change, the notes, the
   description, Edit and Add media, the type's fields, "Added ... by ..." over
   a hairline); the decision column: a Type box with the picked type's
   subtypes as pills under it, ERC Newsletter only drawn as a switch with its
   line, Keep and next (blue), Skip for now (gray fill) and Delete (red), each
   with its key chip K, S or D. Under 1132px wide the decision column drops
   under the card. Every key, ask and Undo is as before.

**Pages lead with what their sidebar row counts** (Kate, Oct 23: "if someone
clicks listserv, they probably want to see the new ones to add first"):
Listserv opens on To be added (the count, Open the sign-up sheet and the
three steps), then the sign-up form; Policy Exchange on the Publish and
Highlight doors, then the site's status, Edit live items, then the code
line, in one 720px column (its three how-to links went to the How-tos panel,
Oct 24); Newsletter's Next issue on a
head line ("Oct 27 issue", sends in N days, Open the builder), then the
lists. The Policy Exchange count is one number everywhere (the sidebar, the
front page, the door), what the live check says Publish would add, and
nothing until that check lands, never a guess. Listserv's side note drops
under its boxes below 1232px wide.

The how-tos wear the desk's look, sidebar and all, and every picture in them
is of it, shot with `how-to/capture.mjs` and built with `how-to/make-deck.mjs`.

## The page's corner (Oct 24)

Two picks of Kate's, each from five drawn in the real desk
(`.superpowers/tmp/oct23-options/`), sharing the top right of every page with
the sidebar: the desk's screens, the builder, the email's three pages and
every how-to. `js/page-corner.js` draws them once a page, called by
`renderSidebar`; `css/shell.css` seats them in the grid's second cell, 40px in
from the window's right, centered on the desk's status line row (32px down)
and sticky at the top as the page scrolls, on the page's ground so words
scrolling under them never show through.

- **Today's date, her pick E**: a small gray line, the calendar icon and
  "Saturday, Oct 24", College Station's (`todayWords` in `js/today.js`), a
  `time` element. It turns over past midnight without a reload (a 30 second
  clock, and again when the tab comes back). It is not on Content Sort, whose
  band carries the How-tos button alone. The status line's words and their
  action end before the corner starts: the corner measures itself into
  `--corner-w`, the status line pads its right end by that and 16px, the spring
  note keeps the same room, and on Sort the band's wait note and the status
  line's right reserve move left of the button. The status line keeps one line
  on every page, as on Sort: the words end in an ellipsis (the whole message is
  its title) and the action follows them, so a message never moves the page,
  1024 wide included. A brief's title, the paper's and often long, keeps the
  same room. Sort's sign-in has no band, so its corner is every other page's,
  date and all.
- **How-tos, her pick D**: a quiet white button, the book icon and "How-tos",
  just right of the date. It opens a panel from the right, 380px, the
  window's height, over the page: the browser's own modal dialog, named by its
  heading "How-tos", focus moving in as it opens and back to the button as it
  closes, closed by X, Escape wherever focus is, a click beside it, or a link
  followed. First "For this page": the page's guide as a card with its parts,
  the part for this page tagged This page (the builder's part is its step on
  screen); on a how-to "This guide", its parts as places on the page and the
  one on screen marked; on All how-tos no card. Then "Every other guide" under
  the sidebar's own headings, Bring it in, Send it out and Research, then
  Behind the scenes for the guides no hub owns.
- **One data module**, `js/howto-index.js`: the guides, each under its
  heading, by its page's own title; their parts as their pages' own chips
  name them, at their anchors; and which page opens which guide at which part
  (since the trim below, a page's topic has a part in its hub's guide; the
  front page, Policy Exchange and Research briefs open theirs with none
  tagged). It lists
  only what exists: a test reads each guide's page for its parts and ids. The
  newsletter's read me is a guide here, "The email: read me", with its
  headings as parts; the blank template and the sample open it.
- **The scattered links went**, replaced by the panel: the front page's How
  it all connects and the Submit content row's How to submit content; the
  team page's lede link; the Content queue's How to sort and How it all
  connects; Next issue's How to build an issue and The email: read me;
  Listserv's Google scripts line; the Policy Exchange foot's three; the
  Highlight's and Research briefs' head links. Kept: the sidebar's All how-tos
  and I need help!, the links inside the how-tos between guides, the
  Newsletter row's Read me, Blank template and Sample issue (her trio of Oct
  8), and the Team submit page's own link, since it has no sidebar.

## The how-tos, trimmed (Oct 24)

The owner, of the guides: "some of the how-tos are SOOOOO redundant". The
proposal in `.superpowers/tmp/oct23-options/data/howtos.md`, followed: each
repeated topic told once, in the guide the How-tos panel opens for its page,
and cut wherever the screen already says it.

- **One copy each:** Publish, the highlight and its photo rule, and fixing
  what is live in Publish and the Exchange (renamed from Change the Policy
  Exchange); ERC Newsletter only and Finalize in Sort the queue; "3 to 5 of
  each" on Build the newsletter's Outline; what the builder can do in Build
  the newsletter; where items come from in How it all connects alone.
- **Change the desk** keeps what is its own: Who to ask, the Exchange's look
  (from the Exchange guide) and the Needs code table. Its hub chapters moved
  with their stills: An item and the scraper to Sort the queue (Fix an item
  later, The scraper), Issues and send dates to Build the newsletter (Send
  dates, first; fixing an archived issue under Save & Export); The Exchange
  and the listserv slide were cut, the screens and the other guides saying
  them.
- **The team password** is the one name for the one password, the
  handoff's; Who to ask says once where it is kept, and every guide that asks
  for it links there. I need help! is in the sidebar, and Ask Claude says so.
- **Submit content** lost Links to share (the front page's Public links has
  Copy link) for one line: "Never send the desk's address." Its four unused
  pictures of Oct 7 are gone.
- **The read me** stays a page (her pick of Oct 8, linked from the Newsletter
  card): the two pages and changing the template itself; a change to one issue
  links to Build the newsletter.
- **All how-tos** and `desk-guide.txt` are drawn from `js/howto-index.js`:
  the panel's headings, each guide by its own title and line.
- **How it all connects** is her pick A of three (Tidied): her three bands
  and every box, the six pages in one row, three filters on the picture and
  the rest listed under it.
- **Sort's conference rule** (the owner's decision): a conference on
  education policy or research, or its call for proposals, is kept; a job, an
  award, or a teaching or trade conference is deleted. ECS State Policy
  Tracker and the Austin American-Statesman left the Sources slide, switched
  off in the scraper on Oct 22.

## Sort's how-to, round two (Oct 24)

The owner's two picks from round two of the Sort how-to's options
(`.superpowers/tmp/oct23-options/sort-v2/`), in place of the four word
slides. `how-to/make-deck.mjs` draws both from `how-to/sort/deck.json`, and
`desk-guide.txt` keeps every rule as words: each group's name, line and rules,
and each band's sources with their counts, a short name with its full one
("Coordinating Board (Texas Higher Education Coordinating Board)").

- **Keep or delete, her pick B (flashcards)**: the Content Sort still, then
  one slide. On the left a real item from the queue, drawn as Content Sort's
  card: its type and subtype, "1 of 11", the title, the source and its domain
  on a gray pill (not a link). No date and no name. On the right, "Keep or
  delete?" with Content Sort's own Keep and Delete and their K and D chips.
  An answer says Right or Not quite in their place, stamps the card with the
  verdict and a short reason ("Keep · Tests a policy"), lights its group and
  offers Next card (Start over on the last). Under the ask, the six groups,
  three a side, in her names: Keep for Tests or changes a policy, Policy
  events and money, Ours or added by hand; Delete for Not education policy,
  Not news we share, Already in the queue. The 11 cards are queue items as
  they were decided, but the OEP conference is a Keep under the conference
  rule, its host as its source, and Texas Public Radio's repeat lights
  Already in the queue. K and D answer only while the slide is up and on
  screen, never in a field or under an open dialog, and once a card; the
  arrows still turn slides, and nothing on the slide moves. Which type and
  subtype to pick sits beside Next. Without script the slide lists the six
  groups with every rule.
- **The conference rule lives in the groups**: Policy events and money keeps
  a conference on education policy or research and its call for proposals;
  Not news we share deletes a job, an award, or a teaching or trade
  conference.
- **Sources, her pick D**: three tinted bands, Usually kept (the info tint),
  Read each one (white with a gray bar) and Usually deleted (the error tint),
  each source a chip with how often it was kept ("4 of 4"), from the queue
  export of Sep 3 to Oct 20; a Read each one chip carries its rule ("Schools
  only"). Under 760px of deck width the bands sit side by side as columns.
  Under them, beside Next, Add a source (outline, with the plus) and Open the
  sources sheet (in a new tab).
- **Add a source from the how-to** goes to `/#queue/add-source`: the Content
  queue opens with its form open and Name focused, and the address goes back
  to `#queue`, so a reload shows the queue with the form shut.
