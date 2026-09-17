/**
 * The newsletter archive lives in this repo (builder/newsletters/), so the
 * desk's own host serves every saved issue directly. Saving puts the
 * issue's HTML and refreshes the index the archive page lists.
 */
import { getContents, putContents } from './github.js';

function repo() { return process.env.ARCHIVE_REPO || 'kateb-123/erc-content-desk'; }
function branch() { return process.env.ARCHIVE_BRANCH || 'main'; }

/** Where the public web serves a path in that repo, the moment it lands. */
export function rawUrl(path) {
  return `https://raw.githubusercontent.com/${repo()}/${branch()}/${path}`;
}

/** { text, sha } — or { text: null, sha: null } when the file doesn't exist yet. */
export async function readRepoFile(path) {
  const res = await getContents({ repo: repo(), path, branch: branch() });
  if (res.status === 404) return { text: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: HTTP ${res.status}`);
  const data = await res.json();
  return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
}

/** Commit one file: text is encoded here, a Buffer (an image) is already the
 *  bytes. An image goes to a new unique path, so it passes no sha. */
export async function putRepoFile(path, content, sha, message) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const res = await putContents({
    repo: repo(), path, base64: bytes.toString('base64'), sha, message, branch: branch(),
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
  // The file is always <date>.html, so the index carries the date and the label only.
  const entry = { date: isoDate, label: archiveLabel(isoDate) };
  const rest = (Array.isArray(list) ? list : []).filter(e => e?.date !== isoDate);
  return [...rest, entry].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
