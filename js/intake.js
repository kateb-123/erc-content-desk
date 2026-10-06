/**
 * Submit-form fields -> validated v2 row. The form is structured now (title /
 * blurb / link / type / subtype / spotlight / name), so there is no URL
 * sniffing — what the submitter typed is what we store. original_text keeps
 * the blurb verbatim so extraction can never lose anything.
 */
import { blankRow, isValidType, isValidSubtype } from './schema.js';
import { isSafeLink } from './links.js';

const s = v => String(v ?? '').trim();

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validateSubmission(
  { title, blurb, link, type, subtype, submitter, submitter_email, date, deadline } = {},
  { allowBlankSubtype = false, requireEmail = false } = {},
) {
  const errors = [];
  if (requireEmail && !s(submitter_email)) errors.push('Add your email address.');
  if (s(submitter_email) && !/^\S+@\S+\.\S+$/.test(s(submitter_email))) {
    errors.push("That email address doesn't look right.");
  }
  if (!s(link)) errors.push('Add a link.');
  else if (!isSafeLink(link)) errors.push('The link needs to start with http:// or https://.');
  if (s(type) && !isValidType(s(type))) errors.push('Pick a type.');
  else if (!s(type) && s(subtype)) errors.push('Pick a type before a subtype.');
  else if (s(type) && !(allowBlankSubtype && !s(subtype)) && !isValidSubtype(s(type), s(subtype))) {
    errors.push('Pick a subtype.');
  }
  if (!s(submitter)) errors.push('Add your name or initials.');
  // Quick add's Date field (Kate, Oct 6): a date input sends YYYY-MM-DD; anything else is refused.
  if (s(date) && !ISO_DAY.test(s(date))) errors.push('The date needs to be a full date.');
  if (s(deadline) && !ISO_DAY.test(s(deadline))) errors.push('The deadline needs to be a full date.');
  return errors;
}

export function buildSubmission({
  title, blurb, link, type, subtype, spotlight, submitter, submitter_email,
  infographic, original_text, submittedAt, id, date, deadline,
} = {}) {
  return blankRow({
    id,
    status: 'new',
    headline: s(title),
    blurb: s(blurb),
    // A spreadsheet's extra columns ride here, not in the description.
    original_text: s(original_text) || s(blurb),
    link: s(link),
    type: s(type),
    subtype: s(subtype),
    spotlight_request: Boolean(spotlight),
    submitter: s(submitter),
    submitter_email: s(submitter_email),
    infographic: s(infographic),
    date: s(date),
    deadline: s(deadline),
    submitted_at: submittedAt,
  });
}

/**
 * Which form field a validation message is about, so the form can mark it
 * and put focus there: 'link', 'submitter', 'submitter_email', 'type', or
 * '' for a message about nothing in particular.
 */
export function fieldFor(message) {
  const m = String(message ?? '').toLowerCase();
  if (m.includes('email')) return 'submitter_email';
  if (m.includes('link')) return 'link';
  if (m.includes('name or initials')) return 'submitter';
  if (m.includes('date') || m.includes('deadline')) return 'date';
  if (m.includes('type')) return 'type';
  return '';
}
