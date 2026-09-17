/**
 * The GitHub contents API, the two calls the desk makes: read a file, commit
 * a file. Both hand back the raw response, because what a 404 or a 409 means
 * differs by caller (the archive creates a missing file, the Exchange must
 * never publish onto one) and so does the sentence it becomes.
 */
function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN must be set');
  return t;
}

export function ghHeaders() {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const contentsUrl = (repo, path) => `https://api.github.com/repos/${repo}/contents/${path}`;

export function getContents({ repo, path, branch }) {
  return fetch(`${contentsUrl(repo, path)}?ref=${branch}`, { headers: ghHeaders() });
}

/** content goes up already base64-encoded; sha is sent only when there is one
 *  (a new path has none, and sending null is a 422). */
export function putContents({ repo, path, base64, sha, message, branch }) {
  const body = { message, branch, content: base64 };
  if (sha) body.sha = sha;
  return fetch(contentsUrl(repo, path), {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
