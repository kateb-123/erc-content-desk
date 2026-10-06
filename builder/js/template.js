/**
 * template.js: HTML renderer for the ERC Newsletter, the Stacked Blocks look
 * (Claude Design handoff, Oct 2026). Every part of the email is its own 640px
 * white panel on the gray page: header, intro, one per section, the maroon
 * callout, the footer. Table-and-inline-style email markup, so it survives
 * Outlook. The maroon lives here and nowhere in-app.
 *
 * Per-issue options the builder writes:
 *   issue.layout.nav       false hides the contents strip             (default on)
 *   issue.callouts         [{ id, kind, after, style, title, text, button, url, deadline }]
 *                          any number, each after a section; kind 'share' or 'custom';
 *                          style 'maroon' | 'gray' | 'dotted' (Kate, Oct 5)
 *   fields.showSummary     true | false overrides the group's description default
 *   fields.pictureStyle    'stamp' | 'headshot' | 'none'              (default by title)
 *   fields.pictureWidth    a width in px, 48 to 240, else the layout's own
 * Older drafts carried issue.layout.callout for the one fixed callout; it
 * still reads as one Share callout after ERC Research.
 */

import { SECTION_REGISTRY, newCallout } from './model.js';

// ─── Tokens (Aggie UX) ───────────────────────────────────────────────────────

const MASTHEAD = 'https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/builder/images/newsletter-masthead.png';
const LOCKUP = 'https://i.ibb.co/JjQWyZq3/ERC-Horizontal-White-Text-narrow.png';
export const URLS = {
  site: 'https://erc.cehd.tamu.edu/',
  join: 'https://erc-policy-exchange.vercel.app/newsletter/',
  email: 'mailto:erc@tamu.edu',
  submit: 'https://forms.office.com/Pages/ResponsePage.aspx?id=44HzaNpGuUe6V28yK48NoV5eaARTlZdIspuMdxu3p_lUQkwwS0pRMzgzTlE2MktPRjZCRDcwUDgxRS4u',
};

const C = {
  maroon: '#500000', maroonDark: '#3C0000', maroonLight: '#732F2F', white: '#ffffff',
  g100: '#F6F6F6', g200: '#EAEAEA', g300: '#D1D1D1', g400: '#A7A7A7', g600: '#626262', g700: '#535353', g800: '#3E3E3E', g900: '#202020',
  cream: '#D6D3C4', ivory: '#E9E4DC',
};

const SANS = "'Trebuchet MS','Segoe UI',Tahoma,sans-serif";
const LABEL = 'Verdana,Geneva,Tahoma,sans-serif';

const T = {
  title: `font-family:${SANS}; font-size:16px; line-height:1.3; font-weight:700;`,
  meta: `font-family:${SANS}; font-size:14px; line-height:1.4; color:${C.g700};`,
  body: `font-family:${SANS}; font-size:14px; line-height:1.5; color:${C.g800};`,
  digest: `font-family:${SANS}; font-size:14px; line-height:1.45; color:${C.g900};`,
  label: `font-family:${LABEL}; font-size:12px; line-height:1.4; font-weight:700; letter-spacing:1.1px; text-transform:uppercase; color:${C.maroonLight};`,
  hair: `1px solid ${C.g200}`,
  tail: `font-family:${SANS}; font-size:14px; line-height:1.4; font-weight:700; color:${C.maroon};`,
};

/** The option values the renderer understands; anything else falls to the default. */
export const CALLOUT_STYLES = ['maroon', 'gray', 'dotted'];
export const PICTURE_STYLES = ['stamp', 'headshot', 'none'];

/** The email's heading, contents-strip label, and which groups show a description, per section. */
const EMAIL = {
  research:      { heading: 'ERC Research',                 short: 'Research',        summaryGroups: null },
  spotlight:     { heading: 'ERC Spotlight',                short: 'Spotlight',       summaryGroups: null },
  events:        { heading: 'Upcoming Events',              short: 'Events',          summaryGroups: ['featured'] },
  opportunities: { heading: 'Opportunities',                short: 'Opportunities',   summaryGroups: [] },
  policy:        { heading: 'New Education Policy Research', short: 'Policy Research', summaryGroups: null },
  headlines:     { heading: 'Education Headlines',          short: 'Headlines',       summaryGroups: null },
  misc:          { heading: 'Miscellaneous',                short: 'Miscellaneous',   summaryGroups: null },
};
const DIGEST_KINDS = new Set(['grouped-digest']);

