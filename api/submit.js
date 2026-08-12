/**
 * POST /api/submit — the public intake endpoint.
 *
 * Open by design: anyone with the link can add to the queue. It only appends a
 * row; it never reads the sheet back and never calls Claude, so the worst an
 * abusive caller can do is add junk rows that the team trashes.
 */

import { randomUUID } from 'node:crypto';
import { buildSubmission, validateSubmission } from '../js/intake.js';
import { appendRow } from '../lib/sheets.js';

const MAX_CONTENT_LENGTH = 20000;
const MAX_SUBMITTER_LENGTH = 200;
const MAX_NOTE_LENGTH = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, errors: ['Use POST.'] });
    return;
  }

  const bodyContent = req.body?.content ?? '';
  const bodySubmitter = req.body?.submitter ?? '';
  const bodyNote = req.body?.note ?? '';

  const errors = validateSubmission({ content: bodyContent, submitter: bodySubmitter });
  if (String(bodyContent).length > MAX_CONTENT_LENGTH) {
    errors.push(`Keep it under ${MAX_CONTENT_LENGTH} characters.`);
  }
  if (String(bodySubmitter).length > MAX_SUBMITTER_LENGTH) {
    errors.push(`Name must be under ${MAX_SUBMITTER_LENGTH} characters.`);
  }
  if (String(bodyNote).length > MAX_NOTE_LENGTH) {
    errors.push(`Note must be under ${MAX_NOTE_LENGTH} characters.`);
  }
  if (errors.length) {
    res.status(400).json({ ok: false, errors });
    return;
  }

  const id = randomUUID();
  try {
    await appendRow(buildSubmission({
      content: bodyContent, submitter: bodySubmitter, note: bodyNote, id, submittedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('submit failed', err);
    res.status(502).json({ ok: false, errors: ["Couldn't save that. Try again in a moment."] });
    return;
  }

  res.status(200).json({ ok: true, id });
}
