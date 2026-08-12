/**
 * Turning whatever someone pasted into a row. This runs before any Claude call,
 * so it stays deliberately dumb: keep the text verbatim, pull out a URL if one
 * is obviously there, and leave every CSV field blank for the Process step.
 */

import { blankRow } from './schema.js';

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/;

export function validateSubmission({ content, submitter } = {}) {
  const errors = [];
  const normalizedContent = (content ?? '');
  const normalizedSubmitter = (submitter ?? '');
  if (!String(normalizedContent).trim()) errors.push('Add a link or paste some text.');
  if (!String(normalizedSubmitter).trim()) errors.push('Add your name.');
  return errors;
}

export function buildSubmission({ content, submitter, note = '', submittedAt, id }) {
  const normalizedContent = (content ?? '');
  const normalizedSubmitter = (submitter ?? '');
  const normalizedNote = (note ?? '');
  const text = String(normalizedContent).trim();
  const match = text.match(URL_PATTERN);
  let url = match ? match[0] : '';
  // Strip trailing punctuation that can end a sentence but not a URL
  if (url) {
    url = url.replace(/[.,;:!?\]]+$/, '');
  }
  return blankRow({
    id,
    status: 'new',
    submitter: String(normalizedSubmitter).trim(),
    submitted_at: submittedAt,
    note: String(normalizedNote).trim(),
    original_text: text,
    link: url,
  });
}
