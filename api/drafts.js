/**
 * /api/drafts: the builder's discarded drafts, kept in the desk's private
 * database for 90 days (Kate, Sep 23, 2026).
 *
 *   POST   { issueDate, draft }  keep one; answers { ok, draft: entry }
 *   GET                          { ok, drafts: [entry] }, newest first, after
 *                                dropping any older than 90 days
 *   GET    ?id=                  { ok, draft: { ...entry, body } }
 *   DELETE ?id=                  { ok, removed }
 *
 * An entry is { id, issueDate, discardedAt, items }. Database only: in Sheet
 * mode, or before scripts/ensure-schema.js has made the table, every call
 * answers with a plain error saying kept drafts need the database. The
 * endpoint never creates the table itself.
 */
import { preflight } from './_lib/cors.js';
import { pickMode } from './_lib/store.js';
import { liveQuery } from './_lib/db.js';
import { createDrafts, isMissingTable, NEEDS_DB, NO_TABLE } from './_lib/drafts.js';

const MAX_DRAFT_CHARS = 1024 * 1024;
const MAX_ID_LENGTH = 100;

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Built over its dependencies so the tests can hand in fakes. */
export function createDraftsHandler({ mode, drafts }) {
  return async function handler(req, res) {
    if (preflight(req, res, 'GET, POST, DELETE')) return;
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
      return res.status(405).json({ ok: false, error: 'Use GET, POST or DELETE.' });
    }
    if (mode() !== 'db') return res.status(503).json({ ok: false, error: NEEDS_DB });

    const id = String(req.query?.id ?? '').slice(0, MAX_ID_LENGTH);
    try {
      if (req.method === 'POST') {
        const draft = req.body?.draft;
        const issueDate = String(req.body?.issueDate ?? '');
        if (!isPlainObject(draft) || !isPlainObject(draft.sections)) {
          return res.status(400).json({ ok: false, error: 'Nothing to keep. The draft came through empty.' });
        }
        if (issueDate && !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
          return res.status(400).json({ ok: false, error: 'Pass issueDate as YYYY-MM-DD.' });
        }
        if (JSON.stringify(draft).length > MAX_DRAFT_CHARS) {
          return res.status(400).json({ ok: false, error: 'That draft is too big to keep.' });
        }
        return res.status(200).json({ ok: true, draft: await drafts().save({ issueDate, body: draft }) });
      }

      if (req.method === 'DELETE') {
        if (!id) return res.status(400).json({ ok: false, error: 'Pass the id of the draft to remove.' });
        return res.status(200).json({ ok: true, removed: await drafts().remove(id) });
      }

      if (id) {
        const draft = await drafts().get(id);
        if (!draft) return res.status(404).json({ ok: false, error: 'That draft is no longer on the desk.' });
        return res.status(200).json({ ok: true, draft });
      }
      return res.status(200).json({ ok: true, drafts: await drafts().list() });
    } catch (err) {
      if (isMissingTable(err)) return res.status(503).json({ ok: false, error: NO_TABLE });
      console.error('drafts failed', err);
      return res.status(502).json({ ok: false, error: "Couldn't reach the desk's database. Try again in a moment." });
    }
  };
}

let live;
export default createDraftsHandler({
  mode: () => pickMode(process.env),
  drafts: () => (live ??= createDrafts(liveQuery())),
});
