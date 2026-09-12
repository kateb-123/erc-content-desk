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

Five tabs in the header: **Home, Sort, Finalize, Publish to Exchange, Send to
Newsletter**, plus a **Build newsletter** pill on the right that opens the builder
at `/builder/` in a new tab. Under the header sits one status line that carries
loading and error messages for the whole app.

Every screen head is a bare title plus a **View info** toggle that opens a tinted
instruction panel, and (where the pipeline continues) one slim primary door button
on the right with a right arrow: Go to Finalize, Go to Publish, Send to newsletter.

### Home
- **Glance row**, four one-line cards: *Exchange updated* (when the public site's
  file last changed), *Next newsletter* (the next issue date), *Queue* with a count
  badge (clicking scrolls to the table), *Public page* with Open and Copy buttons
  for the public submission form.
- **Add to the queue** form on the left: Title, Description ("paste whatever you
  have"), Link, a spotlight checkbox, Type radios (picking a type reveals its
  subtypes under it, labelled Subtype), and "Your name or initials". Submit saves
  at once and swaps the form for a drawn-check confirmation, "Got it, in the
  queue.", and a **Submit another** button. A link with no other field is valid.
- **The spreadsheet door** under the form: drop or choose a .docx, .md, .txt,
  .xlsx or .csv. Spreadsheets map one row to one item; documents are split by
  Claude. The items appear in a review table (each with Remove, click a row to
  peek) and nothing saves until **Add all to the queue**, which opens a blocking
  progress popup.
- **Two doors** on the right: Policy Exchange and Build newsletter, both new tabs.
- **The queue table** at the bottom: every waiting and parked item, newest first,
  sortable, with a red trash can per row. Deleting greys the row in place with an
  Undo for the rest of the session. A row still being read says "Reading...".

### Sort (the screen that matters most)
A left column of section pills, each with a count: All, Needs a type, ERC, ERC
events, Research, Events, Opportunities, Headlines. Needs a type glows amber while
it holds anything.

- **All** is the one-card-at-a-time stream: one card, arrows either side to browse
  without deciding, a position counter, and "Undo last" under the section label.
  The card carries badges (New, Spotlight requested, External submission, a
  duplicate warning naming the earlier item), the title, a meta line, the
  description, the type line, an amber link alert when the link could not be read,
  two quiet notes when the reader came up short, then the footer: **Edit** (pen)
  and **Delete** (red trash) far left, **Skip** (bare word) and **Keep** (the one
  filled button, with a check) on the right. A decided card is replaced at once and
  parks to its left as a dulled sliver.
- **Every other pill is a list** (new, Sep 11): a table of rows, each with a
  chevron, the title with authors or source and date, the first two lines of the
  description, the subtype, and **Skip** and **Delete**. One filled **Keep the rest
  (N)** button sits at the top right of the list. Rows that still need a type or a
  link check wear an amber mark and stay out of Keep the rest. The chevron expands
  the row in place into the same white detail card Finalize uses: full description,
  notes, the type line with Change (or the type picker itself when a type is
  missing), Open source, the link alert, and Edit. A decided row sinks to the
  bottom of the list, greyed (deleted ones struck through) with an Undo.
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
Arrives showing only the keeps that still need an ERC-voice description, tinted,
with **Rewrite N descriptions**. That button makes one batched model call; while it
runs the rows hide and a dots loader shows. The results come back as a **carousel
of check cards**, one at a time with arrows and an i/j counter: **Edit** and
**Delete** left, **Use original** (with a back arrow) and **Keep** (filled) right.
Nothing is saved until each card is decided. Then the screen is a sortable table of
every unpublished keep; a chevron expands a row into a white detail card with the
facts, the description, and Edit fields (which include date, time, location,
authors, deadline). **Go to Publish** appears only when nothing is pending.

### Publish to Exchange
On arrival it checks the live public file and shows a dots loader. Then a receipt:
three chips (**Adding N**, **Held for the newsletter N**, **Already live**), each of
which opens its list, a table of what is going up, and folds for the held and
already-live groups. If kept items still lack a type, an amber alert points back to
Sort. One deliberate button: **Publish N to the Exchange**, which disappears while
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
  rejected. The decided card is replaced at once; the dulled sliver parked to its
  left is what records the decision.
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
