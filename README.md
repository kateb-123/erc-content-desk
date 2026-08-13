# ERC Content Desk

A web app and submission queue for managing content in the ERC newsletter and the ERC Policy Exchange hub. The app uses one Google Sheet as the source of truth, and Claude to automatically extract and structure submissions.

## The flow

**Submit** — Anyone with the link visits `/submit`, pastes a link or text, and it goes into the queue.

**Queue** — On the desk at `/`, the first screen shows new submissions waiting for human review.

**Sort** — The second screen lets you decide what happens to each item: keep it (mark for processing), trash it, or adjust the type/subtype.

**Process** — Click a button to run Claude over the keepers, extracting structured fields like headline, link, type, and deadline. This costs money and takes a minute or two.

**Build / Downloads** — The final screens show processed items ready for the newsletter and hub, and let you download the data for publishing.

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
   - `DESK_PASSWORD` — a shared password to protect the `/` desk screens

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

**`/`** — The team desk. Requires the `DESK_PASSWORD` in the `x-desk-password` header (the desk interface handles this). Shows the queue, sort, build, and download screens.

**`/submit`** — The public submission form. Deliberately open to anyone with the link. Appends to the Google Sheet, no password needed.

## Everyday use

### Correcting data

Edit the Google Sheet directly. The desk will pick up the changes when you reload the tab.

### Deleting or re-sorting rows

If you delete or move rows in the Sheet while a desk tab is open, the tab should be reloaded afterward to stay in sync. (The draft queue stays in memory while the tab is open, so edits made elsewhere don't auto-update — reload to refresh.)

## Cost

The **Process** step calls the Anthropic API. Each item costs money — Claude is processing a link or pasted text to extract structured fields.

The default is 3 items per run (`MAX_ITEMS_PER_RUN=3`). Raising this value speeds up bulk processing but increases cost and runtime. Each item is a non-streaming Claude Opus call that can take 20–60 seconds, so keep the total under Vercel's 300-second timeout.

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
