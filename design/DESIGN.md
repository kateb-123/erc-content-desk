# Design spec: ERC Content Desk + Newsletter Builder

One look across both apps. This file is the source of truth for style decisions:
read it before any UI work. The mockups are Kate's wireframes of Sep 17 in
`design/mockups/` (five pages and their 1280 by 900 renders): verification is a
screenshot from the running sandbox (`localhost:4173`, serves `/builder/` too)
matched against them with `scripts/visual-diff.mjs`, approved by Kate before
deploy.

## The system: the U-M Library Design System

Both apps wear the design system Kate brought on Sep 23, 2026: her mockup of
all four screens built in the **U-M Library Design System**, a UI toolkit
reconstructed from that library's Figma file. Her pick that day: the look
only, the palette as designed, the pipeline unchanged. Four ramps at 100 to
500, "when in doubt, start with 400": blue `#00274c`, maize `#ffcb05`, teal
`#1d7491`, neutral `#212b36`, with green, pink, indigo and orange for meaning
and state alone. Flat white pages; a 56px navy top bar carrying the desk's
name as an eyebrow; white boxes with a 1px neutral hairline; Mulish for
everything and Crimson Text for large titles only; teal fills the primary
button, draws every link and marks the chosen row, and maize draws the rule
under a section label and the table head and the inner focus ring but carries
no text (1.4:1); 2px corners on fields, 4px on buttons, boxes and notes, 16px
on pills; spacing in multiples of 8 plus 2 and 4; uppercase 14px bold labels
with 1.25px tracking. No maroon in-app: it lives in the newsletter email and
on the public pages, which keep their own outward look. No shadows in either
app (the system keeps them for floating menus, which neither app has); colour
is never the only signal. The tokens live in `css/tokens.css`, the one file
where a colour, a size or a face is written down; they keep Carbon's names
with the system's values, so the stylesheets read as they did, and the
system's own ramps are there under its own names (`--color-teal-400` and the
rest).

Two deliberate departures from the system, both because the desk is denser
than a library website: an outline button hovers to the quiet surface with a
darker rule instead of the system's white-then-neutral ring, which would paint
over its neighbours in a row of controls; and the press step under each fill
is one shade past the hover, since the system defines none.

The Sep 22 refresh that this replaces: the cream ground `#f6f3ec`; Archivo and
Lora; the ink wash for inner surfaces; orange `#ff8200` as the only mark;
ink and navy fills; 2px corners everywhere; 12px micro-labels.

## Tokens

Carbon names, the system's values (Sep 23). Reference them, never a literal:
the census allows a hex only in `css/tokens.css`. The rows below name the
role; the value is in the file.

