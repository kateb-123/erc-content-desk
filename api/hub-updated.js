/**
 * GET /api/hub-updated — when the Exchange's news.csv last changed.
 *
 * Home used to read this from the GitHub API in the browser. The Exchange
 * repo is private now, so that returns nothing; and the file is served
 * publicly by the Exchange itself, so ask that instead. It is the same
 * Last-Modified header the Exchange shows as "Updated", so the two agree.
 * A miss returns an empty string rather than an error: Home leaves a dash.
 */
const CSV_URL = process.env.HUB_CSV_URL
  || 'https://erc-policy-exchange.vercel.app/data/news.csv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, errors: ['Use GET.'] });
  }
  try {
    const upstream = await fetch(CSV_URL, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    const lastModified = upstream.ok ? (upstream.headers.get('last-modified') ?? '') : '';
    return res.status(200).json({ ok: true, lastModified });
  } catch {
    return res.status(200).json({ ok: true, lastModified: '' });
  }
}
