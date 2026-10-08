/**
 * Sheet 1's row count for the desk's Listserv hub (Oct 8, 2026).
 *
 * This goes in the Apps Script of the SIGN-UP sheet, the one LISTSERV_URL
 * posts to, not in the desk's own Code.gs. Paste both functions at the end
 * of that script. If the script already has a doGet, add the `if` block to
 * it instead. Then Deploy, Manage deployments, the pencil, Version: New
 * version, Deploy: saving the file alone changes nothing live. The web app
 * keeps its URL. The desk then asks <that URL>?action=count and gets
 * { ok: true, waiting: N }, N being the rows on the first tab below the
 * header with something in column A. Never a name or an address.
 */
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
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var values = sheet.getRange(2, 1, last - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim()) n++;
  }
  return n;
}
