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
var SENDER_NAME = 'Charlesa Thompson';
var SHEET_NAME = 'Submissions';
var HEADERS = ['Timestamp', 'First', 'Last', 'Email', 'Subject', 'Message', 'Page', 'Confirmation'];

// The endpoint is public, so it could in principle be pointed at strangers to
// send them mail. Cap auto-replies per day: well above real traffic, low
// enough to stop abuse and to protect the 100/day Gmail sending quota.
var MAX_CONFIRMATIONS_PER_DAY = 40;

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

    // The visitor's confirmation is a courtesy — never let it cost us the
    // submission itself, which is the part that actually matters.
    var confirmation = 'skipped';
    try {
      confirmation = confirm_(row) ? 'sent' : 'rate-limited';
    } catch (mailErr) {
      console.error(mailErr);
      confirmation = 'failed';
    }

    appendRow(row, confirmation);
    notify(row);

    return json({ result: 'success' });
  } catch (err) {
    // Logged to Executions in the Apps Script editor.
    console.error(err);
    return json({ result: 'error', error: 'Server error.' });
  }
}

/**
 * Lets you confirm the deployment is live by visiting the URL in a browser.
 * Bump VERSION whenever this file changes — it is the only way to tell from
 * outside whether a redeploy actually picked up new code.
 */
var VERSION = 2;

function doGet() {
  return json({ result: 'ok', message: 'Contact endpoint is live.', version: VERSION });
}

function appendRow(row, confirmation) {
  var sheet = getSheet();
  sheet.appendRow([
    row.timestamp,
    row.first,
    row.last,
    row.email,
    row.subject,
    row.message,
    row.page,
    confirmation
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
  } else if (sheet.getLastColumn() < HEADERS.length) {
    // A sheet created before a column was added — backfill the new headers
    // so existing data keeps its labels.
    var from = sheet.getLastColumn() + 1;
    var extra = HEADERS.slice(from - 1);
    sheet.getRange(1, from, 1, extra.length)
      .setValues([extra])
      .setFontWeight('bold');
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

/**
 * Auto-reply to the visitor so they know the message landed.
 * Returns false if today's cap is already spent.
 */
function confirm_(row) {
  if (!underDailyCap_()) return false;

  var greeting = row.first ? 'Hi ' + row.first + ',' : 'Hi,';

  var text =
    greeting + '\n\n' +
    'Thanks for reaching out — your message came through, and I\'ll get back ' +
    'to you soon.\n\n' +
    'Here\'s a copy for your records:\n\n' +
    'Subject: ' + row.subject + '\n\n' +
    row.message + '\n\n' +
    '— ' + SENDER_NAME + '\n' +
    'thecharlesathompson.com\n\n' +
    'This is an automated confirmation, but replying to it reaches me directly.';

  var html =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;' +
    'font-size:15px;line-height:1.6;color:#1c2137;max-width:520px">' +
      '<p>' + esc(greeting) + '</p>' +
      '<p>Thanks for reaching out — your message came through, and I&rsquo;ll get ' +
      'back to you soon.</p>' +
      '<p style="margin-top:28px;font-size:13px;color:#6b7280">Here&rsquo;s a copy for your records:</p>' +
      '<div style="border-left:3px solid #d0dce4;padding:4px 0 4px 16px;margin:12px 0 28px">' +
        '<p style="margin:0 0 8px"><strong>' + esc(row.subject) + '</strong></p>' +
        '<p style="margin:0;white-space:pre-wrap">' + esc(row.message) + '</p>' +
      '</div>' +
      '<p style="margin:0">&mdash; ' + esc(SENDER_NAME) + '<br>' +
      '<a href="https://www.thecharlesathompson.com" style="color:#304465">thecharlesathompson.com</a></p>' +
      '<p style="margin-top:28px;font-size:12px;color:#9ca3af">This is an automated ' +
      'confirmation, but replying to it reaches me directly.</p>' +
    '</div>';

  MailApp.sendEmail({
    to: row.email,
    subject: 'Thanks for reaching out, ' + (row.first || 'and hello') + '!',
    body: text,
    htmlBody: html,
    replyTo: NOTIFY_EMAIL,
    name: SENDER_NAME
  });

  return true;
}

/** Rolling per-day counter kept in script properties. */
function underDailyCap_() {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var stored = props.getProperty('confirmCount') || '';
  var parts = stored.split('|');
  var count = parts[0] === today ? parseInt(parts[1], 10) || 0 : 0;

  if (count >= MAX_CONFIRMATIONS_PER_DAY) return false;

  props.setProperty('confirmCount', today + '|' + (count + 1));
  return true;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trim(value) {
  return value ? String(value).trim() : '';
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
