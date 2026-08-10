/**
 * Contact form endpoint for thecharlesathompson.com
 *
 * Logs every submission to the bound Google Sheet and emails a copy to
 * NOTIFY_EMAIL. Runs inside your own Google account: free, and it never
 * pauses or expires the way a hosted database free tier does.
 *
 * Setup lives in apps-script/README.md.
 */

var NOTIFY_EMAIL = 'charlesathompsondesigns@gmail.com';
var SHEET_NAME = 'Submissions';
var HEADERS = ['Timestamp', 'First', 'Last', 'Email', 'Subject', 'Message', 'Page'];

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};

    // Honeypot — bots fill hidden fields. Return success so they stop retrying.
    if (p.company) return json({ result: 'success' });

    var first = trim(p.first);
    var email = trim(p.email);
    var message = trim(p.message);

    if (!first || !email || !message) {
      return json({ result: 'error', error: 'Missing required fields.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ result: 'error', error: 'Invalid email address.' });
    }

    var row = {
      timestamp: new Date(),
      first: first,
      last: trim(p.last),
      email: email,
      subject: trim(p.subject) || '(no subject)',
      message: message,
      page: trim(p.page)
    };

    appendRow(row);
    notify(row);

    return json({ result: 'success' });
  } catch (err) {
    // Logged to Executions in the Apps Script editor.
    console.error(err);
    return json({ result: 'error', error: 'Server error.' });
  }
}

/** Lets you confirm the deployment is live by visiting the URL in a browser. */
function doGet() {
  return json({ result: 'ok', message: 'Contact endpoint is live.' });
}

function appendRow(row) {
  var sheet = getSheet();
  sheet.appendRow([
    row.timestamp,
    row.first,
    row.last,
    row.email,
    row.subject,
    row.message,
    row.page
  ]);
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notify(row) {
  var name = (row.first + ' ' + row.last).trim();

  var body =
    'New message from your portfolio contact form.\n\n' +
    'Name:    ' + name + '\n' +
    'Email:   ' + row.email + '\n' +
    'Subject: ' + row.subject + '\n' +
    (row.page ? 'Page:    ' + row.page + '\n' : '') +
    '\n' + row.message + '\n';

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'Portfolio: ' + row.subject + ' — ' + name,
    body: body,
    // Hitting Reply in Gmail replies straight to the visitor.
    replyTo: row.email,
    name: 'Portfolio Contact Form'
  });
}

function trim(value) {
  return value ? String(value).trim() : '';
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
