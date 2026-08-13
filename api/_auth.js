/**
 * Shared desk password gate for the internal API routes (/api/sheet,
 * /api/process). /api/submit is intentionally exempt — it's the public,
 * append-only intake endpoint the /submit page depends on.
 *
 * The leading underscore keeps Vercel from turning this into its own
 * Serverless Function.
 */

export function checkDeskPassword(req, res) {
  // Read at request time, never at import time, so a cold start always sees
  // the current value and nothing gets cached across requests.
  const expected = process.env.DESK_PASSWORD;
  if (!expected) {
    console.error('DESK_PASSWORD is not set — refusing desk API requests until it is configured.');
    res.status(401).json({ ok: false, error: "The desk password isn't set up yet. Contact the site owner." });
    return false;
  }
  const provided = req.headers['x-desk-password'];
  if (provided !== expected) {
    res.status(401).json({ ok: false, error: 'Wrong password.' });
    return false;
  }
  return true;
}
