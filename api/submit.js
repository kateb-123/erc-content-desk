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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, errors: ['Use POST.'] });
    return;
  }

  const { content = '', submitter = '', note = '' } = req.body || {};

  const errors = validateSubmission({ content, submitter });
  if (String(content).length > MAX_CONTENT_LENGTH) {
    errors.push(`Keep it under ${MAX_CONTENT_LENGTH} characters.`);
  }
  if (errors.length) {
    res.status(400).json({ ok: false, errors });
    return;
  }

  const id = randomUUID();
  try {
    await appendRow(buildSubmission({
      content, submitter, note, id, submittedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('submit failed', err);
    res.status(502).json({ ok: false, errors: ["Couldn't save that. Try again in a moment."] });
    return;
  }

  res.status(200).json({ ok: true, id });
}
