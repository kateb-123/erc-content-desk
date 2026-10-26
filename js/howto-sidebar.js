/**
 * The sidebar on a how-to page (Oct 23): the desk's own, lighting All how-tos
 * at its foot, with what waits at each item, counted by the code the front
 * page counts with (home-panel.js's hubCards, shell-view.js's navBadges). The
 * names draw at once; the desk's rows, the sign-ups and the live Exchange check
 * are read beside each other as the page opens, and each count shows when its
 * read lands. A read that fails leaves its item a name, quietly. Policy
 * Exchange keeps the desk's rule: nothing until the live check lands.
 * A how-to loads this file as its one line for the sidebar. Since Oct 25 the
 * builder and the email's three pages take their counts from countSidebar here
 * too, drawing their own sidebar for their own screen (the owner: they showed
 * the names alone).
 */
import { renderSidebar } from './shell-ui.js';
import { navBadges } from './shell-view.js';
import { hubCards } from './home-panel.js';
import { fetchDesk, readReply } from './sheet-client.js';
import { todayCentral } from './today.js';

/** What waits at each sidebar item: `paint(badges)` at once with none, then
 *  again as each read lands. Resolves once every read has answered or failed;
 *  nothing waits on it. `today` is for the tests. */
export function countSidebar(paint, { today = todayCentral() } = {}) {
  const got = { desk: null, signups: null, check: null };
  const draw = () => paint(navBadges(hubCards({ rows: got.desk?.rows ?? [], schedule: got.desk?.schedule ?? [], today, loaded: Boolean(got.desk), preview: got.check, signups: got.signups })));
  draw();
  const land = async (key, read) => {
    try {
      got[key] = await read();
      draw();
    } catch { /* quiet: the item keeps its name alone */ }
  };
  return Promise.all([
    land('desk', fetchDesk),
    land('signups', async () => readReply(await fetch('/api/listserv'), 'count the sign-ups')),
    land('check', async () => readReply(await fetch('/api/publish'), 'check the Exchange')),
  ]);
}

/** Draws the sidebar into `nav` as a how-to, then again as each count lands.
 *  Resolves once every read has answered or failed. `draw` and `today` are for the tests. */
export function mountHowtoSidebar(nav, { draw = renderSidebar, today = todayCentral() } = {}) {
  return countSidebar(badges => draw(nav, { screen: 'howto', badges }), { today });
}

/** A how-to's address: /how-to/ and everything under it. */
export const isHowToPage = path => /^\/how-to(\/|$)/.test(String(path ?? ''));

// Only a how-to mounts itself: the builder and the email's pages import this
// file for countSidebar and draw the sidebar for their own screen.
const nav = globalThis.document?.querySelector('nav.sidebar');
if (nav && isHowToPage(globalThis.location?.pathname)) mountHowtoSidebar(nav);