// ─── Text ────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SAFE_HREF_SCHEME = /^(https?:|mailto:|#|\/)/i;

/** A markdown link: [label](href), the href allowing one level of nesting so
 *  a trailing ")" in a Wikipedia URL stays inside the href. */
const MD_LINK = /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g;

/** A url only becomes an href when its scheme is safe. Unsafe links render
 *  as plain text. Shared by item links and renderProse's markdown links. */
function safeItemHref(url) {
  const trimmed = normalizeHref(url);
  return SAFE_HREF_SCHEME.test(trimmed) ? trimmed : '';
}

/** "www.site.org/x" or "site.org/x" typed without a scheme becomes https://… ;
 *  anything else is returned trimmed, for the scheme check to judge. */
const SCHEME_LESS = /^(?:www\.|(?:[a-z0-9-]+\.)+[a-z]{2,6}(?:[\/?#]|$))/i;
function normalizeHref(url) {
  const trimmed = String(url ?? '').trim();
  return SCHEME_LESS.test(trimmed) && !/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? `https://${trimmed}` : trimmed;
}

/** Applies **bold** and *italic* to ALREADY-ESCAPED text. */
function applyEmphasis(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

/** Inline links in prose: maroon, bold, underlined (the system's link). */
const LINK = `color:${C.maroon}; font-weight:700; text-decoration:underline;`;

/**
 * Escapes all text, converting [label](href) markdown links into a maroon
 * underlined <a target="_blank" rel="noopener">. No data-edit-* attributes.
 */
export function renderProse(text) {
  if (!text) return '';
  const links = [];
  const tokenized = String(text).replace(MD_LINK, (m, label, href) => { links.push({ label, href }); return `\u0000${links.length - 1}\u0000`; });
  return applyEmphasis(esc(tokenized)).replace(/\u0000(\d+)\u0000/g, (m, i) => {
    const { label, href } = links[Number(i)];
    const inner = applyEmphasis(esc(label));
    const safe = safeItemHref(href);
    return safe
      ? `<a href="${esc(safe)}" target="_blank" rel="noopener" style="${LINK}">${inner}</a>`
      : inner;
  });
}

/** Markdown to plain words, for the hidden preheader. */
const plain = (md) => String(md ?? '').replace(MD_LINK, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\s+/g, ' ').trim();

const splitParas = (md) => String(md ?? '').split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);

/** Returns data-edit-* attribute string when editable=true, else ''. */
function editAttrs(section, itemId, field, editable) {
  if (!editable) return '';
  const secAttr = ` data-edit-section="${esc(section)}"`;
  const itemAttr = itemId != null ? ` data-edit-item="${esc(String(itemId))}"` : '';
  const fieldAttr = ` data-edit-field="${esc(field)}"`;
  return secAttr + itemAttr + fieldAttr;
}

// ─── Layout pieces ───────────────────────────────────────────────────────────

const row = (inner, td = '') => `<tr><td style="${td}">${inner}</td></tr>`;
const spacer = (h) => `<tr><td style="height:${h}px; font-size:1px; line-height:${h}px;">&nbsp;</td></tr>`;
const tbl = (inner, w = '100%') => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="${w}" style="width:${typeof w === 'number' ? w + 'px' : w}; border-collapse:collapse;"><tbody>${inner}</tbody></table>`;
const rule = (border, pad = '0 24px') => row(`<div style="border-top:${border}; font-size:1px; line-height:1px;">&nbsp;</div>`, `padding:${pad};`);
const twoCol = (left, right, leftW, top = 2) => tbl(`<tr><td valign="top" width="${leftW}" style="width:${leftW}px; vertical-align:top; padding:${top}px 0 0 0;">${left}</td><td valign="top" style="vertical-align:top;">${right}</td></tr>`);
const p = (style, html, mb = 0, attrs = '') => `<p style="margin:0 0 ${mb}px; ${style}"${attrs}>${html}</p>`;
const paras = (style, md, gap, attrs = '') => { const l = splitParas(md); return l.map((t, i) => p(style, renderProse(t), i < l.length - 1 ? gap : 0, attrs)).join(''); };
const button = (label, href, bg, fg) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tbody><tr><td style="background-color:${bg}; padding:11px 20px 12px 20px;"><a href="${href}" target="_blank" rel="noopener" style="display:inline-block; font-family:${SANS}; font-size:14px; line-height:1.2; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${fg}; text-decoration:none; white-space:nowrap;">${label}</a></td></tr></tbody></table>`;

// ─── Data ────────────────────────────────────────────────────────────────────

/** Items that can render: a title is the one field every item needs. */
const titled = (items) => (items || []).filter((i) => String(i?.fields?.title ?? '').trim());

/** The anchor a section heading emits and the contents strip links to. Headlines
 *  is the one section whose anchor is not its key. */
const anchorIdForSection = (key) => (key === 'headlines' ? 'news' : key);

/** An item's group as the email draws it: a featured event pins under Featured
 *  Events; a research item with an unknown group folds into Research Brief. */
function groupOf(secKey, item) {
  const g = item.group || '';
  if (secKey === 'events' && item.featured) return 'featured';
  if (secKey === 'research') return ['brief', 'report'].includes(g) ? g : 'brief';
  if (secKey === 'misc') return 'misc';
  return g;
}

/** A section's items bucketed by group: the registry's order first, then any
 *  group the registry does not name, so nothing is dropped. */
function groupsInOrder(secReg, items) {
  const order = secReg.groups.map((g) => g.key);
  const byGroup = {};
  for (const item of items) {
    const gk = groupOf(secReg.key, item);
    (byGroup[gk] = byGroup[gk] || []).push(item);
  }
  const keys = order.filter((gk) => byGroup[gk]);
  for (const gk of Object.keys(byGroup)) if (!order.includes(gk)) keys.push(gk);
  return keys.map((key) => ({ key, label: secReg.groups.find((g) => g.key === key)?.label ?? key, items: byGroup[key] }));
}

/** The sections that render, in registry order, each with its groups. */
function buildSections(issue) {
  const out = [];
  for (const secReg of SECTION_REGISTRY) {
    const sec = issue?.sections?.[secReg.key];
    if (!sec || !sec.enabled) continue;
    const items = titled(sec.items);
    if (!items.length) continue;
    const email = EMAIL[secReg.key] || { heading: secReg.label, short: secReg.navLabel ?? secReg.label, summaryGroups: null };
    out.push({
      key: secReg.key, anchor: anchorIdForSection(secReg.key), heading: email.heading, short: email.short,
      kind: DIGEST_KINDS.has(secReg.kind) ? 'digest' : 'full', showSource: secReg.key === 'headlines',
      tailUrl: safeItemHref(secReg.seeMoreUrl), summaryGroups: email.summaryGroups,
      groups: groupsInOrder(secReg, items),
    });
  }
  return out;
}

const summaryAllowed = (def, gkey) => !def.summaryGroups || def.summaryGroups.includes(gkey);

/** Whether a group shows descriptions by default: Research and Spotlight do,
 *  Events only under Featured Events, Opportunities never. The Outline asks
 *  this so its checkbox starts where the email would. */
export function summaryDefault(sectionKey, groupKey) {
  const email = EMAIL[sectionKey];
  if (!email) return false;
  return !email.summaryGroups || email.summaryGroups.includes(groupKey);
}

/** Whether an item shows its description: the builder's choice, else the group's default. */
function showsSummary(def, gkey, fields) {
  if (!fields.summary) return false;
  const choice = fields.showSummary;
  return (typeof choice === 'boolean' ? choice : summaryAllowed(def, gkey));
}

const isEdTalk = (title) => /^ERC EdTalk/i.test(String(title ?? '').trim());

/** The picture layout an item gets when nothing was chosen: a headshot for an
 *  "ERC EdTalk", a stamp otherwise. */
export function pictureDefault(title) {
  return isEdTalk(title) ? 'headshot' : 'stamp';
}

/** The picture layout in force: the one chosen by hand, else the default for the title. */
export function pictureStyleOf(fields) {
  return PICTURE_STYLES.includes(fields?.pictureStyle) ? fields.pictureStyle : pictureDefault(fields?.title);
}

/** The picture's width: 160 for a headshot, 96 for a stamp, 0 for none. With
 *  no photo the email draws nothing; the editable preview draws a placeholder
 *  when a picture layout was chosen, so the choice can be seen (Kate, Oct 5). */
function pictureWidth(fields, sumOk, editable = false) {
  const src = safeItemHref(fields.image);
  if (!sumOk) return 0;
  const chosen = PICTURE_STYLES.includes(fields.pictureStyle);
  if (!src && !(editable && chosen)) return 0;
  const style = chosen ? fields.pictureStyle : pictureDefault(fields.title);
  if (style === 'none') return 0;
  // A size picked by hand (Kate, Oct 5), else the layout's own: 96 for a stamp, 160 for a headshot.
  const picked = Number(fields.pictureWidth);
  if (Number.isFinite(picked) && picked >= PICTURE_MIN && picked <= PICTURE_MAX) return Math.round(picked);
  return style === 'headshot' ? 160 : 96;
}

/** The widths a picture may be set to by hand, in px. */
export const PICTURE_MIN = 48;
export const PICTURE_MAX = 240;
/** The column a picture takes: its width plus one 16px gutter. */
const PICTURE_GUTTER = 16;

/** The preview's stand-in for a photo not yet added: a dashed box the size the photo would take. */
function placeholderPicture(w, sectionKey, itemId, editable) {
  const h = Math.round(w * 1.25);
  return `<span style="display:block; box-sizing:border-box; width:${w}px; height:${h}px; border:1px dashed #A7A7A7; background-color:#F6F6F6; color:#626262; font-family:${SANS}; font-size:12px; line-height:${h}px; text-align:center;"${editAttrs(sectionKey, itemId, 'image', editable)}>Photo</span>`;
}

/** The layout options, normalised. */
export function layoutOf(issue) {
  const l = issue?.layout || {};
  return { nav: l.nav !== false };
}

/**
 * The issue's callouts, in order. A draft from before Oct 5 carried one fixed
 * callout as issue.layout.callout (or research.showSubmit=false for none); it
 * reads as one Share callout after ERC Research in that style, so nothing an
 * older draft chose is lost.
 */
export function calloutsOf(issue) {
  if (Array.isArray(issue?.callouts)) {
    return issue.callouts.filter((c) => c && typeof c === 'object' && String(c.title ?? '').trim());
  }
  const old = issue?.layout?.callout;
  if (old === 'none' || (old == null && issue?.sections?.research?.showSubmit === false)) return [];
  const c = newCallout('share', 'research');
  c.id = 'callout_legacy';
  if (CALLOUT_STYLES.includes(old)) c.style = old;
  return [c];
}

// ─── Header, intro ───────────────────────────────────────────────────────────

const uLink = (href, t, color) => `<a href="${href}" target="_blank" rel="noopener" style="color:${color}; text-decoration:none;">${t}</a>`;
const utility = () => `${uLink(URLS.site, 'Website', C.g700)}<span style="padding:0 8px; color:${C.g400};">&#183;</span>${uLink(URLS.join, 'Join the mailing list', C.g700)}`;
const masthead = () => row(`<a href="${URLS.site}" target="_blank" rel="noopener" style="display:block; line-height:0; text-decoration:none;"><img width="640" src="${MASTHEAD}" alt="Education Research Center Newsletter" style="width:640px; max-width:640px; height:auto; display:block; border:0;"></a>`, 'padding:0;');

/**
 * Contents strip: one line when it fits; otherwise two balanced lines split at
 * a <br>, so no line ever ends or starts on a separator. Widths are estimated
 * (6.4px a character, 21px a separator) only to choose the split.
 * In the editable preview the links go nowhere, so they are drawn as words.
 */
export function navLinks(nav, editable = false) {
  const sepHtml = `<span style="padding:0 4px; color:${C.g400};">&#183;</span>`;
  const link = (s) => {
    const words = esc(s.short).replace(/ /g, '&nbsp;');
    return editable
      ? `<span style="color:${C.g700};">${words}</span>`
      : `<a href="#${s.anchor}" style="color:${C.g700}; text-decoration:none;">${words}</a>`;
  };
  const line = (items) => items.map(link).join(`&nbsp;${sepHtml}&nbsp;`);
  const w = (items) => items.reduce((a, s) => a + s.short.length * 6.4, 0) + (items.length - 1) * 21;
  if (nav.length < 2 || w(nav) <= 600) return line(nav);
  let best = 1, bestW = Infinity;
  for (let k = 1; k < nav.length; k++) { const m = Math.max(w(nav.slice(0, k)), w(nav.slice(k))); if (m < bestW) { bestW = m; best = k; } }
  return line(nav.slice(0, best)) + '<br>' + line(nav.slice(best));
}

function headerRows(issue, nav, showNav, editable) {
  const date = esc(issue.date || '');
  const rows = [
    row(tbl(`<tr><td style="font-family:${SANS}; font-size:15px; line-height:1.4; font-weight:700; color:${C.maroon};">${date}</td><td align="right" style="text-align:right; font-family:${SANS}; font-size:14px; line-height:1.4; color:${C.g700};">${utility()}</td></tr>`), 'padding:14px 24px 12px 24px;'),
    masthead(),
  ];
  if (showNav && nav.length) rows.push(row(navLinks(nav, editable), `background-color:${C.g100}; padding:10px 16px 11px 16px; text-align:center; font-family:${SANS}; font-size:13px; line-height:1.7; font-weight:700; color:${C.g700};`));
  return rows;
}

function introRows(issue, editable) {
  const list = splitParas(issue.intro);
  if (!list.length) return [];
  const hook = editAttrs('intro', null, 'intro', editable);
  // The "Want to feature something?" standing line is gone (Kate, Oct 5): the Share callout says it.
  const bodyStyle = `font-family:${SANS}; font-size:15px; line-height:1.55; color:${C.g900};`;
  const body = list.map((t, i) => p(bodyStyle, renderProse(t), i < list.length - 1 ? 14 : 0, hook)).join('');
  return [row(body, 'padding:26px 48px 0 24px;'), spacer(26)];
}

// ─── Sections ────────────────────────────────────────────────────────────────

function sectionHeadRows(def) {
  const anchor = `<a name="${def.anchor}" id="${def.anchor}" style="text-decoration:none; color:inherit;"></a>`;
  return [
    row('&nbsp;', `height:4px; background-color:${C.maroon}; font-size:0; line-height:0; padding:0;`),
    row(`<h2 style="margin:0; font-family:${SANS}; font-size:18px; line-height:1.3; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; color:${C.maroon};">${anchor}${esc(def.heading)}</h2>`, 'padding:20px 24px 0 24px;'),
  ];
}
const labelRow = (text, pt) => row(`<h3 style="margin:0; ${T.label}">${esc(text)}</h3>`, `padding:${pt}px 24px 0 24px;`);

/** An item's title: a link to its source, or a plain span when the url is
 *  missing or unsafe. Either way it carries the edit hook. */
function titleLink(sectionKey, item, editable) {
  const hooks = editAttrs(sectionKey, item.id, 'title', editable);
  const href = safeItemHref(item.fields.url);
  return href
    ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="color:${C.g900}; text-decoration:none;"${hooks}>${esc(item.fields.title)}</a>`
    : `<span${hooks}>${esc(item.fields.title)}</span>`;
}

/** The meta line's words and hooks: authors in Research; else fields.meta, else
 *  date | time | location (each hooked in the editable preview). */
function metaLine(def, item, mb, editable) {
  const f = item.fields;
  const style = T.meta;
  if (def.key === 'research') {
    return f.authors ? p(style, esc(f.authors), mb, editAttrs('research', item.id, 'authors', editable)) : '';
  }
  if (f.meta) return p(style, esc(f.meta), mb, editAttrs(def.key, item.id, 'meta', editable));
  const parts = ['date', 'time', 'location'].filter((k) => f[k]);
  if (!parts.length) return '';
  const content = editable
    ? parts.map((k) => `<span${editAttrs(def.key, item.id, k, editable)}>${esc(f[k])}</span>`).join(' | ')
    : parts.map((k) => esc(f[k])).join(' | ');
  return p(style, content, mb);
}

/** One item: title (the link), meta line, description; the picture as a 96px
 *  stamp beside the description, or a 160px headshot beside the whole item. */
function itemHtml(it, def, g, editable) {
  const f = it.fields;
  const sumOk = showsSummary(def, g.key, f);
  const w = pictureWidth(f, sumOk, editable);
  const hasMeta = def.key === 'research' ? !!f.authors : !!(f.meta || f.date || f.time || f.location);
  const title = (mb) => p(`${T.title} color:${C.g900};`, titleLink(def.key, it, editable), mb);
  const meta = (mb) => metaLine(def, it, mb, editable);
  const body = sumOk ? paras(T.body, f.summary, 8, editAttrs(def.key, it.id, 'summary', editable)) : '';
  const src = safeItemHref(f.image);
  const stamp = !w ? ''
    : !src ? placeholderPicture(w, def.key, it.id, editable)
    : `<a href="${esc(safeItemHref(f.url) || src)}" target="_blank" rel="noopener" style="display:block; text-decoration:none;"><img src="${esc(src)}" alt="${esc('Picture: ' + (f.title || ''))}" width="${w}" style="width:${w}px; max-width:${w}px; height:auto; display:block; border:0;"${editAttrs(def.key, it.id, 'image', editable)}></a>`;
  if (!w) return title(hasMeta || sumOk ? 4 : 0) + meta(sumOk ? 8 : 0) + body;
  // A headshot stands beside the whole item; a stamp sits under the title, beside the description.
  if (pictureStyleOf(f) === 'headshot') return twoCol(stamp, title(4) + meta(8) + body, w + PICTURE_GUTTER, 3);
  return title(4) + meta(8) + twoCol(stamp, body, w + PICTURE_GUTTER, 4);
}

function fullRows(def, editable) {
  const rows = [];
  def.groups.forEach((g, gi) => {
    const shows = (it) => showsSummary(def, g.key, it.fields);
    const brief = def.key === 'events' && !summaryAllowed(def, g.key);
    if (g.label) rows.push(labelRow(g.label, gi === 0 ? 18 : 30));
    g.items.forEach((it, ii) => {
      if (ii && brief) rows.push(rule(T.hair, '12px 48px 0 40px'));
      const tight = ii && !shows(it) && !shows(g.items[ii - 1]);
      const pt = ii === 0 ? 10 : brief ? 12 : tight ? 16 : 22;
      rows.push(row(itemHtml(it, def, g, editable), `padding:${pt}px 48px 0 40px;`));
    });
  });
  return rows;
}

function digestList(items, def, editable) {
  const n = items.length;
  const text = (it) => {
    const f = it.fields;
    const src = def.showSource && f.source ? ` <span style="color:${C.g600};">(${esc(f.source)})</span>` : '';
    return p(T.digest, titleLink(def.key, it, editable) + src);
  };
  return tbl(items.map((it, i) =>
    `<tr><td style="vertical-align:top; padding:${i ? 9 : 0}px 0 ${i === n - 1 ? 0 : 9}px 0;${i ? ` border-top:${T.hair};` : ''}">${text(it)}</td></tr>`).join(''));
}
function digestRows(def, editable) {
  const rows = [];
  def.groups.forEach((g, gi) => {
    const top = gi === 0 ? 18 : 30;
    if (g.label) rows.push(labelRow(g.label, top));
    rows.push(row(digestList(g.items, def, editable), `padding:${g.label ? 10 : top}px 48px 0 40px;`));
  });
  return rows;
}

const tailRow = (href) => row(`<a href="${esc(href)}" target="_blank" rel="noopener" style="${T.tail} text-decoration:none;">View more &#187;</a>`, 'padding:18px 48px 0 40px;');

function sectionRows(def, editable) {
  const rows = [...sectionHeadRows(def)];
  rows.push(...(def.kind === 'digest' ? digestRows(def, editable) : fullRows(def, editable)));
  if (def.tailUrl) rows.push(tailRow(def.tailUrl));
  rows.push(spacer(26));
  return rows;
}

// ─── The callout ─────────────────────────────────────────────────────────────

/**
 * One callout, in its style: the title, the text, an optional deadline line,
 * and the button. Each part carries its edit hook in the preview. Maroon is
 * its own panel; gray and dotted are a box inside the panel before it.
 */
function calloutRows(c, editable) {
  const hook = (field) => editAttrs('callout', c.id, field, editable);
  const href = safeItemHref(c.url);
  const btn = (bg, fg) => {
    const words = `${esc(c.button || 'Learn more')} &#187;`;
    return href ? button(words, esc(href), bg, fg).replace('<a href=', `<a${hook('button')} href=`) : button(words, '#', bg, fg).replace('<a href=', `<a${hook('button')} href=`);
  };
  const inner = (titleStyle, textColor, btnBg, btnFg, metaColor) =>
    p(titleStyle, esc(c.title), 8, hook('title'))
    + (c.text ? p(`font-family:${SANS}; font-size:15px; line-height:1.5; color:${textColor};`, renderProse(c.text), c.deadline ? 8 : 18, hook('text')) : '')
    + (c.deadline ? p(`font-family:${SANS}; font-size:14px; line-height:1.4; color:${metaColor};`, esc(c.deadline), 18, hook('deadline')) : '')
    + btn(btnBg, btnFg);
  const style = CALLOUT_STYLES.includes(c.style) ? c.style : 'maroon';
  const box = (td, titleColor) => [row(tbl(`<tr><td style="${td}">${inner(`font-family:${SANS}; font-size:18px; line-height:1.3; font-weight:700; color:${titleColor};`, C.g800, C.maroon, C.white, C.g700)}</td></tr>`), 'padding:28px 24px 0 24px;')];
  if (style === 'gray') return box(`background-color:${C.g100}; padding:22px 24px 24px 24px;`, C.g900);
  if (style === 'dotted') return box(`border:2px dotted ${C.maroonLight}; padding:20px 22px 22px 22px;`, C.maroon);
  return [row(inner(`font-family:${SANS}; font-size:18px; line-height:1.3; font-weight:700; color:${C.white};`, C.ivory, C.white, C.maroon, C.cream), `background-color:${C.maroon}; padding:26px 48px 28px 24px;`)];
}

/**
 * Where each callout lands: after the section it names when that section
 * renders, else after the nearest earlier one that does, else after the
 * intro. Returns a map of anchor key ('intro' or a section key) to callouts.
 */
function calloutsByAnchor(issue, renderedKeys) {
  const order = SECTION_REGISTRY.map((s) => s.key);
  const out = new Map();
  for (const c of calloutsOf(issue)) {
    let anchor = 'intro';
    const at = order.indexOf(c.after);
    for (let i = at; i >= 0; i--) if (renderedKeys.includes(order[i])) { anchor = order[i]; break; }
    if (!out.has(anchor)) out.set(anchor, []);
    out.get(anchor).push(c);
  }
  return out;
}

/** The callouts after one anchor, as panel parts: gray and dotted go inside
 *  `rows` before its closing spacer; maroon stands alone after it. */
function placeCallouts(parts, rows, callouts, editable) {
  const inside = [], alone = [];
  for (const c of callouts) ((CALLOUT_STYLES.includes(c.style) ? c.style : 'maroon') === 'maroon' ? alone : inside).push(c);
  if (rows) {
    for (const c of inside) rows.splice(rows.length - 1, 0, ...calloutRows(c, editable));
    parts.push(rows);
  } else {
    // No panel to sit inside (after the intro, or before any section): each gets its own.
    for (const c of inside) parts.push([...calloutRows(c, editable), spacer(26)]);
  }
  for (const c of alone) parts.push(calloutRows(c, editable));
}

// ─── Footer, preheader, document ─────────────────────────────────────────────

function footerRows(issue) {
  const link = (href, t) => `<a href="${href}" target="_blank" rel="noopener" style="color:${C.white}; text-decoration:none;">${t}</a>`;
  const dot = ` <span style="padding:0 6px; font-weight:400; color:${C.cream};">&#183;</span> `;
  return [
    row(`<img width="190" height="50" src="${LOCKUP}" alt="Texas A&amp;M University Education Research Center" style="width:190px; height:50px; display:block; border:0;">`, `background-color:${C.maroon}; padding:28px 24px 20px 24px;`),
    row(`<div style="border-top:1px solid ${C.maroonLight}; font-size:1px; line-height:1px;">&nbsp;</div>`, `background-color:${C.maroon}; padding:0 24px;`),
    row(tbl(`<tr><td style="font-family:${SANS}; font-size:14px; line-height:1.5; font-weight:700; color:${C.white};">${link(URLS.site, 'Website')}${dot}${link(URLS.email, 'Email')}${dot}${link(URLS.join, 'Join&nbsp;the&nbsp;mailing&nbsp;list')}</td><td align="right" style="text-align:right; font-family:${SANS}; font-size:13px; line-height:1.5; color:${C.cream}; white-space:nowrap;">${esc(issue.date || '')}</td></tr>`), `background-color:${C.maroon}; padding:14px 24px 24px 24px;`),
  ];
}

function preheader(issue) {
  const first = plain(splitParas(issue.intro)[0] || '');
  if (!first) return '';
  return `<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${esc(first)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>`;
}

/** The email's body: the stacked panels on the gray page. */
export function renderBody(issue, opts = {}) {
  const editable = opts.editable === true;
  const { nav: showNav } = layoutOf(issue);
  const secs = buildSections(issue);
  const nav = secs.map((s) => ({ anchor: s.anchor, short: s.short }));
  const parts = [headerRows(issue, nav, showNav, editable)];
  const intro = introRows(issue, editable);
  if (intro.length) parts.push(intro);
  const callouts = calloutsByAnchor(issue, secs.map((s) => s.key));
  if (callouts.has('intro')) placeCallouts(parts, null, callouts.get('intro'), editable);
  for (const def of secs) {
    const rows = sectionRows(def, editable);
    if (callouts.has(def.key)) placeCallouts(parts, rows, callouts.get(def.key), editable);
    else parts.push(rows);
  }
  parts.push(footerRows(issue));
  const sheet = (rows) => `<table align="center" width="640" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:640px; margin:0 auto; background-color:${C.white};"><tbody>\n${rows.join('\n')}\n</tbody></table>`;
  const gap = (h) => `<table align="center" width="640" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:640px; margin:0 auto;"><tbody>${spacer(h)}</tbody></table>`;
  const inner = parts.map(sheet).join(gap(12)) + gap(24);
  return preheader(issue) +
    `<div lang="en" style="background-color:${C.g200}; margin:0px;">` +
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${C.g200}; width:100%;"><tbody><tr><td>${inner}</td></tr></tbody></table></div>`;
}

// Dark-mode guards: every background and text colour the email uses, pinned.
const BGS = [C.white, C.g100, C.g200, C.maroon, C.maroonDark, C.g900];
const INKS = [C.g900, C.g800, C.g700, C.g600, C.maroon, C.maroonLight, C.white, C.cream, C.ivory, C.g300, C.g400];
function guards() {
  const bg = (sel) => BGS.map((c) => `${sel}[style*="background-color:${c}"] { background-color:${c} !important; }`).join('\n  ');
  const ink = (sel) => INKS.map((c) => `${sel}[style*=" color:${c}"] { color:${c} !important; }`).join('\n  ');
  return `${bg('[data-ogsc] ')}\n  ${bg('[data-ogsb] ')}\n  ${ink('[data-ogsc] ')}\n  ${ink('[data-ogsb] ')}\n  @media (prefers-color-scheme: dark) {\n  ${bg('')}\n  ${ink('')}\n  }`;
}

/** The paste-ready document. opts.editable adds the data-edit-* hooks the builder's preview clicks on. */
export function renderNewsletter(issue, opts = {}) {
  const title = `ERC Newsletter | ${issue.date || ''}`;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${esc(title)}</title>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style type="text/css">
  body { font-size: 16px; word-break: break-word; margin: 0; }
  P { margin-top:0; margin-bottom:0; }
  :root { color-scheme: light only; supported-color-schemes: light only; }
  ${guards()}
</style>
</head>
<body dir="ltr">
${renderBody(issue, opts)}
</body>
</html>`;
}
