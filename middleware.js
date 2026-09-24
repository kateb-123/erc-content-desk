/**
 * /api/auth, answered at the edge (Kate, Sep 23): GET says whether this
 * browser is signed in, POST { password } signs in for a day, DELETE signs
 * out. It lives here rather than in api/ because the Hobby plan allows
 * twelve functions and api/ holds twelve; the matcher keeps it to this one
 * address, so nothing else on the desk passes through it. The rules are in
 * api/_lib/session.js, which the node routes use to check the cookie.
 */
import { authReply } from './api/_lib/session.js';

export const config = { matcher: '/api/auth' };

export default async function middleware(request) {
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const reply = await authReply(
    { method: request.method, body, cookie: request.headers.get('cookie') ?? '' },
    { secret: process.env.DESK_PASSWORD, now: Date.now(), secure: true },
  );
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (reply.setCookie) headers['Set-Cookie'] = reply.setCookie;
  return new Response(JSON.stringify(reply.body), { status: reply.status, headers });
}
