/**
 * The Exchange side of Publish: read the live news.csv from GitHub, diff by
 * link, append new lines, commit. Append-only by construction — the existing
 * text is never edited, only extended. Pure helpers up top (offline-testable);
 * the two network calls at the bottom.
 */
import { CSV_COLUMNS } from '../../js/schema.js';
import { hubRowLine } from '../../js/hub-csv.js';

function repo() { return process.env.HUB_REPO || 'kateb-123/erc-policy-exchange'; }
function csvPath() { return process.env.HUB_CSV_PATH || 'data/news.csv'; }
function branch() { return process.env.HUB_BRANCH || 'main'; }
function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN must be set');
  return t;
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  const src = String(text ?? '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ''));
}

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

function contentsUrl() {
  return `https://api.github.com/repos/${repo()}/contents/${csvPath()}`;
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function fetchHubCsv() {
  const res = await fetch(`${contentsUrl()}?ref=${branch()}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub read failed: HTTP ${res.status}`);
  const data = await res.json();
  return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
}

export async function putHubCsv(text, sha, message) {
  const res = await fetch(contentsUrl(), {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message, sha, branch: branch(),
      content: Buffer.from(text, 'utf8').toString('base64'),
    }),
  });
  if (res.status === 409) throw Object.assign(new Error('hub CSV changed since read'), { conflict: true });
  if (!res.ok) throw new Error(`GitHub write failed: HTTP ${res.status}`);
}
