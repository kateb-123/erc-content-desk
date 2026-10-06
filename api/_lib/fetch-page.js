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
/** Whole fetchPageText call (DNS + all hops) must finish inside this window,
 * well under Vercel's maxDuration, so a slow/malicious chain can't strand
 * the submission past the function timeout. */
const TOTAL_BUDGET_MS = 10000;

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
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 240) return true; // 240.0.0.0/4 (reserved)
  if (a === 255 && b === 255 && parts[2] === 255 && parts[3] === 255) return true; // 255.255.255.255
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

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = s => String(s ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

/** The page's own description tag (or og:description), decoded; '' when it
 *  has none. A paper's page often keeps its whole abstract there (Kate,
 *  Oct 6: "we want those abstracts"). */
export function pageDescription(html) {
  const tags = String(html ?? '').match(/<meta\b[^>]*>/gi) ?? [];
  const find = name => {
    for (const tag of tags) {
      const key = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];
      if (key?.toLowerCase() !== name) continue;
      const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1];
      if (content) return decode(content).replace(/\s+/g, ' ').trim();
    }
    return '';
  };
  return find('description') || find('og:description');
}

export function truncateForPrompt(text, cap = MAX_PAGE_CHARS) {
  return String(text ?? '').slice(0, cap);
}

/** Read a response body incrementally, stopping once it exceeds the char cap.
 * A response with no streaming body carries no text to read. Cancels the
 * reader once the cap is hit so the rest of the response is never buffered. */
async function readBodyCapped(res, cap) {
  if (!res.body || typeof res.body.getReader !== 'function') return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (text.length <= cap) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    try { await reader.cancel(); } catch { /* best-effort */ }
  }
  return text.slice(0, cap);
}

/** Best-effort page text; '' on any failure. */
export async function fetchPageText(url, fetchImpl = fetch, lookupImpl) {
  return (await fetchPage(url, fetchImpl, lookupImpl)).text;
}

const NO_PAGE = { text: '', description: '' };

/** Best-effort { text, description }: the page's readable text and its own
 *  description tag; both '' on any failure. Follows redirects manually,
 *  re-validating each hop. */
export async function fetchPage(url, fetchImpl = fetch, lookupImpl) {
  const startedAt = Date.now();
  const remainingBudget = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);
  try {
    let current = String(url ?? '');
    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      if (!isFetchableUrl(current)) return NO_PAGE;

      let remaining = remainingBudget();
      if (remaining <= 0) return NO_PAGE;
      if (!(await resolvesPublic(new URL(current).hostname, lookupImpl))) return NO_PAGE;

      remaining = remainingBudget();
      if (remaining <= 0) return NO_PAGE;
      const res = await fetchImpl(current, {
        signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, remaining)),
        redirect: 'manual',
        headers: { 'User-Agent': 'ERC Content Desk (metadata reader)' },
      });

      if (REDIRECT_STATUSES.has(res.status)) {
        const location = res.headers.get('location');
        if (!location) return NO_PAGE;
        current = new URL(location, current).toString();
        continue;
      }

      if (!res.ok) return NO_PAGE;
      const type = String(res.headers.get('content-type') ?? '');
      if (!/text\/html|text\/plain|application\/xhtml/.test(type)) return NO_PAGE;
      const contentLength = Number(res.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_CHARS) return NO_PAGE;
      const body = await readBodyCapped(res, MAX_RESPONSE_CHARS);
      const html = /html/.test(type);
      const text = html ? pageTextFromHtml(body) : body.replace(/\s+/g, ' ').trim();
      return { text: truncateForPrompt(text), description: html ? pageDescription(body) : '' };
    }
    return NO_PAGE;
  } catch {
    return NO_PAGE;
  }
}
