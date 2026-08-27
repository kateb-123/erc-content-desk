# ERC Content Desk

A web app and submission queue for managing content in the ERC newsletter and the ERC Policy Exchange hub. The app uses one Google Sheet as the source of truth, and Claude to automatically extract and structure submissions.

## The flow (v2)

**Submit** — Anyone with the link visits `/submit` and fills a short structured form
(title, blurb, link, type + subtype, an optional ⭐ spotlight request, their name).
Every submission is instantly filed by a small Claude call — dates, sources, times,
locations land in their own columns. A "Have a whole doc?" side door splits an entire
pasted document into individual items you confirm before anything saves.

**Queue** — The desk's home screen: everything new, grouped by category with counts,
possible duplicates flagged, circle-backs pinned on top. The header shows the next
issue date from the Sheet's `schedule` tab.

**Sort** — Pick a stack, then one card at a time: **Keep** (K), **Circle back** (C),
or **Trash** (T), with U to undo. Keeps are destined for the Ed Policy Exchange;
the newsletter picks come later, in Build.

**Finalize** — The keeps as an editable table (click any cell to fix it), plus one
batched Claude rewrite of Event + Opportunity blurbs in the ERC voice — shown
side-by-side for accept/reject. Research abstracts and headlines are never rewritten.

**Publish** — Checks your keeps against the *live* `news.csv` on GitHub, shows exactly
what will be added vs. skipped (duplicates) vs. not ready (missing a type), then one
button appends the new rows and commits. Append-only: existing hub rows are never
touched.

**Build** — Tick this issue's items from the published pool (⭐ requests float up),
items auto-slot into newsletter sections with a "move to…" override, type the intro,
download Outlook-ready HTML. Building stamps each used item with its issue date, which
is what resets the queue for the next cycle.

**The Sheet** — one `queue` tab (14 hub columns + workflow columns) plus a hand-edited
`schedule` tab of issue dates. Rows are never deleted; history is the duplicate index.
One-time migration scripts from the v1 layout live in `scripts/` (already run in
production, Aug 2026 — dry-run by default; see each script's header before touching).

## Setup

The app talks to the Sheet through a small Google Apps Script web app that runs
inside the Sheet itself, under your own Google account. This is deliberate: it
needs no Google Cloud project and no service account, so it works even on a
Google account where Google Cloud is disabled.

### 1. Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/) and create a new spreadsheet.
2. This will hold your data; you don't need to name the tab or add headers by hand — setup does that for you.

### 2. Paste in the Apps Script

1. In the Sheet, go to **Extensions → Apps Script**. This opens a script editor bound to this Sheet.
2. Delete the placeholder contents of `Code.gs` and paste in the contents of this repo's `apps-script/Code.gs`.
3. Save the project (File → Save, or Ctrl/Cmd+S).

### 3. Set the shared secret

The script checks a secret token on every request — this is what actually protects your
data, since anyone with the deployed URL can technically reach it (see step 4).

1. In the Apps Script editor, click the gear icon (**Project Settings**) in the left sidebar.
2. Scroll to **Script Properties** → **Add script property**.
3. Property name: `SHEET_API_TOKEN`. Value: a long random string you make up (a password
   generator works well). Save it somewhere — you'll need to set the same value in Vercel.

### 4. Deploy as a web app

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** (your account) and **Who has access: Anyone**.
   - This looks alarming, but it's correct: Apps Script web apps don't check the caller's
     identity when access is "Anyone" — that's exactly why the token from step 3 exists.
     Without the right token, every request is rejected before it touches the Sheet.
   - "Execute as: Me" is what lets the script edit the Sheet under your identity, without
     the app needing any credentials of its own.
4. Click **Deploy**, and authorize the script when Google prompts you (it needs permission
   to edit this Sheet).
5. Copy the **Web app URL** it gives you — it ends in `/exec`.

### 5. Set environment variables in Vercel

1. Go to your Vercel project settings.
2. Add these environment variables:
   - `SHEET_API_URL` — the web app URL from step 4 (ends in `/exec`)
   - `SHEET_API_TOKEN` — the same value you set as the `SHEET_API_TOKEN` script property in step 3
   - `ANTHROPIC_API_KEY` — from [Anthropic Console](https://console.anthropic.com/)

### 6. Run the setup script

After deploying to Vercel (or locally, if testing), run:

```bash
npm run setup
```

This writes the header row to your Google Sheet. It is safe to run multiple times.

### 7. Deploy

Push to your Vercel project and deploy.

### If you change the Apps Script later

Any time you edit `Code.gs` (in this repo or directly in the Apps Script editor), you must
**Deploy → Manage deployments → edit → New version** for the change to take effect — saving
the file alone updates the editor but not the live web app.

## The two pages

**`/`** — The team desk. Reachable by anyone with the URL, so share the URL only with the team. The Anthropic and GitHub keys are never exposed to the browser, but the rewrite and publish buttons do real work (small API spend; commits to the live Exchange), so treat the URL as semi-private. Shows the Queue, Sort, Finalize, Publish, and Build screens.

**`/submit`** — The public submission form. Deliberately open to anyone with the link. Appends to the Google Sheet, no password needed.

## Everyday use

### Correcting data

Edit the Google Sheet directly. The desk will pick up the changes when you reload the tab.

### Deleting or re-sorting rows

If you delete or move rows in the Sheet while a desk tab is open, the tab should be reloaded afterward to stay in sync. (The draft queue stays in memory while the tab is open, so edits made elsewhere don't auto-update — reload to refresh.)

## Cost

Two things call the Anthropic API, both deliberately small:

- **Submitting** runs one tiny Haiku call per item (a fraction of a cent) to file the
  metadata. A bulk doc split is one more Haiku call for the whole document — cents.
- **Rewrite blurbs** (Finalize) is one batched Claude Opus call per issue, covering only
  the kept Events + Opportunities that haven't been published yet — typically cents.

There is no rewrite-everything step anymore; nothing spends money without a click
except the per-submission filing.

## Running the tests

```bash
npm test
```

Tests require no credentials and run in Node's test runner.

---

## Quick reference

- **Header row:** written once by `npm run setup`; column order is fixed (see `js/schema.js`)
- **Statuses:** `new`, `kept`, `processed`, `trashed`
- **Types and subtypes:** controlled by `TYPES` in `js/schema.js`; subtypes must match the hub's `news.csv`
- **Boolean columns:** `newsletter` and `hub` are stored as "TRUE" or empty string in the Sheet
- **Sheet access:** via the Apps Script web app in `apps-script/Code.gs`; every request is checked against the `SHEET_API_TOKEN` script property, which must match the `SHEET_API_TOKEN` environment variable in Vercel
