/**
 * Run the scraper from the desk (Kate, Oct 19, 2026: "a button that will run
 * the scraper", and the haul in Drive "so it's available to everyone").
 *
 * The scraper (~/code/erc-scraper, now a GitHub repo) runs on GitHub's
 * machines: every Monday on its own, and when the desk asks. Three doors,
 * all riding /api/bulk, since api/ holds the Hobby plan's twelve functions:
 *
 *   GET  /api/bulk?scraper=status      the run's state and the last haul
 *   POST /api/bulk { action: 'run' }   start a run (a workflow_dispatch)
 *   POST /api/bulk { action: 'haul' }  the run delivers its spreadsheets and
 *                                      run log; the desk files them into the
 *                                      shared drive through the Sheet's own
 *                                      Apps Script (saveFile), and answers
 *                                      with the Drive folder
 *
 * Nothing enters the queue by itself: the team opens the files in Drive and
 * drops what it wants on the bulk door, as a run by hand works today.
 *
 * Server-side only: reads SCRAPER_GITHUB_TOKEN (or GITHUB_TOKEN), SCRAPER_REPO
 * and SCRAPER_TOKEN from the environment.
 */
import { timingSafeEqual } from 'node:crypto';

export const SCRAPER_WORKFLOW = 'scrape.yml';
const GITHUB = 'https://api.github.com';
const DEFAULT_REPO = 'kateb-123/erc-scraper';
const MAX_FILES = 12;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,80}\.(xlsx|txt)$/;
const CONTENT_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
};

/** GitHub's newest run of the workflow, as the desk reads it. */
export function runState(body) {
  const run = body?.workflow_runs?.[0];
  if (!run) return { state: 'idle', startedAt: '', updatedAt: '', url: '' };
  const state = run.status === 'completed' ? (run.conclusion === 'success' ? 'idle' : 'failed') : 'running';
  return { state, startedAt: run.created_at ?? '', updatedAt: run.updated_at ?? '', url: run.html_url ?? '' };
}

function sameSecret(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** What is wrong with a haul, or null. The token first, before anything is read. */
export function haulChecks(body, secret) {
  if (!secret || !sameSecret(body?.token, secret)) return 'Bad token.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body?.date ?? ''))) return 'The date must be YYYY-MM-DD.';
  const files = Array.isArray(body?.files) ? body.files : [];
  if (!files.length || files.length > MAX_FILES) return `Send 1 to ${MAX_FILES} files.`;
  for (const f of files) {
    const name = String(f?.name ?? '');
    if (!FILE_NAME.test(name)) return `A file name is not allowed: ${JSON.stringify(name)}.`;
    const bytes = Buffer.from(String(f?.b64 ?? ''), 'base64').length;
    if (!bytes) return `${name} came through empty.`;
    if (bytes > MAX_FILE_BYTES) return `${name} is too big.`;
  }
  return null;
}

/**
 * The handler, with GitHub and the Sheet's script injectable for tests.
 * `handles(req)` says whether a request is one of the three doors;
 * `handle(req, res)` answers it.
 */
export function createScraperHandler({ fetch = globalThis.fetch, saveFile, env = process.env } = {}) {
  const repo = env.SCRAPER_REPO || DEFAULT_REPO;
  const ghToken = env.SCRAPER_GITHUB_TOKEN || env.GITHUB_TOKEN || '';
  const api = path => `${GITHUB}/repos/${repo}/${path}`;
  const headers = () => ({
    Authorization: `Bearer ${ghToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'erc-content-desk',
  });

  async function gh(path, init = {}) {
    try {
      return await fetch(api(path), { ...init, headers: { ...headers(), ...(init.headers ?? {}) } });
    } catch (err) {
      throw new Error(`Couldn't reach GitHub: ${err.message}`);
    }
  }

  async function latest() {
    const res = await gh('contents/haul/latest.json?ref=main');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for the last haul.`);
    const body = await res.json();
    try {
      return JSON.parse(Buffer.from(String(body?.content ?? ''), 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }

  async function runs() {
    const res = await gh(`actions/workflows/${SCRAPER_WORKFLOW}/runs?per_page=1`);
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for the runs.`);
    return runState(await res.json());
  }

  function handles(req) {
    if (req.method === 'GET') return req.query?.scraper === 'status';
    return req.method === 'POST' && ['run', 'haul'].includes(req.body?.action);
  }

  async function status(res) {
    if (!ghToken) return res.status(200).json({ ok: true, configured: false, run: null, last: null });
    try {
      const [run, last] = await Promise.all([runs(), latest()]);
      return res.status(200).json({ ok: true, configured: true, run, last });
    } catch (err) {
      return res.status(502).json({ ok: false, error: err.message });
    }
  }

  async function run(res) {
    if (!ghToken) return res.status(503).json({ ok: false, error: "The scraper isn't wired to the desk: SCRAPER_GITHUB_TOKEN is not set." });
    try {
      const state = await runs();
      if (state.state === 'running') return res.status(409).json({ ok: false, error: 'The scraper is already running.' });
      const r = await gh(`actions/workflows/${SCRAPER_WORKFLOW}/dispatches`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main' }),
      });
      if (r.status !== 204) return res.status(502).json({ ok: false, error: `GitHub answered ${r.status} when asked to start the scraper.` });
      return res.status(200).json({ ok: true, started: true });
    } catch (err) {
      return res.status(502).json({ ok: false, error: err.message });
    }
  }

  async function haul(req, res) {
    const problem = haulChecks(req.body, env.SCRAPER_TOKEN || '');
    if (problem) return res.status(problem === 'Bad token.' ? 401 : 400).json({ ok: false, error: problem });
    const { date, files } = req.body;
    let folderUrl = '';
    const saved = [];
    try {
      for (const f of files) {
        const ext = f.name.split('.').pop().toLowerCase();
        const reply = await saveFile({ folder: date, name: f.name, contentType: CONTENT_TYPES[ext], b64: f.b64 });
        folderUrl = reply?.folderUrl || folderUrl;
        saved.push(f.name);
      }
    } catch (err) {
      return res.status(502).json({ ok: false, error: `Couldn't file the haul in Drive after ${saved.length} of ${files.length}: ${err.message}` });
    }
    return res.status(200).json({ ok: true, folderUrl, saved });
  }

  async function handle(req, res) {
    if (req.method === 'GET') return status(res);
    if (req.body?.action === 'run') return run(res);
    return haul(req, res);
  }

  return { handles, handle };
}
