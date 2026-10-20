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
 * into the shared drive (saveFile, below). It never runs arbitrary code sent
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
 * run's date. The desk sends the file as base64 (Kate, Oct 19, 2026: the
 * haul in Drive "so it's available to everyone"). A delivery of the same
 * file on the same day replaces the earlier copy, which goes to the trash
 * for 30 days.
 */
function handleSaveFile(body) {
  var folderId = PropertiesService.getScriptProperties().getProperty(SCRAPE_FOLDER_PROPERTY_NAME);
  if (!folderId) {
    return { ok: false, error: 'Server is not configured: the ' + SCRAPE_FOLDER_PROPERTY_NAME + ' script property is not set.' };
  }
  if (!body.folder || !/^\d{4}-\d{2}-\d{2}$/.test(body.folder)) {
    return { ok: false, error: 'saveFile needs a "folder" named by date, YYYY-MM-DD.' };
  }
  if (!body.name || !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,80}\.(xlsx|txt)$/.test(body.name)) {
    return { ok: false, error: 'saveFile needs a plain file "name" ending in .xlsx or .txt.' };
  }
  if (!body.b64) {
    return { ok: false, error: 'saveFile needs the file as "b64".' };
  }
  var root = DriveApp.getFolderById(folderId);
  var subs = root.getFoldersByName(body.folder);
  var folder = subs.hasNext() ? subs.next() : root.createFolder(body.folder);
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
 * Puts a run's rows on the tab of the issue they feed (Kate, Oct 19, 2026:
 * "a new sheet based on the scrape, by the newsletter send out dates"; her
 * pick: one Sheet, a tab per issue). The tab is made on first use with the
 * header frozen; the newest issue's tab sits first. A link already on the
 * tab is never written twice, and the script never removes a row, so what
 * the team deletes by hand stays deleted and a second run the same day
 * only adds what is new (Kate, Oct 20). Links are clickable.
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