| Token | Value | Use |
|---|---|---|
| `--color-blue-*` / `--color-maize-*` / `--color-teal-*` / `--color-neutral-*` | the system's four ramps at 100 to 500 | the source values; every token below reads one of them |
| `--background` | `#ffffff` | the page, both apps. The top bar is `--color-blue-400`, the system's dark site header |
| `--layer-02` / `--border-subtle-01` | `#ffffff` / `#e5e9ed` | a card, a list, a table, the receipt, the busy popup: a white box with a 1px neutral hairline (`--layer`, `--layer-line`) |
| `--layer-01` | blue 100 `#f7f8f9` | a quiet box inside a card: Finalize's edit box, decided Sort rows, table header rows, the builder's edit stage (`--wash`) |
| `--layer-accent-01` | neutral 100 `#e5e9ed` | pills, counts, progress tracks |
| `--accent-10` / `--accent-20` | teal 100 `#e9f2f5` / teal 200 `#a7cddb` | row hover and tinted rows (`--row-hover`, `--tint`); the chosen row is teal 100 (`--selected`) in `--accent-deep` navy with a 4px teal bar |
| `--accent-alpha` | teal at 6% | the hover wash on quiet buttons and menu rows (`--hover`), layered over any tint |
| `--field-01` / `--field-02` | `#ffffff` | fields are white on both grounds, boxed by `--border-strong-01` |
| `--text-primary` / `--text-secondary` / `--text-helper` / `--text-placeholder` | neutral `#212b36` / `#637381` / `#637381` / `#8a96a1` | ink (`--ink`), quiet text (`--muted`), helper lines, placeholders (placeholders are decoration, never the only label) |
| `--border-subtle-00` / `--border-subtle-01` | neutral 100 `#e5e9ed` | hairlines on the page (`--line`) and inside a layer (`--line-in`); dividers only |
| `--border-strong-01` | neutral 200 `#8a96a1` | a field's rule, dashed drop zones, tag outlines |
| `--border-interactive` / `--mark` | maize 400 `#ffcb05` | the brand rule: 2px under a section label and a table head, the builder's reached step line. It never carries text |
| `--button-primary` / `-hover` / `-active` | teal `#1d7491` / `#106684` / `#0c5570` | the filled buttons (`--accent`), both apps: the two no longer differ by accent. Teal 400 is 5.1:1 on white, so it fills, lines, links and marks alike. The active step is the system's missing press state |
| `--button-secondary` / `-hover` | blue 400 `#00274c` / blue 500 `#001324` | the builder's Back, Save to the archive, Download: the navy fill beside a teal primary |
| `--button-disabled` / `--text-on-color-disabled` | neutral 100 `#e5e9ed` / neutral 200 `#8a96a1` | a locked Keep: full opacity, grey fill |
| `--link-primary` / `-hover` | teal 400 / teal 500 | links and the quiet action words, underlined |
| `--focus` / `--focus-inset` / `--focus-ring` | neutral 400 / maize 400 / the two as one shadow | the system's ring: 2px maize inside 3px neutral, drawn as a box-shadow so it never moves the page. Programmatic focus (`[tabindex="-1"]`) draws none |
| `--support-error` / `--button-danger-secondary` | pink 500 `#bf3232` | crimson: destructive words (`--err`) and the error note's bar |
| `--support-success` / `--text-success` | green 400 `#20a848` / green 500 `#198539` | success as an icon (`--ok-mark`) and the toggle when on / as text (`--ok`), which needs the 500 step for 4.5:1 |
| `--support-warning` / `--text-warning` | orange 400 `#f25f1f` / orange 500 `#c74e1a` | needs doing as an icon, the triangle (`--warn-mark`), and as text (`--warn`); the warning tab. It was UT's Globe blue from Sep 17 to 23 |
| `--support-info` | teal 400 `#1d7491` | the info note's bar and icon |
| `--notification-*-background` / `-border` | info teal 100, success green 100, warning maize 100, error pink 100; the border is the role's colour at 30% | inline notes: the info panel, the fix panel, the link ask, the builder's status boxes; text on them is `--text-primary`, and the left bar is 4px |
| `--tag-background-*` / `--tag-color-*` | gray neutral 100 / neutral 400, blue teal 100 / teal 500, review maize 100 / orange 500 | tags: a fact, New, a duplicate (needs review, so it wears the review tint); the queue count |
| `--accent-30` to `--accent-80` | the teal ramp | the sliding-dots loader; `--accent-30` is Publish's held segment |
| `--background-inverse` / `--link-inverse` | blue 400 `#00274c` / maize 400 | the builder's Undo toast |
| `--overlay` | `#00000040` | the dim behind the busy popup and the tutorial: the system's 25% scrim, its only transparency |
| `--spacing-01` to `--spacing-10` | 2, 4, 8, 12, 16, 24, 32, 40, 48, 64px | every gap, pad and margin; 16 is the default; 10px is a bug. Page gutters are 40px (`--gap-56`), 16px on mobile |

Maroon `#500000` is FORBIDDEN in-app; it lives only in the newsletter email
template and the public Exchange site.

## Type

- **Mulish** at 300, 400, 600 and 700 for everything; **Crimson Text** is the
  system's second family, for large titles only, and the desk draws none yet.
  Both from Google Fonts; Archivo and Lora are gone (Sep 23).
- The scale, as `css/tokens.css` writes it: the page title 32/40 at 700; a card
  title 20/28 600; a section title 18/26 600; the lede, prose and body 16/24;
  meta 14/20; the label 14/18 at 700, uppercase with 1.25px tracking; a big
  numeral 28/34 at 700. Headings run at 1.25 line height, copy at 1.5, and
  prose measures about 60 characters. Buttons are 16px at 700; a lit tab is
  700 over a 2px teal bar.
- Body copy is left-aligned, never centred or justified. Numbers are digits.

## Shape

- **4px corners** (`--radius`) on buttons, boxes, notes and the busy popup;
  **2px** on fields (`--radius-input`). Bars and the progress tracks stay
  square. Pills are 16px (`--radius-pill`): tags, counts; the toggle and the
  loader's dots are round.
