# Connections

Every outside account and service this project depends on at build or run time.
Env-var and token **names** only, no values live in this file.

Current as of Sep 11, 2026.

`origin` = `github.com/kateb-123/erc-content-desk`, which auto-deploys to Vercel on
every push to `main`.

## Dependency table

| service | what it holds | authorized by (env-var / token NAME) | read by | written by |
| --- | --- | --- | --- | --- |
| **GitHub `kateb-123/erc-content-desk`** (origin) | the app source; also the default newsletter archive - saved issue HTML in `builder/newsletters/`, the archive index, and uploaded images in `builder/images/` | git remote (source); `GITHUB_TOKEN` for archive writes; target set by `ARCHIVE_REPO` / `ARCHIVE_BRANCH` (default this repo / `main`) | Vercel (deploy on push to `main`); `api/newsletter-archive.js` (`readRepoFile`) | `git push main`; `api/newsletter-archive.js` (`putRepoFile` - issue HTML + index); `api/newsletter-image.js` (`putRepoBinary` - images) |
| **GitHub `kateb-123/erc-policy-exchange`** (public hub) | the live `data/news.csv` - the published Policy Exchange feed; also the public share page (`share/index.html`), which posts to `/api/submit` and `/api/newsletter-image` here | `GITHUB_TOKEN`; location set by `HUB_REPO` / `HUB_BRANCH` / `HUB_CSV_PATH` (defaults `kateb-123/erc-policy-exchange` / `main` / `data/news.csv`) | `api/publish.js` (`fetchHubCsv` - dedupe diff) | `api/publish.js` (`putHubCsv` - append-only commit) |
| **Vercel** (hosting + serverless functions) | the deployed `/` desk, the `/builder/`, the `/api/*` functions, and every runtime secret as an env var | Vercel↔GitHub git integration (auto-deploy on push to `main`) | end-user browsers | push to `main` on `erc-content-desk` |
| **Cloudflare Turnstile** (bot check on the public share page) | nothing persistent - issues a one-time token in the visitor's browser | `TURNSTILE_SECRET_KEY` (checked against Cloudflare's siteverify); the public site key sits in the hub's `share/index.html` | `api/_lib/turnstile.js`, called by `api/submit.js` and `api/newsletter-image.js` for cross-origin callers | - (stateless) |
| **Vercel Postgres (Neon)** | THE SOURCE OF TRUTH since Sep 10, 2026: every row and the newsletter schedule copy | `DATABASE_URL` (set by the Vercel/Neon integration, all environments) | `api/_lib/store.js` in database mode, which every endpoint reads through | `api/_lib/store.js` (append, update), `scripts/ensure-schema.js` (adds a column the live table predates), `scripts/copy-sheet-to-db.js` (the one-time copy, refuses to run without `SHEET_TO_DB_CONFIRM=yes`) |
| **Google Sheet via Apps Script web app** (`apps-script/Code.gs`) | the MIRROR behind the database, kept so the data stays human-readable: `queue` tab (submissions + workflow state) and hand-edited `schedule` tab (issue dates). `DESK_STORE=sheet` falls back to it alone. Written positionally, so a new column can only be APPENDED - `queue` tab (submissions + workflow state) and hand-edited `schedule` tab (issue dates) | `SHEET_API_URL`, `SHEET_API_TOKEN` (must equal the Apps Script `SHEET_API_TOKEN` script property) | `api/sheet.js`, `api/rewrite.js`, `api/publish.js`, `api/newsletter-pull.js` (`readAllRows` / `readScheduleRows`) | `api/submit.js` (`appendRow`), `api/sheet.js` (`updateRow`), `api/publish.js` (`updateRow` - mark published), `scripts/setup-sheet.js` (`writeHeader`) |
| **Anthropic API** (`@anthropic-ai/sdk`) | nothing persistent: the model that files, splits, and rewrites submission text | `ANTHROPIC_API_KEY` (read implicitly by `new Anthropic()`) | called by `api/submit.js` and `api/read.js` (filing a submission, Haiku), `api/bulk.js` (doc split, Haiku), `api/rewrite.js` (blurb rewrite, Opus) | nothing (stateless) |
| **Crossref** (`api.crossref.org`) | nothing persistent: the public record for a DOI (title, authors, date, journal) | none, it is open; the desk sends a mailto in its User-Agent | `api/_lib/crossref.js`, called by the reader when a journal page turns it away | nothing (stateless) |

`GITHUB_TOKEN` is one shared credential: it authorizes both the hub write in
Publish and the archive/image writes in the builder.

