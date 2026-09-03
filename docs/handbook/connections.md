# Connections

Every outside account and service this project depends on at build or run time.
Env-var and token **names** only — no values live in this file.

`origin` = `github.com/kateb-123/erc-content-desk`, which auto-deploys to Vercel on
every push to `main`.

## Dependency table

| service | what it holds | authorized by (env-var / token NAME) | read by | written by |
| --- | --- | --- | --- | --- |
| **GitHub `kateb-123/erc-content-desk`** (origin) | the app source; also the default newsletter archive — saved issue HTML in `builder/newsletters/`, the archive index, and uploaded images in `builder/images/` | git remote (source); `GITHUB_TOKEN` for archive writes; target set by `ARCHIVE_REPO` / `ARCHIVE_BRANCH` (default this repo / `main`) | Vercel (deploy on push to `main`); `api/newsletter-archive.js` (`readRepoFile`) | `git push main`; `api/newsletter-archive.js` (`putRepoFile` — issue HTML + index); `api/newsletter-image.js` (`putRepoBinary` — images) |
| **GitHub `kateb-123/erc-policy-exchange`** (public hub) | the live `data/news.csv` — the published Policy Exchange feed | `GITHUB_TOKEN`; location set by `HUB_REPO` / `HUB_BRANCH` / `HUB_CSV_PATH` (defaults `kateb-123/erc-policy-exchange` / `main` / `data/news.csv`) | `api/publish.js` (`fetchHubCsv` — dedupe diff) | `api/publish.js` (`putHubCsv` — append-only commit) |
| **Vercel** (hosting + serverless functions) | the deployed `/` desk and `/submit` page, the `/api/*` functions, and all four runtime secrets as env vars | Vercel↔GitHub git integration (auto-deploy on push to `main`) | end-user browsers | push to `main` on `erc-content-desk` |
| **Google Sheet via Apps Script web app** (`apps-script/Code.gs`) | the source-of-truth data — `queue` tab (submissions + workflow state) and hand-edited `schedule` tab (issue dates) | `SHEET_API_URL`, `SHEET_API_TOKEN` (must equal the Apps Script `SHEET_API_TOKEN` script property) | `api/sheet.js`, `api/rewrite.js`, `api/publish.js`, `api/newsletter-pull.js` (`readAllRows` / `readScheduleRows`) | `api/submit.js` (`appendRow`), `api/sheet.js` (`updateRow`), `api/publish.js` (`updateRow` — mark published), `scripts/setup-sheet.js` (`writeHeader`) |
| **Anthropic API** (`@anthropic-ai/sdk`) | nothing persistent — the model that files, splits, and rewrites submission text | `ANTHROPIC_API_KEY` (read implicitly by `new Anthropic()`) | called by `api/submit.js` (per-item filing), `api/bulk.js` (doc split), `api/rewrite.js` (blurb rewrite) | — (stateless) |

`GITHUB_TOKEN` is one shared credential: it authorizes both the hub write in
Publish and the archive/image writes in the builder.

Related account, **not** a runtime dependency: the public listserv sign-up and
other ERC tools live under the separate GitHub account `erc-kate` (repo
`erc-tools`). `/submit` only borrowed its outward maroon look
(`submit.html` styles it deliberately unlike the internal desk); no code here
calls it.

## If it goes away

- **GitHub `erc-content-desk`** — Vercel has nothing to deploy (the site goes dark), and Save-to-archive and image uploads fail.
- **GitHub `erc-policy-exchange`** — Publish can't read or append `news.csv`, and the published Policy Exchange feed is gone.
- **Vercel** — the desk and `/submit` are unreachable and every `/api` function stops; the Sheet and repos still hold their data.
- **Google Sheet / Apps Script web app** — the desk has no data: Queue, Sort, Finalize, Publish, Build, and `/submit` all fail; nothing can be read or saved.
- **Anthropic API** — submissions can't be auto-filed, bulk doc split fails, and Finalize's rewrite fails; manual entry into the Sheet still works.
- **`GITHUB_TOKEN` revoked** — Publish (hub) and archive/image saves break together, since both use this one token.
