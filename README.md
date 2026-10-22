# ERC Content Desk

The private pipeline that feeds the ERC's two outward products: the public
**Policy Exchange** site and the monthly **newsletter**. Submissions come in as a
link or a pasted announcement, a small Claude call reads them into fields, and one
person sorts, finalizes, publishes, and stages an issue without hand-formatting
anything.

One Vercel project serves both halves: the desk at `/` and the newsletter builder
at `/builder/`. **Every push to `main` is a live deploy.**

New here? Read `design/DESIGN-BRIEF.md` (what it is, what every control does, how
it runs) and `design/DESIGN.md` (the style contract).

## The flow

**Add to the queue** (Home, under a strip of facts, with the sidebar for everything else): a title, a link, and whatever text the submitter can
paste. A link alone is enough. The row saves at once; the reader then opens the
link, fills the blank columns, and turns a pasted announcement into a short
description, in the background. The spreadsheet door takes a whole `.xlsx`, `.csv`,
`.docx`, `.md` or `.txt` and splits it into items you review before anything saves.
The public submission form lives outside this repo (a small GitHub Pages site) and
posts to `/api/submit` behind a Cloudflare Turnstile check.

**Sort**: one section at a time (Needs a fix, ERC, ERC events, Research, Events,
Opportunities, Headlines, Skipped), picked from the pills on top. The rows run down
the left; the card on the right shows the chosen row with **Edit**, **Delete**,
**Skip** and **Keep**, and each section has one **Keep the rest**. A skipped row
waits under Skipped, any type, with **Keep** and **Delete**.
Decisions are click only. Nothing reaches the list until the reader has filed it.

**Finalize**: one batched Opus call rewrites kept events, ERC events, and
opportunities into the ERC voice (research abstracts and headlines are left alone),
then you check each rewrite one at a time: **Keep** saves it, **Use original**
keeps the old text. Nothing is written until you decide.

**Publish to Exchange**: checks the keeps against the live `data/news.csv` in the
Exchange repo, shows what is being added, held for the newsletter, or already live,
then one button appends the new rows and commits. Append-only: existing rows are
never touched.

**Send to Newsletter**: stamps chosen items with an issue date, which drains them
from the desk and makes them available to the builder. Mistakes are recoverable
(Undo send, or Remove from the issue).

**The builder** (`/builder/`): pulls the staged items for an issue, lets you
reorder and edit them against a live preview, then copies Outlook-ready HTML,
saves the issue into the archive, or downloads it.

## Where the data lives

Vercel Postgres (Neon) is the truth. A Google Sheet is mirrored behind it as a
human-readable backup, written through an Apps Script web app that lives in the
Sheet (`apps-script/Code.gs`); the Sheet is positional, so a new column can only
be appended. `DESK_STORE=sheet` falls back to the Sheet alone.

- **Statuses**: `new`, `kept`, `circleback`, `trashed`. Rows are never deleted, so
  history is the duplicate index.
- **Columns**: 14 public-site columns plus the workflow columns, all defined in
  `js/schema.js`. The only boolean column is `spotlight_request`.
- **Types and subtypes** are also in `js/schema.js`, and must match the public
  site's own vocabulary.

## Setup

Environment variables (Vercel project settings):

