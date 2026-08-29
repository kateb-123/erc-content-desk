/**
 * Fetches the page behind a submission link so extraction can read it.
 * The pure helpers are offline-testable; fetchPageText takes an injectable
 * fetch so tests never touch the network. Any failure returns '' —
 * enrichment is best-effort by design.
 */

const MAX_PAGE_CHARS = 12000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_CHARS = 1_000_000;

/** http(s) only, and never localhost, .local, or a literal-IP host. */
export function isFetchableUrl(url) {
  let parsed;
  try { parsed = new URL(String(url ?? '')); } catch { return false; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(':')) return false;
  return true;
}

/** HTML -> readable text: drop scripts/styles/tags, decode common entities, collapse whitespace. */
export function pageTextFromHtml(html) {
  let text = String(html ?? '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/gi, '"');
  return text.replace(/\s+/g, ' ').trim();
}

export function truncateForPrompt(text, cap = MAX_PAGE_CHARS) {
  const s = String(text ?? '');
  return s.length <= cap ? s : s.slice(0, cap);
}

/** Best-effort page text; '' on any failure. */
export async function fetchPageText(url, fetchImpl = fetch) {
  if (!isFetchableUrl(url)) return '';
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
      headers: { 'User-Agent': 'ERC Content Desk (metadata reader)' },
    });
    if (!res.ok) return '';
    const type = String(res.headers.get('content-type') ?? '');
    if (!/text\/html|text\/plain|application\/xhtml/.test(type)) return '';
    const body = (await res.text()).slice(0, MAX_RESPONSE_CHARS);
    const text = /html/.test(type) ? pageTextFromHtml(body) : body.replace(/\s+/g, ' ').trim();
    return truncateForPrompt(text);
  } catch {
    return '';
  }
}
