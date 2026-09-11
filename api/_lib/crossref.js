/**
 * DOI lookup through Crossref, for journal pages that turn the desk's reader
 * away (SAGE, MIT Press: 7 of the 11 research links in the Sep 10 queue).
 * Crossref knows the title, authors, date, and journal from the DOI alone, so
 * the reader files from that text instead of leaving "Verify link" on a link
 * that works for people (usability run F12).
 */
const DOI_IN_URL = /\b(10\.\d{4,9}\/[^\s/?#"'<>]+)/;
const CROSSREF = 'https://api.crossref.org/works/';
const TIMEOUT_MS = 8000;

/** The DOI inside a doi.org or publisher link, or ''. */
export function doiFromUrl(url) {
  const m = DOI_IN_URL.exec(String(url ?? ''));
  return m ? m[1].replace(/[.,;)]+$/, '') : '';
}

const stripJats = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const pad = n => String(n).padStart(2, '0');
function dateFromParts(parts) {
  const p = Array.isArray(parts?.[0]) ? parts[0] : [];
  if (!p.length) return '';
  return [String(p[0]), ...p.slice(1, 3).map(pad)].join('-');
}

/** Crossref's record as plain "Field: value" lines the reader can file from; '' when unknown. */
export async function crossrefText(doi, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(CROSSREF + encodeURIComponent(doi), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'ERC Content Desk (metadata reader; mailto:kl.barnestn@gmail.com)' },
    });
    if (!res.ok) return '';
    const m = (await res.json())?.message ?? {};
    const lines = [];
    const title = stripJats(m.title?.[0]);
    if (title) lines.push(`Title: ${title}`);
    const authors = (m.author ?? []).map(a => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean);
    if (authors.length) lines.push(`Authors: ${authors.join(', ')}`);
    const date = dateFromParts(m.issued?.['date-parts']) || dateFromParts(m.published?.['date-parts']);
    if (date) lines.push(`Published: ${date}`);
    const journal = stripJats(m['container-title']?.[0]);
    if (journal) lines.push(`Journal: ${journal}`);
    if (m.publisher) lines.push(`Publisher: ${stripJats(m.publisher)}`);
    const abstract = stripJats(m.abstract);
    if (abstract) lines.push(`Abstract: ${abstract}`);
    return lines.join('\n');
  } catch {
    return '';
  }
}
