# Brief for Claude Design: bring back the desk's two Google scripts

Written Oct 24, 2026, and fact-checked the same day. The walkthrough is for a teammate (Kathy) who is not a developer and does not use git.

Code version: every step follows the live code on GitHub's `main` (commit 45924a7 since Oct 24). On the branch `feat/native-look`, `apps-script/`, `api/` and the existing how-to's `deck.json` are the same as on GitHub's `main`, and the two raw links below serve the same script files byte for byte. The local `main` branch in the desk's folder is stale (a336a6a): check against `origin/main`, never local `main`.

## 1. What stopped, and what keeps working

The person who deployed the two scripts has left, and that Google account is now disabled. The two Sheets and their scripts belong to the team drive, but a web app set to **Execute as: Me** runs as the account that deployed it, so both stopped. Live checks, Oct 24: the desk's `/api/listserv` answers `sheet:false`, the desk's own log shows the desk script answering HTTP 403, and the script address in the old sign-up page (section 1, below) answers 403 too.

| Script | Lives in | What it does |
|---|---|---|
| The desk script | Sheet **erc-content-desk**, in ERC Content Desk > Content queue | Keeps the Sheet copy of the queue, reads send dates from the schedule tab, files the scraper's spreadsheets in Drive and fills the Newsletter scrapes Sheet, and makes, fills and lists each research brief's Drive folder. |
| The sign-up script | Sheet **subscribe to listserve**, in ERC Content Desk > Listserv | Writes each public listserv sign-up to Sheet 1 and gives the Listserv hub its count. |

Since they stopped:

