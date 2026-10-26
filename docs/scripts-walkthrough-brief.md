# Brief for Claude Design: bring back the desk's two Google scripts

Written Oct 24, 2026, and fact-checked the same day. The walkthrough is for a teammate (Kathy) who is not a developer and does not use git.

Code version: every step follows the live code on GitHub's `main` (commit 45924a7 since Oct 24). On the branch `feat/native-look`, `apps-script/`, `api/` and the existing how-to's `deck.json` are the same as on GitHub's `main`, and the two raw links below serve the same script files byte for byte. The local `main` branch in the desk's folder is stale (a336a6a): check against `origin/main`, never local `main`.

## 0. Where each thing is

Every name below is the one the walkthrough should use. Nothing else is needed.

| Thing | Where | Who can open it |
|---|---|---|
| The desk's Sheet, **erc-content-desk** | Team drive Education Research Center > ERC Content Desk > Content queue. https://docs.google.com/spreadsheets/d/1dvXdBhMgp1-XmijS0M8wtxARWjy3ejCCFcy-YGKjP4I/edit | Anyone on the team drive |
| The desk's script (script 1) | Inside that Sheet: **Extensions** > **Apps Script**. Its project name starts with "ERC Content Desk" and ends with "Sheet API". It is bound to the Sheet, so it lives on the team drive with it. | Anyone who can edit the Sheet |
| The sign-up Sheet, **subscribe to listserve** | Team drive > ERC Content Desk > Listserv. https://docs.google.com/spreadsheets/d/1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E/edit | Anyone on the team drive |
| The sign-up script (script 2) | Not known. Its code opens the Sheet by id, so the old one may have been inside the Sheet or a separate project in the closed account's own Drive, which is locked. Either way the walkthrough makes it inside the sign-up Sheet (**Extensions** > **Apps Script**), from the repository's copy, so the team can always find it from the Sheet. | Anyone who can edit the Sheet |
| The code for both scripts | Appendix A (the desk script) and Appendix B (the sign-up script) at the end of this brief, each pasted whole into the Apps Script editor. They are copies of `apps-script/Code.gs` and `apps-script/listserv-count.gs` in the desk's public repository, https://github.com/kateb-123/erc-content-desk/tree/main/apps-script, which is for whoever maintains the code, not for the teammate. | Anyone |
| The desk's settings (`SHEET_API_URL`, `LISTSERV_URL`) | vercel.com, team **TAMU-ERC**, project **erc-content-desk**, Settings > Environment Variables | The desk's owner only, named in READ ME FIRST - ERC Content Desk |
| READ ME FIRST - ERC Content Desk | Team drive > ERC Content Desk, at the top. https://docs.google.com/document/d/1DHzMJCA_Alep8suiZi7iICzLGSKtexvm6Z1yqVEoUFg/edit | Anyone on the team drive |
| The existing how-to | https://erc-content-desk.vercel.app/how-to/google-scripts/ (its Redeploy tab is where the desk's Listserv page sends people while the script is down) | Anyone, no login |

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
- The desk's owner, named in READ ME FIRST - ERC Content Desk, for the Vercel step.

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
7. Copy the whole of **Appendix A** at the end of this brief (the desk script, 518 lines). The walkthrough shows it in a box with a Copy button; the teammate never opens GitHub.
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

Where the old script lived is not known (section 0). It does not matter: a deployment runs as the person who made it, so this is a new project either way, and the repository holds the whole code. Make it inside the sign-up Sheet so the team can always find it from the Sheet.

1. Open the Sheet subscribe to listserve: https://docs.google.com/spreadsheets/d/1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E/edit
2. Click **Extensions** > **Apps Script**. One of two things opens:
   - A project that already holds `doPost`, `doGet` and `waitingCount`: the old script was here. Carry on in it.
   - A new Untitled project holding only `function myFunction() {}`: the old script was elsewhere. Carry on in this new project; the repository's copy finds Sheet 1 by its id. Click the project name at the top and name it "Listserv sign-up".
