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

export function isLocalOrigin(origin) {
  return /^http:\/\/localhost(:\d+)?$/.test(origin);
}

export function setCors(req, res) {
  const origin = String(req.headers?.origin ?? '');
  if (ALLOWED_ORIGINS.has(origin) || isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

/** The CORS headers, plus the browser's preflight answered: true when this
 *  request WAS the preflight and the handler should stop here. */
export function preflight(req, res, methods = 'POST') {
  setCors(req, res);
  if (req.method !== 'OPTIONS') return false;
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
  return true;
}
