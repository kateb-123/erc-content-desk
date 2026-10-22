/**
 * The paper read (Kate, Oct 22, 2026: "id rather it read it and filled it
 * in"): the browser hands over the paper's first pages as text, the model
 * answers with the title, the authors, the journal, the year and the first
 * author's last name, and the New brief form fills its empty boxes with them.
 * Pure: the prompt and the shape of what comes back. api/briefs.js makes the
 * call.
 */

/** How much of the paper the model is shown: the first pages hold everything asked for. */
export const PAPER_TEXT_MAX = 12000;

/** The shape the model is held to (output_config json_schema, like every other model call on the desk), so a fence or a preface can never break the parse. */
export const PAPER_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    authors: { type: 'string' },
    journal: { type: 'string' },
    year: { type: 'string' },
    firstAuthorLast: { type: 'string' },
  },
  required: ['title', 'authors', 'journal', 'year', 'firstAuthorLast'],
  additionalProperties: false,
};

const cap = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function buildPaperPrompt(text) {
  const shown = String(text ?? '').slice(0, PAPER_TEXT_MAX);
  return [
    'Below is the text of the first pages of a research paper. Read it and answer with ONE JSON object and nothing else, with these keys:',
    '"title": the paper\'s title, as printed, without a trailing period;',
    '"authors": the authors as the paper lists them, first name then last name, separated by commas, "and" before the last one (for example "Brian Holzman, Jeehee Han and Irina Chukhray");',
    '"journal": the journal or series the paper appears in, if the pages say so (a working paper, a job market paper or a preprint has none: use "");',
    '"year": the four-digit year of publication, or of the version shown, as a string, or "" if the pages do not say;',
    '"firstAuthorLast": the first author\'s last name only.',
    'Use "" for anything the pages do not say. Never guess a journal. Do not add keys.',
    '',
    'PAPER TEXT:',
    shown,
  ].join('\n');
}

/** The first author's last name from an authors line, when the model left it out. */
function lastNameFrom(authors) {
  const first = String(authors ?? '').split(/\s*(?:,|;|\band\b|&)\s*/)[0]?.trim() ?? '';
  if (!first) return '';
  const words = first.split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  // "Holzman, B." arrives as "Holzman" after the split; "Andrew Avitabile" wants its last word.
  return words[words.length - 1].replace(/[^A-Za-zÀ-ɏ'-]/g, '');
}

export function normalizePaperFields(json) {
  const got = json && typeof json === 'object' ? json : {};
  const year = cap(got.year, 10);
  const authors = cap(got.authors, 500);
  return {
    title: cap(got.title, 500).replace(/\.$/, ''),
    authors,
    journal: cap(got.journal, 200),
    year: /^\d{4}$/.test(year) && Number(year) >= 1950 && Number(year) <= 2100 ? year : '',
    firstAuthorLast: cap(got.firstAuthorLast, 80) || lastNameFrom(authors),
  };
}
