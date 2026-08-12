/**
 * Turning whatever someone pasted into a row. This runs before any Claude call,
 * so it stays deliberately dumb: keep the text verbatim, pull out a URL if one
 * is obviously there, and leave every CSV field blank for the Process step.
 */

import { blankRow } from './schema.js';

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/;

export function validateSubmission({ content = '', submitter = '' } = {}) {
  const errors = [];
  if (!String(content).trim()) errors.push('Add a link or paste some text.');
  if (!String(submitter).trim()) errors.push('Add your name.');
  return errors;
}

export function buildSubmission({ content, submitter, note = '', submittedAt, id }) {
  const text = String(content).trim();
  const match = text.match(URL_PATTERN);
  return blankRow({
    id,
    status: 'new',
    submitter: String(submitter).trim(),
    submitted_at: submittedAt,
    note: String(note).trim(),
    original_text: text,
    link: match ? match[0] : '',
  });
}
