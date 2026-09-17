/**
 * The Exchange side of Publish: read the live news.csv from GitHub, diff by
 * link, append new lines, commit. Append-only by construction — the existing
 * text is never edited, only extended. Pure helpers up top (offline-testable);
 * the two network calls at the bottom.
 */
import { hubRowLine, parseCsv } from '../../js/hub-csv.js';
import { getContents, putContents } from './github.js';
export { parseCsv };

function repo() { return process.env.HUB_REPO || 'kateb-123/erc-policy-exchange-app'; }
function csvPath() { return process.env.HUB_CSV_PATH || 'data/news.csv'; }
function branch() { return process.env.HUB_BRANCH || 'main'; }

export function csvLinks(text) {
  const rows = parseCsv(text);
  if (!rows.length) return new Set();
  const linkIndex = rows[0].indexOf('link');
  if (linkIndex === -1) return new Set();
  return new Set(rows.slice(1).map(r => (r[linkIndex] ?? '').trim()).filter(Boolean));
}

export function diffAgainstHub(csvText, rows) {
  const existing = csvLinks(csvText);
  const newRows = [], skipped = [];
  for (const row of rows) {
    const link = String(row.link ?? '').trim();
    (link && existing.has(link) ? skipped : newRows).push(row);
  }
  return { newRows, skipped };
}

export function appendRowsToCsv(csvText, rows) {
  const base = String(csvText ?? '').replace(/[\r\n]+$/, '');
  const lines = rows.map(hubRowLine);
  return [base, ...lines].join('\n') + '\n';
}

export async function fetchHubCsv() {
  const res = await getContents({ repo: repo(), path: csvPath(), branch: branch() });
  if (!res.ok) throw new Error(`GitHub read failed: HTTP ${res.status}`);
  const data = await res.json();
  return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
}

export async function putHubCsv(text, sha, message) {
  const res = await putContents({
    repo: repo(), path: csvPath(), branch: branch(), message, sha,
    base64: Buffer.from(text, 'utf8').toString('base64'),
  });
  if (res.status === 409) throw Object.assign(new Error('GitHub conflict: hub CSV changed since read'), { conflict: true });
  if (!res.ok) throw new Error(`GitHub write failed: HTTP ${res.status}`);
}
