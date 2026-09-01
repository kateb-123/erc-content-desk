/**
 * Link safety. /submit is public, so a submitted link is untrusted input: it
 * reaches the desk, the newsletter HTML, and the public Exchange. Only http(s)
 * URLs are ever treated as links; everything else is dropped rather than
 * rendered as a clickable control.
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

export function isSafeLink(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    return SAFE_PROTOCOLS.has(new URL(trimmed).protocol);
  } catch {
    return false;   // relative, schemeless, or unparseable
  }
}

/** The link when it is safe to use as an href, otherwise an empty string. */
export function safeHref(value) {
  return isSafeLink(value) ? String(value).trim() : '';
}

/**
 * A schemeless link typed by a person ("wested.org/report") gets https://
 * put in front; anything already carrying a scheme passes through untouched
 * for isSafeLink to judge.
 */
export function withScheme(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;
}
