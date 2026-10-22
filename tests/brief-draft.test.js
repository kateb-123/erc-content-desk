// tests/brief-draft.test.js: round 2 of the Research briefs hub, the draft
// (Kate, Oct 22, 2026, her Go on the drawn stage). The pure parts: the steps
// in order, the prompts and schemas the model is held to, what comes back
// shaped, the assembled brief, the Grammarly copy, the figures inventory,
// the number flags and the word band. The model calls live in api/briefs.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SECTION_DEFS, DRAFT_STEPS, nextDraftStep, stepWords,
  STYLE_SYSTEM_PROMPT, EXTRACT_PROMPT, EXTRACT_SCHEMA, normalizeExtract,
  buildPlanPrompt, parsePlan, buildSectionPrompt, buildCheckPrompt, CHECK_SCHEMA,
  assembleDraft, grammarlyCopy, figuresInventory, numberFlagsMd, bodyWordCount, wordBand, checkStyle, draftFiles,
} from '../js/brief-draft.js';

const extract = {
  title: 'Sorted and Tracked: English Learners, College-Level Course-Taking in High School, and Postsecondary Opportunity',
  authors: ['Brian Holzman', 'Esmeralda Sánchez Salazar', 'Irina Chukhray', 'Weiqi Guo'],
  journal: 'Educational Evaluation and Policy Analysis', year: 2025, design: 'observational',
  research_questions: ['What is the role of EL status in predicting college enrollment?'],
  sample: 'Five cohorts of Houston ISD graduates, 2008 to 2012', methods_summary: 'Linear probability models with school fixed effects',
  key_numbers: [{ value: '10 percentage points', context: 'ELs reclassified in elementary school were 10 percentage points less likely to enroll, Table 2, p. 14' }],
  findings: [{ title: 'Later reclassification, fewer college-level courses', summary: 'Students reclassified in middle school took 1.51 courses.' }],
  policy_recommendations: ['Review reclassification timing'],
  apa_citation: 'Holzman, B., Sánchez Salazar, E., Chukhray, I., & Guo, W. (2025). Sorted and tracked. Educational Evaluation and Policy Analysis.',
  recommended_visuals: [
    { kind: 'table', source_label: 'Table 2', page: 14, why: 'the headline gaps', suggested_caption: 'College enrollment and completion by EL timing' },
    { kind: 'table', source_label: 'Table 3', page: 16, why: 'course counts by group', suggested_caption: 'College-level courses taken, by group' },
    { kind: 'figure', source_label: 'Figure 1', page: 9, why: 'the sample', suggested_caption: 'Reclassification timing in the sample' },
  ],
  number_flags: [{ claim: '10 percentage points', where: 'Introduction, p. 2', conflict: 'Table 2 says 9.6', used: 'Table 2' }],
};

test('the eight sections and the steps in order; nextDraftStep walks them and ends', () => {
  assert.deepEqual(SECTION_DEFS.map(s => s.key), ['exec_summary', 'highlights', 'introduction', 'research_overview', 'key_findings', 'policy_implications', 'conclusions', 'references']);
  assert.deepEqual(DRAFT_STEPS, ['extract', 'plan', 'visual', 'exec_summary', 'highlights', 'introduction', 'research_overview', 'key_findings', 'policy_implications', 'conclusions', 'references', 'check', 'assemble']);
  assert.equal(nextDraftStep([]), 'extract');
  assert.equal(nextDraftStep(['extract', 'plan']), 'visual');
  assert.equal(nextDraftStep(['extract', 'plan', 'visual']), 'exec_summary');
  assert.equal(nextDraftStep(DRAFT_STEPS), null);
  assert.equal(nextDraftStep(['plan']), 'extract', 'order holds even if a later step somehow came first');
});

test('stepWords says each step in the busy words, the section by its name', () => {
  assert.equal(stepWords('extract'), 'Reading the paper');
  assert.equal(stepWords('plan'), 'Planning the pages');
  assert.equal(stepWords('key_findings'), 'Writing the brief, Key Findings');
  assert.equal(stepWords('check'), 'Checking the draft against the paper');
  assert.equal(stepWords('assemble'), 'Putting the files together');
});