3. Open the code file (Code.gs). Select all of it and replace it with the whole of **Appendix B** (the sign-up script, 50 lines), as in steps 7 and 8 above. Click **Save project**. This script needs no script properties: the Sheet's id is in the code.
4. In the function menu pick **waitingCount**, then click **Run**. It reads Sheet 1, so Google asks for permission: steps 11 to 13 above. The log ends with **Execution completed**.
5. **Deploy** > **New deployment** > the gear > **Web app**. Description: your name and the date. **Execute as**: **Me**. **Who has access**: **Anyone**, since the desk asks for the count and sends sign-ups without signing in. Click **Deploy**.
6. Next to **Web app URL**, click **Copy**.
7. In a private window, the address reads "The sign-up script is running." The same address with `?action=count` at the end reads `{"ok":true,"waiting":N}`, N being the rows on Sheet 1.

### Send the two addresses

Email both to the desk's owner, named in READ ME FIRST - ERC Content Desk. Say which is which: "erc-content-desk script" and "subscribe to listserve script". Email only: never a shared doc, a chat or a page.

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
3. **The desk Sheet's new row.** On Submit content (https://erc-content-desk.vercel.app/#team), add an obviously fake item with **Add to the queue**: the link https://example.org/test, the title "Test item, delete me", and your initials (the form needs them). Within a minute it is the last row on the first tab of erc-content-desk. Delete it on Content Sort (the team password is in READ ME FIRST - ERC Content Desk). Its Sheet row stays, with its status set to trashed: rows are never removed.
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

The code goes in the page:

- The teammate does not use GitHub. Each script's code is in the walkthrough itself, in a code box with a **Copy** button, at the step that pastes it: Appendix A at script 1's step 7, Appendix B at script 2's step 3. Plain text, no line numbers, no syntax coloring that changes characters, nothing cut.
- Copy the code from the appendices below exactly. Do not reword, reformat, shorten or "fix" it. A changed character breaks the script.
- Show the first and last line under the box ("It starts with ... and ends with ...") so the teammate can see the paste took the whole file.
- If the code ever changes, the code box is what gets updated. Say so on the page: "This code is a copy from the desk's repository on the date shown."

What not to invent:

- Only these steps and these names. No buttons, menus, messages or behavior that are not in this brief. Where it says Unconfirmed, keep the mark or leave the line out.
- Do not draw or mock Google's screens. Where a picture helps, leave a labeled empty frame ("Your screenshot: the permissions screen") for the teammate's own.
- Never a password, the token's value or any `/exec` address. Do not name the person who left: say "the desk's owner, named in READ ME FIRST - ERC Content Desk".
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

## Appendix A: the desk script (apps-script/Code.gs, copy of Oct 26, 2026)

Paste the whole box over the code in script 1's Code.gs. It starts with `/**` and ends with `}`.

