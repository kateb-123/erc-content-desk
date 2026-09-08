/**
 * Cloudflare Turnstile for the two routes the public share page calls
 * (/api/submit and /api/newsletter-image). A request needs a token unless it
 * comes from the desk itself (same origin) or from localhost in dev, so the
 * desk's own forms and the builder are untouched. Tokens are single-use and
 * live five minutes; the page takes a fresh one per request.
 *
 * Fails closed: no secret configured, no token, or Cloudflare unreachable all
 * refuse the request. Anyone who forges the desk's Origin header still gets
 * in — the desk has no auth by Kate's rule; this stops bots driving the form.
 */
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;   // Cloudflare's stated ceiling
const TIMEOUT_MS = 8000;

export const REJECTED = "Couldn't confirm you're a person. Reload the page and try again.";

export function tokenRequired(req) {
  const origin = String(req.headers?.origin ?? '');
  const host = String(req.headers?.host ?? '');
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return false;
  return !origin || origin !== `https://${host}`;
}

export async function verifyToken(token, {
  secret = process.env.TURNSTILE_SECRET_KEY, remoteip = '', fetchImpl = fetch,
} = {}) {
  if (!secret) return { ok: false, codes: ['missing-input-secret'] };
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, codes: ['missing-input-response'] };
  }
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);
  try {
    const res = await fetchImpl(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const data = await res.json();
    return { ok: data.success === true, codes: data['error-codes'] ?? [] };
  } catch {
    return { ok: false, codes: ['internal-error'] };
  }
}

/** '' when the request may proceed; otherwise the message to send back. */
export async function checkRequest(req, options = {}) {
  if (!tokenRequired(req)) return '';
  const remoteip = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
  const { ok, codes } = await verifyToken(req.body?.turnstile_token, { remoteip, ...options });
  if (ok) return '';
  console.warn('turnstile refused', codes.join(','));
  return REJECTED;
}
