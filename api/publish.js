/**
 * GET  /api/publish — preview: what would be added vs skipped, against the
 *                     LIVE news.csv (the overwrite worry dies here), plus the
 *                     live rows that can be highlighted and the picks as
 *                     they stand.
 * POST /api/publish — append the new rows, commit, stamp published_at; then
 *                     commit her highlight picks as the pins of the Exchange's
 *                     own data/featured.json when the body carries them, with
 *                     the card's words (Kate, Sep 30). With only: 'highlight'
 *                     (the highlight's own Save, Kate, Oct 6) it writes the
 *                     pins alone; a pick not on the Exchange yet is held.
 * Never modifies or deletes an existing hub row.
 *
 * GET  /api/publish?updated=1 — when the Exchange last changed (api/_lib/hub-updated.js).
 *
 * Behind the desk password (Kate, Sep 23): both need a signed-in browser,
 * and the write asks for the password once more, in the body.
 */
import { readAllRows, updateRows } from './_lib/store.js';
import { readyToPublish, markPublished, sendTo } from '../js/workflow.js';
import { isValidType, isValidSubtype } from '../js/schema.js';
import { isSafeLink } from '../js/links.js';
import { fetchHubFile, putHubFile, diffAgainstHub, appendRowsToCsv, parseCsv, csvLinks } from './_lib/hub.js';
import { FEATURED_PATH, hubRows, parseFeatured, nowPicks, nowCards, featuredText, cleanPicks, describePicks, pickable, photoUpdates } from './_lib/highlights.js';
import { refuseUnlessPassword } from './_lib/session.js';
import { todayCentral } from '../js/today.js';
import { PUBLISH_PAUSED } from '../js/flags.js';
import hubUpdated from './_lib/hub-updated.js';
import { saveFile } from './_lib/sheets.js';

/** The team drive folder ERC Content Desk / Policy Exchange, where every
 *  publish files the list as it stands after the write (Kate, Oct 22, 2026:
 *  "can it just get saved to the google drive?"). The folder's own sharing
 *  guards it, as the sign-up sheet's does. */
export const EXCHANGE_FOLDER_ID = process.env.EXCHANGE_FOLDER_ID || '1eSRrsHYDMnQZLoH-rOMilx40V7c8nsd_';

/** erc-exchange-2026-09-23-1505.csv: the day and the minute in College Station's
 *  time, so two publishes a day keep both copies and the name matches the clock on the wall. */
export function copyName(clockIso) {
  const t = new Date(clockIso);
  if (Number.isNaN(t.getTime())) return 'erc-exchange.csv';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t).map(p => [p.type, p.value]));
  return `erc-exchange-${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}.csv`;
}

export const config = { maxDuration: 300 };

const label = r => ({ id: r.id, headline: r.headline || r.link || r.id });
const CSV_PATH = () => process.env.HUB_CSV_PATH || 'data/news.csv';

