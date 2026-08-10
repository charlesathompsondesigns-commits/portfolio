# Contact form → Gmail + Google Sheet

Submissions from the contact form on `index.html` and `about.html` are sent to a
Google Apps Script Web App, which does two things with every message:

1. appends a row to a Google Sheet
2. emails a copy to `charlesathompsondesigns@gmail.com`

It runs inside your own Google account. It is free, and unlike a hosted database
free tier it never pauses, sleeps, or expires.

## One-time setup (~5 minutes)

1. Go to <https://sheets.new> and create a spreadsheet. Name it something like
   *Portfolio Contact Submissions*.
2. In that sheet: **Extensions → Apps Script**. An editor opens.
3. Delete whatever is in `Code.gs` and paste in the full contents of
   [`Code.gs`](./Code.gs) from this folder. Save (⌘S).
4. Click **Deploy → New deployment**. Choose type **Web app**, then set:
   - **Execute as:** Me
   - **Who has access:** **Anyone** ← required, or the browser cannot reach it
5. Click **Deploy**. Google asks you to authorize — approve it. You will hit a
   "Google hasn't verified this app" screen: click **Advanced → Go to
   (project name)**. This is expected for your own scripts.
6. Copy the **Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfy…long…/exec`
7. Open [`contact.js`](../contact.js) and paste it into the `ENDPOINT` constant
   at the top:
   ```js
   var ENDPOINT = 'https://script.google.com/macros/s/AKfy…/exec';
   ```
8. Commit and push. Vercel redeploys automatically — then **verify the commit
   actually built**, since a push silently failed to deploy once before.

To confirm the endpoint is alive, paste the Web app URL straight into a browser.
You should see `{"result":"ok","message":"Contact endpoint is live."}`.

## Before it's configured

While `ENDPOINT` is blank, the form falls back to opening the visitor's own mail
client with the message pre-filled. It is never a dead end — but those messages
only arrive if the visitor actually hits send in their mail app, so finish the
setup above.

## Changing the script later

Edits to `Code.gs` do **not** go live until you redeploy: **Deploy → Manage
deployments → pencil icon → Version: New version → Deploy**. The URL stays the
same. This trips people up constantly — if a change seems to have no effect,
this is why.

## Spam

A hidden `company` honeypot field is submitted empty by real people and filled
in by most bots; the script silently discards anything that fills it. If real
spam ever gets through, the next step is adding Cloudflare Turnstile.

## Limits

Consumer Gmail accounts can send 100 emails/day from Apps Script. Well beyond a
portfolio contact form — and even if a flood hit that ceiling, the Sheet row is
still written, so nothing is lost.
