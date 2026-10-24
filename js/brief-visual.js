/**
 * The brief's proposed chart (Kate, Oct 22: "i want to see their figure and
 * the proposed new one before it goes off to the author"; her pick D1, maroon
 * bars with the values on them). Pure: an SVG string from the proposal, drawn
 * on the brief page beside the paper's own figure and saved as a PNG for the
 * author round. These are the printed brief's colors, from the Texas A&M
 * brand guide (Aggie Maroon, Dark Gray, Gray, Light Gray), not the desk's:
 * the chart belongs to the brief, the way the email's maroon belongs to the
 * newsletter template. Every word from the model is escaped.
 */

export const CHART_COLOURS = { bar: '#500000', ink: '#3E3E3E', quiet: '#707070', rule: '#D1D1D1', ground: '#FFFFFF' };
const FONT = "'Open Sans', Arial, sans-serif";

const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A bar's value as the paper prints it, never rounded (review, Oct 22); a percent with its sign, once. */
const shown = (b, format) => {
  const printed = String(b.printed ?? '').trim() || String(b.value);
  return format === 'percent' && !printed.endsWith('%') ? `${printed}%` : printed;
};

/** Words broken into lines of at most `width` characters, at most `max` lines, the last cut with an ellipsis. */
function wrap(text, width, max) {
  const lines = [];
  let line = '';
  for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
    if (line && `${line} ${word}`.length > width) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  if (lines.length > max) { lines.length = max; lines[max - 1] = `${lines[max - 1].slice(0, width - 1)}…`; }
  return lines;
}

const text = (x, y, words, { size = 14, weight = 400, fill = CHART_COLOURS.ink, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(words)}</text>`;

/** The alt text the brand guide asks for: the figure's name and title, under 125 characters. */
export function chartAlt(visual) {
  const alt = `${visual.name}. ${visual.title}`;
  return alt.length <= 125 ? alt : `${alt.slice(0, 124)}…`;
}

/**
 * The chart: upright columns when every label is short (weeks, years), bars
 * on their side when a group's name is long, so every name reads whole.
 * Bars start at zero; the tallest fills the plot; each carries its value.
 */
export function chartSvg(visual) {
  // Drawn small so its words stay readable at the half-width the brief's page gives it, and doubled for the picture.
  const W = 520;
  const bars = visual.bars ?? [];
  const max = Math.max(...bars.map(b => b.value), 0) || 1;
  const titleLines = wrap(`${visual.name}. ${visual.title}`, 40, 3);
  const head = titleLines.map((l, i) => text(20, 34 + i * 26, l, { size: 20, weight: 700 })).join('')
    + text(20, 34 + titleLines.length * 26 + 2, visual.value_label ?? '', { size: 15, fill: CHART_COLOURS.quiet });
  const top = 34 + titleLines.length * 26 + 30;
  const upright = bars.every(b => b.label.length <= 8) && bars.length <= 6;
  let body = '';
  let H;
  if (upright) {
    const plotH = 220;
    const base = top + plotH;
    const slot = (W - 40) / bars.length;
    const bw = Math.min(72, slot * 0.62);
    bars.forEach((b, i) => {
      const h = (b.value / max) * (plotH - 24);
      const x = 20 + slot * i + (slot - bw) / 2;
      body += `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${CHART_COLOURS.bar}"/>`;
      body += text((x + bw / 2).toFixed(1), (base - h - 8).toFixed(1), shown(b, visual.value_format), { size: 18, weight: 700, anchor: 'middle' });
      body += text((x + bw / 2).toFixed(1), base + 24, b.label, { size: 15, fill: CHART_COLOURS.quiet, anchor: 'middle' });
    });
    body += `<line x1="20" y1="${base}" x2="${W - 20}" y2="${base}" stroke="${CHART_COLOURS.rule}" stroke-width="1"/>`;
    H = base + 44;
  } else {
    // Long names get their own line above each bar, the whole width, so every name reads whole.
    const row = 60;
    const plotW = W - 40 - 70;
    bars.forEach((b, i) => {
      const y = top + i * row;
      const w = (b.value / max) * plotW;
      body += text(20, y + 14, wrap(b.label, 54, 1)[0], { size: 15 });
      body += `<rect x="20" y="${y + 22}" width="${w.toFixed(1)}" height="26" fill="${CHART_COLOURS.bar}"/>`;
      body += text((20 + w + 8).toFixed(1), y + 41, shown(b, visual.value_format), { size: 18, weight: 700 });
    });
    body += `<line x1="20" y1="${top}" x2="20" y2="${top + bars.length * row}" stroke="${CHART_COLOURS.rule}" stroke-width="1"/>`;
    H = top + bars.length * row + 24;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(FONT)}" data-layout="${upright ? 'columns' : 'bars'}" role="img" aria-label="${esc(chartAlt(visual))}">`
    + `<rect x="0" y="0" width="${W}" height="${H}" fill="${CHART_COLOURS.ground}"/>${head}${body}</svg>`;
}
