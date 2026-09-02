# Every word both apps say

A complete inventory of the user-visible text in the **ERC Content Desk** and the **ERC Newsletter Builder**, as written on September 2, 2026. Nothing here is a suggestion — it is what the screens actually say today, so you can read it in one place and mark up anything that lands wrong.

Text assembled from parts is shown with the moving piece in `[brackets]` — `"Send [N] to the [Month D] issue"` is one string, not a dozen.

## What to look at first

Four things surfaced while collecting this. None are broken features; they are words that have drifted from what the software now does.

1. **The same section has two names.** The builder's Outline calls it **"Featured Research"**; the band printed in the sent email says **"ERC Research"**. One of them should change — the email's name is the one your readers see.
2. **Step 4 still mentions a file format that no longer exists.** Its empty state offers to "add content from a .md on the Outline step" — the .md door was removed when the builder started pulling from the desk.
3. **Step 2's info panel describes controls that aren't there.** It says "Drag sections into order and switch them on or off," but Outline has no section dragging and no on/off toggles; every populated section is always included, and items move with the up/down arrows.
4. **One action wears two labels.** Editing an item is **"Edit"** on a Sort card and a Finalize check card, but **"Edit fields"** on an expanded Finalize row.

## How this is organized

Part one walks the desk in the order you meet it. Part two walks the builder's four steps. Part three is separate on purpose: the standing words baked into the **newsletter email itself** — section bands, footer links, the masthead — which your subscribers read, not you.

---

# Part 1 — The content desk

## Header / nav

**Heading**

- **Browser tab title —** "ERC Content Desk"
- **Site title, top left —** "ERC Content Desk"

**Labels**

- **Nav landmark (screen-reader only) —** "Screens"

**Buttons**

- **Screen tab 1 —** "Home"
- **Screen tab 2 —** "Sort"
- **Screen tab 3 —** "Finalize"
- **Screen tab 4 —** "Publish to Exchange"
- **Screen tab 5 —** "Send to Newsletter"

**Links**

- **Door at the far right of the header bar —** "Build newsletter ↗"

**Statuses** *(the one status line under the header bar, shared by every screen)*

- **While the desk loads (any screen but Home) —** "Loading…"
- **After a rewrite run —** "Rewrote [N] description — check them one by one."
- **After a rewrite run, plural —** "Rewrote [N] descriptions — check them one by one."
- **While publishing —** "Publishing to the Exchange…"
- **While sending to the newsletter —** "Sending [N] to the newsletter…"
- **After sending to the newsletter —** "Sent [N] to the newsletter builder."
- **After un-sending —** "Pulled [N] back from the newsletter."

*Source: index.html, js/app.js, js/icons.js*

---

## Home

**Heading**

- **Form card heading —** "Add to the queue"
- **Queue table heading —** "In the queue"

**Info panel**

- **Form card lede —** "Share whatever details you have."

**Labels** *(the four glance cards across the top)*

- **Glance card 1 label —** "Exchange updated"
- **Glance card 1 value —** "[Mon D]"
- **Glance card 1 value, when unknown —** "—"
- **Glance card 2 label —** "Next newsletter"
- **Glance card 2 value —** "[Mon D]"
- **Glance card 2 value, when unknown —** "—"
- **Glance card 3 label —** "Queue"
- **Glance card 3, beside the count —** "waiting"
- **Glance card 4 label —** "Public page"

**Buttons**

- **Glance card 4, copy the /submit URL —** "Copy"
- **Glance card 4, after a successful copy (reverts after 1.5s) —** "Copied"
- **Glance card 4, when the clipboard is blocked —** "Can't copy"
- **Above the queue table —** "Refresh"

**Links**

- **Glance card 4, opens /submit in a new tab —** "Open ↗"
- **Door card 1 title —** "Policy Exchange ↗"
- **Door card 1 description —** "The public hub everything publishes to."
- **Door card 2 title —** "Build newsletter ↗"
- **Door card 2 description —** "Assemble the next issue from what the desk staged."

