/**
 * The newsletter archive lives in this repo (builder/newsletters/), so the
 * desk's own host serves every saved issue directly. Saving puts the
 * issue's HTML and refreshes the index the archive page lists.
 */
function repo() { return process.env.ARCHIVE_REPO || 'kateb-123/erc-content-desk'; }
function branch() { return process.env.ARCHIVE_BRANCH || 'main'; }
function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN must be set');
  return t;
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function contentsUrl(path) {
  return `https://api.github.com/repos/${repo()}/contents/${path}`;
}

/** { text, sha } — or { text: null, sha: null } when the file doesn't exist yet. */
export async function readRepoFile(path) {
  const res = await fetch(`${contentsUrl(path)}?ref=${branch()}`, { headers: ghHeaders() });
  if (res.status === 404) return { text: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: HTTP ${res.status}`);
  const data = await res.json();
  return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
}

/** Commit already-base64 bytes (images) — new unique paths, so no sha dance. */
export async function putRepoBinary(path, base64, message) {
  const res = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, branch: branch(), content: base64 }),
  });
  if (!res.ok) throw new Error(`GitHub write failed: HTTP ${res.status}`);
}

export async function putRepoFile(path, text, sha, message) {
  const body = {
    message, branch: branch(),
    content: Buffer.from(text, 'utf8').toString('base64'),
  };
  if (sha) body.sha = sha;
  const res = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub write failed: HTTP ${res.status}`);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function archiveLabel(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/**
 * Merge one issue into the archive index: replace a same-date entry
 * (re-saving an issue is normal), keep newest first.
 */
export function mergeArchiveIndex(list, isoDate) {
  const entry = { date: isoDate, file: `${isoDate}.html`, label: archiveLabel(isoDate) };
  const rest = (Array.isArray(list) ? list : []).filter(e => e?.date !== isoDate);
  return [...rest, entry].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
