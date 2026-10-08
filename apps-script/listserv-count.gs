/**
 * The sign-up sheet's Apps Script, whole (Oct 8, 2026): Kate's doPost as it
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