- Public sign-ups (the listserv page on erc-share.vercel.app and the Policy Exchange's sign-up boxes, which all go through the desk) are refused with "Couldn't reach the list just now. Try again in a moment." and are saved nowhere. Those people must sign up again.
- The Listserv hub's count is blank and reads "Sheet 1 couldn't be counted just now." with **Try again**.
- The Sheet copy of the queue misses every change, and nothing is sent again later: an item added in the gap never reaches the Sheet, and an older row catches up only when it changes again.
- New send dates typed on the schedule tab do not reach the desk. The desk's own copy runs through Dec 15.
- The scraper's Monday run (next: Oct 26, 7:00 Central) will fail to deliver. Today the Content queue still reads "Last run Oct 22, for the Nov 3 issue: ..."; after a failed run it reads "The last run failed on GitHub. Last good run Oct 22."
- Research briefs: a new brief cannot be made, **Write the draft** fails, and a brief's page reads "Drive didn't answer. Use the folder link above."
- Publish still publishes. Its CSV copy in Drive fails, and the receipt offers the download instead. The repository's Code.gs takes .csv names since Oct 24 (commit 45924a7), so the copy comes back once these steps paste that file.

Keeps working: the desk and the newsletter builder (their data is in the desk's own database), Submit content and the public submit form, Content Sort, Newsletter, Publish, and the Policy Exchange. They run on Vercel.

Not fixed by these steps: the old sign-up page at erc-kate.github.io/erc-tools/listserv-signup/, linked twice from the September 8 issue, posts straight to an old script address that answers 403, and it says "Thank you for subscribing!" anyway. Sign-ups made there are lost, before and after this walkthrough. Changing that page takes the old erc-kate GitHub account.

## 2. Before you start

You need:

- A computer with Chrome, signed in to your TAMU Google account. Google requires the account that deploys a script on a team drive to be in the team drive's own domain, so a personal Gmail will not work. If other Google accounts are signed in too, use a window with only the TAMU one (traps 3 and 11).
- Edit access to both Sheets. They are on the team drive Education Research Center, in ERC Content Desk. Google gives anyone who can edit a Sheet edit access to its script. If **Extensions** > **Apps Script** is missing or will not open, ask for edit access first.
- Unconfirmed: your access to the scripts. An Oct 22 note reads that the team drive gives you "access to all but the Google Apps Scripts". The test is the step above.
- Unconfirmed: your role on the team drive. The desk script moves an older copy of a file to the trash when it saves a new one under the same name, and on a team drive that takes Content manager or Manager. Contributor cannot trash.
- About 15 minutes.
- The desk's owner, named in READ ME FIRST - ERC handoff, for the Vercel step.

Who changes the Vercel settings:

- The two script addresses are environment variables, `SHEET_API_URL` and `LISTSERV_URL`, in the Vercel project **erc-content-desk**, team **TAMU-ERC**. That team sits in the desk owner's own Vercel login, and the owner is its only member. Only the owner can change them. You email the two new addresses, and the owner pastes them in.
- Nothing else changes. The public pages (Vercel project erc-share), the Exchange's sign-up and share pages, and the scraper on GitHub all call the desk's own `/api`, never the scripts. The scraper's secrets (`DESK_URL`, `SCRAPER_TOKEN`) point at the desk and stay as they are. The one page that calls a script directly is the old erc-tools sign-up page in section 1, and these steps cannot reach it.
- Unconfirmed: whether the erc-share project holds unused copies of either variable. Its code does not read them.

Keep private: the two new addresses (they go to the owner by email, nowhere else; the sign-up script has no token, so its address alone lets anyone add rows) and the value of the `SHEET_API_TOKEN` script property (never copy it anywhere).

## 3. The steps

### Script 1: erc-content-desk

1. Open the Sheet erc-content-desk: https://docs.google.com/spreadsheets/d/1dvXdBhMgp1-XmijS0M8wtxARWjy3ejCCFcy-YGKjP4I/edit
2. Click **Extensions** > **Apps Script**. The Apps Script editor opens in a new tab. The project name at the top starts with "ERC Content Desk" and ends with "Sheet API". If it is a new Untitled project instead, stop and email the desk's owner: the token lives only in the real project.
3. In the left bar, click **Project Settings** (the gear).
4. Tick **Show "appsscript.json" manifest file in editor**.
5. Scroll to **Script Properties**. At least these three should be there. Script properties belong to the script and are shared by everyone who uses it, so they should have survived the account closing.
   - `SHEET_API_TOKEN`: a long value. Leave it alone.
   - `SCRAPE_FOLDER_ID`: `1P7KCtPTN8QEosahGoth-qp04PZJ3JqwN`, the folder ERC Content Desk > Newsletter > Newsletter Scrape > scrapes
   - `BRIEFS_FOLDER_ID`: `13Q8dz0Ar1g9iHQxW72KioKM04THCM-sr`, the folder ERC Content Desk > ERC Research Briefs

   A folder's id is the last part of its address when the folder is open in Drive. If a folder id is missing: **Edit script properties** > **Add script property**, type the name and the value, then **Save script properties**. If `SHEET_API_TOKEN` is missing, stop and email the desk's owner.
6. In the left bar, click **Editor** (the `< >` icon). Click **appsscript.json**. Inside `"oauthScopes"` it should list these two (added Oct 20):
   ```
   "https://www.googleapis.com/auth/spreadsheets",
   "https://www.googleapis.com/auth/drive"
   ```
   If one is missing, add it and save. Unconfirmed: the rest of the live manifest, which is not in the repository.
7. In a new tab, open the repository's copy of the code: https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/apps-script/Code.gs. Select all of it and copy.
8. Back in the editor, click **Code.gs**, click inside the code, select all (Cmd+A on a Mac, Ctrl+A on Windows) and paste. This replaces the old code. Click **Save project** (the disk icon).
9. Click at the very end of Code.gs, paste this helper, and save. It only reads three names, to start Google's permission screen. It is not in the repository's file.
   ```
   function checkAccess() {
     var props = PropertiesService.getScriptProperties();
     Logger.log(SpreadsheetApp.getActiveSpreadsheet().getName());
     Logger.log(DriveApp.getFolderById(props.getProperty('SCRAPE_FOLDER_ID')).getName());
     Logger.log(DriveApp.getFolderById(props.getProperty('BRIEFS_FOLDER_ID')).getName());
   }
   ```
10. In the toolbar, open the function menu beside **Run** and **Debug**, pick **checkAccess**, then click **Run**.
11. **Authorization required** appears. Click **Review permissions**, then pick your TAMU account.
12. If Google says it hasn't verified this app, click **Advanced**, then **Go to** the project name **(unsafe)**. A script made inside TAMU may skip this screen.
13. Google lists what the script may do, each with its own box. Tick every box (Google may offer **Select all**), then **Continue**. An empty box is a partial grant, and the desk's writes fail later (trap 2). Google's wording may differ slightly.
14. The **Execution log** opens below the code. It shows erc-content-desk, scrapes and ERC Research Briefs, then **Execution completed**. An error on one of the `getFolderById` lines means a folder id in step 5 is missing or wrong.
15. Click **Deploy** (top right) > **New deployment**.
16. Beside **Select type**, click the gear, then **Web app**.
17. **Description**: your name and the date, for example "Kathy, Oct 2026". The old deployments show as Untitled (one may say Drive), so this marks yours.
18. **Execute as**: **Me** (your TAMU address). **Who has access**: **Anyone**, not "Anyone with Google account". The desk calls the script without signing in to Google; the token is what protects it.
19. Click **Deploy**. If Google asks for permission again, repeat steps 11 to 13.
20. Next to **Web app URL**, click **Copy**. The address ends in `/exec`. Then **Done**. Leave the old deployments as they are.
21. Paste the address into a private (Incognito) window. It should read: "ERC Content Desk sheet API is running. It only accepts POST requests." A Google sign-in page instead means Who has access is not Anyone (step 18).

### Script 2: subscribe to listserve

1. Open the Sheet subscribe to listserve: https://docs.google.com/spreadsheets/d/1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E/edit
2. Click **Extensions** > **Apps Script**. Unconfirmed: this project's name and its code file's name (probably Code.gs).
3. Unconfirmed: that the sign-up script is attached to this Sheet. The handoff says it is, but its code opens the Sheet by its id, which also works from a script kept elsewhere. If the editor opens a new Untitled project holding only `function myFunction() {}`, the old script is not here: carry on in this project anyway, since the repository's copy finds Sheet 1 by its id.
4. Open the code file. It should hold `doPost`, `doGet` and `waitingCount`, and a `SHEET_ID` line with this Sheet's id. Replace it all with the repository's copy, as in steps 7 and 8 above: https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/apps-script/listserv-count.gs. Click **Save project**. This script needs no script properties: the Sheet's id is in the code.
5. In the function menu pick **waitingCount**, then click **Run**. It reads Sheet 1, so Google asks for permission: steps 11 to 13 above. The log ends with **Execution completed**.
6. **Deploy** > **New deployment** > the gear > **Web app**. Description: your name and the date. **Execute as**: **Me**. **Who has access**: **Anyone**, since the desk asks for the count and sends sign-ups without signing in. Click **Deploy**.
7. Next to **Web app URL**, click **Copy**.
8. In a private window, the address reads "The sign-up script is running." The same address with `?action=count` at the end reads `{"ok":true,"waiting":N}`, N being the rows on Sheet 1.

### Send the two addresses

Email both to the desk's owner, named in READ ME FIRST - ERC handoff. Say which is which: "erc-content-desk script" and "subscribe to listserve script". Email only: never a shared doc, a chat or a page.

## 4. The Vercel step (the desk's owner only)

1. On vercel.com, open team **TAMU-ERC**, project **erc-content-desk**.
2. **Settings** > **Environment Variables**.
3. `SHEET_API_URL`: the row's menu (three dots) > **Edit**. Paste the erc-content-desk script's `/exec` address. **Save**.
4. `LISTSERV_URL`: the same, with the subscribe to listserve address.
5. Leave `SHEET_API_TOKEN` alone. It still matches the script property.
6. **Deployments** > the newest Production deployment > the menu > **Redeploy**. A changed variable only reaches a new deployment.

Unconfirmed: which environments (Production, Preview) hold the two variables. Edit each one that exists. The owner's local `.env` holds an older desk-script address, used only for work on the code.

## 5. How to check it worked

Once the owner says the redeploy is done:

1. **Listserv count.** Open https://erc-content-desk.vercel.app/#listserv. Under **To be added** there is a number, with "Rows on Sheet 1, counted as this page opened." A blank with "Sheet 1 couldn't be counted just now." means not yet. Under Status, "Live, taking sign-ups" means the script answered the count; "Down: the sign-up script isn't answering, so sign-ups fail." means it did not (since Oct 25).
2. **A test sign-up.** On https://erc-share.vercel.app/listserv/, sign up as "Test, delete me" with your own email, pass the check box, and send. The page says "Thank you. You are on the list." Your test is the last row on Sheet 1 of subscribe to listserve. Delete that row. The desk keeps its own copy of every sign-up, so the hub's Last sign-up shows today's date, and Last updated may change to today too. Both are expected.
3. **The desk Sheet's new row.** On Submit content (https://erc-content-desk.vercel.app/#team), add an obviously fake item with **Add to the queue**: the link https://example.org/test, the title "Test item, delete me", and your initials (the form needs them). Within a minute it is the last row on the first tab of erc-content-desk. Delete it on Content Sort (the team password is in READ ME FIRST - ERC handoff). Its Sheet row stays, with its status set to trashed: rows are never removed.
4. **The scraper.** On the Content queue (https://erc-content-desk.vercel.app/#queue), under **Scraper**, press **Run the scraper**. The line shimmers while it runs (the last run took under two minutes). When it ends: "Last run <date>, for the <date> issue: ..." with **Open the sheet** and **the files**. "The last run failed on GitHub." means the delivery still failed.
5. **Research briefs.** Open any brief's page (the team password again). Its files are listed, each a link into Drive. "Drive didn't answer. Use the folder link above." means the desk script still fails.
6. **Later.** Send dates typed on the Sheet's schedule tab show on Newsletter > Schedule within ten minutes.

When a check fails:

- In the Apps Script editor, the left bar's **Executions** lists each call. A failed sign-up call shows as Failed; click it to read why. The desk script catches its own errors and answers them in words, so its calls show Completed even when they refuse.
- A Google sign-in page in the private window: **Deploy** > **Manage deployments** > your deployment > the pencil > **Who has access**: **Anyone** > **Deploy**. The address stays.
- "Unauthorized: missing or incorrect token." (on a brief's page, or in the desk's log): the token property changed. Do not guess a value. Email the owner.
- "Server is not configured: the ... script property is not set.": add it as in step 5 of script 1. For `SHEET_API_TOKEN`, email the owner.
- "The Sheet's script does not know this action yet." or "Unknown action": old code is live. Paste Code.gs, save, then **Deploy** > **Manage deployments** > your deployment > the pencil > **Version**: **New version** > **Deploy**.
- A permission error naming Drive or Sheets: trap 2.
- The private-window checks work but the desk still fails: the Vercel step is missing or not redeployed. The owner can read the desk's logs in Vercel, which keep only the last hour on this plan; "Sheet API returned HTTP 403" there means the desk still calls an old address.

## 6. The traps

1. **Permission is asked only when a function that needs it runs.** On Oct 20, running `doGet` asked nothing; a function that read a Drive folder brought up the screen. Fix: run `checkAccess` in the desk script and `waitingCount` in the sign-up script, never `doGet` or `doPost`.
2. **Google's granular consent.** Each permission has its own box, and an empty box is a partial grant. Once, the first grant was read-only, and making folders failed after. Fix: tick every box. If it already went wrong, remove the script's access on your Google account's permissions page (`myaccount.google.com/u/N/permissions`, trap 3), then run `checkAccess` again and tick every box.
3. **The account number in Google's addresses.** With several Google accounts signed in, each has a number in the address, such as `script.google.com/u/1/...`. Google's permissions page opens on account 0 unless the address carries the same number as the editor's. Fix: use `myaccount.google.com/u/<the editor's number>/permissions`, or a window signed in to TAMU only.
4. **Saving changes nothing live.** The web app runs the code as it was deployed. Fix: **Manage deployments** > the pencil > **Version**: **New version** > **Deploy**.
5. **A new deployment gets a new address; a new version keeps it.** This time a new deployment is needed: the old ones belong to the closed account, and Google does not move a deployment to another owner, so Vercel must change. Every later change is a new version of your own deployment, and Vercel stays as it is.
6. **Several deployments, all looking alike.** Once, a new version went on only one of three. Fix: the description in step 17, and always pick that deployment.
7. **The wrong project.** Once, a script property went into a different Apps Script project. Fix: always open a script from its Sheet, **Extensions** > **Apps Script**, and check the name at the top.
8. **Two old helpers.** The live desk script once held `checkDrive` and `restoreMorningScrape`, which were never in the repository's file. The notes say an Oct 21 paste removed them; if either is still there, step 8 removes it, which is fine. Never run `restoreMorningScrape`: it was a one-time repair on Oct 20 that moves files in and out of the trash.
9. **The test address.** **Test deployments** shows an address ending in `/dev`, which works only for people who can edit the script. The desk needs the `/exec` one.
10. **No "Anyone" under Who has access.** That is a TAMU setting. It was offered to the old account. Unconfirmed for yours. If it is missing, stop and tell the owner: an option limited to Texas A&M or to Google accounts will not work, because the desk never signs in.
11. **Several accounts in one browser.** The editor may not open, or opens as the wrong account. Fix: a window signed in to TAMU only.
12. **The scripts now run as you.** If your account ever closes, this happens again, and whoever follows does these same steps.

## 7. Later: Add a source

Not in the code yet. On Oct 24, `apps-script/Code.gs` is the same on `feat/native-look` and on GitHub's `main`, and no branch has an Add a source action or `SOURCES_SHEET_ID`. The plan in the notes: a form on the desk finds a source's feed and writes a row to the Scraper sources Sheet (ERC Content Desk > Newsletter > Scraper sources), and the Monday run reads that Sheet's feed rows too.

When it lands on `main`:

1. Open erc-content-desk > **Extensions** > **Apps Script**.
2. Replace Code.gs with the new file from the raw link in step 7 of script 1, and save. Paste `checkAccess` at the end again, since the paste removes it.
3. **Project Settings** > **Edit script properties** > **Add script property**: `SOURCES_SHEET_ID` = `19gAAU4OTxGrfYqitBS3Nx9KjfIbE4qW_7C51Lq_pZhw`. **Save script properties**. Unconfirmed: the property's name, planned in the notes; the new file's comments have the final one.
4. Unconfirmed: whether the new code needs another permission. If its notes say so, add that line to `appsscript.json`, run `checkAccess` and tick every box.
5. **Deploy** > **Manage deployments** > your deployment > the pencil > **Version**: **New version** > **Deploy**. Same address. Vercel needs nothing.

## 8. For Claude Design

What to make:

- A calm walkthrough page for a teammate who is not a developer, read on a computer.
- Parts in this order: Before you start; Script 1, erc-content-desk; Script 2, subscribe to listserve; Send the two addresses; Check it worked; If something goes wrong. Then Add a source as a short Later part, marked "not yet".
- One action per step. Each step: the action, with Google's names in bold exactly as written here, then one line on what the screen shows next.
- It must open from a link in an email and read in full without JavaScript. A past Claude Design walkthrough needed JavaScript to open by email.
- Sentence case, American spelling, plain short sentences, no em dashes, no emojis, no filler.

What not to invent:

- Only these steps and these names. No buttons, menus, messages or behavior that are not in this brief. Where it says Unconfirmed, keep the mark or leave the line out.
- Do not draw or mock Google's screens. Where a picture helps, leave a labeled empty frame ("Your screenshot: the permissions screen") for the teammate's own.
- Never a password, the token's value or any `/exec` address. Do not name the person who left: say "the desk's owner, named in READ ME FIRST - ERC handoff".
- If the page will be public, leave out the three Drive ids (the two folders and the Scraper sources Sheet) and keep the line on finding a folder's id from its address.

Links to give it:

- The repository (public; `main` is live): https://github.com/kateb-123/erc-content-desk
- The desk script: https://github.com/kateb-123/erc-content-desk/blob/main/apps-script/Code.gs (raw: https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/apps-script/Code.gs)
- The sign-up script: https://github.com/kateb-123/erc-content-desk/blob/main/apps-script/listserv-count.gs (raw: https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/apps-script/listserv-count.gs)
- The existing short how-to: https://erc-content-desk.vercel.app/how-to/google-scripts/ (its words: https://github.com/kateb-123/erc-content-desk/blob/main/how-to/google-scripts/deck.json; a desk screenshot of the Listserv count it may reuse: https://github.com/kateb-123/erc-content-desk/blob/main/how-to/google-scripts/shots/listserv.png)
- The setup steps: https://github.com/kateb-123/erc-content-desk/blob/main/README.md#setup
- Every outside service: https://github.com/kateb-123/erc-content-desk/blob/main/docs/handbook/connections.md
- The two Sheets (they open only for people on the team drive): erc-content-desk https://docs.google.com/spreadsheets/d/1dvXdBhMgp1-XmijS0M8wtxARWjy3ejCCFcy-YGKjP4I/edit and subscribe to listserve https://docs.google.com/spreadsheets/d/1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E/edit
- The desk pages in the checks: https://erc-content-desk.vercel.app/#listserv, https://erc-share.vercel.app/listserv/, https://erc-content-desk.vercel.app/#team, https://erc-content-desk.vercel.app/#queue
