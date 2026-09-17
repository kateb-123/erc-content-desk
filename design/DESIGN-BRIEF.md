# ERC Content Desk: brief for a designer

Everything a designer needs to work on this app without reading the code first.
Written Sep 11, 2026, corrected Sep 17. The rules in `design/DESIGN.md` are the
source of truth for style; this file explains what the thing is, what every
control does, and how it runs. Where the two disagree, DESIGN.md wins.

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

A sidebar down the left of every page: **ERC Content Desk**; under **Policy
Exchange**, Policy Exchange, Share an item, Listserv sign-up, each with a copy
icon that puts one sentence with the link on the clipboard; under **Newsletter**,
Next newsletter, Newsletter builder, Past newsletters; under **Desk work**, Sort
(with the queue count), Finalize, Publish to Exchange, Send to Newsletter. Desk
work folds: its heading has a chevron, the desk remembers it shut, and it always
opens on a pipeline screen. The group headings carry the icons; the items carry
none. From the front door the pipeline items open the pipeline in its own window,
which has the same sidebar and switches in place; the builder and the public
pages open a new tab. On a Desk work screen the sidebar tucks behind a 48px strip
with one menu button; open, it is back in place and pushes the page over, and a
pick, the close button on the same spot, or Escape tucks it away again. The
builder's pages carry the same sidebar: the builder tucked like Desk work, Past
newsletters open like Home. Above the content sits one status line that carries
loading and error messages for the whole app.

Every screen head is a bare title plus a **View info** toggle that opens a tinted
instruction panel, and (where the pipeline continues) one tertiary door button on
the right with a right arrow: Go to Finalize, Go to Publish, Send to Newsletter.

### Home
- **Four stat tiles** on the tint, each an icon, a label and the value in the
  deep accent: *In the queue* ("14 waiting"; clicking opens the queue fold and
  goes there), *Next newsletter* ("Sep 22", "1 item so far" small beside it;
  clicking opens the Next newsletter page), *Exchange updated* (the link to the
  Exchange), *Last newsletter* (the newest date in the builder's archive index;
  the link to Past newsletters). A grid, so a narrow window gets two rows.