test('the style prompt carries the house rules and never an em dash of its own outside the rule that bans it', () => {
  assert.match(STYLE_SYSTEM_PROMPT, /NEVER use an em dash/);
  assert.match(STYLE_SYSTEM_PROMPT, /% symbol/);
  assert.match(STYLE_SYSTEM_PROMPT, /1,300 and 2,000 words/);
  assert.match(STYLE_SYSTEM_PROMPT, /Causal language/);
  assert.match(STYLE_SYSTEM_PROMPT, /THE ERC VOICE/);
  assert.ok(!/—/.test(STYLE_SYSTEM_PROMPT.replace(/\(—\)/g, '')), 'the only em dash is the one named as banned');
});

test('the extract prompt and schema ask for the deep read, the visuals with PDF page positions, and the numbers the paper disagrees with itself on', () => {
  assert.match(EXTRACT_PROMPT, /Read EVERY part of the paper/);
  assert.match(EXTRACT_PROMPT, /number_flags/);
  assert.deepEqual(Object.keys(EXTRACT_SCHEMA.properties).slice(-2), ['recommended_visuals', 'number_flags']);
  assert.equal(EXTRACT_SCHEMA.additionalProperties, false);
  assert.ok(EXTRACT_SCHEMA.required.includes('number_flags'));
  assert.deepEqual(EXTRACT_SCHEMA.properties.design.enum, ['causal', 'observational', 'descriptive', 'qualitative']);
});

test('normalizeExtract keeps the shape, fills what the model left out, and refuses nonsense', () => {
  const got = normalizeExtract({ ...extract, number_flags: undefined, year: '2025' });
  assert.equal(got.year, 2025);
  assert.deepEqual(got.number_flags, []);
  assert.equal(got.recommended_visuals.length, 3);
  assert.equal(normalizeExtract({ ...extract, design: 'magic' }).design, 'descriptive', 'an unknown design is the most cautious one');
  assert.throws(() => normalizeExtract(null), /nothing came back/);
  assert.throws(() => normalizeExtract({ title: '' }), /no title/);
});

test('buildPlanPrompt hands over the extract, her notes and the measured capacities, and asks for a suggested title; parsePlan reads it back', () => {
  const prompt = buildPlanPrompt(extract, 'Lead with the course-taking gap. Table 2 is the visual.');
  assert.match(prompt, /Lead with the course-taking gap/);
  assert.match(prompt, /Cover: Executive Summary \| 125 to 160/);
  assert.match(prompt, /Suggested brief title:/);
  assert.match(prompt, /NOT causal|observational/);
  const plan = '# Page Plan\n\nSuggested brief title: Sorted and Tracked: What English Learner Status Does to Course-Taking\n\n## Plan\n| Page | Content |\n|---|---|\n| Cover | Exec |\n';
  assert.equal(parsePlan(plan).title, 'Sorted and Tracked: What English Learner Status Does to Course-Taking');
  assert.equal(parsePlan('no title line').title, '');
});

