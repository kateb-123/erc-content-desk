/**
 * template.js — HTML renderer for the ERC Newsletter
 * Ports markup verbatim from newsletters/next-issue/ERC_Newsletter_next.html
 */

import { SECTION_REGISTRY } from './model.js';

// ─── Escape helper ─────────────────────────────────────────────────────────────
export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Prose helper ──────────────────────────────────────────────────────────────

/**
 * Escapes all text, converting [label](href) markdown links into a maroon
 * underlined <a target="_blank" rel="noopener">. No data-edit-* attributes.
 */
const SAFE_HREF_SCHEME = /^(https?:|mailto:|#|\/)/i;

/** An item url only becomes an href when its scheme is safe — same rule
 *  renderProse applies to markdown links. Unsafe links render as plain text. */
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

/**
 * Applies **bold** and *italic* to ALREADY-ESCAPED text. Run after esc() so the
 * markers (`*`) survive escaping and can't corrupt generated tag/attribute HTML.
 */
function applyEmphasis(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

export function renderProse(text) {
  if (!text) return '';
  // Swap links out for tokens, style the whole run, then put the anchors back —
  // so **bold [across](url) a link** stays one bold run.
  const re = /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g;
  const links = [];
  const tokenized = String(text).replace(re, (m, label, href) => { links.push({ label, href: normalizeHref(href) }); return `\u0000${links.length - 1}\u0000`; });
  return applyEmphasis(esc(tokenized)).replace(/\u0000(\d+)\u0000/g, (m, i) => {
    const { label, href } = links[Number(i)];
    const inner = applyEmphasis(esc(label));
    return SAFE_HREF_SCHEME.test(href)
      ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="color: #500000; text-decoration: underline;">${inner}</a>`
      : inner;
  });
}

/** A blurb as one or more paragraphs (blank line = paragraph break), in the body style. */
function proseParas(text, attrs = '') {
  const paras = String(text ?? '').split(/\n\s*\n+/).map(t => t.trim()).filter(Boolean);
  return paras.map((t, i) => `<p style="margin:${i < paras.length - 1 ? '0 0 8px' : '0'}; line-height: 1.5; font-family: ${FONT_BODY}; font-size: 14px; color: #404040;"${attrs}>${renderProse(t)}</p>`).join('\n');
}

// ─── Edit-hook helper ─────────────────────────────────────────────────────────

/**
 * Returns data-edit-* attribute string when editable=true, else ''.
 * Omits data-edit-item when itemId is null/undefined (intro case).
 * All attribute VALUES are esc()'d.
 */
function editAttrs(section, itemId, field, editable) {
  if (!editable) return '';
  const secAttr = ` data-edit-section="${esc(section)}"`;
  const itemAttr = itemId != null ? ` data-edit-item="${esc(String(itemId))}"` : '';
  const fieldAttr = ` data-edit-field="${esc(field)}"`;
  return secAttr + itemAttr + fieldAttr;
}

// ─── Item media: the stamp ───────────────────────────────────────────────────
// Spec: docs/superpowers/specs/2026-09-02-newsletter-media-layout.md (Decision, as revised).

/** The stamp: at most 96px wide, never taller than the text beside it. Pictures
 *  are photos, so a portrait headshot (4:5, 1.25× taller than wide) is the
 *  tallest shape assumed; wider photos come out shorter. Dropped below 40px. */
const STAMP = { max: 96, min: 40, gutter: 14, ratio: 1.25 };
/** The item text column: 640px sheet, 40px indent, 48px right padding. */
const ITEM_COLUMN = 640 - 40 - 48;

/** Estimated height (px) of the paragraphs beside a stamp: lines × line-height
 *  plus bottom margins, at the narrowest text column a stamp can leave. */
function textHeight(rest) {
  const cpl = (ITEM_COLUMN - (STAMP.max + 2 + STAMP.gutter)) / 6.3; // ~14px Trebuchet MS
  let h = 0;
  for (const m of rest.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)) {
    const text = m[2].replace(/<[^>]+>/g, '').replace(/&[^;\s]+;/g, 'x');
    const lines = Math.max(1, Math.ceil(text.length / cpl));
    const lineHeight = /line-height: 1\.5/.test(m[1]) ? 21 : 19.6;
    const margin = Number((m[1].match(/margin:0 0 (\d+)px/) || [0, 0])[1]);
    h += lines * lineHeight + margin;
  }
  return h;
}

/**
 * Sets an item's picture as a small "stamp" under the title, to the left of
 * the authors/meta and blurb: a two-cell table, the picture never cropped,
 * linking to the full-size picture. The stamp is sized from the text beside
 * it so it never stands taller than that text (96px at most, none below
 * 40px). Items without a blurb, without a picture, or with an unsafe URL
 * render title and text exactly as before. Pictures are photos, never flyers.
 */
function withStamp(title, rest, fields, sectionKey, itemId, editable, hasBlurb) {
  const src = safeItemHref(fields.image);
  const w = src && hasBlurb ? Math.min(STAMP.max, Math.floor(textHeight(rest) / STAMP.ratio)) : 0;
  if (w < STAMP.min) return `${title}\n${rest}`;
  const cellW = w + 2 + STAMP.gutter; // picture + its 1px border each side + one gutter, so Word and browser box models agree
  const img = `<a href="${esc(src)}" target="_blank" rel="noopener" style="display:block; text-decoration:none;"><img src="${esc(src)}" alt="Picture: ${esc(fields.title || '')}" width="${w}" style="width:${w}px; max-width:${w}px; height:auto; display:block; border:1px solid #e6e2dd; border-radius:3px;"${editAttrs(sectionKey, itemId, 'image', editable)}></a>`;
  return `${title}\n<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;"><tbody><tr><td valign="top" width="${cellW}" style="width:${cellW}px; vertical-align:top; padding:2px 0 0 0;">${img}</td><td valign="top" style="vertical-align:top;">\n${rest}\n</td></tr></tbody></table>`;
}

/** Items that can render: a title is the one field every item needs. */
const titled = items => (items || []).filter(i => String(i?.fields?.title ?? '').trim());

// ─── Common snippets ──────────────────────────────────────────────────────────

const FONT_BODY = "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif";
const FONT_HEAD = 'Verdana, Geneva, Tahoma, sans-serif';

/** 14px spacer row between section tables (the sheet is 640px wide) */
const SPACER_14 = `<!-- spacer --><table align="center" width="640" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 640px; margin: 0 auto; background-color: rgb(255, 255, 255);"><tbody><tr><td style="height: 14px; font-size: 1px; line-height: 14px;">&nbsp;</td></tr></tbody></table>`;

/** File-tab section header */
function sectionHeader(id, label) {
  return `<tr><td style="padding: 16px 24px 0 8px; border-bottom: 3px solid #500000;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tbody><tr><td style="background-color: rgb(80, 0, 0); padding: 7px 16px 8px 16px; border-radius: 8px 8px 0 0;">
<h2 id="${esc(id)}" style="margin:0; font-family: ${FONT_HEAD}; font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;"><a name="${esc(id)}" style="text-decoration:none;color:inherit;"></a>${esc(label)}</h2>
</td></tr></tbody></table>
</td></tr>`;
}

/** Eyebrow group label — first group top padding 18px, subsequent 24px */
function eyebrow(label, first = false) {
  const topPad = first ? '18px' : '32px';
  return `<tr><td style="padding: ${topPad} 24px 0 24px;">
<h3 style="margin:0; font-family: ${FONT_HEAD}; font-size: 13px; font-weight: 700; color: #913B3B; text-transform: uppercase; letter-spacing: 1.1px;">${esc(label)}</h3>
</td></tr>`;
}

/** Thin divider line */
const DIVIDER = `<tr><td style="padding: 12px 48px 0 40px;"><div style="border-top: 1px solid #e6e2dd; line-height: 1px; font-size: 1px;">&nbsp;</div></td></tr>`;

/** "See more on the ERC website →" right-justified tail link. Omitted when the section has no URL. */
function seeMore(href) {
  const h = safeItemHref(href);
  if (!h) return '';
  return `<tr><td style="padding: 10px 24px 22px 24px; text-align: right;">
<a href="${esc(h)}" target="_blank" rel="noopener" style="color: #767676; text-decoration: none; font-family: ${FONT_BODY}; font-size: 14px; font-weight: 700;">See more on the ERC website &#8594;</a>
</td></tr>`;
}
/** A section's tail-link URL: the issue may override the registry default; '' turns the row off. */
const seeMoreUrl = (sec, secReg) => (sec.seeMoreUrl !== undefined ? sec.seeMoreUrl : secReg.seeMoreUrl);

// ─── Per-kind builders ────────────────────────────────────────────────────────

/**
 * Builds the ERC Research section (kind: briefs).
 * Groups items under their research group eyebrow (Research Brief, then Report);
 * followed by compact Submit callout.
 */
function buildBriefs(sec, editable = false) {
  const items = titled(sec.items);
  if (!sec.enabled || !items.length) return '';
  let rows = sectionHeader('research', 'ERC Research');

  const researchReg = SECTION_REGISTRY.find(s => s.key === 'research');
  const groupOrder = researchReg.groups.map(g => g.key);
  const byGroup = {};
  for (const item of items) {
    const gk = groupOrder.includes(item.group) ? item.group : 'brief';
    (byGroup[gk] = byGroup[gk] || []).push(item);
  }
  const present = groupOrder.filter(gk => byGroup[gk]);

  let firstGroup = true;
  for (const gk of present) {
    const groupDef = researchReg.groups.find(g => g.key === gk);
    rows += eyebrow(groupDef.label, firstGroup);
    firstGroup = false;
    const items = byGroup[gk];
    items.forEach((item, i) => {
      const { fields } = item;
      const href = safeItemHref(fields.url);
      const titleLink = href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="color:#202020;text-decoration:none;"${editAttrs('research', item.id, 'title', editable)}>${esc(fields.title)}</a>`
        : `<span${editAttrs('research', item.id, 'title', editable)}>${esc(fields.title)}</span>`;
      const topPad = i === 0 ? '13px' : '12px';
      const title = `<p style="margin:0 0 4px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 16px; font-weight: 700; color: #202020;">${titleLink}</p>`;
      const rest = `${fields.authors ? `<p style="margin:0 0 8px; line-height: 1.4; font-family: ${FONT_BODY}; font-size: 14px; color: #5C5C5C;"${editAttrs('research', item.id, 'authors', editable)}>${esc(fields.authors)}</p>` : ''}
${fields.summary ? proseParas(fields.summary, editAttrs('research', item.id, 'summary', editable)) : ''}`;
      rows += `
<tr><td style="padding: ${topPad} 48px 0 40px;">
${withStamp(title, rest, fields, 'research', item.id, editable, !!fields.summary)}
</td></tr>`;
      if (i < items.length - 1) rows += DIVIDER;
    });
  }

  // Submit callout — optional, toggled per issue in Triage (default on).
  if (sec.showSubmit !== false) {
    rows += `
<tr><td style="padding: 20px 24px 22px 24px;">
<table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:80%; background-color:#f6f6f6; margin:0 auto;"><tbody><tr><td style="padding: 14px 22px;">
<p style="margin:0 0 5px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 14px; font-weight: 700;"><a href="https://forms.office.com/Pages/ResponsePage.aspx?id=44HzaNpGuUe6V28yK48NoV5eaARTlZdIspuMdxu3p_lUQkwwS0pRMzgzTlE2MktPRjZCRDcwUDgxRS4u" target="_blank" rel="noopener" style="color: #500000; text-decoration: none;">Submit Your Research for an ERC Research Brief &#8594;</a></p>
<p style="margin:0; line-height: 1.5; font-family: ${FONT_BODY}; font-size: 13px; color: #404040;">Working on research that could reach a broader audience? The ERC is accepting submissions for a research brief or other public-facing product &#8212; share a recent publication or working paper.</p>
</td></tr></tbody></table>
</td></tr>`;
  }

  return wrapSection(rows);
}

/**
 * Builds grouped-list sections (events, opportunities).
 * Events: featured group gets a description; others title+meta only.
 * Opportunities: title+meta only for all groups.
 */
function buildGroupedList(secReg, sec, editable = false) {
  const items = titled(sec.items);
  if (!sec.enabled || !items.length) return '';

  const isEvents = secReg.key === 'events';
  const anchorId = secReg.key === 'events' ? 'events' : 'opportunities';
  const label = secReg.label;

  let rows = sectionHeader(anchorId, label);

  // Collect groups present in items, in SECTION_REGISTRY group order
  const groupOrder = secReg.groups.map(g => g.key);
  const groupMap = {};
  for (const item of items) {
    const gk = item.group || '';
    if (!groupMap[gk]) groupMap[gk] = [];
    groupMap[gk].push(item);
  }

  // Sort groups by registry order; unknown groups appended at end
  const presentGroups = [];
  for (const gk of groupOrder) {
    if (groupMap[gk]) presentGroups.push(gk);
  }
  for (const gk of Object.keys(groupMap)) {
    if (!groupOrder.includes(gk)) presentGroups.push(gk);
  }

  let firstGroup = true;
  let featuredDividerNeeded = false;

  for (const gk of presentGroups) {
    const items = groupMap[gk];
    const groupDef = secReg.groups.find(g => g.key === gk);
    const groupLabel = groupDef ? groupDef.label : gk;

    rows += eyebrow(groupLabel, firstGroup);
    firstGroup = false;

    const isFeaturedGroup = gk === 'featured';

    items.forEach((item, i) => {
      const { fields, featured } = item;
      const topPad = i === 0 ? '7px' : '12px';
      const sectionKey = secReg.key;
      const href = safeItemHref(fields.url);
      const titleLink = href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="color:#202020;text-decoration:none;"${editAttrs(sectionKey, item.id, 'title', editable)}>${esc(fields.title || '')}</a>`
        : `<span${editAttrs(sectionKey, item.id, 'title', editable)}>${esc(fields.title || '')}</span>`;

      // Build meta line: date | time | location
      const metaParts = [fields.date, fields.time, fields.location].filter(Boolean);
      const metaLine = metaParts.length
        ? `<p style="margin:0 0 5px; line-height: 1.4; font-family: ${FONT_BODY}; font-size: 14px; color: #5C5C5C;"${editAttrs(sectionKey, item.id, 'meta', editable)}>${metaParts.map(esc).join(' | ')}</p>`
        : '';

      // Description only for featured events
      const descLine = (isFeaturedGroup || featured) && fields.summary
        ? proseParas(fields.summary, editAttrs(sectionKey, item.id, 'summary', editable))
        : '';

      // For opportunities: use fields.meta as the meta line
      const oppMeta = !isEvents && fields.meta
        ? `<p style="margin:0; line-height: 1.4; font-family: ${FONT_BODY}; font-size: 14px; color: #5C5C5C;"${editAttrs(sectionKey, item.id, 'meta', editable)}>${esc(fields.meta)}</p>`
        : '';

      // Divider between items within same group (not after featured group — uses section divider)
      const needsItemDivider = isEvents && i < items.length - 1;

      if (isEvents) {
        const title = `<p style="margin:0 0 4px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 16px; font-weight: 700; color: #202020;">${titleLink}</p>`;
        const rest = `${metaLine}
${descLine}`;
        rows += `<tr><td style="padding: ${topPad} 48px 0 40px;">
${withStamp(title, rest, fields, sectionKey, item.id, editable, descLine !== '')}
</td></tr>`;
        if (needsItemDivider) {
          rows += `<tr><td style="padding: 12px 48px 0 40px;"><div style="border-top: 1px solid #e6e2dd; line-height: 1px; font-size: 1px;">&nbsp;</div></td></tr>`;
        }
      } else {
        const title = `<p style="margin:0 0 4px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 16px; font-weight: 700; color: #202020;">${titleLink}</p>`;
        const rest = `${oppMeta}`;
        rows += `<tr><td style="padding: ${topPad} 48px 0 40px;">
${withStamp(title, rest, fields, sectionKey, item.id, editable, false)}
</td></tr>`;
      }
    });

    // After featured group in events: add a section-level divider
    if (isFeaturedGroup && isEvents) {
      rows += `<tr><td style="padding: 16px 48px 0 24px;"><div style="border-top: 1px solid #e6e2dd; line-height: 1px; font-size: 1px;">&nbsp;</div></td></tr>`;
    }
  }

  // See more link for opportunities
  if (!isEvents) {
    rows += seeMore(seeMoreUrl(sec, secReg));
  } else {
    // closing bottom padding for events last item
    rows += `<tr><td style="height: 22px; font-size: 1px; line-height: 22px;">&nbsp;</td></tr>`;
  }

  return wrapSection(rows);
}

/**
 * Builds digest sections (policy, headlines) — grouped bullet lists.
 * Policy: title link only. Headlines: title + (Source) inline.
 */
function buildGroupedDigest(secReg, sec, editable = false) {
  const items = titled(sec.items);
  if (!sec.enabled || !items.length) return '';

  const isHeadlines = secReg.key === 'headlines';
  const anchorId = anchorIdForSection(secReg.key);
  const label = secReg.label;

  let rows = sectionHeader(anchorId, label);

  // Group items by group key in registry order
  const groupOrder = secReg.groups.map(g => g.key);
  const groupMap = {};
  for (const item of items) {
    const gk = item.group || '';
    if (!groupMap[gk]) groupMap[gk] = [];
    groupMap[gk].push(item);
  }

  const presentGroups = [];
  for (const gk of groupOrder) {
    if (groupMap[gk]) presentGroups.push(gk);
  }
  for (const gk of Object.keys(groupMap)) {
    if (!groupOrder.includes(gk)) presentGroups.push(gk);
  }

  for (const gk of presentGroups) {
    const items = groupMap[gk];
    const groupDef = secReg.groups.find(g => g.key === gk);
    const groupLabel = groupDef ? groupDef.label : gk;

    const groupHeading = groupLabel
      ? `<h3 style="margin:0 0 9px; font-family: ${FONT_HEAD}; font-size: 13px; font-weight: 700; color: #913B3B; text-transform: uppercase; letter-spacing: 1.1px;">${esc(groupLabel)}</h3>\n`
      : '';
    rows += `<tr><td style="padding: 18px 24px 0 24px;">
${groupHeading}<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;"><tbody>`;

    items.forEach((item, i) => {
      const { fields } = item;
      const isLast = i === items.length - 1;
      const bottomPad = isLast ? '0' : '7px';

      const sectionKey = secReg.key;
      const href = safeItemHref(fields.url);
      const titleLink = href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="color:#202020;text-decoration:none;"${editAttrs(sectionKey, item.id, 'title', editable)}>${esc(fields.title || '')}</a>`
        : `<span${editAttrs(sectionKey, item.id, 'title', editable)}>${esc(fields.title || '')}</span>`;

      // Headlines: append (Source) after the title link
      const sourcePart = isHeadlines && fields.source
        ? ` <span style="color:#7A6A6A; font-size:14px;">(${esc(fields.source)})</span>`
        : '';

      rows += `<tr>
<td style="vertical-align:top; width:14px; padding:0 8px ${bottomPad} 16px;"><span style="font-family:${FONT_BODY}; font-size:14px; line-height:1.4; color:#202020;">&#8226;</span></td>
<td style="vertical-align:top; padding:0 0 ${bottomPad} 0;"><p style="margin:0; line-height:1.4; font-family:${FONT_BODY}; font-size:14px;">${titleLink}${sourcePart}</p></td>
</tr>`;
    });

    rows += `</tbody></table>
</td></tr>`;
  }

  rows += seeMore(seeMoreUrl(sec, secReg));

  return wrapSection(rows);
}

/**
 * Builds the ERC Spotlight section (kind: spotlight).
 * Groups: programs, events, thisandthat — in registry order, only groups present in items.
 * All groups: bold title link + meta (or date | time | location) + optional summary.
 */
function buildSpotlight(secReg, sec, editable = false) {
  const items = titled(sec.items);
  if (!sec.enabled || !items.length) return '';

  let rows = sectionHeader('spotlight', 'ERC Spotlight');

  // Build group map from items
  const groupOrder = secReg.groups.map(g => g.key);
  const groupMap = {};
  for (const item of items) {
    const gk = item.group || '';
    if (!groupMap[gk]) groupMap[gk] = [];
    groupMap[gk].push(item);
  }

  // Collect present groups in registry order, unknown groups appended
  const presentGroups = [];
  for (const gk of groupOrder) {
    if (groupMap[gk]) presentGroups.push(gk);
  }
  for (const gk of Object.keys(groupMap)) {
    if (!groupOrder.includes(gk)) presentGroups.push(gk);
  }

  let firstGroup = true;

  for (const gk of presentGroups) {
    const items = groupMap[gk];
    const groupDef = secReg.groups.find(g => g.key === gk);
    const groupLabel = groupDef ? groupDef.label : gk;

    rows += eyebrow(groupLabel, firstGroup);
    firstGroup = false;

    // All spotlight groups render the same: bold title link + meta (or
    // date | time | location) + optional summary.
    items.forEach((item, i) => {
        const { fields } = item;
        const topPad = i === 0 ? '7px' : '12px';
        const href = safeItemHref(fields.url);
      const titleLink = href
          ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="color:#202020;text-decoration:none;"${editAttrs('spotlight', item.id, 'title', editable)}>${esc(fields.title || '')}</a>`
          : `<span${editAttrs('spotlight', item.id, 'title', editable)}>${esc(fields.title || '')}</span>`;

        // Meta: use fields.meta if present (hook the meta field); otherwise
        // build from date | time | location and hook EACH sub-field so clicking
        // edits the value actually shown (not a phantom empty `meta`).
        const metaStyle = `margin:0 0 5px; line-height: 1.4; font-family: ${FONT_BODY}; font-size: 14px; color: #5C5C5C;`;
        let metaLine = '';
        if (fields.meta) {
          metaLine = `<p style="${metaStyle}"${editAttrs('spotlight', item.id, 'meta', editable)}>${esc(fields.meta)}</p>`;
        } else {
          const subParts = [
            fields.date ? `<span${editAttrs('spotlight', item.id, 'date', editable)}>${esc(fields.date)}</span>` : '',
            fields.time ? `<span${editAttrs('spotlight', item.id, 'time', editable)}>${esc(fields.time)}</span>` : '',
            fields.location ? `<span${editAttrs('spotlight', item.id, 'location', editable)}>${esc(fields.location)}</span>` : '',
          ].filter(Boolean);
          if (subParts.length) {
            // editable: clickable spans; export: plain joined text (no spans/hooks)
            const plain = [fields.date, fields.time, fields.location].filter(Boolean).map(esc).join(' | ');
            const content = editable ? subParts.join(' | ') : plain;
            metaLine = `<p style="${metaStyle}">${content}</p>`;
          }
        }

        const summaryLine = fields.summary
          ? proseParas(fields.summary, editAttrs('spotlight', item.id, 'summary', editable))
          : '';

        const title = `<p style="margin:0 0 4px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 16px; font-weight: 700; color: #202020;">${titleLink}</p>`;

        const rest = `${metaLine}
${summaryLine}`;
        rows += `<tr><td style="padding: ${topPad} 48px 0 40px;">
${withStamp(title, rest, fields, 'spotlight', item.id, editable, summaryLine !== '')}
</td></tr>`;

        if (i < items.length - 1) {
          rows += `<tr><td style="padding: 12px 48px 0 40px;"><div style="border-top: 1px solid #e6e2dd; line-height: 1px; font-size: 1px;">&nbsp;</div></td></tr>`;
        }
      });
  }

  // Closing bottom padding
  rows += `<tr><td style="height: 22px; font-size: 1px; line-height: 22px;">&nbsp;</td></tr>`;

  return wrapSection(rows);
}

/** Wraps section rows in the standard 640px centered white table */
function wrapSection(rows) {
  return `<table align="center" width="640" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 640px; margin: 0 auto; background-color: rgb(255, 255, 255);">
<tbody>
${rows}
</tbody>
</table>`;
}

// ─── Anchor-id map (must match the ids emitted by each section builder) ───────

/**
 * Returns the HTML anchor id that each section builder emits via sectionHeader().
 * Keep in sync with buildBriefs, buildGroupedList, buildGroupedDigest, buildSpotlight.
 */
function anchorIdForSection(sectionKey) {
  switch (sectionKey) {
    case 'research':      return 'research';
    case 'spotlight':     return 'spotlight';
    case 'events':        return 'events';
    case 'opportunities': return 'opportunities';
    case 'policy':        return 'policy';
    case 'headlines':     return 'news';
    default:              return sectionKey;
  }
}

// ─── Header / masthead / intro / footer ──────────────────────────────────────

function buildHeader(issue, editable = false) {
  const imgSrc = issue.headerImageUrl || 'https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/builder/images/newsletter-masthead.png';
  const date = issue.date || '';

  // Build jump-nav dynamically from enabled sections in SECTION_REGISTRY order.
  // Only sections that are enabled AND have items appear — same guard the builders use.
  const navLinks = SECTION_REGISTRY
    .filter(secReg => {
      const sec = issue.sections[secReg.key];
      return sec && sec.enabled && titled(sec.items).length > 0;
    })
    .map(secReg => {
      const anchor = anchorIdForSection(secReg.key);
      const navText = secReg.navLabel ?? secReg.label;
      return `<a href="#${anchor}" style="color: rgb(83, 83, 83); text-decoration: none; font-weight: 700;">${esc(navText)}</a>`;
    });
  const navHtml = navLinks.join(' &nbsp;|&nbsp; ');

  return `<table align="center" width="640" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 640px; margin: 0 auto; background-color: rgb(255, 255, 255);">
<tbody>
<tr>
<td align="left" width="50%" style="padding: 15px 15px; font-family: ${FONT_BODY}; font-size: 15px; font-weight: 700; color: #500000;">${esc(date)}</td>
<td align="right" width="50%" style="padding: 15px 15px; font-family: ${FONT_BODY}; font-size: 15px; color: rgb(97, 30, 30);">
<a href="https://erc.cehd.tamu.edu/" target="_blank" rel="noopener" style="color: rgb(97, 30, 30); text-decoration: none; padding: 0 5px;">Website</a><span style="color: #202020;"> | </span><a href="https://erc-kate.github.io/erc-tools/listserv-signup/" target="_blank" rel="noopener" style="color: rgb(97, 30, 30); text-decoration: none; padding: 0 5px;">Join the mailing list</a>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding: 0;">
<img width="640" src="${esc(imgSrc)}" alt="Education Research Center Newsletter" style="width: 100%; max-width: 640px; height: auto; display: block; border: 0;">
</td>
</tr>
<tr>
<td colspan="2" style="background-color: #f6f6f6; padding: 9px 15px;">
<p style="text-align: center; line-height: 1.7; margin: 0px; font-family: ${FONT_BODY}; font-size: 14px; color: #202020;">${navHtml}</p>
</td>
</tr>
<tr>
<td colspan="2" style="padding: 24px 48px 30px 24px;">
${buildIntro(issue.intro, editable)}
</td>
</tr>
</tbody>
</table>`;
}

function buildIntro(introText, editable = false) {
  if (!introText) return '';
  const paras = introText.split(/\n\n+/).filter(Boolean);
  if (paras.length === 0) return '';
  const styled = paras.map((p, i) => {
    const margin = i < paras.length - 1 ? 'margin: 0px 0px 12px;' : 'margin: 0px;';
    return `<p style="text-align: left; line-height: 1.5; ${margin} font-family: ${FONT_BODY}; font-size: 14px; color: #202020;"${editAttrs('intro', null, 'intro', editable)}>${renderProse(p.trim())}</p>`;
  });
  return styled.join('\n');
}

function buildFooter() {
  return `<table align="center" width="640" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 640px; margin: 0 auto; background-color: rgb(80, 0, 0);">
<tbody>
<tr>
<td align="center" style="color:#ffffff; padding: 26px 24px 24px; text-align: center;">
<img width="190" height="50" src="https://i.ibb.co/JjQWyZq3/ERC-Horizontal-White-Text-narrow.png" alt="Texas A&amp;M University Education Research Center" style="color:#ffffff; height: 50px; width: auto; max-width: 100%; display: inline-block; border: 0;">
<p style="line-height: 1.45; margin: 16px 0 0; text-align: center; font-family: ${FONT_BODY}; font-size: 13px;">
<span style="white-space: nowrap;">
<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><a href="https://erc.cehd.tamu.edu/" target="_blank" rel="noopener" style="color: #ffffff; text-decoration: none; font-weight: 700; font-family: ${FONT_BODY}; font-size: 13px; vertical-align: middle;">Website</a>
</span>
<span style="color: rgba(255,255,255,0.4); padding: 0 12px;">&#183;</span>
<span style="white-space: nowrap;">
<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:erc@tamu.edu" style="color: #ffffff; text-decoration: none; font-weight: 700; font-family: ${FONT_BODY}; font-size: 13px; vertical-align: middle;">Email</a>
</span>
<span style="color: rgba(255,255,255,0.4); padding: 0 12px;">&#183;</span>
<span style="white-space: nowrap;">
<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg><a href="https://erc-kate.github.io/erc-tools/listserv-signup/" target="_blank" rel="noopener" style="color: #ffffff; text-decoration: none; font-weight: 700; font-family: ${FONT_BODY}; font-size: 13px; vertical-align: middle;">Join the mailing list</a>
</span>
</p></td>
</tr>
</tbody>
</table>`;
}

/** Inbox preview text: issue.preheader, else the intro's first sentence as plain text. */
function preheader(issue) {
  let text = String(issue.preheader ?? '').trim();
  if (!text) {
    const plain = String(issue.intro ?? '')
      .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
      .replace(/\*\*?([^*]+)\*\*?/g, '$1')
      .replace(/\s+/g, ' ').trim();
    // Take whole sentences until there is enough to preview on (a lone "Howdy!" is not a preview).
    const sentences = plain.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [plain];
    text = '';
    for (const sentence of sentences) { text = (text + ' ' + sentence.trim()).trim(); if (text.length >= 60) break; }
    text = text.slice(0, 140);
  }
  if (!text) return '';
  return `<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${esc(text)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>`;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function renderNewsletter(issue, opts = {}) {
  const editable = opts.editable === true;
  const parts = [];

  // Outer wrapper + head
  parts.push(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>ERC Newsletter | ${esc(issue.date)}</title>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style type="text/css">
  body { font-size: 16px; word-break: break-word; }
  P { margin-top:0; margin-bottom:0; }
  :root { color-scheme: light only; supported-color-schemes: light only; }
  /* ===== Keep the light design legible in dark mode (Outlook.com + Apple/Gmail) ===== */
  [data-ogsc] td[style*="rgb(255, 255, 255)"], [data-ogsb] td[style*="rgb(255, 255, 255)"],
  [data-ogsc] table[style*="rgb(255, 255, 255)"], [data-ogsb] table[style*="rgb(255, 255, 255)"] { background-color:#ffffff !important; }
  [data-ogsc] table[style*="#f6f6f6"], [data-ogsb] table[style*="#f6f6f6"], [data-ogsc] td[style*="#f6f6f6"], [data-ogsb] td[style*="#f6f6f6"] { background-color:#f6f6f6 !important; }
  [data-ogsc] td[style*="rgb(80, 0, 0)"], [data-ogsb] td[style*="rgb(80, 0, 0)"],
  [data-ogsc] table[style*="rgb(80, 0, 0)"], [data-ogsb] table[style*="rgb(80, 0, 0)"] { background-color:#500000 !important; }
  [data-ogsc] p[style*="#202020"], [data-ogsb] p[style*="#202020"],
  [data-ogsc] a[style*="#202020"], [data-ogsb] a[style*="#202020"] { color:#202020 !important; }
  [data-ogsc] p[style*="#404040"], [data-ogsb] p[style*="#404040"] { color:#404040 !important; }
  [data-ogsc] span[style*="#7A6A6A"], [data-ogsb] span[style*="#7A6A6A"] { color:#7A6A6A !important; }
  [data-ogsc] h2[style*="#500000"], [data-ogsb] h2[style*="#500000"], [data-ogsc] h3[style*="#500000"], [data-ogsb] h3[style*="#500000"] { color:#500000 !important; }
  @media (prefers-color-scheme: dark) {
    td[style*="rgb(255, 255, 255)"], table[style*="rgb(255, 255, 255)"] { background-color:#ffffff !important; }
    td[style*="#f6f6f6"], table[style*="#f6f6f6"] { background-color:#f6f6f6 !important; }
    td[style*="rgb(80, 0, 0)"], table[style*="rgb(80, 0, 0)"] { background-color:#500000 !important; }
    p[style*="#202020"], h3[style*="#202020"], a[style*="#202020"] { color:#202020 !important; }
    p[style*="#404040"] { color:#404040 !important; }
    span[style*="#7A6A6A"] { color:#7A6A6A !important; }
    h2[style*="#500000"], h3[style*="#500000"] { color:#500000 !important; }
  }
</style>
</head>
<body dir="ltr">
${preheader(issue)}
<div lang="en" style="background-color: rgb(234, 234, 234); margin: 0px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: rgb(234, 234, 234); width: 100%;">
<tbody><tr><td>`);

  // Header / masthead / intro
  parts.push(buildHeader(issue, editable));

  // Sections in SECTION_REGISTRY order; a section that renders nothing leaves no spacer behind.
  for (const secReg of SECTION_REGISTRY) {
    const sec = issue.sections[secReg.key];
    if (!sec || !sec.enabled) continue;

    let sectionHtml = '';
    switch (secReg.kind) {
      case 'briefs':
        sectionHtml = buildBriefs(sec, editable);
        break;
      case 'grouped-list':
        sectionHtml = buildGroupedList(secReg, sec, editable);
        break;
      case 'grouped-digest':
        sectionHtml = buildGroupedDigest(secReg, sec, editable);
        break;
      case 'spotlight':
        sectionHtml = buildSpotlight(secReg, sec, editable);
        break;
    }
    if (sectionHtml) parts.push(SPACER_14, sectionHtml);
  }

  // Footer spacer (26px before footer per template)
  parts.push(`<!-- spacer --><table align="center" width="640" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 640px; margin: 0 auto; background-color: rgb(255, 255, 255);"><tbody><tr><td style="height: 26px; font-size: 1px; line-height: 26px;">&nbsp;</td></tr></tbody></table>`);

  // Footer
  parts.push(buildFooter());

  // Bottom spacer + close
  parts.push(`<!-- bottom spacer -->
<table align="center" width="640" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 640px; margin: 0 auto;"><tbody><tr><td style="height: 20px; font-size: 1px; line-height: 20px;">&nbsp;</td></tr></tbody></table>

</td></tr></tbody></table>
</div>
</body>
</html>`);

  return parts.join('\n');
}