```
/**
 * ERC Content Desk — Sheet API
 *
 * This script turns this Google Sheet into a tiny web API that the Content
 * Desk app talks to instead of the Google Sheets REST API. It runs under
 * your own Google account, so it works even though Google Cloud is disabled
 * for this account — nothing here needs a Cloud project or a service
 * account.
 *
 * WHAT IT DOES: reads rows, appends a row, overwrites a row, or writes the
 * header row. Since October 19, 2026 it also files the scraper's spreadsheets
 * into the shared drive (saveFile, below). Since October 24, 2026 it also
 * reads the Scraper sources Sheet and adds one row to it for the desk's Add a
 * source form (listSources, addSource). It never runs arbitrary code sent
 * to it and only touches the one sheet tab it's told to; the one thing it
 * ever trashes is an older copy of a scraper file being delivered again.
 *
 * SECURITY: when you deploy this as a web app with "Who has access: Anyone",
 * Google does NOT check who's calling — anyone with the URL could call it.
 * The token check below is what actually protects the data: every request
 * must include the same secret value you set as the SHEET_API_TOKEN script
 * property (Project Settings → Script Properties, or Extensions → Apps
 * Script → gear icon). The token is deliberately not written in this file,
 * because this file is not a secret — paste it wherever you like.
 *
 * See README.md for the exact deployment steps.
 */

/** Name of the script property holding the shared secret. Not the secret itself. */
var TOKEN_PROPERTY_NAME = 'SHEET_API_TOKEN';

/** How long to wait for the sheet lock before giving up, in milliseconds. */
var LOCK_TIMEOUT_MS = 10000;

/** Name of the script property holding the id of the shared drive folder
 *  the scraper's runs are filed under (Newsletter Scrape/scrapes). The id is
 *  the last part of the folder's address in Drive. Not the id itself. */
var SCRAPE_FOLDER_PROPERTY_NAME = 'SCRAPE_FOLDER_ID';

/** Name of the script property holding the id of the team drive folder
 *  ERC Content Desk/ERC Research Briefs, where each brief gets a folder of
 *  its own (the owner, Oct 20 and 21, 2026). The id is the last part of the
 *  folder's address. Not the id itself. */
var BRIEFS_FOLDER_PROPERTY_NAME = 'BRIEFS_FOLDER_ID';
/** Name of the script property holding the id of the Scraper sources Sheet
 *  (ERC Content Desk/Newsletter/Scraper sources on the team drive): the list
 *  of sources the scraper watches, where the desk's Add a source form writes
 *  (Oct 24, 2026). The id is the long part of the Sheet's address between
 *  /d/ and /edit. Not the id itself. */
var SOURCES_SHEET_PROPERTY_NAME = 'SOURCES_SHEET_ID';
var FILE_NAME_RULE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,120}\.(xlsx|txt|pdf|md|docx|png|jpg|jpeg|csv)$/;
/** A folder inside a brief's folder, by name: the figures (Oct 22). */
var SUB_RULE = /^[a-z]{1,20}$/;

/**
 * Entry point Google calls for every POST request to the deployed web app.
 */
function doPost(e) {
  var response;
  try {
    var body = parseRequestBody(e);
    var authError = checkToken(body.token);
    if (authError) {
      response = { ok: false, error: authError };
    } else {
      response = handleAction(body);
    }
  } catch (err) {
    // Anything unexpected still comes back as readable JSON, not a stack trace.
    response = { ok: false, error: 'Server error: ' + describeError(err) };
  }
  return jsonOutput(response);
}

/**
 * A GET to the deployed URL (e.g. pasted straight into a browser) gets a
 * plain, friendly message instead of a Google error page — useful for
 * confirming the deployment URL is correct.
 */
function doGet() {
  return ContentService
    .createTextOutput('ERC Content Desk sheet API is running. It only accepts POST requests.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/** Parses the JSON POST body. Throws a plain-language error if it can't. */
function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('No request body was sent.');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('Request body was not valid JSON.');
  }
}

/**
 * Checks the request's token against the SHEET_API_TOKEN script property.
 * Returns an error message string if the request should be rejected, or
 * null if it's allowed to proceed. Fails closed: if the property has never
 * been set, every request is rejected.
 */
function checkToken(requestToken) {
  var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY_NAME);
  if (!expected) {
    return 'Server is not configured: the ' + TOKEN_PROPERTY_NAME + ' script property is not set.';
  }
  if (!requestToken || requestToken !== expected) {
    return 'Unauthorized: missing or incorrect token.';
  }
  return null;
}

/** Dispatches to the right handler once the token has checked out. */
function handleAction(body) {
  switch (body.action) {
    case 'saveFile':
      return handleSaveFile(body);   // Drive, not the sheet
    case 'appendScrape':
      return withLock(function () { return handleAppendScrape(body); });   // the Newsletter scrapes Sheet in Drive
    case 'briefFolder':
      return handleBriefFolder(body);   // Research briefs on the team drive
    case 'listFiles':
      return handleListFiles(body);
    case 'getFile':
      return handleGetFile(body);
    case 'listSources':
      return handleListSources();   // the Scraper sources Sheet, by its id
    case 'addSource':
      return withLock(function () { return handleAddSource(body); });
  }
  var sheet = getTargetSheet(body.sheetName);

  switch (body.action) {
    case 'read':
      return handleRead(sheet);
    case 'append':
      return withLock(function () { return handleAppend(sheet, body.values); });
    case 'update':
      return withLock(function () { return handleUpdate(sheet, body.rowNumber, body.values); });
    case 'header':
      return withLock(function () { return handleHeader(sheet, body.values); });
    default:
      return { ok: false, error: 'Unknown action: ' + body.action };
  }
}

/** Finds the sheet tab to operate on: the named tab, or the first tab if none was given. */
function getTargetSheet(sheetName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (sheetName) {
    var named = spreadsheet.getSheetByName(sheetName);
    if (!named) throw new Error('No sheet tab named "' + sheetName + '".');
    return named;
  }
  return spreadsheet.getSheets()[0];
}

/**
 * Runs fn() while holding the script lock, so two requests can't write at
 * the same time. Returns a clear error instead of throwing if the lock
 * can't be acquired within LOCK_TIMEOUT_MS.
 */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  var acquired = lock.tryLock(LOCK_TIMEOUT_MS);
  if (!acquired) {
    return { ok: false, error: "Couldn't get a lock on the sheet — another request was in progress. Try again." };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reads every data row (everything below row 1, the header) and returns it
 * along with each row's real sheet row number, so the caller can write back
 * to the right place later.
 */
function handleRead(sheet) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return { ok: true, rows: [] };
  }

  var numDataRows = lastRow - 1;
  // getDisplayValues, not getValues: getValues returns Google's typed values,
  // so a date cell comes back as a Date object and would stringify to
  // "Mon Jul 28 2026 00:00:00 GMT-0500 (...)" instead of "2026-07-28",
  // corrupting the date column and the public hub CSV built from it.
  // Display values give us exactly what the sheet shows, as text — which is
  // also what the app writes back, so a round trip changes nothing.
  var values = sheet.getRange(2, 1, numDataRows, lastColumn).getDisplayValues();
  var rows = values.map(function (rowValues, i) {
    return { rowNumber: i + 2, values: rowValues };
  });
  return { ok: true, rows: rows };
}

/** Appends one new row after the last row with content. */
function handleAppend(sheet, values) {
  if (!Array.isArray(values)) {
    return { ok: false, error: 'append needs a "values" array.' };
  }
  sheet.appendRow(values);
  return { ok: true };
}

/** Overwrites an existing row (by its 1-based sheet row number) with new values. */
function handleUpdate(sheet, rowNumber, values) {
  if (!Array.isArray(values)) {
    return { ok: false, error: 'update needs a "values" array.' };
  }
  if (!rowNumber || rowNumber < 2) {
    return { ok: false, error: 'update needs a valid "rowNumber" (2 or greater — row 1 is the header).' };
  }
  sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  return { ok: true };
}

/** Writes the header row (row 1). */
function handleHeader(sheet, values) {
  if (!Array.isArray(values)) {
    return { ok: false, error: 'header needs a "values" array.' };
  }
  sheet.getRange(1, 1, 1, values.length).setValues([values]);
  return { ok: true };
}

/**
 * Files one of the scraper's spreadsheets, or its run log, into the shared
 * drive: Newsletter Scrape/scrapes/<folder>/<name>, where <folder> is the
 * run's date. The desk sends the file as base64 (the owner, Oct 19, 2026: the
 * haul in Drive "so it's available to everyone"). A delivery of the same
 * file on the same day replaces the earlier copy, which goes to the trash
 * for 30 days.
 */
function handleSaveFile(body) {
  var folderId = PropertiesService.getScriptProperties().getProperty(SCRAPE_FOLDER_PROPERTY_NAME);
  if (!folderId && !body.folderId) {
    return { ok: false, error: 'Server is not configured: the ' + SCRAPE_FOLDER_PROPERTY_NAME + ' script property is not set.' };
  }
  if (!body.name || !FILE_NAME_RULE.test(body.name)) {
    return { ok: false, error: 'saveFile needs a plain file "name" ending in .xlsx, .txt, .pdf, .md, .docx, .png, .jpg or .csv.' };
  }
  if (!body.b64) {
    return { ok: false, error: 'saveFile needs the file as "b64".' };
  }
  var folder;
  if (body.folderId) {
    // A brief's own folder (briefFolder gave its id), or a folder inside it by name (its figures).
    folder = DriveApp.getFolderById(String(body.folderId));
    if (body.sub) {
      if (!SUB_RULE.test(body.sub)) return { ok: false, error: 'saveFile needs a plain "sub": lowercase letters only.' };
      var inside = folder.getFoldersByName(body.sub);
      folder = inside.hasNext() ? inside.next() : folder.createFolder(body.sub);
    }
  } else {
    if (!body.folder || !/^\d{4}-\d{2}-\d{2}$/.test(body.folder)) {
      return { ok: false, error: 'saveFile needs a "folder" named by date, YYYY-MM-DD, or a "folderId".' };
    }
    var root = DriveApp.getFolderById(folderId);
    var subs = root.getFoldersByName(body.folder);
    folder = subs.hasNext() ? subs.next() : root.createFolder(body.folder);
  }
  var bytes = Utilities.base64Decode(body.b64);
  var blob = Utilities.newBlob(bytes, body.contentType || 'application/octet-stream', body.name);
  var older = folder.getFilesByName(body.name);
  while (older.hasNext()) older.next().setTrashed(true);
  var file = folder.createFile(blob);
  return { ok: true, url: file.getUrl(), folderUrl: folder.getUrl() };
}

/** The spreadsheet the scrape by issue is kept in, inside the scrapes folder. */
var SCRAPES_SHEET_NAME = 'Newsletter scrapes';
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-27" as a tab name, "Oct 27, 2026"; a run with no issue is "Run 2026-10-19". */
function scrapeTabName(issue, run) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issue || '');
  if (!m) return 'Run ' + run;
  return MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1];
}

/** Finds the Newsletter scrapes Sheet in the scrapes folder, or makes it there. */
function scrapesSpreadsheet(folder) {
  var files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (files.hasNext()) {
    var file = files.next();
    if (file.getName() === SCRAPES_SHEET_NAME) return SpreadsheetApp.openById(file.getId());
  }
  var made = SpreadsheetApp.create(SCRAPES_SHEET_NAME);
  DriveApp.getFileById(made.getId()).moveTo(folder);
  return made;
}

/**
 * Puts a run's rows on the tab of the issue they feed (the owner, Oct 19, 2026:
 * "a new sheet based on the scrape, by the newsletter send out dates"; her
 * pick: one Sheet, a tab per issue). The tab is made on first use with the
 * header frozen; the newest issue's tab sits first. A link already on the
 * tab is never written twice, and the script never removes a row, so what
 * the team deletes by hand stays deleted and a second run the same day
 * only adds what is new (the owner, Oct 20). Links are clickable.
 */
function handleAppendScrape(body) {
  var folderId = PropertiesService.getScriptProperties().getProperty(SCRAPE_FOLDER_PROPERTY_NAME);
  if (!folderId) {
    return { ok: false, error: 'Server is not configured: the ' + SCRAPE_FOLDER_PROPERTY_NAME + ' script property is not set.' };
  }
  if (!body.run || !/^\d{4}-\d{2}-\d{2}$/.test(body.run)) {
    return { ok: false, error: 'appendScrape needs the "run" date, YYYY-MM-DD.' };
  }
  if (!Array.isArray(body.header) || !Array.isArray(body.rows)) {
    return { ok: false, error: 'appendScrape needs a "header" array and a "rows" array.' };
  }
  var ss = scrapesSpreadsheet(DriveApp.getFolderById(folderId));
  var name = scrapeTabName(body.issue, body.run);
  var sheet = ss.getSheetByName(name);
  var width = body.header.length;
  if (!sheet) {
    sheet = ss.insertSheet(name, 0);
    var leftover = ss.getSheetByName('Sheet1');
    if (leftover && ss.getSheets().length > 1 && leftover.getLastRow() === 0) ss.deleteSheet(leftover);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, width).setValues([body.header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  // Only links not already on the tab are written; nothing on the tab is ever removed here.
  var linkCol = body.header.indexOf('Link') + 1;
  var onTab = {};
  var last = sheet.getLastRow();
  if (linkCol > 0 && last > 1) {
    sheet.getRange(2, linkCol, last - 1, 1).getValues().forEach(function (cell) {
      if (cell[0]) onTab[String(cell[0]).trim()] = true;
    });
  }
  var fresh = body.rows.filter(function (row) {
    var link = linkCol > 0 ? String(row[linkCol - 1] || '').trim() : '';
    return !link || !onTab[link];
  });
  if (fresh.length) {
    var start = sheet.getLastRow() + 1;
    var values = fresh.map(function (row) {
      var out = [];
      for (var i = 0; i < width; i++) out.push(row[i] == null ? '' : row[i]);
      return out;
    });
    sheet.getRange(start, 1, values.length, width).setValues(values);
    if (linkCol > 0) {
      var formulas = values.map(function (row) {
        var url = String(row[linkCol - 1] || '');
        return [url ? '=HYPERLINK("' + url.replace(/"/g, '""') + '","' + url.replace(/"/g, '""') + '")' : ''];
      });
      sheet.getRange(start, linkCol, values.length, 1).setFormulas(formulas);
    }
  }
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
  return { ok: true, sheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId(), tab: name, added: fresh.length, skipped: body.rows.length - fresh.length };
}

/**
 * A brief's own folder under ERC Content Desk/ERC Research Briefs on the team
 * drive (the owner, Oct 20 and 21, 2026): lastname-year-topic, made on first use, found after. The desk files
 * the paper, her notes, the drafts and the Word doc into it by its id.
 */
function handleBriefFolder(body) {
  var rootId = PropertiesService.getScriptProperties().getProperty(BRIEFS_FOLDER_PROPERTY_NAME);
  if (!rootId) {
    return { ok: false, error: 'Server is not configured: the ' + BRIEFS_FOLDER_PROPERTY_NAME + ' script property is not set.' };
  }
  if (!body.name || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(body.name)) {
    return { ok: false, error: 'briefFolder needs a plain "name": letters, digits and dashes.' };
  }
  var root = DriveApp.getFolderById(rootId);
  var subs = root.getFoldersByName(body.name);
  var folder = subs.hasNext() ? subs.next() : root.createFolder(body.name);
  return { ok: true, id: folder.getId(), url: folder.getUrl() };
}

/** What a folder holds, newest first: name, the day it last changed, its address, its size. */
function handleListFiles(body) {
  if (!body.folderId) return { ok: false, error: 'listFiles needs a "folderId".' };
  var root = DriveApp.getFolderById(String(body.folderId));
  var out = [];
  var add = function (files, prefix) {
    while (files.hasNext()) {
      var f = files.next();
      out.push({ name: prefix + f.getName(), updated: f.getLastUpdated().toISOString().slice(0, 10), url: f.getUrl(), size: f.getSize() });
    }
  };
  add(root.getFiles(), '');
  // The folders inside (a brief's figures), one level down, named before each file.
  var subs = root.getFolders();
  while (subs.hasNext()) {
    var sub = subs.next();
    add(sub.getFiles(), sub.getName() + '/');
  }
  out.sort(function (a, b) { return a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : a.name.localeCompare(b.name); });
  return { ok: true, files: out };
}

/** One file's bytes, base64, by name within a folder (the paper, for drafting). */
function handleGetFile(body) {
  if (!body.folderId || !body.name) return { ok: false, error: 'getFile needs a "folderId" and a "name".' };
  var folder = DriveApp.getFolderById(String(body.folderId));
  var files = null;
  if (body.sub && SUB_RULE.test(body.sub)) {
    // A brief's figures: the folder inside first, then the brief's folder, where a cut filed before the figures folder sits.
    var inside = folder.getFoldersByName(body.sub);
    if (inside.hasNext()) files = inside.next().getFilesByName(String(body.name));
  }
  if (!files || !files.hasNext()) files = folder.getFilesByName(String(body.name));
  if (!files.hasNext()) return { ok: false, error: 'No file named ' + body.name + ' in that folder.' };
  var blob = files.next().getBlob();
  return { ok: true, name: blob.getName(), contentType: blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()) };
}

/** The Scraper sources Sheet's columns (Oct 22, 2026), for a Sheet with no header yet. */
var SOURCES_HEADER = ['Source', 'Type', 'Subtype', 'Address', 'How it is read', 'Switched on', 'Why off'];
var MAX_SOURCE_ROWS = 500;
var MAX_SOURCE_CELL = 500;
var SOURCES_NOT_SET = 'Server is not configured: the ' + SOURCES_SHEET_PROPERTY_NAME + ' script property is not set.';

/** The Scraper sources Sheet's first tab, or null while its id is not set. */
function sourcesSheet() {
  var id = PropertiesService.getScriptProperties().getProperty(SOURCES_SHEET_PROPERTY_NAME);
  return id ? SpreadsheetApp.openById(id).getSheets()[0] : null;
}

/** Row 1 as the Sheet shows it. */
function sourcesHeaderOf(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
}

/** One address however it was typed (the desk's addressKey): scheme, www, a fragment and trailing slashes aside. */
function sourceKey(address) {
  return String(address || '').trim().toLowerCase().replace(/#.*$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
}

/** A cell written as plain text: a value that would start a formula keeps a leading apostrophe. */
function plainCell(value) {
  var text = String(value == null ? '' : value).slice(0, MAX_SOURCE_CELL);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

/** The Scraper sources Sheet: its header and every row, as shown (Oct 24, 2026). */
function handleListSources() {
  var sheet = sourcesSheet();
  if (!sheet) return { ok: false, error: SOURCES_NOT_SET };
  var header = sourcesHeaderOf(sheet);
  var last = sheet.getLastRow();
  if (last < 2 || !header.length) return { ok: true, header: header, rows: [] };
  return { ok: true, header: header, rows: sheet.getRange(2, 1, last - 1, header.length).getDisplayValues() };
}

/**
 * Adds one source from the desk's Add a source form (Oct 24, 2026), by column
 * name under the Sheet's own header, every cell as plain text. An address
 * already on the Sheet is not written twice: the answer names that row's
 * source. Nothing on the Sheet is ever changed or removed here; switching a
 * source off is done by hand, in its Switched on cell.
 */
function handleAddSource(body) {
  var sheet = sourcesSheet();
  if (!sheet) return { ok: false, error: SOURCES_NOT_SET };
  var source = body.source;
  if (!source || typeof source !== 'object') return { ok: false, error: 'addSource needs a "source".' };
  if (!String(source.Source || '').trim() || !/^https?:\/\/\S+$/i.test(String(source.Address || ''))) {
    return { ok: false, error: 'addSource needs a "Source" name and an http(s) "Address".' };
  }
  var header = sourcesHeaderOf(sheet);
  if (!header.some(function (h) { return h; })) {
    sheet.getRange(1, 1, 1, SOURCES_HEADER.length).setValues([SOURCES_HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    header = SOURCES_HEADER.slice();
  }
  var lower = header.map(function (h) { return h.toLowerCase(); });
  var addressCol = lower.indexOf('address');
  var nameCol = lower.indexOf('source');
  if (addressCol < 0) return { ok: false, error: 'The sources sheet has no Address column.' };
  var last = sheet.getLastRow();
  if (last - 1 >= MAX_SOURCE_ROWS) return { ok: false, error: 'The sources sheet is full.' };
  if (last > 1) {
    var want = sourceKey(source.Address);
    var rows = sheet.getRange(2, 1, last - 1, header.length).getDisplayValues();
    for (var i = 0; i < rows.length; i++) {
      if (sourceKey(rows[i][addressCol]) === want) return { ok: true, added: false, duplicate: nameCol >= 0 ? rows[i][nameCol] : '' };
    }
  }
  var row = lower.map(function (h) {
    for (var j = 0; j < SOURCES_HEADER.length; j++) {
      if (SOURCES_HEADER[j].toLowerCase() === h) return plainCell(source[SOURCES_HEADER[j]]);
    }
    return '';
  });
  sheet.appendRow(row);
  return { ok: true, added: true };
}

/** Wraps a JS object as the JSON response Apps Script sends back. */
function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Best-effort human-readable message from a thrown error of unknown shape. */
function describeError(err) {
  return (err && err.message) ? err.message : String(err);
}
```

