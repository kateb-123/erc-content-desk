/**
 * CORS for the endpoints public pages call: /api/submit + /api/newsletter-image
 * for the public share page, which lives in the Policy Exchange hub repo
 * (kateb-123.github.io/erc-policy-exchange/share/). Cross-origin callers also
 * need a Turnstile token (turnstile.js). localhost is for dev against the sandbox.
 */
const ALLOWED_ORIGINS = new Set([
  'https://kateb-123.github.io',   // the hub: the public share page
]);

export function setCors(req, res) {
  const origin = String(req.headers?.origin ?? '');
  if (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}