- **Add to the queue** form: Title and Link side by side, Description ("paste
  whatever you have"), the Type as pills (picking one reveals its subtypes as
  smaller pills under a Subtype label; ERC Event has none and shows "an event the
  ERC runs"), then one row at the foot:
  "Your initials", the Spotlight checkbox, and **Add to the queue** on the right.
  The same form is the Next newsletter page's Quick add. It saves at once and
  swaps the form for a drawn-check confirmation, "Got it, in the queue.", and an
  **Add another** button. A link with no other field is valid.
- **The spreadsheet door** under the form: drop or choose a .docx, .md, .txt,
  .xlsx or .csv. Spreadsheets map one row to one item; documents are split by
  Claude. The items appear in a review table (each with Remove, click a row to
  peek) and nothing saves until **Add all to the queue**, which opens a blocking
  progress popup.
- **No rail**: the six quick links live in the sidebar, so the form runs the full
  column width.
- **The queue**, folded at the bottom: a closed section headed *In the queue*
  with the count badge and a chevron on the left; click the heading and the table
  opens under it, and it stays the way you left it for the visit. Every waiting
  and parked item, newest first, sortable, with a red trash can per row. Deleting
  greys the row in place with an Undo for the rest of the session. A row still
  being read says "Reading...".

### Next newsletter
Reached from the sidebar or Home's Next newsletter tile; the sidebar is the way
back. The title is "Next newsletter, Sep 22" with the count badge and **Quick
add** on its right, and no lede. The table is the queue's shape: Title with the
source under it, Type, Submitted, and a red **Remove** per row
that takes the item out of the issue (it stays in the queue). Quick add opens a
dashed panel right under the head, where the click was, headed "Add to the Sep 22
newsletter", holding the submit form (no whole-doc door): what it saves lands in
this issue AND in the queue at once, and the table shows it
with a grey **Not sorted yet** badge until Sort has had it (Skipped if Sort
parked it). The status line says "In the next newsletter, and in the queue for
Sort." A row Sort deletes leaves the issue with it. Send to Newsletter stays as
the way to pick from what is already kept.

### Sort (the screen that matters most)
A list and a card. The sections sit as Carbon tabs in one row on top, each with a
count: Needs a fix, ERC, ERC events, Research, Events, Opportunities, Headlines,
Skipped. One section shows at a time; the screen lands on the first tab that holds
anything. Needs a fix is the one warning tab and the one notification on the
screen. It gathers every row that cannot be kept yet (no type, a link the desk
could not open) and every possible duplicate, one amber triangle before each
title. Rows elsewhere carry no amber marks; a fixed row moves to its section.
Skipped, last in the row, holds every parked row of any type: a Skip is never the
end of the road.

- **The list and the card.** Under the section's name, Undo last and one filled
  **Keep the rest (N)**, the rows run down the left: the title with authors or
  source and date, and a New badge on a row that came in today. Clicking a row
  shows it in the card on the right, which stays in view while the list scrolls:
  the type line with Change and the badges, the title, the meta line, the
  description, notes, Open source, then **Edit** and **Delete** on the left and
  **Skip** and **Keep** on the right. A decision moves the card to the next row;
  the decided row sinks to the bottom of the list, greyed (deleted ones struck
  through) with an Undo. A section with nothing left shows a dashed pane naming
  the next section that holds anything.
- **The fix panel** (amber, on the card of a row under Needs a fix) says each
  reason in words: Needs a type, Check the link, Possible duplicate. Keep stays
  locked until the type and the link are settled; Skip and Delete always work.
- A tab's count is exactly the rows it lists. There is no All view.
- **Edit** opens the fields the row's type uses, then the Link and **Add media**
  (any item can carry a picture or a flyer), in the card, with Save and Cancel.
- **Keys**: up and down move through the list, K keeps, S skips, D deletes, U
  undoes.
- **The type picker**: the types as radios, the picked type's subtypes indented
  under it. Picking the subtype is the save; there is no Save button. A flat type
  (ERC Event) saves on the type pick. Change opens the same radios, with Cancel.
- **The amber link ask**: Verify link opens the source in a new tab, and only then
  do **Confirm** and **Change** appear. Change reveals a field to paste a corrected
  link.

### Finalize
A list and a card. Under the title a progress line ("2 of 5 kept items need an
ERC-voice description", then "1 of 2 rewrites checked") and an 8px bar in the
accent on the tint. Down the left, every unpublished keep in the standing order
(ERC first), grouped: **Needs a rewrite**
(on the amber) or **To check**, then **Done** (a green check), then **No rewrite
needed**, folded with its count. The card on the right shows the chosen row. A row
waiting for its rewrite shows its **Original** text in the amber box, with Edit and
Delete. **Rewrite N descriptions** (filled, in the head) makes one batched model
call; while it runs a dots loader shows. A rewrite to check shows **Before** and
**After · ERC voice** side by side, the removed words struck in amber, the added ones
on the green: **Edit** and **Delete** left, **Use original** and **Keep** (filled)
right; either decision stamps the row and moves to the next. **Keep all remaining
(N)**, a quiet link under the list, keeps every rewrite still waiting in one
write and says so, "Kept N rewrites. Undo", with no ask first. Any other row
shows its facts and description with Edit and Delete. When nothing is
left to check, the card reads "Every rewrite is checked. Go to Publish" and the head
carries the **Go to Publish** door.

### Publish to Exchange
On arrival it checks the live public file and shows a dots loader. Then one
**fate bar**: an 8px square bar split by share of rows, adding in the accent,
held for the newsletter in the loader's light blue, needs a fix in the amber
line, already live in the line grey. Under it a legend
("2 adding", "1 held for the newsletter", "1 needs a fix", "Already live" with no
number, ever); clicking an item shows only those rows, clicking again shows all.
Then **one table** of every row: chevron, Title, Type, Submitted, **Fate**. Rows run
adding, held (on the tint), needs a fix (on the amber, its Fate is a link that
opens Sort's Needs a fix), already live (muted). The chips, the folds and the
alert are gone. One deliberate button: **Publish N to the Exchange**, which is
replaced in place by one warning ask, Confirm or Cancel, and then disappears while
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
Like a Desk work screen: the desk's sidebar tucked behind the thin strip, no
header bar (its links live in the menu), a **Newsletter builder** title on the
page with the steps under it. Four steps drawn as Carbon's progress indicator:
**Review** (pick the issue, Pull from the desk, see what is staged) -> **Outline**
(reorder the items, mark one event Featured, switch the research callout on or
off) -> **Preview & Edit** (a live email preview; click any text to edit it in a
rail card, add an item, upload a picture) -> **Save & Export** (Copy HTML for
Outlook, Save to the archive, Download .html). It shares the desk's look through its own
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
- **The public site is a different project** (`erc-policy-exchange`, its own repo).
  Publishing writes a row into that site's data file. It is out of scope here.
- **The public submission form is also elsewhere** (a small GitHub Pages site). The
  desk has no public page of its own.

**Timings a designer should assume**: the desk loads in well under a second; saving
a decision is instant on screen and persists behind you; the rewrite takes seconds
and shows a loader; publishing takes a moment and then shows a receipt.

## 5. The look

Specified with exact values in `design/DESIGN.md`: the tokens, the type, the
shape, the icons, the action vocabulary, the motion and the copy rules. Read it
there, not here.

## 6. Rules that must not be broken

The style rules live in `design/DESIGN.md`. Two are about the work, not the look:

1. Delete is never locked; Keep waits for a type and a checked link.
2. The submitter is never asked to type more. Work moves to the reader or to Sort.

## 7. Where design help is actually wanted

These are open, and a good answer would be taken:

- **Sort is the screen Kate lives in**, one section at a time as a list on the
  left and a card on the right. Each row carries a title, a meta line, two lines
  of description, a subtype and two actions. It works, but the density and rhythm
  of that pair were assembled from existing parts, not designed.
- **The amber one-ask pattern** (verify a link, send an event early) is used for
  anything that needs a decision before an item can move. It is the loudest thing
  on a card. Is it too loud, or not clear enough?
- **Quiet action words vs icons.** The table says Skip is bare and Use original has
  an arrow; a first-time tester read that as random. Kate kept the table. A better
  rule would be welcome.
- **The queue table on Home** is dense and shares nothing with Sort's lists. They
  could be one thing.
- **Empty and error states** were added as needed rather than designed.
- **Mobile.** Nothing is designed for small screens. Submitting from a phone is
  plausible; sorting is not.

## 8. The two references README does not list

`docs/handbook/code-book.md` (what each file holds) and
`docs/CLAUDE-FRONTEND-PLAYBOOK.md` (the frontend process). `README.md` carries
the rest: the sandbox command, the test command, `docs/handbook/words.md`,
`docs/handbook/connections.md` and the `?v=` rule.
