/**
 * The sidebar on a how-to page (Oct 23): the desk's own, lighting All how-tos
 * at its foot, with what waits at each item, counted by the code the front
 * page counts with (home-panel.js's hubCards, shell-view.js's navBadges). The
 * names draw at once; the desk's rows, the sign-ups and the live Exchange check
 * are read beside each other as the page opens, and each count shows when its
 * read lands. A read that fails leaves its item a name, quietly. Policy
 * Exchange keeps the desk's rule: nothing until the live check lands.
 * A how-to loads this file as its one line for the sidebar.
 */
import { renderSidebar } from './shell-ui.js';
import { navBadges } from './shell-view.js';
import { hubCards } from './home-panel.js';
import { fetchDesk, readReply } from './sheet-client.js';
import { todayCentral } from './today.js';

/** Draws the sidebar into `nav`, then again as each count lands. Resolves once
 *  every read has answered or failed. `draw` and `today` are for the tests. */
export function mountHowtoSidebar(nav, { draw = renderSidebar, today = todayCentral() } = {}) {
  const got = { desk: null, signups: null, check: null };
  const paint = () => draw(nav, {
    screen: 'howto',
    badges: navBadges(hubCards({ rows: got.desk?.rows ?? [], schedule: got.desk?.schedule ?? [], today, loaded: Boolean(got.desk), preview: got.check, signups: got.signups })),
  });
  paint();
  const land = async (key, read) => {
    try {
      got[key] = await read();
      paint();
    } catch { /* quiet: the item keeps its name alone */ }
  };
  return Promise.all([
    land('desk', fetchDesk),
    land('signups', async () => readReply(await fetch('/api/listserv'), 'count the sign-ups')),
    land('check', async () => readReply(await fetch('/api/publish'), 'check the Exchange')),
  ]);
}

const nav = globalThis.document?.querySelector('nav.sidebar');
if (nav) mountHowtoSidebar(nav);
