/**
 * The team's own submit page, /team-submit/ (Kate, Oct 23, her pick E): the
 * desk's Submit content page alone, with no top bar, for the team to pin as
 * a browser tab. It is drawn by the same renderTeam as /#team, so the form,
 * its bulk door and every call they make stay one piece of code.
 *
 * The rows behind the "Already in the queue" ask come from the desk's own
 * read-only GET, once on open and again after each item lands, as /#team
 * reloads. A read that fails keeps the rows it had: the item has already
 * landed, and the ask only waits for the next read.
 */
import { renderTeam } from './team-ui.js';
import { fetchDesk } from './sheet-client.js';

export function mountTeamSubmit(container, { load = fetchDesk, render = renderTeam } = {}) {
  let rows = [];
  async function refresh() {
    try { rows = (await load()).rows ?? []; } catch { /* keep what we had */ }
  }
  // No sidebar here, so no How-tos panel: the page keeps its how-to link in the lede.
  render(container, { onSubmitted: refresh, knownLinks: () => rows, howTo: true });
  return refresh();
}

if (typeof document !== 'undefined') {
  const box = document.querySelector('#team-submit');
  if (box) mountTeamSubmit(box);
}
