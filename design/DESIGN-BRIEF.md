# ERC Content Desk: brief for a designer

Everything a designer needs to work on this app without reading the code first.
Written Sep 11, 2026. The rules in `design/DESIGN.md` are the source of truth for
style; this file explains what the thing is, what every control does, and how it
runs. Where the two disagree, DESIGN.md wins.

Heads up: `README.md` is stale. It describes the old v2 app (a `/submit` page that
no longer exists, keyboard shortcuts that were removed, a Google Sheet as the source
of truth). Read this file and DESIGN.md instead.

## 1. What it is and who uses it

The Education Research Center (ERC) at Texas A&M publishes two outward things:

- **The ERC Policy Exchange**, a public website listing education policy research,
  events, opportunities, and headlines.
- **The ERC newsletter**, a monthly HTML email.

The Content Desk is the private pipeline that feeds both. Its job: let one person
take raw submissions to published content without hand-formatting anything.

**Who uses it.** Kate (communications, and the only daily user), a handful of ERC
staff who submit items, and occasionally her director. Nobody is trained on it.
Submitters paste an announcement or drop a link and type nothing else, so the app
must read what they paste rather than ask them for fields. Desktop only in
practice; nobody sorts on a phone.

**The scale.** Tens of items a week, not thousands. A queue of 30 is a busy week.
This is a small internal tool, not a product: speed of one person's decisions
matters more than density, onboarding, or configurability.

## 2. The pipeline

    submit  ->  read  ->  Sort  ->  Finalize  ->  Publish to Exchange  ->  Send to Newsletter  ->  the builder
    (a link  (Claude   (keep,   (rewrite      (the public site)        (stamp into an issue)    (build the email)
     or a     fills     skip,    into the
     paste)   fields)   delete)  ERC voice)

One row moves along that line, gaining a status and fields as it goes.

- **status**: `new` (in the queue) -> `kept` or `circleback` (parked) or `trashed`.
- **published_at** is stamped by Publish. **newsletter_issue** is stamped by Send to
  Newsletter. An item published to the Exchange can also go in the newsletter; the
  newsletter pool is published items plus a few held-back ones.
- **Publish is the gate to the newsletter.** A kept item does not reach the builder
  until Publish stamps it.

**Types** (the vocabulary everything is grouped by, in display order):
ERC Event (no subtypes), New Ed Policy Research (Working Paper, Peer-Reviewed,
Report, ERC Research), Event (A&M, Off-Campus, Webinar-Online), Opportunity
(Funding & Grants, Fellowships & Programs, Call for Proposals, Other), Headline
(National, Texas). A per-row **spotlight_request** flag is separate from type.

## 3. The screens, and what every control does

A sidebar down the left of every page (Kate, Sep 16, from the Claude Design
docs; the tabs and the header pill are gone; reordered the same day from the
second round): **ERC Content Desk**; under **Policy Exchange**, Policy Exchange,
Share an item, Listserv sign-up, each with a copy icon that puts one sentence
with the link on the clipboard; under **Newsletter**, Next newsletter,
Newsletter builder, Past newsletters; under **Desk work**, Sort (with the queue
count), Finalize, Publish to Exchange, Send to Newsletter. Desk work folds: its
heading has a chevron, the desk remembers it shut, and it always opens on a
pipeline screen. The group headings carry the icons; the items carry none. From the front door the Pipeline items open the pipeline in its own
window, which has the same sidebar and switches in place; the builder and the
public pages open a new tab. Above the content sits one status line that carries
loading and error messages for the whole app.

