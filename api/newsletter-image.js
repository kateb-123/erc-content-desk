/**
 * POST /api/newsletter-image — the builder's picture upload: commit an image
 * into builder/images/ and hand back a public URL the email can use. The
 * repo is public, so raw.githubusercontent serves it the moment it lands —
 * no deploy wait. PDFs never reach here: the builder converts the first
 * page to a PNG in the browser before uploading.
 */
import { createHash } from 'node:crypto';
import { preflight } from './_lib/cors.js';
import { checkRequest } from './_lib/turnstile.js';
import { putRepoFile, rawUrl } from './_lib/archive.js';

export const config = { maxDuration: 60 };

const MAX_BYTES = 2.5 * 1024 * 1024;

const MAGIC = {
  png: b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: b => b.length > 6 && b.slice(0, 3).toString('ascii') === 'GIF',
  webp: b => b.length > 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP',
};

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  // Cross-origin callers (the public share page) must carry a Turnstile token.
  const refused = await checkRequest(req);
  if (refused) return res.status(403).json({ ok: false, error: refused });
  const type = String(req.body?.type ?? '').toLowerCase();
  if (!MAGIC[type]) {
    return res.status(400).json({ ok: false, error: 'Use a PNG, JPG, GIF, or WebP.' });
  }
  // Buffer.from never throws on base64: bad input decodes to fewer or zero
  // bytes, which the two checks below refuse.
  const bytes = Buffer.from(String(req.body?.file ?? ''), 'base64');
  if (!bytes.length) return res.status(400).json({ ok: false, error: 'The file came through empty.' });
  if (bytes.length > MAX_BYTES) {
    return res.status(400).json({ ok: false, error: 'That picture is too big. Keep it under 2.5 MB.' });
  }
  if (!MAGIC[type](bytes)) {
    return res.status(400).json({ ok: false, error: "That file doesn't look like the image type it claims to be." });
  }
  try {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
    const file = `builder/images/img-${stamp}-${hash}.${type}`;
    await putRepoFile(file, bytes, null,
      `newsletter image ${stamp}-${hash} (via the builder)`);
    return res.status(200).json({ ok: true, url: rawUrl(file) });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message });
  }
}
