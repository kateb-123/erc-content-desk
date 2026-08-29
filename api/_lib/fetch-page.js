/**
 * Fetches the page behind a submission link so extraction can read it.
 * The pure helpers are offline-testable; fetchPageText takes an injectable
 * fetch so tests never touch the network. Any failure returns '' —
 * enrichment is best-effort by design.
 *
 * DNS is checked per hop before connecting: each redirect is followed
 * manually and its new host is re-validated (isFetchableUrl + resolvesPublic)
 * before it is fetched. A time-of-check/time-of-use rebinding window remains
 * (DNS could re-resolve to a private address between the check and the
 * connect) and is accepted for this deployment.
 */

import { lookup } from 'node:dns/promises';

const MAX_PAGE_CHARS = 12000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_CHARS = 1_000_000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

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

function isPrivateIPv4(addr) {
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(addr) {
  const a = addr.toLowerCase();
  if (a === '::1' || a === '::') return true;
  if (a.startsWith('fe80:') || /^fe[89ab][0-9a-f]:/.test(a)) return true; // fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(a)) return true; // fc00::/7 (fc00-fdff)
  const mapped = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

/** True only if DNS resolves to at least one address and every address is public. */
export async function resolvesPublic(host, lookupImpl = lookup) {
  try {
    const results = await lookupImpl(host, { all: true });
    if (!Array.isArray(results) || results.length === 0) return false;
    return results.every(({ address, family }) =>
      family === 6 ? !isPrivateIPv6(address) : !isPrivateIPv4(address));
  } catch {
    return false;
  }
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

/** Best-effort page text; '' on any failure. Follows redirects manually, re-validating each hop. */
export async function fetchPageText(url, fetchImpl = fetch, lookupImpl) {
  try {
    let current = String(url ?? '');
    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      if (!isFetchableUrl(current)) return '';
      const parsed = new URL(current);
      if (!(await resolvesPublic(parsed.hostname, lookupImpl))) return '';

      const res = await fetchImpl(current, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'manual',
        headers: { 'User-Agent': 'ERC Content Desk (metadata reader)' },
      });

      if (REDIRECT_STATUSES.has(res.status)) {
        const location = res.headers.get('location');
        if (!location) return '';
        current = new URL(location, current).toString();
        continue;
      }

      if (!res.ok) return '';
      const type = String(res.headers.get('content-type') ?? '');
      if (!/text\/html|text\/plain|application\/xhtml/.test(type)) return '';
      const body = (await res.text()).slice(0, MAX_RESPONSE_CHARS);
      const text = /html/.test(type) ? pageTextFromHtml(body) : body.replace(/\s+/g, ' ').trim();
      return truncateForPrompt(text);
    }
    return '';
  } catch {
    return '';
  }
}
