/**
 * Submit-form fields -> validated v2 row. The form is structured now (title /
 * blurb / link / type / subtype / spotlight / name), so there is no URL
 * sniffing — what the submitter typed is what we store. original_text keeps
 * the blurb verbatim so extraction can never lose anything.
 */
import { blankRow, isValidType, isValidSubtype } from './schema.js';

const s = v => String(v ?? '').trim();

export function validateSubmission({ title, blurb, link, type, subtype, submitter } = {}) {
  const errors = [];
  if (!s(title)) errors.push('Add a title.');
  if (!s(link)) errors.push('Add a link.');
  if (!isValidType(s(type))) errors.push('Pick a type.');
  else if (!isValidSubtype(s(type), s(subtype))) errors.push('Pick a subtype.');
  if (!s(blurb) && s(type) !== 'headline') {
    errors.push('Add a blurb — headlines are the only type that can skip it.');
  }
  if (!s(submitter)) errors.push('Add your name or initials.');
  return errors;
}

export function buildSubmission({
  title, blurb, link, type, subtype, spotlight, submitter, submittedAt, id,
} = {}) {
  return blankRow({
    id,
    status: 'new',
    headline: s(title),
    blurb: s(blurb),
    original_text: s(blurb),
    link: s(link),
    type: s(type),
    subtype: s(subtype),
    spotlight_request: Boolean(spotlight),
    submitter: s(submitter),
    submitted_at: submittedAt,
  });
}
