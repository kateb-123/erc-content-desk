/**
 * CORS for the endpoints public pages call: /api/submit + /api/newsletter-image
 * for the public share page, which lives in the Policy Exchange hub repo
 * (the Exchange's /share/). Cross-origin callers also need a Turnstile token
 * (turnstile.js). localhost is for dev against the sandbox.
 *
 * The Exchange is served from two hosts while it moves off GitHub Pages
 * (Sep 9, 2026): both are the same repo, so both are listed.
 */
const ALLOWED_ORIGINS = new Set([
  'https://kateb-123.github.io',            // the hub on GitHub Pages
  'https://erc-policy-exchange.vercel.app', // the hub on Vercel
]);

export function setCors(req, res) {
  const origin = String(req.headers?.origin ?? '');
  if (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}
