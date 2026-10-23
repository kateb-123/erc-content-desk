/**
 * Report a problem (Kate, Oct 22, 2026, the handoff: "a submit issue ... that
 * gets sent to my personal email so that way I can help"). Her pick: a Google
 * Form in her personal Drive, whose answers land in a Sheet there and email
 * her. The desk only links to it, with the page filled in. Until the form's
 * pre-filled link is pasted below, the link does not show: no dead ends.
 *
 * To set it: in the form, ⋮ then "Get pre-filled link", type PAGE in the
 * "Which page?" question, "Get link", copy it, and paste it here.
 */
export const PROBLEM_FORM_URL = '';

/** The form's address with the page filled in, or '' while there is no form. */
export function problemHref(page, base = PROBLEM_FORM_URL) {
  if (!base) return '';
  return base.includes('PAGE') ? base.replace('PAGE', encodeURIComponent(page)) : base;
}
