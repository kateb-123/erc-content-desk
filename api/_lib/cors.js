/**
 * CORS for the endpoints public pages call: the newsletter builder's, and
 * /api/submit + /api/newsletter-image for the public share page on Pages.
 * Vercel address joins the list when the builder moves. localhost is for
 * dev against the sandbox.
 */
const ALLOWED_ORIGINS = new Set([
  'https://kateb-123.github.io',   // the builder, when it lived on Pages
  'https://erc-kate.github.io',    // erc-tools: the public share page
]);

export function setCors(req, res) {
  const origin = String(req.headers?.origin ?? '');
  if (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}
