/**
 * Reading the paper in the browser (Kate, Oct 22, 2026: "id rather it read it
 * and filled it in"). pdf.js, loaded from cdnjs only when a PDF is chosen,
 * gives the first pages as text; the desk's /api/briefs read action asks the
 * model for the title, authors, journal and year; fillFromPaper decides which
 * boxes may take them: the empty ones, never what she typed.
 */

export const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
export const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
/** The title, the authors, the journal and the year are on the first page or two. */
export const PAPER_PAGES = 2;
export const PAPER_TEXT_CAP = 8000;

/** Is there room for a space between two items on a line? Without geometry, assume a word break; with it, a gap past a sliver of the font size. */
function gapBetween(a, b) {
  const ta = a?.transform, tb = b?.transform;
  if (!Array.isArray(ta) || !Array.isArray(tb)) return true;
  const endA = Number(ta[4]) + (Number(a.width) || 0);
  const size = Math.abs(Number(ta[0])) || 10;
  return Number(tb[4]) - endA > size * 0.15;
}

/** pdf.js text items as lines: a break where it marks the end of one, a space where two items stand apart, blanks squeezed. */
export function pageText(items) {
  let out = '';
  let prev = null;
  for (const item of items ?? []) {
    const str = String(item?.str ?? '');
    if (str) {
      if (prev && !/\s$/.test(out) && !/^\s/.test(str) && gapBetween(prev, item)) out += ' ';
      out += str;
      prev = item;
    }
    if (item?.hasEOL) { out += '\n'; prev = null; }
  }
  return out.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

let pdfjsLoading;
/** The library, once: it is 350 KB, so it loads only when a PDF is chosen. */
function loadPdfjs() {
  pdfjsLoading ??= import(/* webpackIgnore: true */ PDFJS_URL).then(lib => {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return lib;
  });
  return pdfjsLoading;
}

/** The first pages of a PDF as text, capped. Throws when the file cannot be read as a PDF. */
export async function paperText(file, { pdfjs = loadPdfjs } = {}) {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data }).promise;
  const pages = [];
  for (let n = 1; n <= Math.min(PAPER_PAGES, doc.numPages); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(pageText(content.items));
  }
  return pages.join('\n\n').slice(0, PAPER_TEXT_CAP);
}

const blank = value => !String(value ?? '').trim();

/**
 * Which boxes the paper's answer may fill: the empty ones. The year box
 * starts with this year typed in, so the paper's year may replace that
 * default and nothing else she set.
 */
export function fillFromPaper(found, current, { defaultYear = '' } = {}) {
  const out = {};
  if (!found) return out;
  if (found.title && blank(current.paperTitle)) out.paperTitle = found.title;
  if (found.authors && blank(current.authors)) out.authors = found.authors;
  if (found.journal && blank(current.journal)) out.journal = found.journal;
  if (found.year && (blank(current.year) || String(current.year).trim() === String(defaultYear))) out.year = found.year;
  if (found.firstAuthorLast && blank(current.authorLast)) out.authorLast = found.firstAuthorLast;
  return out;
}