| name | what it is |
| --- | --- |
| `DATABASE_URL` | the Neon Postgres connection string |
| `SHEET_API_URL`, `SHEET_API_TOKEN` | the Apps Script web app and its shared secret |
| `ANTHROPIC_API_KEY` | read implicitly by the SDK |
| `GITHUB_TOKEN` | publishing to the Exchange repo, and saving issues and images |
| `HUB_REPO`, `HUB_BRANCH`, `HUB_CSV_PATH`, `HUB_CSV_URL` | where the public feed lives (defaults to `kateb-123/erc-policy-exchange-app`, `main`, `data/news.csv`) |
| `ARCHIVE_REPO`, `ARCHIVE_BRANCH` | where saved issues go (defaults to this repo) |
| `TURNSTILE_SECRET_KEY` | the bot check for cross-origin submissions |
| (none new) | `/api/briefs` (Oct 21): the Research briefs hub, behind the sign-in; its `read` action (Oct 22) names a paper from the text of its first pages, one short call on `ANTHROPIC_API_KEY`; its `notes-text` action turns a Word .docx into markdown notes with the desk's Word reader (mammoth); its table `briefs` comes from `scripts/ensure-schema.js`; its files go to the team drive through the Sheet's script (see `BRIEFS_FOLDER_ID` below) |
| `SCRAPER_TOKEN` | the shared secret the scraper's GitHub run uses to deliver its haul to `/api/bulk` (the same value is the `SCRAPER_TOKEN` secret on the scraper repo) |
| `SCRAPER_GITHUB_TOKEN`, `SCRAPER_REPO` | a token that may start the scraper's workflow and read its `haul/latest.json` (falls back to `GITHUB_TOKEN`), and the repo (defaults to `kateb-123/erc-scraper`). On the Sheet's script, the `SCRAPE_FOLDER_ID` property is the id of the team drive folder `ERC Content Desk/Newsletter/Newsletter Scrape/scrapes` (the desk's Drive home since Oct 21: a subfolder a hub, the desk's Sheet under `Content queue`, the sign-up sheet under `Listserv`), where the haul is filed: the run's spreadsheets in a folder named by date, and every row on the tab of the issue it feeds in the `Newsletter scrapes` Sheet the script makes there (a tab per send date, newest first). Its `BRIEFS_FOLDER_ID` property is the id of the team drive folder `ERC Content Desk/ERC Research Briefs` (her folders, Oct 21), where `/api/briefs` files each brief's paper, notes, drafts and Word doc in a folder of its own (`briefFolder`, `saveFile` with a `folderId`, `listFiles`, `getFile`) |
| `LISTSERV_URL` | the newsletter sign-up the public site posts through; its script also answers `?action=count` with Sheet 1's rows for the Listserv hub (`apps-script/listserv-count.gs`) |

The Google Sheet side, once:

1. Create a Sheet. In **Extensions, Apps Script**, replace `Code.gs` with this
   repo's `apps-script/Code.gs` and save.
2. In **Project Settings, Script Properties**, add `SHEET_API_TOKEN` with a long
   random value. The same value goes in Vercel.
3. **Deploy, New deployment, Web app**, execute as **Me**, access **Anyone**. The
   token is what protects it. Copy the `/exec` URL into `SHEET_API_URL`.
4. `npm run setup` writes the header row (safe to rerun).
5. Editing `Code.gs` later needs **Deploy, Manage deployments, New version**;
   saving the file alone does not update the live web app.

The database side: `node --env-file=.env scripts/ensure-schema.js` adds any column
the live table predates. Run it before deploying code that reads a new column.

## Working on it

```bash
npm test                                   # the whole suite, plain node --test
node .superpowers/sandbox/sandbox-server.mjs   # the real front end on fake data, localhost:4173
```

The sandbox touches no live data, no public site, and no models. Every visual
change is reviewed there. There is no build step: the browser loads the source
files, so bump the `?v=` cache busters in `index.html` whenever JS or CSS changes.

## Cost

Two things call Anthropic, both small: one Haiku call per submission to file it
(and one per document split), and one batched Opus call per issue for the ERC-voice
rewrite. Journal links that block the reader are looked up through Crossref, which
is free.

## Quick reference

- **The style contract**: `design/DESIGN.md`. **The brief**: `design/DESIGN-BRIEF.md`.
- **Every string the app says**: `docs/handbook/words.md`.
- **Every outside service**: `docs/handbook/connections.md`.
- **Publish can be paused**: `PUBLISH_PAUSED` in `js/flags.js` makes Publish a mock
  and the server refuse a real publish, for team trials.
