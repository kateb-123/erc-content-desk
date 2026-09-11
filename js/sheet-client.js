/** Thin fetch wrapper over /api/sheet. Throws with a readable message on failure. */

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** GET the whole desk: rows plus the newsletter schedule. */
export async function fetchDesk() {
  try {
    const data = await json(await fetch('/api/sheet'));
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
    }));
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
      let msg = data.error || `Request failed (${res.status})`;
      if (data.saved !== undefined) {
        msg = `Saved ${data.saved} of ${rows.length} rows, then couldn't reach the sheet.`;
      }
      throw new Error(msg);
    }
    return data.saved;
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Couldn\'t reach the server. Check your connection.');
    }
    throw err;
  }
}
