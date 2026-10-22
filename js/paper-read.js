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
  }).catch(err => {
    pdfjsLoading = undefined;   // a blip on the first try must not fail every PDF after it
    throw err;
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

/**
 * One page of a PDF as a PNG (a data URL's base64), for the crops of the
 * paper's tables and figures (round 2). Drawn at twice the page's size so the
 * Word doc's side-by-side stays sharp. Browser only.
 */
/** What the desk's figure door takes, as base64: 1.5 MB of PNG. A scanned page at 2x can pass it, so the cut is drawn smaller until it fits (review, Oct 22). */
export const CROP_B64_MAX = 1.5 * 1024 * 1024 * 4 / 3;
const CROP_SCALES = [2, 1.5, 1.2, 1];

/**
 * The part of a drawn page to keep (Kate, Oct 22: the model marks the box,
 * the desk cuts it): the read's box widened by a margin on each side, in the
 * drawn page's pixels, held to the page. No box keeps the whole page.
 */
export function cropRect({ width, height }, box, margin = 0.015) {
  if (!box) return { x: 0, y: 0, w: width, h: height };
  const x = Math.floor(Math.max(0, box.left - margin) * width);
  const y = Math.floor(Math.max(0, box.top - margin) * height);
  const x2 = Math.ceil(Math.min(1, box.right + margin) * width);
  const y2 = Math.ceil(Math.min(1, box.bottom + margin) * height);
  return { x, y, w: x2 - x, h: y2 - y };
}

/** One table or figure cut out of the paper as a PNG, base64: the page drawn with pdf.js, then the box kept. */
export async function pagePng(bytes, pageNumber, { pdfjs = loadPdfjs, scales = CROP_SCALES, maxB64 = CROP_B64_MAX, box = null } = {}) {
  const lib = await pdfjs();
  // pdf.js hands the buffer to its worker and leaves the caller's copy detached, so each page gets a copy of its own.
  const doc = await lib.getDocument({ data: bytes.slice() }).promise;
  // A page the paper does not have is refused, never cut from the last page instead (review, Oct 22).
  if (!(pageNumber >= 1)) throw new Error('no page given for this one');
  if (pageNumber > doc.numPages) throw new Error(`page ${pageNumber} is past the paper's ${doc.numPages} pages`);
  const page = await doc.getPage(pageNumber);
  let b64 = '';
  for (const scale of scales) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const r = cropRect(canvas, box);
    const cut = document.createElement('canvas');
    cut.width = r.w;
    cut.height = r.h;
    cut.getContext('2d').drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    b64 = cut.toDataURL('image/png').split(',')[1] ?? '';
    if (b64.length <= maxB64) break;
  }
  return b64;
}

/** The proposed chart as a PNG, base64, for the figures folder and the author's Word doc: the SVG drawn at twice its size on white. */
export async function svgPng(svg, { scale = 2 } = {}) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error("couldn't draw the chart")); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(img.width * scale);
    canvas.height = Math.ceil(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

const blank = value => !String(value ?? '').trim();

/**
 * Which boxes the paper's answer may fill: the empty ones, and the ones the
 * desk itself filled from an earlier PDF (readFilled: box to the value it
 * wrote), so choosing the right paper after the wrong one refills them. The
 * year box starts with this year typed in, so the paper's year may replace
 * that default. Nothing she typed or changed is touched.
 */
export function fillFromPaper(found, current, { defaultYear = '', readFilled = {} } = {}) {
  const out = {};
  if (!found) return out;
  const open = key => blank(current[key]) || (readFilled[key] != null && String(current[key]).trim() === String(readFilled[key]).trim());
  if (found.title && open('paperTitle')) out.paperTitle = found.title;
  if (found.authors && open('authors')) out.authors = found.authors;
  if (found.journal && open('journal')) out.journal = found.journal;
  if (found.year && (open('year') || String(current.year).trim() === String(defaultYear))) out.year = found.year;
  if (found.firstAuthorLast && open('authorLast')) out.authorLast = found.firstAuthorLast;
  return out;
}
