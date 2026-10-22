/**
 * The draft as reading text (Kate, Oct 22, her pick A): a small renderer for
 * the markdown the desk itself writes in brief-draft.md: headings,
 * paragraphs with bold, italics and line breaks, numbered and bulleted lists,
 * tables, http links, and the cover lines folded into one muted line. Every
 * character of the text is escaped first, so nothing a model writes can
 * become markup; the only tags are the ones made here.
 */

const escape = text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Bold, italics and links inside one line of escaped text. */
function inline(raw) {
  let s = escape(raw);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => (/^https?:\/\//i.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${text}</a>` : text));
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

const COVER = /^\*\*(ERC Research Brief[^*]*|Study authors:|Research Brief author:)\*\*\s*(.*)$/;
const isTableRow = line => /^\|.*\|$/.test(line.trim());
const isSeparator = line => /^\|[\s|:-]+\|$/.test(line.trim());
const itemStart = line => /^(\d+)\.\s+(.*)$/.exec(line) || /^[-*]\s+(.*)$/.exec(line);

export function renderMarkdown(md) {
  const lines = String(md ?? '').split('\n').map(l => l.replace(/\s+$/, ''));
  const out = [];
  let cover = [];
  const flushCover = () => { if (cover.length) { out.push(`<p class="brief-cover">${cover.join(' · ')}</p>`); cover = []; } };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.trim() === '---') { i++; continue; }
    const c = COVER.exec(line);
    if (c) { cover.push(inline(`${c[1]}${c[2] ? ` ${c[2]}` : ''}`.trim())); i++; continue; }
    flushCover();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (isTableRow(line)) {
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) { if (!isSeparator(lines[i])) rows.push(lines[i].trim().slice(1, -1).split('|').map(cell => inline(cell.trim()))); i++; }
      const [head, ...body] = rows;
      out.push(`<table><thead><tr>${head.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    const first = itemStart(line);
    if (first) {
      const ordered = /^\d+\./.test(line);
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const m = itemStart(lines[i]);
        if (m) items.push([m[m.length - 1]]);
        else if (items.length) items[items.length - 1].push(lines[i].trim());
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map(parts => `<li>${parts.map(inline).join('<br>')}</li>`).join('')}</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s/.test(lines[i]) && !isTableRow(lines[i]) && lines[i].trim() !== '---' && !COVER.test(lines[i])) { para.push(lines[i].trim()); i++; }
    out.push(`<p>${para.map(inline).join('<br>')}</p>`);
  }
  flushCover();
  return out.join('');
}