**Labels — the shared submit form (also used on /submit's desk twin)**

- **Field 1 —** "Title"
- **Field 2 —** "Description"
- **Field 2 hint —** "(paste whatever you have — dates, abstract, the whole announcement; headlines can skip this)"
- **Field 3 —** "Link"
- **Radio group legend —** "Type"
- **Type option —** "New Ed Policy Research"
- **Type option —** "Event"
- **Type option —** "Opportunity"
- **Type option —** "Headline"
- **Subtypes under New Ed Policy Research —** "Working Paper", "Peer-Reviewed", "Report", "ERC Research"
- **Subtypes under Event —** "A&M", "Off-Campus", "Webinar-Online"
- **Subtypes under Opportunity —** "Funding & Grants", "Fellowships & Programs", "Call for Proposals", "Other"
- **Subtypes under Headline —** "National", "Texas"
- **Checkbox —** "Requesting ERC Spotlight / newsletter feature"
- **Last field —** "Your name or initials"

**Buttons — the shared submit form**

- **Primary submit —** "Submit"
- **After a successful submit —** "Submit another"

**Statuses — the shared submit form**

- **While sending —** "Sending…"
- **Confirmation, replaces the form —** "Got it — in the queue."

**Labels — the bulk-upload door**

- **Fold summary —** "Have a whole doc or spreadsheet? Add it here — it gets split into items you review first."
- **Drop zone —** "Drop a file here or click to choose one"
- **Drop zone hint —** ".docx, .md, .txt, .xlsx, .csv — items are shown for review before anything is saved"
- **Under the drop zone —** "Need a starting point? Word template · Spreadsheet template"
- **Review table, item with no title —** "(untitled)"
- **Review table, item the split couldn't type —** "To review"

**Buttons — the bulk-upload door**

- **Confirm, before a file is split —** "Add all to the queue"
- **Confirm, once items are listed —** "Add [N] to the queue"
- **Confirm, after every item is removed (disabled) —** "Nothing left to add"
- **Beside the confirm —** "Cancel"
- **Per row in the review table —** "Remove"

**Statuses — the bulk-upload door**

- **While the file is being split —** "Reading [filename] — this can take a minute…"
- **While items are being saved one by one —** "Adding [N] of [M]…"
- **All items saved —** "Added all [N] to the queue ✓"
- **Some items failed —** "Added [N]. Couldn't add: [title]; [title]"

**Errors — the bulk-upload door**

- **Wrong file extension —** "Not a supported file — .docx, .md, .txt, .xlsx, or .csv."
- **File unreadable in the browser —** "Couldn't read that file."
- **Network failure —** "Couldn't reach the server. Check your connection."

**Labels — the queue table**

- **Sortable column header —** "Title [↕ / ↑ / ↓]"
- **Sortable column header —** "Type [↕ / ↑ / ↓]"
- **Sortable column header —** "Date [↕ / ↑ / ↓]"
- **Row with no title —** "(untitled)"
- **Missing type or date cell —** "—"

**Empty states**

- **Queue table, nothing waiting —** "Nothing waiting. Enjoy it."

*Source: js/home-ui.js, js/home-panel.js, js/queue-ui.js, js/queue-view.js, js/submit-form.js, js/schema.js, js/icons.js*

---

## Public submit page (/submit)

**Heading**

- **Browser tab title —** "Share something — ERC"
- **Card heading —** "Share something with the ERC"

**Info panel**

- **Lede under the heading —** "Events, research, opportunities — if it belongs in the ERC newsletter or on the Policy Exchange, share it here. The ERC team reviews everything before it is published."

**Labels**

- **Field 1 —** "Title"
- **Field 2 —** "Description"
- **Field 2 hint —** "(paste whatever you have — dates, abstract, the whole announcement)"
- **Field 3 —** "Link"
- **Radio group legend —** "Type"
- **Type option —** "New Ed Policy Research"
- **Type option —** "Event/Webinar"
- **Type option —** "Opportunity"
- **Type option —** "Other"
- **Media field —** "Media"
- **Media field hint —** "(optional — a flyer, PDF, or picture)"
- **Field 5 —** "Your name"
- **Field 6 —** "Your email address"
- **Footer logo alt text —** "Texas A&M University Education Research Center"

**Buttons**

- **Primary submit —** "Submit"
- **After a successful submit —** "Submit another"
- **Media control, no file yet —** "Upload media"
- **Media control, a file is attached —** "Replace media"
- **Media control, quiet link beside it —** "Remove media"

**Statuses**

- **While sending —** "Sending"
- **Media control, rasterizing a PDF —** "Converting the PDF…"
- **Media control, sending the file —** "Uploading…"
- **Media control, upload finished —** "Added."

**Confirmations**

- **Replaces the form on success —** "Thank you — the ERC has it."
- **Under the thank-you —** "The team reviews every submission before anything is published."

**Errors — form validation (shown as one joined line)**

- **No type chosen (public page only) —** "Pick a type."
- **Email missing —** "Add your email address."
- **Email malformed —** "That email address doesn't look right."
- **Link missing —** "Add a link."
- **Link not http(s) —** "That link needs to be a normal web link (http or https)."
- **Unknown type value —** "Pick a real type."
- **Subtype without a type —** "Pick a type before a subtype."
- **Type chosen but no subtype —** "Pick a subtype."
- **Name missing —** "Add your name or initials."

**Errors — media control**

- **Unsupported file type —** "Use a PNG, JPG, or PDF."
- **File over the size cap —** "Too big — keep it under 2.5 MB."
- **File unreadable —** "Couldn't read that file."
- **PDF rasterizing failed —** "Couldn't convert that PDF."

**Errors — submit**

- **Server returned no message —** "Something went wrong."
- **Network failure —** "Couldn't reach the server. Check your connection."

*Source: submit.html, js/submit.js, js/item-image.js, js/intake.js, js/links.js*

---

## Sort

**Heading**

- **Screen title —** "Sort"
- **Section heading above the card, names the group you are in —** "All" / "To review" / "ERC" / "Research" / "Events" / "Opportunities" / "Headlines"

**Info panel**

- **Toggle beside the title, closed —** "View info"
- **Toggle beside the title, open —** "Hide info"
- **Panel body —** "Go card by card: Keep what belongs, Skip what you are not sure about (it stays in the queue), Delete the rest. The pen edits the item in place. A card with open work — no type, an unchecked link — locks Keep until you fix it (Delete works any time)."

**Labels**

- **Filter pill 1 —** "All ([N])"
- **Filter pill 2, amber when the count is above zero —** "To review ([N])"
- **Filter pill 3 —** "ERC ([N])"
- **Filter pill 4 —** "Research ([N])"
- **Filter pill 5 —** "Events ([N])"
- **Filter pill 6 —** "Opportunities ([N])"
- **Filter pill 7 —** "Headlines ([N])"
- **Position counter, top of the card —** "[N]/[M]"
- **Card title when the row has none —** "(untitled)"
- **Meta line under the title, parts joined by " · " —** "[source] · [date] · [time] · [location] · from [submitter] · [submitter email]"
- **Editor's note on the row —** "Note: [note]"
- **Filed type line —** "[Type] · [Subtype]"
- **Auto-fill marker beside the type (tooltip) —** "Filed by the desk from the link/description — check it."
- **Auto-fill marker, screen-reader label —** "Type was filed automatically — check it"
- **Type picker prompt —** "Select a type"
- **Subtype picker prompt —** "[Type] — now the subtype:"
- **Inline edit field —** "Title"
- **Inline edit field —** "Description"
- **Inline edit field —** "Link"
- **Inline edit field (ERC items only) —** "Media"
- **Link-fix input placeholder —** "paste the right link"
- **Carousel arrow, screen-reader label —** "Previous card"
- **Carousel arrow, screen-reader label —** "Next card"

**Buttons**

- **Head door, top right —** "Go to Finalize"
- **Card action (pen icon) —** "Edit"
- **Card action (bin icon), far left —** "Delete"
- **Card action, middle —** "Skip"
- **Card action (check icon), primary —** "Keep"
- **Inline edit, primary —** "Save"
- **Inline edit, secondary —** "Cancel"
- **After a decision —** "Undo last"
- **Carousel arrows —** "‹" and "›"

**Links**

- **Beside a filed type —** "Change"
- **Beside the type line, opens the item's link —** "Open source ↗"
- **Amber link alert, opens the link (the ask) —** "Verify link ↗"
- **Amber link alert, after visiting —** "Confirm"
- **Amber link alert, after visiting —** "Change"
- **Amber link alert, saves a pasted link —** "Save"

**Statuses**

- **Beside a link a human has confirmed —** "Verified"
- **Replaces the picker the moment a subtype is tapped —** "✓ Saved"

**Badges**

- **Submitter asked for the spotlight —** "Spotlight requested"
- **Came in through the public /submit page —** "External submission"
- **Same link already ran in a newsletter —** "In a past issue"
- **Same link already on the Exchange —** "Already live"
- **Same link submitted before, amber caution —** "Possible duplicate"

**Errors**

- **Amber alert when the row has no link at all —** "Missing link"

**Empty states**

- **Nothing in the stream, nothing decided yet —** "Nothing to sort."
- **Nothing left after working through the stream —** "All sorted."

*Source: js/sort-ui.js, js/sort-view.js, js/screen-info.js, js/workflow.js, js/schema.js, js/icons.js*

---

## Finalize

**Heading**

- **Screen title —** "Finalize"

**Info panel**

- **Toggle beside the title —** "View info" / "Hide info"
- **Panel body —** "Rewrite pending descriptions into ERC voice, then check each one — Keep saves the rewrite, Use original leaves the Sheet untouched. After the checks, look over the table (click a row for details) and go to Publish."
- **Lede, nothing kept and unpublished —** "No unpublished keeps right now."
- **Lede, stage one (rows still needing a description) —** "Rewrite these descriptions into ERC voice."
- **Lede, while checks are open —** "Check the rewrites — flip through and decide each one."
- **Lede, right after a rewrite run (replaces the line above) —** "Rewrote [N] descriptions — check them one by one."

**Labels**

- **Sortable column header —** "Title [↕ / ↑ / ↓]"
- **Sortable column header —** "Type [↕ / ↑ / ↓]"
- **Sortable column header —** "Date [↕ / ↑ / ↓]"
- **Row with no title —** "(untitled)"
- **Missing type or date cell —** "—"
- **Expand caret, screen-reader label, collapsed —** "Show details"
- **Expand caret, screen-reader label, expanded —** "Hide details"
- **Expanded fact (events) —** "Date"
- **Expanded fact (events) —** "Time"
- **Expanded fact (events) —** "Location"
- **Expanded fact (opportunities) —** "Deadline"
- **Expanded fact (opportunities) —** "Topic"
- **Body heading, research items —** "Abstract"
- **Body heading, everything else —** "Description"
- **Check card, type line —** "[Type] — [Subtype]"
- **Check card, diff heading —** "Before"
- **Check card, diff heading —** "After"
- **Check card, when there was no prior description —** "New description — written from the original text"
- **Check card position counter —** "[N]/[M]"
- **Check carousel arrow, screen-reader label —** "Previous rewrite"
- **Check carousel arrow, screen-reader label —** "Next rewrite"

**Labels — the Edit fields form**

- **Field —** "Title"
- **Field —** "Date"
- **Field —** "Source"
- **Field —** "Topic"
- **Field —** "Description"
- **Field —** "Deadline"
- **Field —** "Authors"
- **Field —** "Time"
- **Field —** "Location"

**Buttons**

- **Primary, singular —** "Rewrite [N] description"
- **Primary, plural —** "Rewrite [N] descriptions"
- **Head door once the rewrites are done —** "Go to Publish"
- **Expanded row action (pen icon) —** "Edit fields"
- **Expanded row action (bin icon) —** "Delete"
- **Edit form, primary —** "Save"
- **Edit form, secondary —** "Cancel"
- **Check card (pen icon) —** "Edit"
- **Check card (bin icon), far left —** "Delete"
- **Check card, discards the rewrite (rotate icon) —** "Use original"
- **Check card, accepts the rewrite (check icon), primary —** "Keep"
- **Under the stage-one table —** "See all items"
- **Check carousel arrows —** "‹" and "›"

**Statuses**

- **In place of a description on a row awaiting rewrite —** "No description yet — Rewrite drafts one from the original text."

*Source: js/finalize-ui.js, js/screen-info.js, js/queue-view.js, js/workflow.js, js/schema.js, js/icons.js*

---

## Publish to Exchange

**Heading**

- **Screen title —** "Publish to Exchange"

**Info panel**

- **Toggle beside the title —** "View info" / "Hide info"
- **Panel body —** "Everything here was checked against the live Exchange on arrival. Publish sends the Adding group to the site; newsletter-only items stay held for the issue, and anything already live is skipped."
- **Lede while the check runs —** "Checking the live Exchange…"
- **Lede when nothing is queued —** "Nothing waiting to publish."
- **Lede once the check is back —** "Checked against the live Exchange · "

**Labels**

- **Row with no title —** "(untitled)"
- **Missing type or date cell —** "—"
- **Expand caret, screen-reader label —** "Show details" / "Hide details"
- **Held group fold summary —** "Held for the newsletter ([N])"
- **Held group hint —** "Spotlight events stay off the Exchange — webinars excepted."

**Buttons**

- **Primary, when there is something to add —** "Publish [N] to the Exchange"
- **Head door, when nothing is left to publish —** "Send to Newsletter"
- **Receipt door, after publishing —** "Send to Newsletter"

**Links**

- **Beside the lede, re-runs the check —** "Re-check"
- **On a row that isn't ready —** "Fix in Finalize"
- **Inside the amber alert —** "fix in Sort's To review"

**Badges**

- **Summary chip, items going up —** "Adding [N]"
- **Summary chip, quiet —** "Held for the newsletter [N]"
- **Summary chip, ghost (no count) —** "Already live"

**Errors**

- **Amber alert above the report, singular —** "[N] kept item still needs a type — "
- **Amber alert above the report, plural —** "[N] kept items still need a type — "

**Confirmations**

- **Receipt heading after publishing —** "Published [N] to the Exchange"
- **Under the receipt heading —** "The site updates in about a minute."

*Source: js/publish-ui.js, js/finalize-ui.js, js/screen-info.js, js/queue-view.js, js/workflow.js, js/schema.js, js/icons.js*

---

## Send to Newsletter

**Heading**

- **Screen title —** "Send to Newsletter"

**Info panel**

- **Toggle beside the title —** "View info" / "Hide info"
- **Panel body —** "Pick items for the issue and send them — they leave the desk and wait in the newsletter builder. Change your mind later with Remove under \"Already sent\". A \"was in a past issue\" note is just a heads-up, never a block."
- **Lede, the standing ask —** "Pick items to send to newsletter"
- **Lede, nothing available —** "Nothing new for the newsletter yet."
- **Lede, right after a send —** "Sent [N] to the [Month D] issue — the builder pulls them from here. "

**Labels**

- **Issue dropdown —** "Issue: "
- **Issue dropdown option —** "[Month D]"
- **Group fold summary —** "[Group] · [N] of [M] picked"
- **Group name —** "ERC Spotlight"
- **Group name —** "New Ed Policy Research"
- **Group name —** "Events"
- **Group name —** "Opportunities"
- **Group name —** "Headlines"
- **Group name —** "Untyped"
- **Row with no title —** "(untitled)"
- **Missing type or date cell —** "—"
- **Event row, under the title —** "[Month D, YYYY] · [location]"
- **Opportunity row, under the title —** "Deadline [Month D, YYYY]"
- **Type cell, item held off the Exchange —** "newsletter only"
- **Already-sent fold summary —** "Already sent to this issue ([N])"
- **Past-items fold summary —** "Past items ([N])"

**Buttons**

- **Primary, nothing picked yet (disabled) —** "Send to the [Month D] issue"
- **Primary, with a selection —** "Send [N] to the [Month D] issue"
- **Under "Already sent" (bin icon) —** "Remove"
- **In the Past items fold (bin icon) —** "Delete"
- **Early-event ask —** "Confirm"
- **Early-event ask —** "Cancel"

**Links**

- **Beside the sent confirmation —** "Undo send"
- **Door after a send, primary —** "Open the newsletter builder ↗"

**Statuses**

- **Amber ask on an event dated for a later issue (clock icon) —** "Send early? "
- **Note on an event dated for a later issue —** "For the [Month D] issue"

**Badges**

- **Quiet note on a row whose link already ran —** "Was in the [Month D] issue"
- **Past item, event predates the issue —** "Before this issue"
- **Past item, deadline predates the issue —** "Closes before this issue"
- **Past item, the date itself —** "[Month D, YYYY]" / "Deadline [Month D, YYYY]"

**Empty states**

- **Nothing to pick —** "Nothing new for the newsletter yet."

*Source: js/newsletter-ui.js, js/screen-info.js, js/schedule.js, js/rows-to-issue.js, js/queue-view.js, js/workflow.js, js/schema.js, js/icons.js*

---

## Shared — statuses, loaders and errors that appear anywhere

**Statuses**

- **Every busy label ends in animated dots; the trailing "…" is stripped and the dots typed on —** "[message]" + "…"
- **The sliding-dots loader itself carries no text (aria-hidden).**

**Errors — reaching the desk (js/sheet-client.js)**

- **Network failure on read —** "Couldn't reach the server. Check your connection."
- **Network failure on save —** "Couldn't reach the server. Check your connection."
- **Server error with no message —** "Request failed ([status])"
- **Partial save —** "Saved [N] of [M] rows, then couldn't reach the sheet."

**Errors — the Sheet endpoint (api/sheet.js)**

- **Empty or malformed PATCH —** "Send a rows array."
- **Too many rows at once —** "Send at most 200 rows at a time."
- **Row missing its sheet position —** "Every row needs a _rowNumber from a read."
- **Sheet unreachable —** "Couldn't reach the sheet."
- **Rows no longer in the sheet, singular —** "[N] row couldn't be matched to the sheet — reload and try again."
- **Rows no longer in the sheet, plural —** "[N] rows couldn't be matched to the sheet — reload and try again."
- **Wrong HTTP method —** "Use GET or PATCH."

**Errors — submitting (api/submit.js)**

- **Field over the length cap —** "That submission is too long."
- **Media URL not from this form —** "That media upload did not come from this form."
- **Save failed —** "Couldn't save that. Try again in a moment."
- **Wrong HTTP method —** "Use POST."

**Warnings — submitting**

- **Enrichment failed but the row saved —** "Saved, but the automatic filing failed — fill in the details during Finalize."
- **Model flagged the item as thin (api/_lib/extract.js) —** "Claude was unsure about this one — double-check its fields."

**Errors — the bulk split (api/bulk.js)**

- **Uploaded file over the byte cap —** "That file is too big — split it in half and try again."
- **Document text over the length cap —** "That document is too big — split it in half and try again."
- **Empty .xlsx upload —** "The spreadsheet upload came through empty — try again."
- **Empty .docx upload —** "The document upload came through empty — try again."
- **Nothing extractable —** "Nothing readable in that file."
- **Split ran out of room —** "That document is too big to split in one go — split it in half and try again."
- **Split failed —** "Couldn't read that document. Try again in a moment."
- **Wrong HTTP method —** "Use POST."

**Warnings — the bulk split (api/_lib/bulk-split.js)**

- **Over the item cap —** "Found [N] items — keeping the first 100."
- **Unrecognized type in a spreadsheet cell —** "[item]: unknown type \"[value]\" — pick one during sort."
- **Subtype doesn't belong to the type —** "[item]: \"[value]\" is not a [type] subtype (expected [list])."

**Errors — the rewrite (api/rewrite.js)**

- **Model declined —** "Claude declined the rewrite. Edit the blurbs by hand this time."
- **Batch too large —** "Too many items to rewrite in one go — publish what you have and rewrite the next batch separately."
- **Rewrite failed —** "The rewrite didn't go through. Try again in a moment."
- **Wrong HTTP method —** "Use POST."

**Warnings — the rewrite**

- **Nothing qualified —** "Nothing to rewrite — kept events, opportunities, and research without a description are the only candidates."
- **A returned rewrite matched no item (api/_lib/rewrite.js) —** "Skipped a rewrite that didn't match an item ([id])."
- **Same, with no id at all —** "Skipped a rewrite that didn't match an item (no id)."

**Errors — publishing (api/publish.js)**

- **The Exchange moved mid-publish —** "The Exchange changed while this publish was running — run the check again and publish once more."
- **GitHub unreachable —** "Couldn't reach the Exchange on GitHub. Check the GITHUB_TOKEN setup."
- **Sheet unreachable —** "Couldn't reach the sheet."
- **Wrong HTTP method —** "Use GET or POST."

**Warnings — publishing**

- **Items went live but the stamps failed —** "Published, but the bookkeeping stamps failed for some rows — publish again to finish stamping (already-published rows are skipped safely)."

**Errors — media upload (api/newsletter-image.js)**

- **Unsupported image type —** "Use a PNG, JPG, GIF, or WebP."
- **File unreadable —** "Couldn't read that file."
- **Empty file —** "The file came through empty."
- **Over the size cap —** "That picture is too big — keep it under 2.5 MB."
- **Extension doesn't match the bytes —** "That file doesn't look like the image type it claims to be."
- **Wrong HTTP method —** "Use POST."

**Errors — the builder's pull and archive doors (api/newsletter-pull.js, api/newsletter-archive.js)**

- **Malformed issue query —** "Pass ?issue=YYYY-MM-DD."
- **Sheet unreachable —** "Couldn't reach the sheet."
- **Malformed issue date on save —** "Pass issueDate as YYYY-MM-DD."
- **Empty issue on save —** "Nothing to save — the issue came through empty."
- **Issue over the size cap —** "That issue is too big to archive."
- **Archive write failed —** "Couldn't save to the archive. Try again in a moment."
- **Wrong HTTP method (pull) —** "Use GET."
- **Wrong HTTP method (archive) —** "Use POST."

**Errors — Sheet plumbing, surfaced verbatim through the status line (api/_lib/sheets.js)**

- **Network failure to Apps Script —** "Couldn't reach the sheet API: [detail]"
- **Non-200 from Apps Script —** "Sheet API returned HTTP [status]. Check that SHEET_API_URL points at the deployed web app's URL."
- **HTML instead of JSON —** "Sheet API returned something that wasn't JSON (likely an HTML page). This usually means the Apps Script deployment's \"Who has access\" setting isn't \"Anyone\" — check Deploy > Manage deployments in the Apps Script editor."
- **Apps Script's own error —** "Sheet API error: [detail]"
- **Apps Script error with no message —** "Sheet API returned an error with no message."
- **Missing configuration —** "SHEET_API_URL must be set"
- **Missing configuration —** "SHEET_API_TOKEN must be set"
- **Missing configuration (api/_lib/hub.js, api/_lib/archive.js) —** "GITHUB_TOKEN must be set"

*Source: js/app.js, js/icons.js, js/sheet-client.js, api/sheet.js, api/submit.js, api/bulk.js, api/rewrite.js, api/publish.js, api/newsletter-image.js, api/newsletter-pull.js, api/newsletter-archive.js, api/_lib/extract.js, api/_lib/bulk-split.js, api/_lib/rewrite.js, api/_lib/sheets.js, api/_lib/hub.js, api/_lib/archive.js*

---

# Part 2 — The newsletter builder

## Header (persistent chrome)

**Heading**

- **Browser tab title —** "ERC Newsletter Builder"
- **App title (h1) —** "ERC Newsletter Builder"

**Links**

- **Header link, to the archive page —** "View past newsletters"
- **Header link, back to the desk (left-arrow icon) —** "ERC Content Desk"

**Labels**

- **Step nav landmark, screen-reader only —** "Wizard steps"
- **Step 1 pill —** "Review"
- **Step 2 pill —** "Outline"
- **Step 3 pill —** "Preview & Edit"
- **Step 4 pill —** "Save & Export"

**Buttons**

- **Footer nav, previous step (left-arrow icon) —** "Back"
- **Footer nav, next step (right-arrow icon) —** "Next"

*Source: builder/index.html*

---

## Step 1 — Review

**Heading**

- **Step heading (h2) —** "Review"

**Info panel**

- **"View info" panel body —** "Set the issue date, pull what the desk staged, and look it over. Pull again any time — only new items are added."

**Labels**

- **Issue-date field label —** "Issue"
- **Date dropdown, while the desk's schedule loads —** "Loading issues…"
- **Date dropdown, unchosen prompt option —** "Pick an issue…"
- **Date dropdown, an option —** "[Month DD, YYYY]" (e.g. "July 01, 2026")
- **Review table, first column header —** "Item"
- **Review table, second column header —** "Section"
- **Review table, item row, when the item has no title or link —** "(untitled)"
- **Review table, section cell —** "[Section name]" with "[Group name]" beneath

**Buttons**

- **The step's one action —** "Pull from the desk"

**Statuses**

- **Pull in progress (dots loader; the word shows with animated dots) —** "Pulling…"
- **Pull succeeded, all items new —** "Pulled [N] from the desk."
- **Pull succeeded, some already present —** "Pulled [N] new · [N] already here."
- **Nothing staged for the chosen date, but staged elsewhere —** "Nothing staged for [Month DD, YYYY] — the desk has [N] staged for [Month DD, YYYY]."
- **Nothing staged for the chosen date, nothing staged anywhere —** "Nothing staged for [Month DD, YYYY]."

**Errors**

- **Pull attempted with no issue date set —** "Set the issue date first."
- **Pull failed / desk unreachable —** "Couldn't reach the desk — try again."
- **Date dropdown, the desk's schedule could not be fetched —** "Couldn't reach the desk"
- **Date dropdown, desk reached but no issues on the schedule —** "No issues scheduled on the desk"

**Empty states**

- **No items in the issue yet —** "Nothing here yet."

**Restore banner** (appears at the top of the step showing at boot, i.e. Review)

- **Banner region label, screen-reader only —** "Restore in-progress newsletter"
- **Banner message —** "Restore your in-progress newsletter?"
- **Primary button —** "Restore"
- **Secondary button —** "Discard"

*Source: builder/js/app.js*

---

## Step 2 — Outline

**Heading**

- **Step heading (h2) —** "Outline"
- **Sub-heading over the section list (h3) —** "Sections"

**Info panel**

- **"View info" panel body —** "Drag sections into order and switch them on or off — the issue builds in this order. Featured marks the lead item."

**Labels**

- **Section row, populated —** "[Section name] ([N])"
- **Section row, empty —** "[Section name]"
- **Note beside an empty section —** "(nothing pulled for this section)"
- **Group label above a bucket of items —** "[Group name]"
- **Item row, when the item has no title —** "(untitled)"
- **Featured checkbox label (Upcoming Events only) —** "Featured"
- **Featured checkbox tooltip —** "Pins this event to the top under a Featured heading — choose one."
- **Research-section switch label —** "Submit your research callout"
- **Research-section switch tooltip —** "Show this callout in the newsletter for this issue"
- **Switch state, on —** "On"
- **Switch state, off —** "Off"

**Buttons**

- **Move item up, screen-reader label (up-arrow icon) —** "Move "[title]" up"
- **Move item down, screen-reader label (down-arrow icon) —** "Move "[title]" down"
- **Remove item, quiet red link (trash icon) —** "Remove"
- **Remove item, screen-reader label —** "Remove "[title]" from the issue"
- **Remove item, tooltip —** "Removes this item from the issue"

**Statuses**

- **Undo toast after a removal (curly quotes; falls back to "item" when the item has no title) —** "Removed “[title]”"
- **Undo toast action button —** "Undo"

*Source: builder/js/app.js*

---

## Step 3 — Preview & Edit

**Heading**

- **Step heading (h2) —** "Preview & Edit"

**Info panel**

- **"View info" panel body —** "Click any text in the preview to edit it in a card on the right. The rail also holds the introduction, a one-off Add an item door, and reordering."

**Labels — the edit rail**

- **Rail header —** "Editing"
- **Preview iframe title, screen-reader only —** "Newsletter preview — click fields to edit"

**Labels — edit-card field sub-labels** (fallback: the field key, title-cased, e.g. "Location", "Time", "Source")

- **`title` —** "Title"
- **`url` —** "Link"
- **`meta` —** "Details"
- **`summary` —** "Description"
- **`description` —** "Description"
- **`author` —** "Author"
- **`authors` —** "Authors"
- **`intro` —** "Introduction"
- **`date` —** "Date"
- **`name` —** "Name"
- **`eyebrow` —** "Label"
- **`image` —** "Media"

**Labels — Introduction panel**

- **Panel summary —** "Introduction"
- **Panel hint —** "Shows under the header, before the first section."

**Labels — "Add an item" panel**

- **Panel summary —** "Add an item"
- **Section picker label —** "Section"
- **Section picker options —** "[Section name]" (the registry labels)
- **Group picker label (hidden when the section has one unlabeled group) —** "Group"
- **Group picker options —** "[Group name]"
- **Title field —** "Title"
- **Link field —** "Link"
- **Summary field —** "Summary"
- **Date field (Events and Spotlight only) —** "Date"
- **Time field (Events and Spotlight only) —** "Time"
- **Location field (Events and Spotlight only) —** "Location"
- **Deadline field (Opportunities only) —** "Deadline"
- **Media field (Research, Spotlight, Events, Opportunities only) —** "Media"
- **Value the Deadline field writes into the item's meta line —** "Deadline: [value]"

**Labels — Reorder panel**

- **Panel summary —** "Reorder items"
- **Section label in the list —** "[Section name]"
- **Group label in the list —** "[Group name]"
- **Row, when the item has no title —** "(untitled)"

**Buttons**

- **Rail header, closes every open card —** "Save all"
- **Edit card, close, screen-reader label (× icon) —** "Close editor"
- **Edit card, restore the pulled values (rotate-left icon) —** "Use original"
- **Edit card, commit and close —** "Save"
- **Edit card, remove the item (trash icon) —** "Delete"
- **Introduction panel, save —** "Save"
- **Introduction panel, save confirmation (reverts to "Save" after 1.5s) —** "Saved"
- **"Add an item" panel, submit —** "Add to the issue"
- **Rich-text toolbar, bold —** "B"
- **Rich-text toolbar, bold tooltip —** "Bold"
- **Rich-text toolbar, italic —** "I"
- **Rich-text toolbar, italic tooltip —** "Italic"
- **Rich-text toolbar, link tooltip (link icon, no label) —** "Add link"
- **Media control, no file yet —** "Upload media"
- **Media control, file present —** "Replace media"
- **Media control, clear the file —** "Remove media"

**Prompts**

- **Browser prompt from the rich-text link button —** "Link URL:"

**Statuses**

- **Media upload, PDF being rasterized (dots loader) —** "Converting the PDF…"
- **Media upload, file in flight (dots loader) —** "Uploading…"
- **Media upload succeeded —** "Added."
- **"Add an item" panel, item added —** "Added to [Section name]."

**Errors**

- **"Add an item" panel, submitted with no title —** "Give it a title first."
- **Media upload, unsupported file type —** "Use a PNG, JPG, or PDF."
- **Media upload, file over 2.5 MB —** "Too big — keep it under 2.5 MB."
- **Media upload, file could not be read —** "Couldn't read that file."
- **Media upload, PDF could not be rasterized —** "Couldn't convert that PDF."

**Empty states**

- **Step opened with no issue loaded —** "No issue loaded — pull from the desk on the Review step first."
- **Edit rail with no cards open —** "Click any text in the preview on the left — it opens here to edit."

*Source: builder/js/app.js*

---

## Step 4 — Save & Export

**Heading**

- **Step heading (h2) —** "Save & Export"

**Info panel**

- **"View info" panel body —** "Copy the finished HTML for Outlook, save the issue to the archive, or download the file. Copy HTML is the one Outlook needs."

**Labels**

- **Description paragraph above the buttons —** "Your newsletter is ready. Copy the HTML to paste directly into Outlook Web App, or download the file."
- **Downloaded file name —** "ERC_Newsletter_[date-slug].html" (slug falls back to "newsletter" when the date is blank)

**Buttons**

- **Primary export action —** "Copy HTML"
- **Commit the issue to the past-newsletter archive —** "Save to the archive"
- **Download the rendered file —** "Download .html"

**Statuses**

- **Archive save in progress (dots loader) —** "Saving…"
- **Copy succeeded (toast) —** "HTML copied to clipboard!"
- **Archive save succeeded (toast) —** "Saved to the archive."
- **Archive save overwrote an earlier save (toast) —** "Saved to the archive (replaced the earlier save)."

**Errors**

- **Copy attempted with no issue loaded (toast) —** "No issue loaded — nothing to copy."
- **Clipboard write refused (toast) —** "Copy failed — check browser permissions."
- **Archive save attempted with no issue date (toast) —** "Set the issue date on Review first."
- **Archive save failed (toast; the desk's own error message shows when it returns one) —** "Couldn't save to the archive."

**Empty states**

- **Step opened with no issue loaded —** "No issue loaded. Build one from Review, or add content from a .md on the Outline step."

*Source: builder/js/app.js*

---

## Past newsletters (archive page)

**Heading**

- **Browser tab title —** "Past Newsletters — ERC Newsletter Builder"
- **Page heading (h1) —** "Past newsletters"

**Labels**

- **Lede under the heading —** "Every issue saved to the archive, newest first. Click one to read it."
- **List row —** "[issue label]" (supplied by `newsletters/index.json`)

**Links**

- **Back link at the top (left-arrow icon) —** "Back to the builder"

**Statuses**

- **While the archive index loads (dots loader caption; shows with animated dots) —** "Loading"

**Errors**

- **Archive index could not be fetched —** "Couldn't load the archive."

**Empty states**

- **Archive index loaded but empty —** "Nothing archived yet."

*Source: builder/archive.html*

---

## Shared (anywhere in the builder)

**Buttons**

- **Instruction-panel toggle, closed — on every step —** "View info"
- **Instruction-panel toggle, open — on every step —** "Hide info"

**Labels**

- **Section names as the builder lists them (Outline rows, Review table, Add-an-item picker, Reorder panel) —** "Featured Research", "ERC Spotlight", "Upcoming Events", "Opportunities", "New Education Policy Research", "Education Headlines", "Miscellaneous"
- **Group names as the builder lists them —** "Research Brief", "Report", "Programs & Opportunities", "Events", "This & That", "Featured Events", "Texas A&M", "Online & Off-Campus", "Funding & Grants", "Fellowships & Training", "Calls for Proposals", "Miscellaneous", "Working Papers", "Peer-Reviewed", "Federal", "Texas"
- **Placeholder wherever an item has no title —** "(untitled)"
- **Fallback name inside aria-labels and the undo toast when an item has no title —** "item"

**Statuses**

- **Undo toast, shared by the Outline row Remove and the edit card Delete —** "Removed “[title]”"
- **Undo toast action —** "Undo"
- **Busy labels that render with the sliding-dots loader —** "Pulling…", "Saving…", "Uploading…", "Converting the PDF…", "Loading"

**Errors** (parser warnings, raised when a pasted/parsed `.md` heading matches no registry alias)

- **Unrecognized group heading —** "Couldn't place group: [heading text]"
- **Unrecognized section heading —** "Couldn't place section: [heading text]"

*Source: builder/js/app.js, builder/js/model.js, builder/js/parser.js*

---

# Part 3 — The newsletter email itself (standing text)

Words that appear in the sent email regardless of which items are in the issue.

## Email document

- **Email `<title>` —** "ERC Newsletter | [Month DD, YYYY]"

## Masthead / header

- **Issue date, top left —** "[Month DD, YYYY]"
- **Top-right link —** "Website"
- **Top-right link separator —** "|"
- **Top-right link —** "Join Listserv"
- **Banner image alt text —** "Education Research Center Newsletter"

## Jump-nav bar (only sections present in the issue appear; separated by " | ")

- **Featured Research —** "ERC Research"
- **ERC Spotlight —** "Spotlight"
- **Upcoming Events —** "Events"
- **Opportunities —** "Opportunities"
- **New Education Policy Research —** "Policy Research"
- **Education Headlines —** "Headlines"
- **Miscellaneous —** "Miscellaneous"

## Section band titles (maroon file-tab headers)

- **Research section band (hard-coded, differs from the builder's "Featured Research") —** "ERC Research"
- **Spotlight section band —** "ERC Spotlight"
- **Events section band —** "Upcoming Events"
- **Opportunities section band —** "Opportunities"
- **Policy section band —** "New Education Policy Research"
- **Headlines section band —** "Education Headlines"
- **One-off section band —** "Miscellaneous"

## Group eyebrows (uppercase rust-red labels under a band)

- **ERC Research —** "Research Brief"
- **ERC Research —** "Report"
- **ERC Spotlight —** "Programs & Opportunities"
- **ERC Spotlight —** "Events"
- **ERC Spotlight —** "This & That"
- **Upcoming Events —** "Featured Events"
- **Upcoming Events —** "Texas A&M"
- **Upcoming Events —** "Online & Off-Campus"
- **Opportunities —** "Funding & Grants"
- **Opportunities —** "Fellowships & Training"
- **Opportunities —** "Calls for Proposals"
- **Opportunities —** "Miscellaneous"
- **New Education Policy Research —** "Working Papers"
- **New Education Policy Research —** "Peer-Reviewed"
- **New Education Policy Research —** "Miscellaneous"
- **Education Headlines —** "Federal"
- **Education Headlines —** "Texas"
- **Miscellaneous —** (no eyebrow; the group label is empty, so the section band is the only heading)

## Submit-your-research callout (gray box at the end of ERC Research; toggled per issue on Outline, default on)

- **Callout link —** "Submit Your Research for an ERC Research Brief →"
- **Callout body —** "Working on research that could reach a broader audience? The ERC is accepting submissions for a research brief or other public-facing product — share a recent publication or working paper."

## Section tail link (Opportunities, Policy Research, Headlines, Miscellaneous)

- **Right-justified tail link —** "See more on the ERC website →"

## Footer (maroon band)

- **Logo alt text —** "Texas A&M University Education Research Center"
- **Footer link, globe icon —** "Website"
- **Footer link, envelope icon (mailto:erc@tamu.edu) —** "Email"
- **Footer link, mailbox icon —** "Join Mailing List"
- **Footer link separator —** "·"

*Source: builder/js/template.js (section band titles and group eyebrows draw on builder/js/model.js)*
