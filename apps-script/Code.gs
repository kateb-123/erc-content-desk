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
 * header row. That's it. It never deletes anything, never runs arbitrary
 * code sent to it, and only touches the one sheet tab it's told to.
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
  var values = sheet.getRange(2, 1, numDataRows, lastColumn).getValues();
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
