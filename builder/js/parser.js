import { sectionByAlias, groupByAlias, createEmptyIssue } from './model.js';

const FIELD_ALIASES = { metaline: 'meta' };

export function parseFieldLine(line) {
  const s = (line || '').trim();
  if (s.startsWith('#')) return null;
  const m = s.match(/^\*{0,2}\s*([A-Za-z][A-Za-z &]*?)\s*\*{0,2}\s*:\s*\*{0,2}\s*(.*)$/);
  if (!m) return null;
  let key = m[1].toLowerCase().replace(/\s+/g, '');
  key = FIELD_ALIASES[key] || key;
  return { key, value: m[2].trim() };
}

export function unescapeMd(s) {
  return (s || '').replace(/\\([^A-Za-z0-9\s])/g, '$1');
}

export function extractUrl(value) {
  const v = (value || '').trim();
  const m = v.match(/\]\((.+)\)/);
  return unescapeMd(m ? m[1] : v).trim();
}

let _idCounter = 0;
export function _resetIds() { _idCounter = 0; } // test helper

const H1 = /^#\s+(.*)$/;
const H2 = /^##\s+(.*)$/;
const H3 = /^###\s+(.*)$/;

export function parseMarkdown(md) {
  const issue = createEmptyIssue();
  const warnings = [];
  const lines = (md || '').split(/\r?\n/);

  let curSection = null;   // section key or null
  let curGroup = '';       // group key or ''
  let curItem = null;      // { id, group, fields }
  let inIntro = false, sawTitle = false;
  const introLines = [];

  const flushItem = () => {
    if (curItem && curSection && Object.keys(curItem.fields).length) {
      issue.sections[curSection].items.push(curItem);
    }
    curItem = null;
  };
  const ensureItem = () => {
    if (!curItem && curSection) curItem = { id: 'itm_' + (++_idCounter), group: curGroup, fields: {} };
  };

  for (const raw of lines) {
    let m;
    if ((m = H3.exec(raw))) {                 // ── item ──
      flushItem();
      if (curSection) curItem = { id: 'itm_' + (++_idCounter), group: curGroup, fields: {} };
      inIntro = false;
      continue;
    }
    if ((m = H2.exec(raw))) {                  // ── group ──
      flushItem();
      inIntro = false;
      const gtext = unescapeMd(m[1]).trim();
      if (curSection) {
        curGroup = groupByAlias(curSection, gtext);
        if (!curGroup) warnings.push(`Couldn't place group: ${gtext}`);
      } else {
        curGroup = '';
      }
      continue;
    }
    if ((m = H1.exec(raw))) {                   // ── section / intro / title ──
      flushItem();
      const htext = unescapeMd(m[1]).replace(/\*/g, '').replace(/:$/, '').trim();
      inIntro = false; curGroup = '';
      if (htext === '') { continue; }                       // empty heading
      if (htext.toLowerCase() === 'intro') { inIntro = true; curSection = null; continue; }
      const sec = sectionByAlias(htext);
      if (sec) { curSection = sec.key; }
      else if (!sawTitle) { sawTitle = true; curSection = null; }   // document title
      else { curSection = null; warnings.push(`Couldn't place section: ${htext}`); }
      continue;
    }
    // ── non-heading line ──
    if (inIntro) { introLines.push(raw); continue; }
    const dm = /^date:\s*(.+)$/i.exec(raw.trim());
    if (dm && !curSection) { issue.date = unescapeMd(dm[1]).trim(); continue; }
    const f = parseFieldLine(raw);
    if (f && curSection) {
      ensureItem();
      if (f.key === 'url') curItem.fields.url = extractUrl(f.value);
      else curItem.fields[f.key] = unescapeMd(f.value).trim();
    }
  }
  flushItem();

  issue.intro = unescapeMd(introLines.join('\n')).replace(/\n{3,}/g, '\n\n').trim();
  for (const key of Object.keys(issue.sections)) {
    issue.sections[key].enabled = issue.sections[key].items.length > 0;
  }
  return { issue, warnings };
}
