/**
 * The desk's one sign-in (Kate, Sep 23): the front page, Content Sort and
 * Publish are hers alone, so they ask for the desk password; a sign-in lasts
 * a day; Publish's Confirm asks for the password once more before the write
 * to the public site.
 *
 * Only Web Crypto and strings here, on purpose: the same file signs in at the
 * edge (middleware.js answers /api/auth) and checks the cookie inside the
 * node routes (publish, rewrite), and the sandbox imports it too.
 *
 * The token is `<expiry seconds>.<HMAC-SHA256 of the expiry, keyed by the
 * password>`. The password itself never leaves the server, and changing it
 * signs every browser out at once. No password configured means nobody gets
 * in: the desk fails shut, and says why.
 */

export const COOKIE = 'desk';
export const DAY_MS = 24 * 60 * 60 * 1000;
const PURPOSE = 'desk-session:';

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret, text) {
  const key = await subtle().importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await subtle().sign('HMAC', key, enc.encode(text)));
}

/** Equal, in time that does not depend on where they differ: both go
 *  through SHA-256 first, so the comparison always walks 32 bytes. */
async function sameText(a, b) {
  const [x, y] = await Promise.all([a, b].map(t => subtle().digest('SHA-256', enc.encode(String(t)))));
  const xa = new Uint8Array(x), ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i += 1) diff |= xa[i] ^ ya[i];
  return diff === 0 && String(a).length === String(b).length;
}

/** A token good for a day from now. */
export async function issueToken(secret, now = Date.now(), ttl = DAY_MS) {
  const exp = Math.floor((now + ttl) / 1000);
  return `${exp}.${await hmac(secret, PURPOSE + exp)}`;
}

/** True while the token is unexpired and carries the password's own signature. */
export async function verifyToken(token, secret, now = Date.now()) {
  if (!secret) return false;
  const m = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(String(token ?? ''));
  if (!m) return false;
  if (Number(m[1]) * 1000 <= now) return false;
  return sameText(m[2], await hmac(secret, PURPOSE + m[1]));
}

/** The whole password, exactly; never when none is configured or none given. */
export async function passwordMatches(given, secret) {
  if (!secret || typeof given !== 'string' || !given) return false;
  return sameText(given, secret);
}

export function readCookie(header, name = COOKIE) {
  for (const part of String(header ?? '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return '';
}

/** HttpOnly, so no script on the page can read it; Secure on the live desk
 *  (the sandbox runs on plain localhost). */
export function sessionCookie(token, { secure = true, maxAge = DAY_MS / 1000 } = {}) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function clearCookie({ secure = true } = {}) {
  return sessionCookie('', { secure, maxAge: 0 });
}

export const NOT_SET_UP = 'The desk password is not set up yet. Add DESK_PASSWORD on Vercel.';
export const WRONG = "That's not the password.";
export const SIGN_IN_FIRST = 'Sign in to the desk first.';

/**
 * /api/auth: GET says whether this browser is signed in, POST { password }
 * signs in for a day, DELETE signs out. Pure over its inputs, so the edge
 * middleware, the sandbox and the tests all call the same thing.
 * Returns { status, body, setCookie? }.
 */
export async function authReply({ method, body, cookie }, { secret, now = Date.now(), secure = true }) {
  const has = secret ? await verifyToken(readCookie(cookie), secret, now) : false;
  if (method === 'GET') return { status: 200, body: { ok: true, signedIn: has } };
  if (method === 'DELETE') return { status: 200, body: { ok: true, signedIn: false }, setCookie: clearCookie({ secure }) };
  if (method !== 'POST') return { status: 405, body: { ok: false, error: 'Use GET, POST or DELETE.' } };
  if (!secret) return { status: 503, body: { ok: false, error: NOT_SET_UP } };
  const given = typeof body?.password === 'string' ? body.password : '';
  if (!given) return { status: 400, body: { ok: false, error: 'Type the password.' } };
  if (!(await passwordMatches(given, secret))) return { status: 403, body: { ok: false, error: WRONG } };
  return { status: 200, body: { ok: true, signedIn: true }, setCookie: sessionCookie(await issueToken(secret, now), { secure }) };
}

const envSecret = () => process.env.DESK_PASSWORD;

/** For a node route: is this request's cookie a live session? */
export async function signedIn(req, { secret = envSecret(), now = Date.now } = {}) {
  return secret ? verifyToken(readCookie(req.headers?.cookie), secret, now()) : false;
}

/** Answers 401 (or 503 with no password configured) and returns true when the
 *  route must stop; false means carry on. */
export async function refuseUnlessSignedIn(req, res, { secret = envSecret(), now = Date.now } = {}) {
  if (!secret) { res.status(503).json({ ok: false, error: NOT_SET_UP }); return true; }
  if (await verifyToken(readCookie(req.headers?.cookie), secret, now())) return false;
  res.status(401).json({ ok: false, error: SIGN_IN_FIRST });
  return true;
}

/** The second ask, at Publish's Confirm: the password rides the body. */
export async function refuseUnlessPassword(req, res, { secret = envSecret() } = {}) {
  if (!secret) { res.status(503).json({ ok: false, error: NOT_SET_UP }); return true; }
  const given = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!given) { res.status(400).json({ ok: false, error: 'Type the password to confirm.' }); return true; }
  if (await passwordMatches(given, secret)) return false;
  res.status(403).json({ ok: false, error: WRONG });
  return true;
}
