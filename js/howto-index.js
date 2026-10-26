/**
 * Every how-to in one place (Kate, Oct 24, 2026, her pick D of five): a
 * How-tos button at the top right of every page opens a panel from the right,
 * this page's guide first with the part for this page tagged This page, then
 * every other guide under the sidebar's own headings. It replaced the how-to
 * links scattered across the pages. This file is the panel's one source: the
 * guides, their parts by the anchors their pages use, and which page opens
 * which guide at which part. Pure data and small rules, so node --test holds
 * them; a test checks that each guide's parts are the parts its page names
 * and that every anchor lands on an id there.
 */
import { NAV } from './shell-view.js';

/** The panel's headings: the sidebar's own, then the guides no hub owns. */
export const BEHIND = 'Behind the scenes';
export const GROUPS = [...NAV.map(g => g.label).filter(Boolean), BEHIND];

/** The guides, in the panel's order, each under one heading. `parts` are the
 *  page's own parts, as its chips (or jump row) name them: [name, anchor]. */
export const GUIDES = [
  { id: 'submit', group: 'Bring it in', icon: 'submit', title: 'Submit content to the desk', line: 'One item or a whole list, and which type to pick.', href: '/how-to/submit-content/',
    parts: [['Add content', 'add'], ['Item types', 'types']] },
  { id: 'sort', group: 'Bring it in', icon: 'queue', title: 'Sort the queue', line: 'The scraper, what to keep, the rewrites, and fixing an item later.', href: '/how-to/sort/',
    parts: [['The scraper', 'scraper'], ['Keep or delete', 'keep'], ['Sources', 'sources'], ['Card and list', 'card'], ['Finalize', 'finalize'], ['Fix an item later', 'fix']] },
  { id: 'newsletter', group: 'Send it out', icon: 'newsletter', title: 'Build the newsletter', line: 'The send dates, then each issue from Next issue to Outlook.', href: '/how-to/newsletter/',
    parts: [['Send dates', 'dates'], ['Outline', 'outline'], ['Preview & Tweak', 'tweak'], ['Save & Export', 'export'], ['Send', 'send'], ['Styles', 'options']] },
  { id: 'email', group: 'Send it out', icon: 'newsletter', title: 'The email: read me', line: 'The blank template, the sample, and changing the template.', href: '/newsletter/read-me/',
    parts: [['The two pages', 'pages'], ['Change the template itself', 'template']] },
  { id: 'exchange', group: 'Send it out', icon: 'exchange', title: 'Publish and the Exchange', line: 'Publish, the highlight, and fixing what is live.', href: '/how-to/exchange/',
    parts: [['Publish', 'publish'], ['Highlight', 'highlight'], ['Fix or remove a live item', 'fix']] },
  { id: 'briefs', group: 'Research', icon: 'briefs', title: 'Make a research brief', line: 'From the paper to a live brief.', href: '/how-to/research-briefs/',
    parts: [['Paper and notes', 'paper'], ['Draft', 'draft'], ['Your proof', 'proof'], ['After the author', 'author']] },
  { id: 'pipeline', group: BEHIND, icon: 'book', title: 'How it all connects', line: 'Where an item goes, start to finish.', href: '/how-to/pipeline/', parts: [] },
  { id: 'change', group: BEHIND, icon: 'book', title: 'Change the desk', line: 'Who to ask, and what needs code.', href: '/how-to/change-the-desk/',
    parts: [['Who to ask', 'ask'], ["The Exchange's look", 'look']] },
  { id: 'scripts', group: BEHIND, icon: 'book', title: 'Bring back the Google scripts', line: "When sign-ups or the queue's Sheet stop updating.", href: '/how-to/google-scripts/',
    parts: [['Which Sheets', 'sheets'], ['Redeploy', 'redeploy'], ['Check it', 'check'], ['If it goes wrong', 'wrong']] },
  { id: 'ask', group: BEHIND, icon: 'book', title: 'Ask Claude about the desk', line: 'Questions answered from the how-tos.', href: '/how-to/ask-claude/',
    parts: [['Set it up once', 'setup'], ['Ask', 'ask'], ['Keep it current', 'current']] },
  { id: 'design', group: BEHIND, icon: 'book', title: 'Design for the ERC', line: 'Web pages, flyers and posts, and print.', href: '/how-to/design/',
    parts: [['Claude Design', 'claude-design'], ['Canva', 'canva'], ['Print', 'print']] },
];

/** Each page with the sidebar: the guide it opens and the part for it ('' when
 *  the guide has no part of its own for that page). Since the trim (Oct 24)
 *  each topic is told once, in its hub's guide: the send dates in Build the
 *  newsletter, the scraper in Sort the queue. */
export const SCREEN_GUIDES = {
  home: ['pipeline', ''],
  team: ['submit', 'add'],
  queue: ['sort', 'scraper'],
  sort: ['sort', 'keep'],
  finalize: ['sort', 'finalize'],
  issue: ['newsletter', 'outline'],
  schedule: ['newsletter', 'dates'],
  past: ['newsletter', 'export'],
  listserv: ['scripts', 'check'],
  exchange: ['exchange', ''],
  publish: ['exchange', 'publish'],
  highlight: ['exchange', 'highlight'],
  briefs: ['briefs', ''],
  brief: ['briefs', ''],
  builder: ['newsletter', 'outline'],
  emailpage: ['email', 'pages'],
};

/** A part's address in its guide, for the one page that points at a part in
 *  words (the owner, Oct 25: the Listserv's Down links the Google scripts'
 *  Redeploy); '' for a part the guide does not have, so no link goes dead. */
export function partHref(id, part) {
  const guide = GUIDES.find(g => g.id === id);
  return guide?.parts.some(p => p[1] === part) ? `${guide.href}#${part}` : '';
}

/** The builder's steps (its sections' data-step) and the newsletter guide's part for each. */
export const BUILDER_PARTS = { triage: 'outline', edit: 'tweak', export: 'export' };

const pathOf = path => String(path ?? '').replace(/index\.html$/, '');

/** Where the panel opens. On a guide's own page you are reading it: its parts
 *  are places on that page, and `part`, the one on screen, is marked. Anywhere
 *  else the page's guide leads, at the part for the page. */
export function panelPlace({ screen = '', path = '', part = '', step = '' } = {}) {
  const own = GUIDES.find(g => g.href === pathOf(path));
  if (own) return { guide: own.id, part: own.parts.some(p => p[1] === part) ? part : '', reading: true };
  if (screen === 'howto') return { guide: '', part: '', reading: true };   // All how-tos: no guide leads
  const [guide, at] = SCREEN_GUIDES[screen] ?? ['', ''];
  return { guide, part: (screen === 'builder' && BUILDER_PARTS[step]) || at, reading: false };
}

/** What the panel shows for a place: the guide first, its parts linked (on
 *  its own page as anchors, elsewhere into the guide), then every other guide
 *  under its heading. */
export function panelModel(place) {
  const lead = GUIDES.find(g => g.id === place.guide) ?? null;
  const first = lead && {
    label: place.reading ? 'This guide' : 'For this page',
    guide: lead,
    parts: lead.parts.map(([name, id]) => ({
      name,
      href: place.reading ? `#${id}` : `${lead.href}#${id}`,
      here: !place.reading && id === place.part,
      current: place.reading && id === place.part,
    })),
  };
  const groups = GROUPS
    .map(label => ({ label, guides: GUIDES.filter(g => g.group === label && g !== lead) }))
    .filter(g => g.guides.length);
  return { first, restLabel: lead ? 'Every other guide' : 'Every guide', groups };
}