Every screen head is a bare title plus a **View info** toggle that opens a tinted
instruction panel, and (where the pipeline continues) one outlined door pill (the header's Build newsletter look, Sep 15)
on the right with a right arrow: Go to Finalize, Go to Publish, Send to newsletter.

### Home
- **Four stat cards** on the tint (Kate's pick J of four card variations, Sep 16,
  after the one-line strip wrapped into a mess at her window width), each an icon,
  a label and the value in the deep accent: *In the queue* ("14 waiting"; clicking
  opens the queue fold and goes there), *Next newsletter* ("Sep 22", "1 item so far"
  small beside it; clicking opens the Next newsletter page), *Exchange updated* (the
  link to the Exchange), *Last newsletter* (the newest date in the builder's archive
  index; the link to Past newsletters). A grid, so a narrow window gets two rows.
- **Add to the queue** form (Claude Design round two, Kate's pick Sep 16): Title and
  Link side by side, Description ("paste whatever you have"), the Type as pills
  (picking one reveals its subtypes as smaller pills under a Subtype label; ERC
  Event has none and shows "an event the ERC runs"), then one row at the foot:
  "Your initials", the Spotlight checkbox, and Submit on the right. The same form
  is the Next newsletter page's Quick add. Submit saves
  at once and swaps the form for a drawn-check confirmation, "Got it, in the
  queue.", and a **Submit another** button. A link with no other field is valid.
- **The spreadsheet door** under the form: drop or choose a .docx, .md, .txt,
  .xlsx or .csv. Spreadsheets map one row to one item; documents are split by
  Claude. The items appear in a review table (each with Remove, click a row to
  peek) and nothing saves until **Add all to the queue**, which opens a blocking
  progress popup.
- **No rail** since Sep 16: the six quick links became the sidebar, so the form runs
  the full column width.
- **The queue**, folded at the bottom: a closed section headed *In the queue*
  with the count badge and a chevron on the left; click the heading and the table
  opens under it, and it stays the way you left it for the visit (Kate, Sep 15:
  "just queue on the bottom and you can expand it out"). Every waiting and parked item, newest first,
  sortable, with a red trash can per row. Deleting greys the row in place with an
  Undo for the rest of the session. A row still being read says "Reading...".

### Next newsletter (Kate, Sep 15: "a list like a table. you can quick add to that", "a new page", "quick add is a whole thing for the newsletter ... it will get added to the queue for sort so everything is talking to each other")
Reached from the sidebar or the strip's Next newsletter fact; the sidebar is the
way back. The title is "Next newsletter, Sep 22" with the count badge and
**Quick add** on its right; no lede (Kate, Sep 15: the panel's
first title "was slop", so the words went). The table is the queue's shape:
Title with the source under it, Type, Submitted, and a red **Remove** per row
that takes the item out of the issue (it stays in the queue). Quick add opens a
dashed panel under the table headed "Add to the Sep 22 newsletter", holding the
submit form (no whole-doc door): what
it saves lands in this issue AND in the queue at once, and the table shows it
with a grey **Not sorted yet** badge until Sort has had it (Skipped if Sort
parked it). The status line says "In the next newsletter, and in the queue for
Sort." A row Sort deletes leaves the issue with it. Send to Newsletter stays as
the way to pick from what is already kept.

### Sort (the screen that matters most)
A left column of section pills, each with a count: Needs a fix, ERC, ERC
events, Research, Events, Opportunities, Headlines, Skipped. One table shows at a time;
the screen lands on the first pill that holds anything. Needs a fix glows amber while
it holds anything; it is the one notification on the screen (Sep 15). It gathers
every row that cannot be kept yet (no type, a link the desk could not open) and
every possible duplicate, with the reason in the subtype column and one amber
triangle before the title. Rows elsewhere carry no amber marks; a fixed row
moves to its section. Skipped, last on the menu, holds every parked row of any
type with Keep and Delete per row (option B, Sep 15): a Skip is never the end
of the road.

- **Every pill is a list** (Sep 11; the one-card stream was dropped Sep 15
  because going card by card took too long): a table of rows, each with a
  chevron, the title with authors or source and date, and **Skip** and
  **Delete**; nothing else (the description and type live in the open row, and
  clicking anywhere on the row opens it). One filled **Keep the rest
  (N)** button sits at the top right of the list. The chevron expands
  the row in place into the same white detail card Finalize uses: full description,
  notes, the type line with Change (or the type picker itself when a type is
  missing), Open source, the link alert, and Edit. A decided row sinks to the
  bottom of the list, greyed (deleted ones struck through) with an Undo.
- A pill's count is exactly the rows it lists. There is no All view (Sep 15,
  Kate: one table per section, the menu pulls up the next).
- **Edit** opens Title, Description, Link (and a picture control on ERC items) in
  place, with Save and Cancel. Whatever is typed is carried by whichever button
  ends the card.
- **The type picker**: "Select a type" chips, then the subtype chips. Tapping the
  subtype is the save; there is no Save button. A flat type (ERC Event) saves on
  the type tap.
- **The amber link bubble**: the whole bubble opens the source in a new tab, and
  only then do **Confirm** and **Change** appear. Change reveals a field to paste a
  corrected link. Keep stays locked until the link is settled; Skip always works.

### Finalize
A list and a card (Claude Design round two, Kate's pick Sep 16). Under the title a
progress line ("2 of 5 kept items need an ERC-voice description", then "1 of 2
rewrites checked") and a 6px bar in the accent on the tint. Down the left, every
unpublished keep in the standing order (ERC first), grouped: **Needs a rewrite**
(on the amber) or **To check**, then **Done** (a green check), then **No rewrite
needed**, folded with its count. The card on the right shows the chosen row. A row
waiting for its rewrite shows its **Original** text in the amber box, with Edit and
Delete. **Rewrite N descriptions** (filled, in the head) makes one batched model
call; while it runs a dots loader shows. A rewrite to check shows **Before** and
**After · ERC voice** side by side, the removed words struck in amber, the added ones
on the green: **Edit** and **Delete** left, **Use original** and **Keep** (filled)
right; either decision stamps the row and moves to the next. **Keep all remaining
(N)**, a quiet link under the list, keeps every rewrite still waiting in one write.
Any other row shows its facts and description with Edit and Delete. When nothing is
left to check, the card reads "Every rewrite is checked. Go to Publish" and the head
carries the **Go to Publish** door.

### Publish to Exchange
On arrival it checks the live public file and shows a dots loader. Then (Claude
Design round two, Kate's pick Sep 16) one **fate bar**: a 10px pill split by share
of rows, adding in the accent, held for the newsletter in the loader's light blue,
needs a fix in the amber line, already live in the line grey. Under it a legend
("2 adding", "1 held for the newsletter", "1 needs a fix", "Already live" with no
number, ever); clicking an item shows only those rows, clicking again shows all.
Then **one table** of every row: chevron, Title, Type, Submitted, **Fate**. Rows run
adding, held (on the tint), needs a fix (on the amber, its Fate is a link that
opens Sort's Needs a fix), already live (muted). The chips, the folds and the
alert are gone. One deliberate button: **Publish N to the Exchange**, which disappears while
it runs. After it, the page becomes a centred receipt card with a drawn check, and
a single **Send to Newsletter** door.

**Right now Publish is in trial mode**: the click is a mock that shows a receipt
marked "Trial run", and the server refuses a real publish. One flag in
`js/flags.js` turns it back on.

### Send to Newsletter
The pool grouped like the issue, every category a foldable block with "4 of 14
picked" summaries, long groups scrolling in their own box. Nothing is pre-checked.
An issue date picker, then **Send N to the [date] issue**, which stamps the items
and drains them from the desk. Success shows a confirmation with **Undo send** and a
door to the builder. A fold at the bottom lists what was already sent, each with
**Remove** (which returns it to the pool, and is not the same as Delete).

### The builder (`/builder/`, its own page)
A four-step wizard with numbered pills: **Review** (pick the issue, Pull from the
desk, see what is staged) -> **Outline** (reorder, enable sections, Featured toggle)
-> **Preview & Edit** (a live email preview; click any text to edit it in a rail
card, add an item, upload a picture) -> **Save & Export** (Copy HTML for Outlook,
Save to the archive, Download .html). It shares the desk's look through its own
`--bp-*` tokens, which resolve to the same values.

The email template itself is **not** part of this look: it keeps the ERC's outward
maroon and is built for Outlook. Do not restyle it as part of a desk redesign.

## 4. What runs where (the Vercel picture)

**One Vercel project, `erc-content-desk`**, serves both the desk (`/`) and the
builder (`/builder/`) from the same origin, deliberately, so they can talk without
CORS and deploy together. **Every push to `main` is a live deploy.** There is no
build step and no framework: the browser loads the source files as ES modules, so
`index.html` carries `?v=` cache busters that must be bumped whenever JS or CSS
changes.

- **Front end**: plain HTML, CSS and ES modules. No React, no bundler, no CSS
  framework. `js/app.js` owns all state and calls pure render functions per screen
  (`home-ui.js`, `sort-ui.js`, `finalize-ui.js`, `publish-ui.js`, `newsletter-ui.js`).
  View logic that can be tested lives in `*-view.js` files.
- **Back end**: files in `api/` become serverless functions. `sheet.js` (read and
  save rows), `submit.js` (save a submission, then read it in the background),
  `read.js` (read rows that are still waiting), `bulk.js` (split a file into items),
  `rewrite.js` (the ERC-voice rewrite), `publish.js` (check and publish to the
  public site), `newsletter-pull.js`, `newsletter-archive.js`, `newsletter-image.js`,
  `hub-updated.js`, `listserv.js`. Shared code is in `api/_lib/`.
- **Data**: Vercel Postgres (Neon) is the truth, with a Google Sheet mirrored behind
  it as a human-readable backup, written through an Apps Script web app
  (`apps-script/Code.gs`). The Sheet's column order is positional, so a new column
  can only be appended.
- **Models**: Claude Haiku reads a submission (fills blank fields, cleans a pasted
  announcement); Claude Opus does the ERC-voice rewrite. Crossref fills in journal
  articles whose publisher blocks the reader.
- **Environment**: `DATABASE_URL`, `SHEET_API_URL`, `SHEET_API_TOKEN`,
  `GITHUB_TOKEN`, `HUB_REPO`/`HUB_BRANCH`/`HUB_CSV_PATH`/`HUB_CSV_URL`,
  `ARCHIVE_REPO`/`ARCHIVE_BRANCH`, `TURNSTILE_SECRET_KEY`, `LISTSERV_URL`, plus the
  Anthropic key. None of this affects design work, but it explains why some actions
  are slow enough to need a loader.
- **The public site is a different project** (`erc-policy-exchange`, its own repo).
  Publishing writes a row into that site's data file. It is out of scope here.
- **The public submission form is also elsewhere** (a small GitHub Pages site). The
  desk has no public page of its own.

**Timings a designer should assume**: the desk loads in well under a second; saving
a decision is instant on screen and persists behind you; the rewrite takes seconds
and shows a loader; publishing takes a moment and then shows a receipt.

## 5. The look

All of this is specified with exact values in `design/DESIGN.md`. The short form:

- **Colour**: one brand blue `#1d6ea5` for filled buttons, links and active pills;
  a tint `#eaf2f8` for highlights and soft fills; ink `#1c2229`, muted `#55606c`,
  hairline `#dbdfe5`, page `#fbfbfd`; green `#1d6f4f` for success, red `#a32d2d`
  for destructive words; amber (`#fdf3d7` on `#6b4e00`) for the one-ask bubbles.
  **Maroon `#500000` is forbidden in the app**: it belongs to the outward newsletter
  and public site only.
- **Type**: Outfit for headings, buttons and pills; Karla for body. Both from Google
  Fonts. No other faces without approval.
- **Shape**: 8px on controls and inputs, 12px on cards and tables, 999px on pills,
  chips and badges. Focus is an accent border plus a 3px tint halo. Decorative
  shadows are out; flat fills only.
- **Icons**: Font Awesome 7.3.1 Free, as small glyph accents only, always
  `aria-hidden`. Two hand-drawn inline SVGs stay: the check that draws itself and
  the sliding-dots loader.

### The action vocabulary (the contract)
The same word, icon and look for the same action everywhere: **Keep** (check,
filled, the one per card), **Skip** (quiet bare word), **Delete** (trash, red quiet
link, always available), **Edit** (pen, accent quiet link), **Use original** (back
arrow), **Remove** (trash, red, takes an item out of a newsletter issue),
**Verify link** (warning triangle on an amber bubble, then Confirm or Change),
**Send early?** (clock on an amber bubble, then Confirm or Cancel), **View info**,
**Re-check**, **Keep the rest (N)** (check, filled, the one per list), and door
buttons with a right arrow.

**Placement grammar**: tools (Edit) pair with Delete far left of a card footer; the
decision pair sits right, secondary then primary; the position counter sits alone
top right; **one filled button per card**; everything else quiet. Any in-flight
button disappears rather than spinning, so nothing can be pushed twice.

### Motion
All CSS and vanilla JS; `prefers-reduced-motion` kills everything.

- **A decision has no motion.** The slide and the shrink were both tried and
  rejected. The decided row greys in place at the bottom of its section, with
  Undo; that is what records the decision.
- **Tab and section switches**: a 16px directional slide, 180ms,
  `cubic-bezier(0.33, 1, 0.68, 1)`.
- **Confirmations**: the check mark draws itself over 350ms.
- **Loading**: a sliding-dots track (a blue ramp from `#9ec9e8` to `#14507a`) with
  the label underneath and typed trailing dots; a mini variant sits inline in
  control rows.
- **Blocking progress**: bulk upload dims the page, shows a white card with the
  count at body size, an 8px accent bar on a tint track, and one muted line. No
  close button and no Escape: it exists to stop clicking around mid-upload.
- **Buttons**: 150ms hover, 0.98 press.

### Copy
Sentence case. Terse. No emoji in the interface (icons are the sanctioned
decoration). The same term for the same thing everywhere. No filler. Every string
the app shows is collected in `docs/handbook/words.md`, so a rewrite can be read in
one place, and a new string should earn its way in there.

## 6. Rules that must not be broken

1. Maroon stays out of the app.
2. One filled button per card or list; everything else is quiet.
3. Decisions have no motion.
4. No new fonts, icon sets or UI libraries without asking.
5. No hardcoded colours or radii where a token exists.
6. Delete is never locked; Keep waits for a type and a checked link.
7. The submitter is never asked to type more. Work moves to the reader or to Sort.
8. Nothing is "done" without a screenshot from the running sandbox.

## 7. Where design help is actually wanted

These are open, and a good answer would be taken:

- **Sort is the screen Kate lives in.** The stream and the lists now coexist: All is
  cards, every section pill is a list. Is that split right, or should one win?
- **Density and rhythm of the lists.** Each row carries a title, a meta line, two
  lines of description, a subtype and two actions. It works but it has not been
  designed, only assembled from existing parts.
- **The amber one-ask pattern** (verify a link, send an event early) is used for
  anything that needs a decision before an item can move. It is the loudest thing
  on a card. Is it too loud, or not clear enough?
- **Quiet action words vs icons.** The table says Skip is bare and Use original has
  an arrow; a first-time tester read that as random. Kate kept the table. A better
  rule would be welcome.
- **The queue table on Home** is dense and read-only, and shares nothing with the
  new lists on Sort. They could be one thing.
- **Empty and error states** were added as needed rather than designed.
- **Mobile.** Nothing is designed for small screens. Submitting from a phone is
  plausible; sorting is not.

## 8. How to see it running

- `node .superpowers/sandbox/sandbox-server.mjs` serves the real front end on fake
  data at `localhost:4173` (it also serves `/builder/`). Nothing it does touches the
  live data, the public site, or the models. This is where every visual change is
  reviewed.
- `npm test` runs the whole suite (381 tests, plain `node --test`, no framework).
- More context in the repo: `design/DESIGN.md` (the style contract),
  `docs/handbook/words.md` (every string), `docs/handbook/connections.md` (every
  outside service), `docs/handbook/code-book.md` and `docs/CLAUDE-FRONTEND-PLAYBOOK.md`.
- Bump the `?v=` numbers in `index.html` when JS or CSS changes.

## 9. State of the repo, Sep 11, 2026

Live on `main`: the section lists are **not** deployed yet; the live desk has the
one-card Sort for every pill. The branch `feat/headline-list` holds the lists
(5 commits), and the current checkout sits on it. Publish is in trial mode until
the team finishes testing.
