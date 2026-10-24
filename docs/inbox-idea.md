# The desk inbox (parked, Oct 23, 2026)

An idea, decided but not built: newsletters and listservs feed the queue the way the scraper does.

## Decided

- **A desk Gmail.** A new Gmail address the team owns subscribes to the newsletters and listservs worth watching. It is not erc@tamu.edu: TAMU's Outlook may block forwarding outside TAMU, and no one person's account should hold it.
- **One item per story.** The reader pulls each story link out of an email, skips ads, unsubscribe and social links, and drops links the queue already has. Each story waits in Content Sort on its own, tagged From the inbox, with the newsletter's name as the source.
- **Once a day.** One batch every morning at 7.
- **Owner: a teammate, later.** Whoever picks this up creates the Gmail account and puts its login in the READ ME FIRST doc beside the team password, never in this repo.

## Not possible

LinkedIn has no way to read a feed automatically, and scraping it breaks LinkedIn's terms. To bring in a post, use Share, copy the link and paste it into Submit content, or email the post to the desk inbox.

## To build it

1. Create the Gmail account. Subscribe it to the sources in the Scraper sources Sheet that send email, and to any listserv the team wants.
2. A Google Apps Script owned by that account: a daily trigger at 7 am Central reads the unread mail, collects the links and posts them to the desk's bulk door (`/api/bulk`), then marks the mail read.
3. The desk side: let the bulk door take a list of links with a source name and the From the inbox tag, and pull each link's title and description with the reader, as it does for the scraper.
4. Tests first, then a proof in the sandbox with a saved sample email.