/** Built over its dependencies so the tests can hand in fakes. */
export function createPublishHandler({
  readAllRows: readRows, updateRows: writeRows,
  hub = { fetchFile: fetchHubFile, putFile: putHubFile },
  drive = { saveFile },
  copyFolder = EXCHANGE_FOLDER_ID,
  session = {}, today = () => todayCentral(), clock = () => new Date().toISOString(),
}) {
  return async function handler(req, res) {
    // When the Exchange last changed rides this function (Oct 21): a GET with ?updated.
    if (req.method === 'GET' && req.query?.updated != null) return hubUpdated(req, res);
    try {
      // The sign-in is off (Kate, Sep 30): the check is open; the write still
      // asks for the password, below.
      // Team trial: the Exchange door is closed. The GET preview stays open so
      // the desk can still show what would publish; only the write is refused.
      if (req.method === 'POST' && PUBLISH_PAUSED) {
        return res.status(200).json({
          ok: false,
          error: 'Publishing is paused for the team trial. Nothing was sent to the Exchange.',
        });
      }
      if (req.method === 'POST' && await refuseUnlessPassword(req, res, session)) return;
      if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({ ok: false, error: 'Use GET or POST.' });
      }

      const all = await readRows();
      const candidates = readyToPublish(all);

      // Split candidates into publishable (valid type/subtype and a safe link) and
      // notReady. The candidates are the rows ticked for the Exchange (Sort's Send
      // it to, Sep 18): nothing is held back here any more.
      const publishable = candidates.filter(r =>
        isValidType(r.type) && isValidSubtype(r.type, r.subtype) && isSafeLink(r.link));
      const notReady = candidates.filter(r => !publishable.includes(r));

      if (req.method === 'GET') {
        const [{ text }, picksFile] = await Promise.all([hub.fetchFile(CSV_PATH()), hub.fetchFile(FEATURED_PATH)]);
        const { newRows, skipped } = diffAgainstHub(text, publishable);
        const live = hubRows(text);
        const featured = parseFeatured(picksFile.text);
        return res.status(200).json({
          ok: true,
          adding: newRows.map(label),
          skipped: skipped.map(label),
          notReady: notReady.map(label),
          // Kept, not published, ticked for the newsletter alone, and not in an
          // issue already sent: Publish lists them as Held for newsletter (review, Oct 23).
          newsletterOnly: all.filter(r => r.status === 'kept' && !r.published_at && !sendTo(r).exchange
            && (!r.newsletter_issue || r.newsletter_issue >= today())).map(label),
          hubCount: Math.max(parseCsv(text).length - 1, 0),
          liveLinks: [...csvLinks(text)],   // Sort's Already live group reads these (Kate, Sep 22)
          hub: pickable(live, today()),      // what the Exchange still shows, for the highlight step
          // What the card holds today: the pins within their day, and the
          // one-off cards made on the Exchange beside them.
          highlights: { items: describePicks(nowPicks(featured, today()), { adding: newRows, hub: live }), cards: nowCards(featured, today()) },
        });
      }

      // Her picks ride the body when the highlight step was on the page; an
      // absent list leaves the file alone.
      const picksGiven = Array.isArray(req.body?.highlights);
      const onlyHighlight = req.body?.only === 'highlight';
      if (onlyHighlight && !picksGiven) return res.status(400).json({ ok: false, error: 'Send the highlight picks.' });

      // The CSV as it stands after this publish goes back in the response, so the
      // desk can hand Kate a copy to keep (Sep 9) without a second round trip.
      let published = [], skipped = [], finalCsv = '', picks = { items: [], dropped: [] };
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { text, sha } = await hub.fetchFile(CSV_PATH());
        if (sha === null) throw new Error('GitHub read failed: HTTP 404');   // nothing is ever published onto a missing list
        if (onlyHighlight) {
          // The pins alone: only what the Exchange already holds can be pinned.
          picks = cleanPicks(req.body.highlights, { adding: [], hub: hubRows(text), today: today() });
          finalCsv = text;
          break;
        }
        const diff = diffAgainstHub(text, publishable);
        published = diff.newRows;
        skipped = diff.skipped;
        if (picksGiven) {
          picks = cleanPicks(req.body.highlights, { adding: published, hub: hubRows(text), today: today() });
          // A pick's photo goes on the row before it is written, so the site
          // holds it in the list too.
          const withPhoto = new Map(photoUpdates(picks.items, published).map(r => [r.id, r]));
          published = published.map(r => withPhoto.get(r.id) ?? r);
        }
        if (!published.length) { finalCsv = text; break; }
        const nextCsv = appendRowsToCsv(text, published);
        try {
          await hub.putFile(CSV_PATH(), nextCsv, sha,
            `Publish from Content Desk: ${published.length} item(s)`);
          finalCsv = nextCsv;
          break;
        } catch (err) {
          if (!err.conflict || attempt === 1) throw err;
        }
      }
      if (!published.length && !skipped.length && !picksGiven) {
        return res.status(200).json({ ok: true, published: 0, skipped: 0 });
      }

      const now = clock();
      if (picksGiven) {
        // Her picks become the pins; the Exchange's other lists stay as they are.
        const file = await hub.fetchFile(FEATURED_PATH);
        await hub.putFile(FEATURED_PATH, featuredText(parseFeatured(file.text), picks.items), file.sha,
          `Highlight from Content Desk: ${picks.items.length} item(s)`);
      }

      // Stamp published_at — dupes too: they are already on the hub. The
      // GitHub commit above already succeeded, so a stamping failure here must
      // not report total failure — the rows are live either way. A pick's
      // photo lands on the desk's own row here as well.
      const reply = { ok: true, published: published.length, skipped: skipped.length };
      if (published.length || skipped.length) reply.csv = finalCsv;
      // The copy goes to Drive, not to a download (Kate, Oct 22): the list after
      // the write, filed in the team drive. A failed copy never fails the
      // publish; the receipt offers the download instead.
      if (published.length) {
        const name = copyName(now);
        try {
          const saved = await drive.saveFile({ folderId: copyFolder, name, contentType: 'text/csv', b64: Buffer.from(finalCsv, 'utf8').toString('base64') });
          reply.copy = { name, url: saved.url, folderUrl: saved.folderUrl };
        } catch (err) {
          console.error('exchange copy failed', err);
          reply.copyError = 'The copy did not reach Drive. Download it from the receipt.';
        }
      }
      if (picksGiven) reply.highlighted = picks.items.length;
      // The picks it could not pin yet because they go out with the next publish.
      if (onlyHighlight) reply.held = picks.dropped.filter(link => publishable.some(r => String(r.link ?? '').trim() === link));
      try {
        const stamped = [...published, ...skipped].map(row => markPublished(row, now));
        const photos = picksGiven ? photoUpdates(picks.items, all.filter(r => !stamped.some(s => s.id === r.id))) : [];
        if (stamped.length || photos.length) await writeRows([...stamped, ...photos]);
      } catch (err) {
        console.error('publish stamping failed', err);
        return res.status(200).json({
          ...reply,
          warning: 'Published. Some rows were not marked as published. Publish again to mark them; nothing goes out twice.',
        });
      }
      return res.status(200).json(reply);
    } catch (err) {
      console.error('publish failed', err);
      if (err.conflict) {
        return res.status(502).json({ ok: false, error: 'The Exchange changed while this publish was running. Run the check again and publish once more.' });
      }
      const message = /GITHUB_TOKEN|GitHub/.test(err.message)
        ? "Couldn't reach the Exchange on GitHub. Check the GITHUB_TOKEN setup."
        : "Couldn't reach the sheet.";
      return res.status(502).json({ ok: false, error: message });
    }
  };
}

export default createPublishHandler({ readAllRows, updateRows });