test('buildSectionPrompt carries the extract, the plan, her notes, the sections so far and the section\'s own instruction and band', () => {
  const prompt = buildSectionPrompt(extract, '| Cover | Exec ~120 |', 'Keep the hedge on transfer students.', 'key_findings', [{ key: 'introduction', content: 'Intro words.' }]);
  assert.match(prompt, /Key Findings as 2 to 4 findings/);
  assert.match(prompt, /300 to 550 words/);
  assert.match(prompt, /Keep the hedge on transfer students/);
  assert.match(prompt, /## introduction\nIntro words\./);
  assert.match(prompt, /NOT causal/);
  assert.match(prompt, /Output ONLY the section text/);
  assert.match(buildSectionPrompt({ ...extract, design: 'causal' }, '', '', 'exec_summary', []), /causal design, so causal language/);
  assert.match(buildSectionPrompt(extract, '', '', 'references', []), /No word target/);
});

test('buildCheckPrompt and CHECK_SCHEMA: every section back, corrected, with flags for what it would not change', () => {
  const prompt = buildCheckPrompt(extract, [{ key: 'exec_summary', content: 'x' }, { key: 'references', content: 'y' }]);
  assert.match(prompt, /VERIFY EVERY STATISTIC/);
  assert.match(prompt, /Return ALL 2 sections/);
  assert.match(prompt, /Educational Evaluation and Policy Analysis/);
  assert.deepEqual(Object.keys(CHECK_SCHEMA.properties), ['sections', 'flags']);
});

test('assembleDraft writes the Bowen-shaped brief: title, the month line, study authors, the brief author, then the sections by their titles', () => {
  const sections = {
    exec_summary: 'Stakes.\n\nThis brief summarizes a study in *Educational Evaluation and Policy Analysis*.',
    highlights: '**01. One.**\nSupport.',
    introduction: 'Intro.', research_overview: 'This brief draws on district records.', key_findings: 'Finding 1\n\nStudents were 10 percentage points less likely.',
    policy_implications: '1. **Review timing.**\nWhy.', conclusions: 'Close.', references: 'Holzman, B. (2025). Sorted and tracked.',
  };
  const md = assembleDraft({ extract, sections, title: 'Sorted and Tracked: What EL Status Does', briefAuthor: 'Kate Barnes', month: 'October 2026' });
  assert.ok(md.startsWith('# Sorted and Tracked: What EL Status Does\n\n**ERC Research Brief | October 2026**\n\n**Study authors:** Brian Holzman · Esmeralda Sánchez Salazar · Irina Chukhray · Weiqi Guo\n**Research Brief author:** Kate Barnes\n\n---\n\n## Executive Summary\n'), md.slice(0, 300));
  assert.match(md, /\n## Report Highlights\n\n\*\*01\. One\.\*\*/);
  assert.match(md, /\n## Key Findings\n/);
  assert.match(md, /\n## References\n\nHolzman/);
  assert.ok(!/—/.test(md));
  assert.equal(assembleDraft({ extract, sections, title: '', briefAuthor: '', month: 'October 2026' }).split('\n')[0], `# ${extract.title}`, 'no title from the plan, the paper\'s');
});

test('grammarlyCopy is the brief\'s words alone: no header block, no markdown marks, headings as lines, a table as its rows', () => {
  const md = '# Title\n\n**ERC Research Brief | October 2026**\n\n**Study authors:** A · B\n**Research Brief author:** K\n\n---\n\n## Executive Summary\n\nWords with *italics* and **bold** and a [link](https://x.y).\n\n| Outcome | Effect |\n|---|---|\n| Discipline | 3.0 points lower |\n\n### Finding 1\n\nMore words.\n';
  assert.equal(grammarlyCopy(md), 'Title\n\nExecutive Summary\n\nWords with italics and bold and a link.\n\nOutcome: Effect\nDiscipline: 3.0 points lower\n\nFinding 1\n\nMore words.');
});

test('figuresInventory: the first two visuals are flagged for rework, the rest stay prose, each with its page and a crop name', () => {
  const inv = figuresInventory(extract);
  assert.deepEqual(inv.items.map(i => [i.label, i.page, i.rework, i.crop]), [
    ['Table 2', 14, 'Rework for the brief', 'figure-table-2-p14.png'],
    ['Table 3', 16, 'Rework, maybe', 'figure-table-3-p16.png'],
    ['Figure 1', 9, 'Prose', 'figure-figure-1-p9.png'],
  ]);
  assert.match(inv.md, /^# Tables and figures in the paper\n/);
  assert.match(inv.md, /\| Table 2 \| 14 \| College enrollment and completion by EL timing \| Rework for the brief \|/);
  assert.deepEqual(figuresInventory({ ...extract, recommended_visuals: [] }).items, []);
});

test('numberFlagsMd lists each conflict with where it is and what the draft used; none says so', () => {
  assert.match(numberFlagsMd(extract.number_flags), /1\. \*\*10 percentage points\*\* \(Introduction, p\. 2\): Table 2 says 9\.6\. The draft uses Table 2\./);
  assert.equal(numberFlagsMd([]), 'None found: the paper agrees with itself on every number the brief uses.');
});

test('bodyWordCount leaves the references out; wordBand names the band', () => {
  const sections = { exec_summary: 'one two three', references: 'ref ref ref ref', highlights: '**01. four five**' };
  assert.equal(bodyWordCount(sections), 6);
  assert.equal(wordBand(1480), 'In the band');
  assert.equal(wordBand(1200), 'Under the floor of 1,300');
  assert.equal(wordBand(2100), 'Over the cap of 2,000');
});

test('checkStyle: em dashes, "percent" after a number, bare jargon and a missing journal line are flagged by section', () => {
  const flags = checkStyle([
    { key: 'exec_summary', content: 'A study — with 8 percent more. Uses regression discontinuity.' },
    { key: 'introduction', content: 'Fine: 8 percentage points, a cutoff-based (regression discontinuity) design.' },
  ], 'Educational Evaluation and Policy Analysis');
  assert.deepEqual(flags.map(f => f.section), ['exec_summary', 'exec_summary', 'exec_summary', 'exec_summary']);
  assert.match(flags[0].note, /em dash/);
  assert.match(flags[1].note, /% symbol/);
  assert.match(flags[2].note, /regression discontinuity/);
  assert.match(flags[3].note, /journal-signal/);
});

test('draftFiles names the four files that land in the folder, markdown each', () => {
  const files = draftFiles({ plan: '# Plan', draft: '# Brief', grammarly: 'Brief', figures: '# Tables' });
  assert.deepEqual(files.map(f => [f.name, f.contentType]), [['page-plan.md', 'text/markdown'], ['brief-draft.md', 'text/markdown'], ['brief-for-grammarly.md', 'text/markdown'], ['figures.md', 'text/markdown']]);
  assert.equal(files[1].text, '# Brief\n');
});

test('a crop name is never one the desk refuses: a long label is cut to 60 characters, an empty one falls back to its place (review, Oct 22)', () => {
  const long = { ...extract, recommended_visuals: [
    { kind: 'figure', source_label: 'Figure 3. Distribution of reclassification timing across cohorts by proficiency band', page: 9, why: 'w', suggested_caption: 'c' },
    { kind: 'table', source_label: '---', page: 11, why: 'w', suggested_caption: 'c' },
  ] };
  const names = figuresInventory(long).items.map(i => i.crop);
  for (const n of names) assert.match(n, /^figure-[a-z0-9-]{1,60}-p\d{1,3}\.png$/, n);
  assert.equal(names[1], 'figure-visual-2-p11.png');
});

test('parsePlan takes the suggested title bare or in bold, the way a model writes a label', () => {
  assert.equal(parsePlan('**Suggested brief title:** Majors That Lead Somewhere\n').title, 'Majors That Lead Somewhere');
  assert.equal(parsePlan('- Suggested brief title: "Sorted and Tracked"').title, 'Sorted and Tracked');
});

import { VISUAL_SCHEMA, buildVisualPrompt, normalizeVisual, visualMarkdown, normalizeBox } from '../js/brief-draft.js';

test('the steps: the plan is followed by the proposal of the brief\'s one visual, before any section is written', () => {
  assert.deepEqual(DRAFT_STEPS.slice(0, 4), ['extract', 'plan', 'visual', 'exec_summary']);
  assert.equal(stepWords('visual'), "Proposing the brief's table or chart");
});

test('the read marks a box around each table or figure on its page (Kate, Oct 22: the model marks it, the desk cuts it)', () => {
  const item = EXTRACT_SCHEMA.properties.recommended_visuals.items;
  assert.ok(item.required.includes('box'));
  assert.deepEqual(item.properties.box.required, ['left', 'top', 'right', 'bottom']);
  assert.match(EXTRACT_PROMPT, /box/);
  assert.deepEqual(normalizeBox({ left: 0.1, top: 0.2, right: 0.9, bottom: 0.6 }), { left: 0.1, top: 0.2, right: 0.9, bottom: 0.6 });
  assert.deepEqual(normalizeBox({ left: -0.2, top: 0.2, right: 1.4, bottom: 0.6 }), { left: 0, top: 0.2, right: 1, bottom: 0.6 }, 'held to the page');
  assert.equal(normalizeBox({ left: 0.5, top: 0.2, right: 0.52, bottom: 0.6 }), null, 'a sliver is no box');
  assert.equal(normalizeBox({ left: 0.9, top: 0.2, right: 0.1, bottom: 0.6 }), null, 'backwards is no box');
  assert.equal(normalizeBox(null), null);
  assert.equal(normalizeBox({ left: 'a', top: 0, right: 1, bottom: 1 }), null);
  const ex = normalizeExtract({ ...extract, recommended_visuals: [{ kind: 'table', source_label: 'Table 2', page: 4, why: 'w', suggested_caption: 'c', box: { left: 0.1, top: 0.1, right: 0.9, bottom: 0.5 } }] });
  assert.deepEqual(ex.recommended_visuals[0].box, { left: 0.1, top: 0.1, right: 0.9, bottom: 0.5 });
  assert.deepEqual(figuresInventory(ex).items[0].box, { left: 0.1, top: 0.1, right: 0.9, bottom: 0.5 });
});

test('the plan names the brief\'s visual as a chart or a table, the plan\'s pick (Kate, Oct 22: "maybe a chart or a table", the plan picks per paper)', () => {
  const prompt = buildPlanPrompt(extract, 'notes');
  assert.match(prompt, /## The brief's visual/);
  assert.match(prompt, /Figure 1/);
  assert.match(prompt, /Table 1/);
});

test('buildVisualPrompt builds the visual the plan names, with its data table, every number from the paper', () => {
  const prompt = buildVisualPrompt(extract, '## The brief\'s visual (page 3)\nFigure 1, from the paper\'s Figure 2.', 'Keep the bars.');
  assert.match(prompt, /TASK: Build the brief's one visual/);
  assert.match(prompt, /Figure 1, from the paper's Figure 2/);
  assert.match(prompt, /Keep the bars/);
  assert.match(prompt, /data table/);
  assert.equal(VISUAL_SCHEMA.additionalProperties, false);
  assert.deepEqual(VISUAL_SCHEMA.properties.kind.enum, ['table', 'chart']);
});

test('normalizeVisual: a chart keeps 2 to 8 bars and its table; a chart it cannot draw becomes the table; nothing usable is an error', () => {
  const chart = normalizeVisual({ kind: 'chart', source_label: ' Figure 2 ', title: 'Courses fell with later reclassification', kept: 'k', columns: ['Group', 'Courses'], rows: [['Never EL', '2.60'], ['High school', '0.72', 'extra']], value_label: 'College-level courses', value_format: 'number', bars: [{ label: 'Never EL', value: 2.6 }, { label: 'High school', value: 0.72 }] });
  assert.equal(chart.kind, 'chart');
  assert.equal(chart.name, 'Figure 1');
  assert.equal(chart.source_label, 'Figure 2');
  assert.deepEqual(chart.rows, [['Never EL', '2.60'], ['High school', '0.72']], 'rows held to the columns');
  const one = normalizeVisual({ ...chart, kind: 'chart', bars: [{ label: 'a', value: 1 }] });
  assert.equal(one.kind, 'table');
  assert.equal(one.name, 'Table 1');
  assert.deepEqual(one.bars, []);
  assert.equal(normalizeVisual({ ...chart, bars: [{ label: 'a', value: -1 }, { label: 'b', value: 2 }] }).kind, 'table', 'a negative bar is told as a table');
  assert.equal(normalizeVisual({ ...chart, bars: Array.from({ length: 9 }, (_, i) => ({ label: `g${i}`, value: i + 1 })) }).kind, 'table', 'too many bars');
  assert.equal(normalizeVisual({ ...chart, bars: [{ label: 'a', value: 'NaN' }, { label: 'b', value: 2 }] }).kind, 'table');
  const pct = normalizeVisual({ ...chart, value_format: 'percent' });
  assert.equal(pct.value_format, 'percent');
  assert.equal(normalizeVisual({ ...chart, value_format: 'odd' }).value_format, 'number');
  assert.throws(() => normalizeVisual({ kind: 'table', title: 't', columns: [], rows: [], bars: [] }), /proposal/);
  assert.throws(() => normalizeVisual(null), /proposal/);
});

test('visualMarkdown: the proposal as a file, its name and title, the table, where it came from', () => {
  const md = visualMarkdown(normalizeVisual({ kind: 'table', source_label: 'Table 3', title: 'Matched workers earned more', kept: 'Kept: the two groups.', columns: ['Workers', 'Earnings'], rows: [['Matched', '$52,000'], ['Not | matched', '$44,000']], value_label: '', value_format: 'number', bars: [] }));
  assert.match(md, /^# Table 1\. Matched workers earned more\n/);
  assert.match(md, /\| Workers \| Earnings \|\n\|---\|---\|\n\| Matched \| \$52,000 \|/);
  assert.match(md, /Not \\\| matched/, 'a bar inside a cell is escaped');
  assert.match(md, /From the paper's Table 3\. Kept: the two groups\./);
  const chartMd = visualMarkdown(normalizeVisual({ kind: 'chart', source_label: 'Figure 2', title: 'T', kept: 'k', columns: ['G', 'V'], rows: [['a', '1'], ['b', '2']], value_label: 'Courses', value_format: 'number', bars: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }));
  assert.match(chartMd, /^# Figure 1\. T\n/);
  assert.match(chartMd, /A bar chart of Courses; its numbers:/);
  assert.match(chartMd, /proposed-figure-1\.png/);
});

test('the findings mark where the proposal goes by its name, a chart as Figure 1', () => {
  const visual = normalizeVisual({ kind: 'chart', source_label: 'Figure 2', title: 'T', kept: 'k', columns: ['G', 'V'], rows: [['a', '1'], ['b', '2']], value_label: 'V', value_format: 'number', bars: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] });
  const prompt = buildSectionPrompt(extract, 'plan', '', 'key_findings', [], visual);
  assert.match(prompt, /\[Figure 1 here\]/);
  assert.doesNotMatch(prompt, /\[Table 1 here\]/);
  assert.match(prompt, /THE BRIEF'S VISUAL: Figure 1, T/);
  assert.match(buildSectionPrompt(extract, 'plan', '', 'key_findings', []), /\[Table 1 here\]/, 'no proposal yet, the table as before');
});

import { STEP_BUDGET, budgetFor, TOKENS_PER_SECOND, CALL_SECONDS } from '../js/brief-draft.js';

test('every step\'s reply fits its call: max tokens at the measured pace stays under the call\'s time (live, Oct 22: the read stopped at 12,000 tokens after about 143 s, "the reply was cut short")', () => {
  assert.equal(TOKENS_PER_SECOND, 80, 'measured live: 12,000 tokens in about 143 s, rounded down');
  assert.equal(CALL_SECONDS, 250);
  for (const [step, b] of Object.entries(STEP_BUDGET)) {
    assert.ok(b.maxTokens / TOKENS_PER_SECOND <= CALL_SECONDS, `${step}: ${b.maxTokens} tokens cannot be written in ${CALL_SECONDS} s`);
    assert.ok(['low', 'medium', 'high'].includes(b.effort), step);
  }
});

test('the paper read gets more room and thinks at medium, since the check re-verifies every number at high', () => {
  assert.deepEqual(budgetFor('extract'), { maxTokens: 20000, effort: 'medium' });
  assert.ok(budgetFor('extract').maxTokens > 12000, 'more room than the live failure had');
  assert.equal(budgetFor('check').effort, 'high');
  assert.deepEqual(budgetFor('key_findings'), budgetFor('exec_summary'), 'every section the same');
  assert.match(EXTRACT_PROMPT, /at most 15/, 'the key numbers are bounded so the reply stays short');
});

import { sameVisual } from '../js/brief-draft.js';

const chartJson = (over = {}) => ({ kind: 'chart', source_label: 'Table 2', page: 10, box: { left: 0.1, top: 0.2, right: 0.9, bottom: 0.5 }, title: 'T', kept: 'k', columns: ['Group', 'Courses'], rows: [['a', '1.0'], ['b', '2.50']], value_label: 'Courses', value_format: 'number', bars: [{ label: 'a', value: 1, printed: '1.0' }, { label: 'b', value: 2.5, printed: '2.50' }], ...over });

test('review, Oct 22: a blank stub header is kept, so the headers stay over their cells and no column is lost', () => {
  const v = normalizeVisual(chartJson({ kind: 'table', columns: ['', 'Treatment', 'Control'], rows: [['Enrolled', '45%', '38%'], ['Persisted', '30%', '25%']], bars: [] }));
  assert.deepEqual(v.columns, ['', 'Treatment', 'Control']);
  assert.deepEqual(v.rows, [['Enrolled', '45%', '38%'], ['Persisted', '30%', '25%']]);
  assert.match(visualMarkdown(v), /\|  \| Treatment \| Control \|\n\|---\|---\|---\|\n\| Enrolled \| 45% \| 38% \|/);
  const noColumns = normalizeVisual(chartJson({ columns: [], rows: [] }));
  assert.deepEqual(noColumns.columns, ['Group', 'Courses'], 'a chart with no table gets a group column and its measure');
  assert.deepEqual(noColumns.rows, [['a', '1.0'], ['b', '2.50']], 'its rows read as the paper prints them');
});

test('review, Oct 22: the proposal marks its own source on the page, so the pair is always its source, cut by its own box', () => {
  const item = VISUAL_SCHEMA.properties;
  assert.ok(VISUAL_SCHEMA.required.includes('page') && VISUAL_SCHEMA.required.includes('box'));
  assert.deepEqual(item.box.required, ['left', 'top', 'right', 'bottom']);
  assert.ok(item.bars.items.required.includes('printed'));
  assert.match(buildVisualPrompt(extract, 'plan', ''), /page/);
  const v = normalizeVisual(chartJson());
  assert.equal(v.page, 10);
  assert.deepEqual(v.box, { left: 0.1, top: 0.2, right: 0.9, bottom: 0.5 });
  assert.equal(v.crop, 'figure-table-2-p10.png');
  assert.equal(normalizeVisual(chartJson({ page: 0 })).crop, '', 'no page, no cut');
  assert.equal(normalizeVisual(chartJson({ box: null })).box, null);
});

test('review, Oct 22: a chart keeps each value as the paper prints it', () => {
  const v = normalizeVisual(chartJson({ bars: [{ label: 'a', value: 0.0004, printed: '0.0004' }, { label: 'b', value: 0.125, printed: '0.1250' }] }));
  assert.deepEqual(v.bars.map(b => b.printed), ['0.0004', '0.1250']);
  assert.equal(normalizeVisual(chartJson({ bars: [{ label: 'a', value: 2, printed: '' }, { label: 'b', value: 3 }] })).bars[0].printed, '2', 'no printed form, the number itself');
});

test('sameVisual: a table or figure named two ways is the same one; a different number is not', () => {
  assert.ok(sameVisual('Table 3', 'Table 3. Earnings by match'));
  assert.ok(sameVisual('table 3', 'Table 3 (Panel A)'));
  assert.ok(sameVisual('Fig. 2', 'Figure 2'));
  assert.ok(sameVisual('Table A4', 'Appendix Table A4'));
  assert.ok(!sameVisual('Table 2', 'Table 3'));
  assert.ok(!sameVisual('Table 2', 'Figure 2'));
  assert.ok(!sameVisual('', 'Table 2'));
  assert.ok(!sameVisual('Table 12', 'Table 1'));
});

test('review, Oct 22: figures.md is the inventory table, not "[object Object]"', () => {
  const files = draftFiles({ plan: 'p', draft: 'd', grammarly: 'g', figures: [{ label: 'Table 2' }], figuresMd: '# Tables and figures in the paper\n' });
  assert.equal(files.find(f => f.name === 'figures.md').text, '# Tables and figures in the paper\n');
});
