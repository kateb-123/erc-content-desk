/** Thin fetch wrapper over /api/sheet. Throws with a readable message on failure. */

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function fetchRows() {
  return (await json(await fetch('/api/sheet'))).rows;
}

export async function saveRows(rows) {
  if (!rows.length) return 0;
  const res = await fetch('/api/sheet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  return (await json(res)).saved;
}