Related account, **not** a runtime dependency: the public listserv sign-up and
other ERC tools live under the separate GitHub account `erc-kate` (repo
`erc-tools`). The share page borrowed its outward maroon look from the sign-up
page and is styled deliberately unlike the internal desk; no code here calls
`erc-tools`.

## If it goes away

- **GitHub `erc-content-desk`** - Vercel has nothing to deploy (the site goes dark), and Save-to-archive and image uploads fail.
- **GitHub `erc-policy-exchange`** - Publish can't read or append `news.csv`, and the published Policy Exchange feed is gone.
- **Vercel** - the desk is unreachable, every `/api` function stops, and the share page can't submit; the Sheet and repos still hold their data.
- **Vercel Postgres (Neon)** - the desk has no data: every screen fails, and nothing can be read or saved (unless `DESK_STORE=sheet` moves it back onto the Sheet).
- **Google Sheet / Apps Script web app** - the mirror stops updating and the readable backup goes stale; the desk itself keeps working, and the failure is logged, not raised.
- **Cloudflare Turnstile** - the share page can't submit (the desk refuses cross-origin calls without a valid token); the desk's own forms and the builder are unaffected.
- **Anthropic API** - submissions save but are never filed (they sit waiting for the reader and never reach a Sort card), bulk doc split fails, and Finalize's rewrite fails.
- **Crossref** - journal links whose publisher blocks the reader keep their "couldn't open this page" warning; nothing else changes.
- **`GITHUB_TOKEN` revoked** - Publish (hub) and archive/image saves break together, since both use this one token.

## Add a source (Oct 24, 2026)

The Content queue's Scraper block has an **Add a source** button beside Run the scraper. Anyone can use it: the page is open.

- **What the form does.** It takes a name, an address, what the source posts (events, research, headlines or opportunities) and its kind: a site or feed, or an email newsletter. For a site or feed the desk looks for an RSS or Atom feed: the address itself, the page's own feed link, then `/feed/`, `/rss.xml` and `/feed.xml`. It then writes one row to the Scraper sources Sheet and says what happened: a feed found is switched on ("Added. The scraper reads its feed from next Monday."); no feed is saved switched off ("Saved, but it has no feed, so the scraper cannot read it yet."); an email newsletter is saved switched off and never fetched ("Saved as an email newsletter. The scraper cannot read email."). An address already in the Sheet or in the scraper's `sources.yaml` is not added twice.
- **Safety.** The check runs on the desk's server (`api/_lib/sources.js`): web addresses only, the usual ports, never localhost, a private or link-local address, or a name that resolves to one (checked when the connection opens, and again at every redirect), 10 seconds in all, and the form only from the desk's own page.
- **The Sheet.** Scraper sources, in the team drive at `ERC Content Desk/Newsletter/Scraper sources`. Columns: Source, Type, Subtype, Address, How it is read, Switched on, Why off. The form only adds rows. To switch a source off, set its Switched on cell to `no`.
- **`SOURCES_SHEET_ID`.** A script property on the desk's Apps Script (the one bound to the desk's Sheet, `apps-script/Code.gs`): the Scraper sources Sheet's id, from its address. The script's `listSources` and `addSource` actions open the Sheet by it. Until the new `Code.gs` is deployed and the property is set, the form says "The sources sheet is not connected yet."
- **The scraper's step.** Each run on GitHub (Mondays, and the Run the scraper button) first asks the desk `GET /api/bulk?sources=feeds`, with `SCRAPER_TOKEN` as a Bearer header (`tools/fetch_sources.py` in the scraper repo). The desk answers with the Sheet's rows read as a feed and switched on. The run reads each one as a plain feed, no code, and skips any address already in `sources.yaml`, switched on or parked. A feed that fails shows in the run log like any source. If the desk does not answer, the run goes on with `sources.yaml` alone and the log says so.

| service | what it holds | authorized by (env-var / token NAME) | read by | written by |
| --- | --- | --- | --- | --- |
| **Google Sheet "Scraper sources"** (team drive) | the scraper's source list for people to read, plus the rows Add a source writes | the desk's Apps Script, `SHEET_API_URL` / `SHEET_API_TOKEN`; the script property `SOURCES_SHEET_ID` | `api/_lib/scraper.js` (`listSources`: the form's duplicate check, and `?sources=feeds` for the run) | `api/_lib/scraper.js` (`addSource`, one row per form) |

- **If it goes away.** The form says the sheet is not connected, and runs go on with `sources.yaml` alone.
