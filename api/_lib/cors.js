/**
 * CORS for the newsletter builder's endpoints. GitHub Pages today; the
 * Vercel address joins the list when the builder moves. localhost is for
 * dev against the sandbox.
 */
const ALLOWED_ORIGINS = new Set(['https://kateb-123.github.io']);

export function setCors(req, res) {
  const origin = String(req.headers?.origin ?? '');
  if (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}
