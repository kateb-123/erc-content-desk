/**
 * GET  /api/publish — preview: what would be added vs skipped, against the
 *                     LIVE news.csv (the overwrite worry dies here), plus the
 *                     live rows that can be highlighted and the picks as
 *                     they stand.
 * POST /api/publish — append the new rows, commit, stamp published_at; then
 *                     commit her highlight picks (data/highlights.json) when
 *                     the body carries them.
 * Never modifies or deletes an existing hub row.
 *
 * Behind the desk password (Kate, Sep 23): both need a signed-in browser,
 * and the write asks for the password once more, in the body.
 */
import { readAllRows, updateRows } from './_lib/store.js';
import { readyToPublish, markPublished } from '../js/workflow.js';
import { isValidType, isValidSubtype } from '../js/schema.js';
import { isSafeLink } from '../js/links.js';
import { fetchHubFile, putHubFile, diffAgainstHub, appendRowsToCsv, parseCsv, csvLinks } from './_lib/hub.js';
import { HIGHLIGHTS_PATH, hubRows, parseHighlights, highlightsText, cleanPicks, describePicks, pickable, photoUpdates } from './_lib/highlights.js';
import { refuseUnlessSignedIn, refuseUnlessPassword } from './_lib/session.js';
import { todayCentral } from '../js/today.js';
import { PUBLISH_PAUSED } from '../js/flags.js';

export const config = { maxDuration: 300 };

const label = r => ({ id: r.id, headline: r.headline || r.link || r.id });
const CSV_PATH = () => process.env.HUB_CSV_PATH || 'data/news.csv';

/** Built over its dependencies so the tests can hand in fakes. */
export function createPublishHandler({
  readAllRows: readRows, updateRows: writeRows,
  hub = { fetchFile: fetchHubFile, putFile: putHubFile },
  session = {}, today = () => todayCentral(), clock = () => new Date().toISOString(),
}) {
  return async function handler(req, res) {
    try {
      if (await refuseUnlessSignedIn(req, res, session)) return;
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
        const [{ text }, picksFile] = await Promise.all([hub.fetchFile(CSV_PATH()), hub.fetchFile(HIGHLIGHTS_PATH)]);
        const { newRows, skipped } = diffAgainstHub(text, publishable);
        const live = hubRows(text);
        const picks = parseHighlights(picksFile.text);
        return res.status(200).json({
          ok: true,
          adding: newRows.map(label),
          skipped: skipped.map(label),
          notReady: notReady.map(label),
          hubCount: Math.max(parseCsv(text).length - 1, 0),
          liveLinks: [...csvLinks(text)],   // Sort's Already live group reads these (Kate, Sep 22)
          hub: pickable(live, today()),      // what the Exchange still shows, for the highlight step
          highlights: { updated: picks.updated, items: describePicks(picks.items, { adding: newRows, hub: live }) },
        });
      }

      // Her picks ride the body when the highlight step was on the page; an
      // absent list leaves the file alone.
      const picksGiven = Array.isArray(req.body?.highlights);

      // The CSV as it stands after this publish goes back in the response, so the
      // desk can hand Kate a copy to keep (Sep 9) without a second round trip.
      let published = [], skipped = [], finalCsv = '', picks = { items: [], dropped: [] };
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { text, sha } = await hub.fetchFile(CSV_PATH());
        if (sha === null) throw new Error('GitHub read failed: HTTP 404');   // nothing is ever published onto a missing list
        const diff = diffAgainstHub(text, publishable);
        published = diff.newRows;
        skipped = diff.skipped;
        if (picksGiven) {
          picks = cleanPicks(req.body.highlights, { adding: published, hub: hubRows(text) });
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
        const file = await hub.fetchFile(HIGHLIGHTS_PATH);
        await hub.putFile(HIGHLIGHTS_PATH, highlightsText(picks.items, now), file.sha,
          `Highlight from Content Desk: ${picks.items.length} item(s)`);
      }

      // Stamp published_at — dupes too: they are already on the hub. The
      // GitHub commit above already succeeded, so a stamping failure here must
      // not report total failure — the rows are live either way. A pick's
      // photo lands on the desk's own row here as well.
      const reply = { ok: true, published: published.length, skipped: skipped.length };
      if (published.length || skipped.length) reply.csv = finalCsv;
      if (picksGiven) reply.highlighted = picks.items.length;
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
