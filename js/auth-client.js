/**
 * The desk's sign-in over /api/auth (Kate, Sep 23): is this browser signed
 * in, sign in with the password, sign out. The session is an HttpOnly
 * cookie the browser sends on its own; the page never sees it.
 */
import { jsonInit } from './sheet-client.js';

/** A refusal carries the server's status and sentence, for authError. */
async function reply(res) {
  const data = await res.json().catch(() => null);
  if (data?.ok) return data;
  throw Object.assign(new Error(data?.error || `server error ${res.status}`), { status: res.status, error: data?.error });
}

/** True when the cookie still holds. A server miss reads as signed out. */
export async function sessionStatus() {
  const data = await reply(await fetch('/api/auth', { cache: 'no-store' }));
  return Boolean(data.signedIn);
}

export async function signIn(password) {
  await reply(await fetch('/api/auth', jsonInit({ password })));
}

export async function signOut() {
  await reply(await fetch('/api/auth', { method: 'DELETE' }));
}
