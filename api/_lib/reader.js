/**
 * The reader: files a submitted row after it is saved (Kate, Sep 10: "I don't
 * want someone to wait as it does it when they submit, but definitely before
 * it gets to the card"). It opens the link, asks the model to fill the blank
 * columns, swaps a pasted event or opportunity announcement for a clean
 * description (the paste stays in original_text), and clears pending_read.
 * A failed model call throws, so the row stays pending and Sort's catch-up
 * reads it again.
 */
import { applyExtractedWithProvenance, linkCheckedFromFetch } from '../../js/workflow.js';
import {
  EXTRACT_MODEL, EXTRACTION_SCHEMA, CLEAN_TYPES,
  buildExtractionPrompt, parseExtraction, normalizeExtraction,
} from './extract.js';

export async function readRow(row, { fetchPage, extract }) {
  let pageText = '';
  if (row.link) {
    try { pageText = await fetchPage(row.link); } catch { pageText = ''; }
  }
  let next = row.link ? { ...row, link_checked: linkCheckedFromFetch(pageText) } : { ...row };
  let read = normalizeExtraction(await extract(next, pageText), next);
  if (pageText && read.linkMismatch) {
    // The page is a different item: mark the link for a human and read
    // again from the submitted text alone, so nothing of that page is filed.
    next = { ...next, link_checked: 'mismatch' };
    read = normalizeExtraction(await extract(next, ''), next);
  }
  const { fields, needsReview, cleanBlurb } = read;
  next = applyExtractedWithProvenance(next, fields).row;
  const pasted = Boolean(String(row.original_text || row.blurb || '').trim());
  if (cleanBlurb && pasted && CLEAN_TYPES.includes(next.type)) next = { ...next, blurb: cleanBlurb };
  return { ...next, needs_review: needsReview ? 'yes' : '', pending_read: '' };
}

/** The production extract: one Haiku call, parsed. */
export function extractWithClaude(anthropic) {
  return async (row, pageText) => {
    const response = await anthropic.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 2048,
      output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      messages: [{ role: 'user', content: buildExtractionPrompt(row, pageText) }],
    });
    return parseExtraction(response.content.find(b => b.type === 'text')?.text ?? '');
  };
}
