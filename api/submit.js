/**
 * POST /api/submit — public, unauthenticated by design.
 * Saves the row at once, marked pending_read, and answers. The reader then
 * opens the link, fills the blank fields, and cleans a pasted announcement in
 * the background (waitUntil), before the row can reach a Sort card (Kate,
 * Sep 10: "I don't want someone to wait as it does it when they submit").
 * A reading that fails leaves the row pending; Sort's catch-up reads it again.
 */
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { waitUntil } from '@vercel/functions';
import { buildSubmission, validateSubmission } from '../js/intake.js';
import { fetchPageText } from './_lib/fetch-page.js';
import { readRow, extractWithClaude } from './_lib/reader.js';
import { appendRow, updateRow, readAllRows } from './_lib/store.js';
import { setCors } from './_lib/cors.js';
import { checkRequest } from './_lib/turnstile.js';

export const config = { maxDuration: 60 };

const MAX_FIELD_LENGTH = 20000;

/** Built over its dependencies so the tests can hand in fakes. */
export function createSubmitHandler(deps) {
  async function readAndSave(row) {
    try {
      const read = await deps.readRow(row);
      // Home's queue can delete a row while it is being read; never bring it back.
      const now = deps.currentRow ? await deps.currentRow(row.id) : row;
      if (!now || now.status !== row.status || now.pending_read !== 'yes') return;
      await deps.updateRow(read);
    } catch (err) {
      console.error('reader failed; the row stays pending for Sort', row.id, err);
    }
  }

  return async function handler(req, res) {
    // The public share page is served from another origin, so the browser
    // preflights this POST — answer it before anything else.
    setCors(req, res);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, errors: ['Use POST.'] });
    }
    // Cross-origin callers (the public share page) must carry a Turnstile token.
    const refused = await deps.checkRequest(req);
    if (refused) return res.status(403).json({ ok: false, errors: [refused] });
    try {
      const body = req.body ?? {};
      for (const key of ['title', 'blurb', 'original_text', 'link', 'type', 'subtype', 'spotlight', 'submitter', 'submitter_email', 'infographic']) {
        if (String(body[key] ?? '').length > MAX_FIELD_LENGTH) {
          return res.status(400).json({ ok: false, errors: ['That submission is too long.'] });
        }
      }
      // A body carrying submitter_email is the public page's — email required there.
      const errors = validateSubmission(body, {
        allowBlankSubtype: true, requireEmail: 'submitter_email' in body,
      });
      const media = String(body.infographic ?? '');
      if (media && !media.startsWith('https://raw.githubusercontent.com/')) {
        errors.push('That media upload did not come from this form.');
      }
      if (errors.length) return res.status(400).json({ ok: false, errors });

      const row = {
        ...buildSubmission({ ...body, id: randomUUID(), submittedAt: new Date().toISOString() }),
        pending_read: 'yes',
      };
      await deps.appendRow(row);
      deps.defer(readAndSave(row));
      return res.status(200).json({ ok: true, id: row.id, warnings: [] });
    } catch (err) {
      console.error('submit failed', err);
      return res.status(502).json({ ok: false, errors: ["Couldn't save that. Try again in a moment."] });
    }
  };
}

const anthropic = new Anthropic({ timeout: 20_000, maxRetries: 1 });
const extract = extractWithClaude(anthropic);

export default createSubmitHandler({
  appendRow,
  updateRow,
  readRow: row => readRow(row, { fetchPage: fetchPageText, extract }),
  currentRow: async id => (await readAllRows()).find(r => r.id === id),
  defer: waitUntil,
  checkRequest,
});
