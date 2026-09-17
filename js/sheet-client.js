/** Thin fetch wrapper over /api/sheet. Throws with a readable message on failure. */

/**
 * Read a JSON reply from the desk's own api. A non-JSON page (a Vercel
 * timeout, a proxy error) and a bare status both become one plain sentence
 * that says what failed; the server's own sentence is kept when it gave one.
 * `what` is the verb phrase: 'publish', 'check the Exchange'.
 */
export async function readReply(res, what) {
  const data = await res.json().catch(() => null);
  if (data && data.ok) return data;
  if (data?.error) throw new Error(data.error);
  if (Array.isArray(data?.errors) && data.errors.length) throw new Error(data.errors.join(' '));
  throw new Error(`The desk couldn't ${what} right now (server error ${res.status}). Try again in a minute.`);
}

/** The sentence for the status bar: a dropped connection gets its own words. */
export function plainError(err) {
  return err instanceof TypeError ? "Couldn't reach the server. Check your connection." : err.message;
}

const json = (res, what) => readReply(res, what);

/** GET the whole desk: rows plus the newsletter schedule. */
export async function fetchDesk() {
  try {
    const data = await json(await fetch('/api/sheet'), 'load');   // "The desk couldn't load right now", not "load the desk" twice
    return { rows: data.rows ?? [], schedule: data.schedule ?? [] };
  } catch (err) {
    if (err instanceof TypeError) throw new Error("Couldn't reach the server. Check your connection.");
    throw err;
  }
}

/** POST /api/read: the reader's catch-up over the given waiting rows. */
export async function readNewRows(ids) {
  try {
    return await json(await fetch('/api/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }), 'read the new items');
  } catch (err) {
    if (err instanceof TypeError) throw new Error("Couldn't reach the server. Check your connection.");
    throw err;
  }
}

export async function saveRows(rows) {
  if (!rows.length) return 0;
  try {
    const res = await fetch('/api/sheet', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      if (data.saved !== undefined) throw new Error(`Saved ${data.saved} of ${rows.length} rows, then couldn't reach the sheet.`);
      throw new Error(data.error || `The desk couldn't save right now (server error ${res.status}). Try again in a minute.`);
    }
    return data.saved;
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Couldn\'t reach the server. Check your connection.');
    }
    throw err;
  }
}
