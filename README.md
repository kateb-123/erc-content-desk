# ERC Content Desk

A web app and submission queue for managing content in the ERC newsletter and the ERC Policy Exchange hub. The app uses one Google Sheet as the source of truth, and Claude to automatically extract and structure submissions.

## The flow

**Submit** — Anyone with the link visits `/submit`, pastes a link or text, and it goes into the queue.

**Queue** — On the desk at `/`, the first screen shows new submissions waiting for human review.

**Sort** — The second screen lets you decide what happens to each item: keep it (mark for processing), trash it, or adjust the type/subtype.

**Process** — Click a button to run Claude over the keepers, extracting structured fields like headline, link, type, and deadline. This costs money and takes a minute or two.

**Build / Downloads** — The final screens show processed items ready for the newsletter and hub, and let you download the data for publishing.

## Setup

### 1. Create a Google Cloud service account

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or use an existing one).
3. Enable the Google Sheets API.
4. Create a Service Account and download its JSON key file.
5. From the JSON key file, note the `client_email` (the service account email) and `private_key` values.

### 2. Create and share the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/) and create a new spreadsheet.
2. Rename the first sheet tab to `Items` (or your chosen name).
3. Right-click the sheet tab → "Share" and share it with the service account email as an **Editor**.
4. Copy the spreadsheet ID from the URL (the long alphanumeric string between `/d/` and `/edit`).

### 3. Set environment variables in Vercel

1. Go to your Vercel project settings.
2. Add these environment variables:
   - `SHEET_ID` — the ID from step 2
   - `SHEET_NAME` — the sheet tab name (defaults to `Items`)
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — from the JSON key file
   - `GOOGLE_PRIVATE_KEY` — from the JSON key file (include the `-----BEGIN` and `-----END` lines)
   - `ANTHROPIC_API_KEY` — from [Anthropic Console](https://console.anthropic.com/)
   - `DESK_PASSWORD` — a shared password to protect the `/` desk screens

### 4. Run the setup script

After deploying to Vercel (or locally, if testing), run:

```bash
npm run setup
```

This writes the header row to your Google Sheet. It is safe to run multiple times.

### 5. Deploy

Push to your Vercel project and deploy.

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
- **Service account:** must have Editor access to the Sheet; permissions are checked on every API call
