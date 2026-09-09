/**
 * POST /api/listserv — the public newsletter signup: the Exchange's
 * /newsletter/ page and the share page's "add me to the newsletter" box.
 *
 * The browser used to post straight to the Apps Script, which meant the
 * webhook URL sat in the page source and anyone could append rows by hand.
 * The URL lives in LISTSERV_URL here instead, and a cross-origin caller must
 * carry a Turnstile token — the same gate as /api/submit. Fails closed: no
 * URL configured, no token, or the script unreachable all refuse.
 *
 * The timestamp is taken here, in the ERC's timezone, rather than from the
 * visitor's clock.
 */
import { setCors } from './_lib/cors.js';
import { checkRequest } from './_lib/turnstile.js';

export const config = { maxDuration: 30 };

const MAX_FIELD_LENGTH = 200;
const EMAIL = /^\S+@\S+\.\S+$/;
const TIMEZONE = 'America/Chicago';

/** { date_subscribed: 'YYYY-MM-DD', time: 'HH:MM:SS' } in the ERC's timezone. */
export function stamp(now = new Date()) {
  const date_subscribed = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now);
  return { date_subscribed, time };
}

/** '' when the pair is usable, otherwise the message to send back. */
export function validateSignup({ name, email }) {
  if (!name) return 'Add your name.';
  if (!email) return 'Add your email address.';
  if (name.length > MAX_FIELD_LENGTH || email.length > MAX_FIELD_LENGTH) {
    return 'That name or address is too long.';
  }
  if (!EMAIL.test(email)) return "That email address doesn't look right.";
  return '';
}

export default async function handler(req, res) {
  // The signup pages are served from another origin, so the browser
  // preflights this POST — answer it before anything else.
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, errors: ['Use POST.'] });
  }
  const refused = await checkRequest(req);
  if (refused) return res.status(403).json({ ok: false, errors: [refused] });

  const url = process.env.LISTSERV_URL;
  if (!url) {
    console.error('listserv: LISTSERV_URL is not set');
    return res.status(500).json({ ok: false, errors: ["The sign-up isn't configured. Email erc@tamu.edu and we'll add you."] });
  }

  const body = req.body ?? {};
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const problem = validateSignup({ name, email });
  if (problem) return res.status(400).json({ ok: false, errors: [problem] });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listserv_signup', name, email, ...stamp() }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.error('listserv: the script returned HTTP', response.status);
      return res.status(502).json({ ok: false, errors: ["Couldn't reach the list just now. Try again in a moment."] });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('listserv failed', err);
    return res.status(502).json({ ok: false, errors: ["Couldn't reach the list just now. Try again in a moment."] });
  }
}