- **White boxes with a hairline on a white page.** A card, a list or a table is
  `--layer-02` white with a 1px `--layer-line` hairline; a box inside a card
  (Finalize's edit box, a quote box, the list head) is `--layer-01`, the
  system's blue 100, with no border. Rows divide with `--line-in`, lift to
  `--wash-hover` on hover, and the chosen one sits on teal 100 in navy at 600
  with a 4px teal bar on the left. Teal means "this one"; blue 100 means "a
  surface"; maize means "the brand's rule", and marks nothing that can be
  chosen.
- **Buttons.** 40px tall (32px in a screen head or a section head, 48px for the
  builder's export trio), 16px side padding, the label left at 700. A primary is
  the teal fill, the same on both apps, with its icon in a 64px right slot (48px
  on the small size); with no icon the slot goes. Everything beside a primary is
  the outline: white with a neutral 200 rule, lifting to blue 100 with a darker
  rule on hover (Cancel, the doors, Quick add, the builder's Next and Start the
  next issue). The builder's Back and archive buttons are the navy fill. A Save inside an open card whose
  edits are already live is a ghost word (audit round two, Sep 17).
  Quiet words (Edit, Delete, Skip, Undo, Cancel in a panel) are ghost buttons:
  32px, a `--background-hover` fill on hover. No press scale. On the desk,
  where links and quiet words are grey like secondary text, a word that acts
  with no icon wears an underline (View info, Change, Verify link, Undo,
  Re-check), so it never reads as text; Edit and Delete carry their icons,
  Skip and Cancel stay muted (design critique, Sep 18).
- **Fields.** 40px, white, boxed by a 1px `--border-strong-01` rule with 2px
  corners, 12px side padding; the focus ring sits outside it. Labels are the
  uppercase label above.
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
- **Notes.** Every panel that speaks is the system's callout: a
  `--notification-*-background`, a 1px `-border`, a 4px left bar in the
  `--support-*` colour, the matching icon, `--text-primary` words. Info for the
  View info panel; warning for Sort's card questions (the link, a duplicate),
  Send early?, the builder's restore banner and its Replace the archived issue?
  ask; success and error for the builder's upload, pull, save and export
  results. An error note that can be retried carries a ghost Retry, and a
  success that ends a task stays (Saved to the archive, with Open Past
  newsletters), never a toast that fades (audit round two, Sep 17).
- **Focus.** `box-shadow: var(--focus-ring)`, the system's ring: 2px maize
  inside 3px neutral, drawn as a shadow so it never moves the page (Sep 23; a
  2px ink outline before). Programmatic focus, which the card takes after a
  decision, draws no ring.
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
| **Send it to** ERC Newsletter only | none | one checkbox on Sort's card (Kate, Sep 22; two boxes, Newsletter and Policy Exchange, from Sep 18) | where the item goes once kept: unticked it waits in the newsletter's pool at once AND on Publish, ticked it waits in the newsletter's pool and never reaches Publish; a campus event comes ticked: an Event with the A&M subtype, another unit's, the one thing held off the Exchange by default (Kate, Sep 22); ERC's own events go everywhere, and the old Spotlight request flag moves nothing. Nowhere is not a state, so Keep and next no longer locks on it |
| **Dismiss all** | `fa-trash-can` | red ghost word at the right of a group's head on Sort | deletes every row in that group in one change, with one Undo ("Dismissed N. Undo"). The groups (Kate, Sep 22): Past, an event whose date has gone or an opportunity whose deadline has passed, and Already live, a link the live Exchange already has (the same check Publish runs, asked for quietly on arrival); they sit under the skipped rows, each row tagged, and a row in both is Already live |
| **Undo** (Sort) | none | the status line's word after a decision; a greyed row's own Undo | Keys on Sort (Sep 17): up and down move, K keeps, S skips, D deletes, U undoes; the buttons' tooltips name them. A decision says itself in the status line ("Kept: title. Undo"), the card moves to the next item and takes focus; Undo says what it undid |
| **Download the CSV** → **Download the CSV again** | `fa-download` | the primary in Publish's head, then a ghost word beside the Publish button | the copy of the Adding rows in the hub's own columns, saved before anything is sent (Kate, Sep 22: the CSV comes first); Publish appears only once it has been downloaded, and a changed Adding list asks for a fresh copy. The receipt's Download the CSV again is the whole hub file after the write |
| **Publish N to the Exchange → Confirm / Cancel** | `fa-triangle-exclamation` on the ask | the primary, then one warning note in its place | the one ask before the append-only write to the public site (design audit b6, Sep 17), at body-01 with the count and "live" in 600; Keep the rest on Finalize gets "Kept N rewrites. Undo" instead of an ask |

The front page is Kate's own (her answer, Sep 22): the title Desk, the lede
"What waits on each page.", then five cards in a grid of white boxes: Submit
content (the team's page), Content Sort, Newsletter and Policy Exchange,
each a name, a line of what it holds and the count as a big numeral with an
arrow, the teal bar on hover; and Documentation, greyed, Forthcoming. The
top bar shows no lane links there.

The team's page, Submit content at /#team (Kate's sketch and the handoff,
Sep 22; `design/mockups/submit-content.png`, the handoff itself in
`design/refresh-sep22/`): the page head, then two columns. Left, the share
form in a white box, then Queue, a section head over the maize rule with
"N waiting · newest first" at its right and every waiting item as a read-only
row in its own scroll; the head's label is a fold, opening from a chevron on
its left, and it starts open (Kate, Sep 23). Right, one white box and one
button (Kate's pick C, Sep 23): Quick links, where every link is a row with a
32px icon on the quiet surface, its name, and ONE line under it, never its
address. The icons are Kate's set D of Sep 23, each one the thing itself and
no two alike: a square plus for the share form, an address book for the
sign-up, a display for the Exchange (her pick from ten, eight of them screens),
a newspaper for the Newsletter and a stack for Content Sort ("I friggin hate having the url displayed"). Every row says "Public facing link" under its
name (Kate, Sep 23), and where the desk knows something about the page a
second line sits under that: when it last published to the Exchange. The
Newsletter's next issue is said on its own button, and the send dates are said
there only, never repeated on the listserv row. The four are the public
share page, the listserv sign-up, the Policy Exchange and the Newsletter,
each opening in a new tab, the first three with Copy link, which says Copied
for two seconds. The Newsletter has none: its address is the desk's, and the
desk is not for handing out. Under the box, the desk's own two as filled
buttons (Kate, Sep 23): the Newsletter first, in its own window, with the next
issue under its name, then Content Sort in place. Only Content Sort wears a
badge, a maize pill in navy ink at the button's right ("not 17 but more like an
alert"), and it is drawn only while something waits; the newsletter's pool is
not something to be alerted about. The top bar shows only Policy Exchange on the right. The
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
`design/mockups/newsletter.png`) is the hub, opened in its own window from
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
colour, Sep 23; UT's Globe blue held the job from Sep 17, and Carbon's warning
yellow before that). A row the card has a question about leads its title with
an orange triangle (`fa-triangle-exclamation`); a missing type turns the Type
label and its row orange. It is the only orange on the screen, so it cannot be
read as an accent. Keep and next stays locked in Carbon's disabled grey until the type
and the link are settled and the item has somewhere to go, and its tooltip
says which. The Spotlight request checkbox and its tag went on Sep 22: ERC Spotlight is fed by the ERC event type, and anything else is moved there by hand in the builder.

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

- No new fonts, icon sets, or UI libraries without approval. Mulish and Crimson
  Text are the two faces (Sep 23).
- No maroon in-app.
- No corner but `--radius` 4px, `--radius-input` 2px on fields, `--radius-pill`
  16px on tags and counts, and round on the toggle and the loader's dots.
- No shadows at all (Kate, Sep 2; the system keeps them only for floating menus,
  which neither app has): layers separate things, and focus is a ring.
- No hex outside `css/tokens.css`; no size off the spacing scale.
- Teal fills on both apps (Sep 23); the desk and the builder no longer differ by
  accent. Maize is the brand rule and the focus ring and nothing else: at 1.4:1
  on white it never fills a button, never carries text and never marks what is
  chosen.
- Colour is never the only signal: a status colour ships with its icon and a word.
- Nothing is "done" without a screenshot from the running sandbox.

## The public pages

The share form and the listserv sign-up live in `public-pages/`, a Vercel project of their own at an address of their own (Kate's pick A, Sep 22), beside the Policy Exchange's copies at /share/ and /newsletter/. Never on the desk's address: the desk has no password, and a public page on it is a door into it (copies at the desk's /submit and /listserv were built and taken down the same hour on Sep 22; Kate: "I don't want others to backspace from submit and see everything"). The pages post to their own `/api`, which the folder's `vercel.json` forwards to the desk server-side, so the desk's address is written nowhere a visitor can read, and the desk's own deployment sends the folder's addresses on to the standalone site (a redirect in the desk's `vercel.json`; an ignore line would empty the standalone deploy too, since Vercel reads `.vercelignore` at the repository root for every project built from the repo). Each call carries `public: true`, which the bot check honours as "gate me"; the project's hostname must be on the Turnstile widget's list in Cloudflare or the human check will not load. The sandbox serves the folder on port 4174 with the same forward. The public share page is deliberately NOT the desk theme: it wears the ERC's outward maroon, the listserv sign-up's look (Work Sans/Open Sans, white card with the 3px #500000 border and hard offset shadow, uppercase maroon button), because it faces the public alongside the newsletter and the hub. It never links into the desk. Uniformity audits should hold it against the sign-up page, not against the desk tokens.