## Appendix B: the sign-up script (apps-script/listserv-count.gs, copy of Oct 26, 2026)

Paste the whole box over the code in script 2's Code.gs. It starts with `/**` and ends with `}`.

```
/**
 * The sign-up sheet's Apps Script, whole (Oct 8, 2026): the owner's doPost as it
 * was, which appends each sign-up to the first tab (Sheet 1), plus doGet,
 * which answers ?action=count with Sheet 1's rows for the desk's Listserv
 * hub: { ok: true, waiting: N }, N being the rows below the header with
 * something in column A. Never a name or an address.
 *
 * This is the SIGN-UP sheet's script, the one LISTSERV_URL posts to, not the
 * desk's own Code.gs. To change it: open the script, select all, paste this
 * file, save, then Deploy, Manage deployments, the pencil, Version: New
 * version, Deploy. Saving alone changes nothing live. The URL stays the same.
 */
var SHEET_ID = '1U_kFmkji6tPeD6OzRVcOWkaWz46pcQcogD1nYtObO2E';

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.action === 'listserv_signup') {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    sheet.appendRow([data.name, data.email, data.date_subscribed, data.time]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'count') {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, waiting: waitingCount() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput('The sign-up script is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/** Rows on the first tab (Sheet 1) with something in column A, the header left out. */
function waitingCount() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var values = sheet.getRange(2, 1, last - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim()) n++;
  }
  return n;
}
```
