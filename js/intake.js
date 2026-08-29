/**
 * Submit-form fields -> validated v2 row. The form is structured now (title /
 * blurb / link / type / subtype / spotlight / name), so there is no URL
 * sniffing — what the submitter typed is what we store. original_text keeps
 * the blurb verbatim so extraction can never lose anything.
 */
import { blankRow, isValidType, isValidSubtype } from './schema.js';
import { isSafeLink } from './links.js';

const s = v => String(v ?? '').trim();

export function validateSubmission(
  { title, blurb, link, type, subtype, submitter } = {},
  { allowBlankSubtype = false } = {},
) {
  const errors = [];
  if (!s(link)) errors.push('Add a link.');
  else if (!isSafeLink(link)) errors.push('That link needs to be a normal web link (http or https).');
  if (s(type) && !isValidType(s(type))) errors.push('Pick a real type.');
  else if (!s(type) && s(subtype)) errors.push('Pick a type before a subtype.');
  else if (s(type) && !(allowBlankSubtype && !s(subtype)) && !isValidSubtype(s(type), s(subtype))) {
    errors.push('Pick a subtype.');
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
