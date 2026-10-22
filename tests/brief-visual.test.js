// tests/brief-visual.test.js: the proposed chart (Kate, Oct 22: "i want to
// see their figure and the proposed new one before it goes off to the
// author"; her picks: the plan picks a chart or a table, D1 maroon bars).
// Drawn as SVG in the brief's print colours from the Texas A&M brand guide,
// Aggie Maroon bars and Dark Gray words, with the counts on the bars.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chartSvg, chartAlt, CHART_COLOURS } from '../js/brief-visual.js';

const visual = (over = {}) => ({
  kind: 'chart', name: 'Figure 1', source_label: 'Figure 2', title: 'Howdies rose every week of the fall', kept: 'k',
  columns: ['Week', 'Howdies'], rows: [], value_label: 'Greetings per week', value_format: 'number',
  bars: [{ label: 'Week 1', value: 25 }, { label: 'Week 2', value: 40 }, { label: 'Week 3', value: 72 }], ...over,
});

test('the brief\'s colours, from the brand guide: Aggie Maroon bars, Dark Gray words', () => {
  assert.deepEqual(CHART_COLOURS, { bar: '#500000', ink: '#3E3E3E', quiet: '#707070', rule: '#D1D1D1', ground: '#FFFFFF' });
});

test('chartSvg: one maroon bar a value, the value on each bar, the title and the unit, a white ground', () => {
  const svg = chartSvg(visual());
  assert.match(svg, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal((svg.match(/<rect [^>]*fill="#500000"/g) ?? []).length, 3);
  for (const v of ['25', '40', '72']) assert.match(svg, new RegExp(`>${v}</text>`));
  const title = [...svg.matchAll(/<text [^>]*font-size="20"[^>]*>([^<]*)<\/text>/g)].map(m => m[1]).join(' ');
  assert.equal(title, 'Figure 1. Howdies rose every week of the fall', 'the title, wrapped over its lines');
  assert.match(svg, />Greetings per week</);
  assert.match(svg, /<rect [^>]*fill="#FFFFFF"/);
});

test('chartSvg: the tallest bar fills the plot and the others scale from zero', () => {
  const svg = chartSvg(visual({ bars: [{ label: 'a', value: 50 }, { label: 'b', value: 100 }] }));
  const heights = [...svg.matchAll(/<rect [^>]*height="([\d.]+)"[^>]*fill="#500000"/g)].map(m => Number(m[1]));
  assert.equal(heights.length, 2);
  assert.ok(Math.abs(heights[0] * 2 - heights[1]) < 1, `half as tall: ${heights}`);
});

test('chartSvg: a percent reads with its sign; decimals stay as the paper prints them', () => {
  assert.match(chartSvg(visual({ value_format: 'percent', bars: [{ label: 'a', value: 71 }, { label: 'b', value: 59.5 }] })), />71%<\/text>[\s\S]*>59\.5%<\/text>/);
  assert.match(chartSvg(visual({ bars: [{ label: 'a', value: 2.6 }, { label: 'b', value: 0.72 }] })), />2\.6<\/text>[\s\S]*>0\.72<\/text>/);
});

test('chartSvg: long group names turn the chart on its side so every name reads whole', () => {
  const upright = chartSvg(visual());
  const sideways = chartSvg(visual({ bars: [{ label: 'Reclassified in middle school', value: 1.51 }, { label: 'Never an English learner', value: 2.6 }] }));
  assert.match(upright, /data-layout="columns"/);
  assert.match(sideways, /data-layout="bars"/);
  assert.match(sideways, />Reclassified in middle school</);
});

test('chartSvg: nothing the model writes becomes markup', () => {
  const svg = chartSvg(visual({ title: '<script>x</script> & "q"', bars: [{ label: '<b>', value: 1 }, { label: 'b', value: 2 }] }));
  assert.ok(!/<script>/.test(svg));
  assert.match(svg, /&lt;script&gt;x&lt;\/script&gt; &amp; &quot;q&quot;/);
  assert.match(svg, />&lt;b&gt;</);
});

test('chartAlt: the alt text names the figure and stays under 125 characters, as the brand guide asks', () => {
  assert.equal(chartAlt(visual()), 'Figure 1. Howdies rose every week of the fall');
  assert.ok(chartAlt(visual({ title: 'x'.repeat(300) })).length <= 125);
});

test('review, Oct 22: the value on a bar is the paper\'s own, never rounded; a percent gets its sign once', () => {
  const svg = chartSvg(visual({ bars: [{ label: 'a', value: 0.0004, printed: '0.0004' }, { label: 'b', value: 0.125, printed: '0.1250' }] }));
  assert.match(svg, />0\.0004<\/text>[\s\S]*>0\.1250<\/text>/);
  const pct = chartSvg(visual({ value_format: 'percent', bars: [{ label: 'a', value: 45, printed: '45.0%' }, { label: 'b', value: 38, printed: '38.0' }] }));
  assert.match(pct, />45\.0%<\/text>[\s\S]*>38\.0%<\/text>/);
});
