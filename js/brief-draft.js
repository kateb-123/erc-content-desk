/**
 * The draft stage of a research brief (Kate, Oct 22, 2026; round 2 of the
 * hub, docs/research-briefs-handoff.md): from the paper and her notes to the
 * page plan, the brief as one markdown file, the Grammarly copy, the figures
 * to look at and the numbers the paper disagrees with itself on. Pure: the
 * steps, the prompts and schemas, and what comes back shaped. The model
 * calls and the files are api/briefs.js's job. The prompts descend from the
 * July brief-builder app (~/code/erc-brief-builder/src/lib/prompts.ts),
 * carrying STYLE-GUIDE.md and the brand voice; her notes steer each one.
 */

export const SECTION_DEFS = [
  { key: 'exec_summary', title: 'Executive Summary', min: 150, max: 250 },
  { key: 'highlights', title: 'Report Highlights', min: 40, max: 120 },
  { key: 'introduction', title: 'Introduction', min: 150, max: 280 },
  { key: 'research_overview', title: 'Research Overview', min: 220, max: 320 },
  { key: 'key_findings', title: 'Key Findings', min: 300, max: 550 },
  { key: 'policy_implications', title: 'Policy Implications', min: 200, max: 380 },
  { key: 'conclusions', title: 'Conclusions', min: 100, max: 220 },
  { key: 'references', title: 'References', min: 0, max: 0 },
];

/** The steps in order: the deep read, the page plan, the brief's one visual, the eight sections, the check against the paper, the files. */
export const DRAFT_STEPS = ['extract', 'plan', 'visual', ...SECTION_DEFS.map(s => s.key), 'check', 'assemble'];

/** The first step not yet done, in order; null once every step is. */
export function nextDraftStep(done) {
  const did = new Set(done ?? []);
  return DRAFT_STEPS.find(step => !did.has(step)) ?? null;
}

/** What the busy words say while a step runs. */
export function stepWords(step) {
  const section = SECTION_DEFS.find(s => s.key === step);
  if (section) return `Writing the brief, ${section.title}`;
  return { extract: 'Reading the paper', plan: 'Planning the pages', visual: "Proposing the brief's table or chart", check: 'Checking the draft against the paper', assemble: 'Putting the files together' }[step] ?? 'Working';
}

export const STYLE_SYSTEM_PROMPT = `You are the Education Research Center (Texas A&M University) research brief writer. You translate peer-reviewed education research into ADA-compliant briefs for policymakers and the public.

Non-negotiable style rules (from the ERC style guide):
- Plain language at a 9th-10th grade reading level. Define every technical term the first time it appears.
- NEVER use an em dash (—) anywhere in the prose. Use commas, periods, or parentheses instead. An aside that contains its own commas goes in parentheses. En dashes in numeric page ranges are fine.
- Always use the % symbol, never the word "percent". The phrase "percentage points" stays spelled out.
- Report numbers verbatim from the paper with context (for example "% of the mean"). Never invent or round numbers beyond what the paper reports.
- Causal language ("causes", "increases", "leads to") is allowed ONLY for causal designs (randomized experiments, regression discontinuity/cutoff designs). For observational, descriptive, or qualitative work use associational language only ("is associated with", "is related to"). Always preserve the paper's own hedging.
- Voice: measured plain declaratives, not chatty. No colloquial metaphor openers, no throwaway interjections. Report Highlights and titles may be punchier.
- References follow APA 7th edition.
- Total body prose across all sections lands between 1,300 and 2,000 words. Never compress a section to be artificially short; if a section feels thin, it is wrong.
- The Policy Implications section is paper-first: lead with the paper's own recommendations. If the paper offers none, the section is titled "Considerations" instead, and every claim in it must be backed by cited peer-reviewed literature.

THE ERC VOICE (distilled from the published brief series; match it, do not approximate it):

We are: measured (findings stated at their true size), evidence-disciplined (every claim sized to the study design), plain-spoken (jargon translated on contact), human-stakes-first (openings name who is affected and why it matters), direct and declarative (subject-led sentences).
We are not: hype (never "striking" or "game-changing"; no exclamation points), overclaiming, academic (never leave a technical term undefined), abstract (never open a section with "the literature" or a methods statement), chatty (no metaphor openers, no contractions in body prose, no first-person).

Sentence craft:
- Mostly medium sentences (20-35 words) carrying one clause of data plus one clause of interpretation, punctuated by short declaratives (8-12 words) for emphasis: "White students see no net loss."
- Numbers always carry context, comparative or parenthetical: "8.8 percentage points more likely, about a 40% increase over the baseline rate of 21.7%"; "only 13% (4 out of 31 statutes)".
- Hedge specifically, never vaguely. Name what is robust and what is suggestive: "The findings regarding course enrollment are robust, while those related to majors and minors should be interpreted as suggestive." Never write a blanket "results should be interpreted with caution."
- Pivots: "Yet" and "However" raise stakes or introduce limits; "But taken together, the results point to..." resolves a hedge.
- Jargon is translated on contact, plain term first: "a cutoff-based (regression discontinuity) design". A raw academic term must never stand alone.
- Policy asks are softened: conditional, permissive claims about what the evidence supports ("Policymakers may consider...", "should view a single message as an initial step..."), never commands to named actors. The justification always trails the ask.
- One rhetorical lift is allowed per brief, in the Conclusions only, framed declaratively, never with a question mark: "The real question is whether their schools will get the support they need."
- Banned entirely: leverage, unlock, game-changer, synergy, impactful, cutting-edge, exclamation points, contractions, first-person.

Model sentences (imitate this register):
- "That number is small, but it is not zero."
- "The estimates are noisy because these outcomes are rare, so the study cannot rule out modest effects."
- "A student's choice of major is one of the most consequential decisions they make in college, directly shaping their future earnings and career opportunities."

The brief's editor (the person who runs this desk) reads the paper first and leaves notes: what to lead with, what to keep, which table is the visual, which hedges matter. When her notes are given, follow them; where they are silent, follow the paper.

When the journal article PDF is attached, ground every claim in the paper itself.`;

export const EXTRACT_PROMPT = `Do a deep, close reading of the attached journal article. This extraction is the foundation for an entire policy brief; anything you miss or get wrong propagates into every section.

Close-reading protocol:
- Read EVERY part of the paper: abstract, body, tables, figures, figure notes, footnotes, and appendices. Key statistics often live only in tables or notes.
- For every number you extract, locate it in the paper and copy it verbatim with its page number in the context field (e.g. "8.8pp jump at the cutoff, Table 3, p. 14"). Never approximate or recompute.
- Capture ALL findings, not just the headline result: secondary findings, null results, and subgroup differences the authors emphasize.
- Capture the authors' own limitations and hedging in their own terms.
- Distinguish what the authors CLAIM from what their design supports.

Extract the structured record requested by the output schema. For "design": choose "causal" only for randomized experiments or regression discontinuity/cutoff designs; otherwise choose observational, descriptive, or qualitative as appropriate. For "key_numbers": pull the exact statistics a policy brief would cite, each with enough context (and page number) to use verbatim. For "apa_citation": produce a correct APA 7 reference for this article.

For "recommended_visuals": identify at most 3 figures or tables from the paper that would EARN A PLACE in a short policy brief (clearer than prose could be; central to the findings). List them best first. For each, give its label in the paper (e.g. "Figure 2"), the PDF page it appears on (the page's position in the file, starting at 1, not the printed page number), why it earns a place, a plain-language caption a policymaker would understand, and its "box": where it sits on that page, as left, top, right and bottom fractions of the page's width and height measured from the top-left corner (0 to 1), wide enough to take in its title, every row, axis and label, and its notes, and nothing else on the page. If nothing earns a place, return an empty array; do not pad.

For "number_flags": list every place the paper disagrees with itself on a number a brief might use (an introduction that rounds what a table reports, a sample size that differs between sections, a percent that is really percentage points). For each give the claim as written, where it is (section and page), what conflicts with it and where, and which value the brief should use and why (usually the table). An empty array means the paper agrees with itself.`;

export const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    authors: { type: 'array', items: { type: 'string' } },
    journal: { type: 'string' },
    year: { type: 'integer' },
    design: { type: 'string', enum: ['causal', 'observational', 'descriptive', 'qualitative'] },
    research_questions: { type: 'array', items: { type: 'string' } },
    sample: { type: 'string' },
    methods_summary: { type: 'string' },
    key_numbers: { type: 'array', items: { type: 'object', properties: { value: { type: 'string' }, context: { type: 'string' } }, required: ['value', 'context'], additionalProperties: false } },
    findings: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, summary: { type: 'string' } }, required: ['title', 'summary'], additionalProperties: false } },
    policy_recommendations: { type: 'array', items: { type: 'string' } },
    apa_citation: { type: 'string' },
    recommended_visuals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['figure', 'table'] }, source_label: { type: 'string' }, page: { type: 'integer' }, why: { type: 'string' }, suggested_caption: { type: 'string' },
          box: { type: 'object', properties: { left: { type: 'number' }, top: { type: 'number' }, right: { type: 'number' }, bottom: { type: 'number' } }, required: ['left', 'top', 'right', 'bottom'], additionalProperties: false },
        },
        required: ['kind', 'source_label', 'page', 'why', 'suggested_caption', 'box'], additionalProperties: false,
      },
    },
    number_flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: { claim: { type: 'string' }, where: { type: 'string' }, conflict: { type: 'string' }, used: { type: 'string' } },
        required: ['claim', 'where', 'conflict', 'used'], additionalProperties: false,
      },
    },
  },
  required: ['title', 'authors', 'journal', 'year', 'design', 'research_questions', 'sample', 'methods_summary', 'key_numbers', 'findings', 'policy_recommendations', 'apa_citation', 'recommended_visuals', 'number_flags'],
  additionalProperties: false,
};

const DESIGNS = ['causal', 'observational', 'descriptive', 'qualitative'];
const str = v => String(v ?? '').trim();
const list = v => (Array.isArray(v) ? v : []);

/**
 * Where a table or figure sits on its page, as the read marked it: fractions
 * of the page from its top-left corner, held to the page. A box too thin to
 * hold anything, or drawn backwards, is no box, and the cut is the whole page.
 */
export function normalizeBox(box) {
  if (!box || typeof box !== 'object') return null;
  const n = k => (typeof box[k] === 'number' && Number.isFinite(box[k]) ? Math.min(1, Math.max(0, box[k])) : null);
  const [left, top, right, bottom] = ['left', 'top', 'right', 'bottom'].map(n);
  if ([left, top, right, bottom].some(v => v === null)) return null;
  if (right - left < 0.05 || bottom - top < 0.03) return null;
  return { left, top, right, bottom };
}

/** The extract as the desk keeps it: every key present, the design one of the four, nothing invented. */
export function normalizeExtract(json) {
  if (!json || typeof json !== 'object') throw new Error('nothing came back from the read of the paper');
  const title = str(json.title);
  if (!title) throw new Error('the read of the paper gave no title');
  return {
    title,
    authors: list(json.authors).map(str).filter(Boolean),
    journal: str(json.journal),
    year: Number.parseInt(json.year, 10) || 0,
    design: DESIGNS.includes(json.design) ? json.design : 'descriptive',
    research_questions: list(json.research_questions).map(str).filter(Boolean),
    sample: str(json.sample),
    methods_summary: str(json.methods_summary),
    key_numbers: list(json.key_numbers).map(n => ({ value: str(n?.value), context: str(n?.context) })).filter(n => n.value),
    findings: list(json.findings).map(f => ({ title: str(f?.title), summary: str(f?.summary) })).filter(f => f.title || f.summary),
    policy_recommendations: list(json.policy_recommendations).map(str).filter(Boolean),
    apa_citation: str(json.apa_citation),
    recommended_visuals: list(json.recommended_visuals)
      .map(v => ({ kind: v?.kind === 'figure' ? 'figure' : 'table', source_label: str(v?.source_label), page: Number.parseInt(v?.page, 10) || 0, why: str(v?.why), suggested_caption: str(v?.suggested_caption), box: normalizeBox(v?.box) }))
      .filter(v => v.source_label),
    number_flags: list(json.number_flags).map(f => ({ claim: str(f?.claim), where: str(f?.where), conflict: str(f?.conflict), used: str(f?.used) })).filter(f => f.claim),
  };
}

/** What fits on a page, measured from the built briefs (bowen-2026/page-plan.md). */
export const PAGE_CAPACITY = [
  ['Cover: Executive Summary', '125 to 160', 'meer, kwok, nagro, svajda-hardy'],
  ['Cover: Report Highlights (3)', '105 to 130', 'same'],
  ['Body page, text only', '420 to 470', 'meer p2, kwok p2, nagro p2'],
  ['Body page with one table', '330 to 400', 'meer p4, nagro p3, svajda-hardy p3'],
  ['Closing page (refs, paper card, About ERC)', '150 to 260', 'kwok p5, meer p5'],
];

const designNote = extract => (extract.design === 'causal'
  ? 'This study uses a causal design, so causal language is appropriate where the paper itself makes causal claims.'
  : `This study is ${extract.design}, NOT causal. Use associational language only ("associated with", "related to"). Never write "causes" or "leads to".`);

const notesBlock = notes => (str(notes) ? `THE EDITOR'S NOTES (follow them; where they are silent, follow the paper):\n${str(notes)}` : 'The editor left no notes; follow the paper.');

/** The page plan: cover and body pages with prose budgets, the brief's table, the rule once authors approve, a suggested title. */
export function buildPlanPrompt(extract, notes) {
  return [
    'Structured record of the attached paper:',
    JSON.stringify(extract, null, 2),
    '',
    notesBlock(notes),
    '',
    designNote(extract),
    '',
    'TASK: Write the page plan for a 5-page ERC research brief on this paper, as a markdown document, in this shape:',
    '1. The first line: "# Page Plan: <first author> (<year>)".',
    '2. A line "**Paper:**" with the APA citation, a line "**Design:**" naming the design and what language it allows.',
    '3. A line exactly "Suggested brief title: <title>" with a brief title in the ERC pattern (a plain main title, a colon, what the study found or asked), 80 characters or fewer.',
    '4. "## Capacity (measured from built briefs)", this table as given:',
    '| Page type | Words that fit | Measured from |',
    '|---|---|---|',
    ...PAGE_CAPACITY.map(([type, words, from]) => `| ${type} | ${words} | ${from} |`),
    'Counts include headings and table text, so prose budgets sit under the ceilings.',
    '5. "## Plan (cover + 4 body pages)": a table with Page, Content, Prose budget, Visual; the cover carries the Executive Summary and 3 Report Highlights; findings get a page with the brief\'s one table; Policy Implications and Conclusions close; the last page holds Conclusions, References, the paper card and About ERC. Then "**Body prose total:**" against the band 1,300 to 2,000.',
    '6. "## The brief\'s visual (page N)": the brief\'s one visual, adapted from the paper\'s best table or figure (name it). Say whether it is Figure 1, a bar chart, or Table 1: a chart when its point is a trend over time or a comparison across 2 to 8 groups AND the paper prints the values; a table for results, several measures, or anything the paper does not print as numbers. Say what it keeps and which subgroup results stay in prose.',
    '7. "## Rule once authors approve": wording is frozen after author sign-off; layout may move content or change spacing; any wording cut goes back to the editor as a flag.',
    '8. "## Number flags (paper conflicts with itself)": a numbered list from the record\'s number_flags, each naming the value the brief uses; or "None found."',
    'Output ONLY the markdown document.',
  ].join('\n');
}

/** What the plan says back: the suggested title, if the model wrote the line. */
export function parsePlan(plan) {
  const m = /^(?:[-*]\s+|\d+\.\s+)?\*{0,2}Suggested brief title:?\*{0,2}:?\s*(.+?)\s*$/m.exec(String(plan ?? ''));
  return { title: m ? m[1].replace(/^["“]|["”]$/g, '').trim() : '' };
}

/**
 * The brief's one visual, proposed (Kate, Oct 22: "i want to see their
 * figure and the proposed new one before it goes off to the author"; the
 * plan picks a chart or a table per paper). Always its table, which is the
 * chart's data table too (the brand guide pairs every chart with one); a
 * chart's bars as numbers for the desk to draw.
 */
export const VISUAL_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['table', 'chart'] },
    source_label: { type: 'string' },
    title: { type: 'string' },
    kept: { type: 'string' },
    columns: { type: 'array', items: { type: 'string' } },
    rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    value_label: { type: 'string' },
    value_format: { type: 'string', enum: ['number', 'percent'] },
    bars: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' } }, required: ['label', 'value'], additionalProperties: false } },
  },
  required: ['kind', 'source_label', 'title', 'kept', 'columns', 'rows', 'value_label', 'value_format', 'bars'],
  additionalProperties: false,
};

/** The proposal's prompt: the record, the plan (which names the visual and its form), her notes. */
export function buildVisualPrompt(extract, plan, notes) {
  return [
    'Structured record of the attached paper:',
    JSON.stringify(extract, null, 2),
    '',
    'THE PAGE PLAN (its section "The brief\'s visual" names the visual and whether it is a chart or a table):',
    str(plan) || '(no plan)',
    '',
    notesBlock(notes),
    '',
    'TASK: Build the brief\'s one visual exactly as the page plan names it.',
    '- kind: "chart" for a bar chart (Figure 1) or "table" (Table 1), as the plan says.',
    '- source_label: the paper\'s table or figure it is drawn from, as the paper labels it (e.g. "Table 3").',
    '- title: one plain sentence a policymaker reads as the finding, in sentence case, no period at the end.',
    '- kept: one or two short sentences, "Kept: ... Left out: ...", naming what moved to prose.',
    '- columns and rows: the visual as a data table a policymaker can read, every cell a string. Fill them for a chart too: they are the chart\'s data table.',
    '- For a chart: bars holds 2 to 8 bars, each a short group or time label and its value as a number; value_label names what the bars measure ("Share who felt at home", "College-level courses taken"); value_format is "percent" when the values are percents, else "number". Bars start at zero, so use no negative values; if the values are not all zero or more, make it a table.',
    '- For a table: bars is empty, value_label is empty and value_format is "number".',
    'Every number must be copied verbatim from the attached paper (a table\'s cells, or values the paper prints on or beside a figure). Never read a value off a bar\'s height. If the paper does not print the values a chart needs, make it a table of what it does print.',
  ].join('\n');
}

const cell = v => str(v).replace(/\s+/g, ' ');

/** The proposal as the desk keeps it: a chart it can draw, or the table; its name, Figure 1 or Table 1. */
export function normalizeVisual(json) {
  if (!json || typeof json !== 'object') throw new Error('the proposal came back empty');
  const columns = list(json.columns).map(cell).filter(Boolean);
  const rows = list(json.rows).map(r => list(r).map(cell).slice(0, columns.length)).filter(r => r.some(Boolean))
    .map(r => [...r, ...Array(Math.max(0, columns.length - r.length)).fill('')]);
  const bars = list(json.bars).map(b => ({ label: cell(b?.label), value: typeof b?.value === 'number' ? b.value : Number.NaN }));
  const drawable = bars.length >= 2 && bars.length <= 8 && bars.every(b => b.label && Number.isFinite(b.value) && b.value >= 0) && bars.some(b => b.value > 0);
  const kind = json.kind === 'chart' && drawable ? 'chart' : 'table';
  if (!columns.length || !rows.length) {
    if (kind !== 'chart') throw new Error('the proposal came back without a table');
  }
  const title = str(json.title).replace(/\.$/, '');
  if (!title) throw new Error('the proposal came back without a title');
  return {
    kind,
    name: kind === 'chart' ? 'Figure 1' : 'Table 1',
    source_label: str(json.source_label),
    title,
    kept: str(json.kept),
    columns: columns.length ? columns : [str(json.value_label) || 'Group', 'Value'],
    rows: rows.length ? rows : bars.map(b => [b.label, String(b.value)]),
    value_label: kind === 'chart' ? str(json.value_label) : '',
    value_format: kind === 'chart' && json.value_format === 'percent' ? 'percent' : 'number',
    bars: kind === 'chart' ? bars : [],
  };
}

const mdCell = v => String(v ?? '').replace(/\|/g, '\\|');

/** The proposal as a file in the figures folder: its name and title, the table, where it came from. */
export function visualMarkdown(visual) {
  const head = [`# ${visual.name}. ${visual.title}`, ''];
  if (visual.kind === 'chart') head.push(`A bar chart of ${visual.value_label || 'the values'}; its numbers:`, '');
  const table = [
    `| ${visual.columns.map(mdCell).join(' | ')} |`,
    `|${visual.columns.map(() => '---').join('|')}|`,
    ...visual.rows.map(r => `| ${r.map(mdCell).join(' | ')} |`),
  ];
  const foot = ['', `From the paper's ${visual.source_label || 'table or figure'}. ${visual.kept}`.trim()];
  if (visual.kind === 'chart') foot.push('', 'The chart itself: proposed-figure-1.png, beside this file.');
  return `${[...head, ...table, ...foot].join('\n')}\n`;
}

const SECTION_INSTRUCTIONS = {
  exec_summary: 'Write the Executive Summary as two short paragraphs: first the stakes, then the study and its headline result. The FIRST sentence of the second paragraph must name the journal and signal that this brief summarizes a larger study, in the pattern: "This brief summarizes a research study in {JOURNAL} that examines ...".',
  highlights: 'Write Report Highlights: exactly 3 items. Each item is a bold takeaway line in the pattern "**01. <takeaway>.**" on its own line, followed on the next line by one number-forward supporting sentence or two. This is the punchiest register in the brief: a bold takeaway followed by number-forward support. Livelier than body prose but still factual.',
  introduction: 'Write the Introduction. Open on human stakes with a statistic: who is affected, why it matters for Texas and US education policy, what problem the study addresses. Urgency without alarm. Claims about the broader literature should be conservative and clearly framed; number any outside source with a superscript and list it in References.',
  research_overview: 'Write the Research Overview. It MUST open with the house pattern: "This brief draws on [data source]..." Then research questions, sample, and methods in plain language; this is the most methodical and most hedged section. Define the design for a lay reader with the plain term first (for example "a cutoff-based (regression discontinuity) design"). End by stating the study\'s limitations plainly. Do not compress this section.',
  key_findings: 'Write Key Findings as 2 to 4 findings. Format each as "### Finding N" on its own line followed by a short bold finding title line, then a paragraph that leads with the number-bearing subject ("Students who received the email were 8.8 percentage points more likely to...") and then interprets, tying back to the larger issue. Where the page plan places the brief\'s visual, write "[{VISUAL} here]" on its own line at that spot. Verbatim numbers with context. This is the heart of the brief; do not compress it.',
  policy_implications: 'Write Policy Implications. Paper-first: lead with what the authors themselves recommend. Format each item as a NUMBERED bold action phrase on its own line ("1. **Use low-cost encouragement to widen the pipeline.**") followed by a plain-language explanation paragraph; the justification trails the ask, and asks are softened ("may consider", "can implement"), never commands. For qualitative studies, a split into "Implications for Practice" and "Implications for Policy" is allowed. If the paper makes no recommendations at all, title the items as Considerations, back every claim with cited peer-reviewed literature, and flag any claim you cannot cite.',
  conclusions: 'Write the Conclusions: a forward-looking wrap-up that restates the stakes in fresh words without introducing new claims. One slightly rhetorical closing move is allowed, framed declaratively, never as a question ("The real question is whether their schools will get the support they need.").',
  references: 'Produce the References list in APA 7. Include the focal article citation exactly as extracted. Include any other works explicitly cited in earlier sections, numbered to match their superscripts, and no others. One reference per line.',
};

/** One section's prompt: the record, the plan, her notes, what is drafted so far, the task and its band. */
export function buildSectionPrompt(extract, plan, notes, key, prior, visual = null) {
  const def = SECTION_DEFS.find(s => s.key === key);
  if (!def) throw new Error(`no section named ${key}`);
  const target = def.max > 0 ? `Target length: ${def.min} to ${def.max} words.` : 'No word target; include every needed reference.';
  const priorText = prior?.length
    ? `Sections drafted so far (for continuity; do not repeat them):\n\n${prior.map(p => `## ${p.key}\n${p.content}`).join('\n\n')}`
    : 'This is the first section drafted.';
  return [
    'Structured record of the attached paper:',
    JSON.stringify(extract, null, 2),
    '',
    'THE PAGE PLAN (the budgets and the visual it names bind this section):',
    str(plan) || '(no plan)',
    '',
    visual ? `THE BRIEF'S VISUAL: ${visual.name}, ${visual.title}. Refer to it as ${visual.name}.` : '',
    notesBlock(notes),
    '',
    priorText,
    '',
    `TASK: ${SECTION_INSTRUCTIONS[key].replace('{VISUAL}', visual?.name ?? 'Table 1')}`,
    designNote(extract),
    target,
    `The journal is ${extract.journal}. Before writing, re-read the parts of the attached paper relevant to this section closely, including any tables, figure notes, and appendices they reference. Every number you cite must be located in the paper and copied verbatim; if you cannot find a number in the paper, do not use it. Output ONLY the section text itself: no section heading, no preamble, no commentary.`,
  ].join('\n');
}

export const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    sections: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, content: { type: 'string' } }, required: ['key', 'content'], additionalProperties: false } },
    flags: { type: 'array', items: { type: 'object', properties: { section: { type: 'string' }, note: { type: 'string' } }, required: ['section', 'note'], additionalProperties: false } },
  },
  required: ['sections', 'flags'],
  additionalProperties: false,
};

/** The check: every section back, corrected against the rules and the paper, with flags for what it would not change. */
export function buildCheckPrompt(extract, sections) {
  return `Below is a complete ERC research brief draft, and the journal article it summarizes is attached as a PDF. Review the draft closely against BOTH the style rules in your instructions AND the paper itself, then return every section, corrected where needed.

Checks to enforce mechanically:
0. VERIFY EVERY STATISTIC against the attached paper: locate each number in the paper (body, tables, figure notes, appendices) and confirm the draft uses it verbatim and in the right context. Correct any number that is wrong; flag any number you cannot find. The draft must never claim more than the paper does.
1. Remove every em dash; restructure the sentence instead.
2. Every number originally written as "N percent" becomes "N%". "percentage points" stays spelled out.
3. The Executive Summary names the journal (${extract.journal}) and signals it summarizes a larger study.
4. Causal vs associational language matches the design (${extract.design}).
5. No raw academic term standing alone: any jargon (regression discontinuity, difference-in-differences, fixed effects, instrumental variables, and the like) must appear WITH its plain-language translation, plain term first ("a cutoff-based (regression discontinuity) design"). Fix in place.
6. The Research Overview opens with "This brief draws on ...". Policy items are numbered bold action phrases. No exclamation points, no contractions, no first-person anywhere in body prose.
7. Do NOT shorten sections. Never trim for brevity. Fix wording in place.
8. Anything you are unsure about (a claim you cannot verify, a judgment call), leave the text as-is and add a flag {section, note} instead of silently changing it.

Return ALL ${sections.length} sections in the "sections" array, even ones you did not change.

DRAFT:
${sections.map(s => `### ${s.key}\n${s.content}`).join('\n\n')}`;
}

const noDash = text => String(text ?? '').replace(/\s*—\s*/g, ', ');

/** The brief as one markdown file, shaped like bowen-2026/brief-draft.md. */
export function assembleDraft({ extract, sections, title, briefAuthor, month }) {
  const head = [
    `# ${str(title) || extract.title}`,
    '',
    `**ERC Research Brief | ${month}**`,
    '',
    `**Study authors:** ${(extract.authors ?? []).join(' · ')}`,
  ];
  if (str(briefAuthor)) head.push(`**Research Brief author:** ${str(briefAuthor)}`);
  head.push('', '---', '');
  const body = SECTION_DEFS.map(def => `## ${def.title}\n\n${noDash(sections?.[def.key] ?? '').trim()}`);
  return `${head.join('\n')}\n${body.join('\n\n')}\n`;
}

/** The brief's words alone, for Grammarly: no header block, no markdown marks, headings as lines, a table as its rows. */
export function grammarlyCopy(md) {
  const out = [];
  for (const raw of String(md ?? '').split('\n')) {
    const line = raw.trimEnd();
    if (/^\*\*(ERC Research Brief|Study authors:|Research Brief author:)/.test(line) || line.trim() === '---') continue;
    if (/^\|\s*-+\s*\|/.test(line) || /^\|[\s|:-]+\|$/.test(line)) continue;
    if (/^\|.*\|$/.test(line)) {
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      out.push(cells.length > 1 ? `${cells[0]}: ${cells.slice(1).join(', ')}` : cells[0]);
      continue;
    }
    let text = line.replace(/^#{1,6}\s+/, '');
    text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2');
    out.push(text);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const REWORK = ['Rework for the brief', 'Rework, maybe'];
/** The crop's file name, held to what the desk's figure door takes: 1 to 60 slug characters, so a long or blank label never leaves a figure uncut (review, Oct 22). */
const cropName = (label, page, n) => {
  const slug = String(label ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return `figure-${slug || `visual-${n}`}-p${page}.png`;
};

/** The paper's tables and figures that earn a place: the first two flagged for rework, the rest prose, each with its page and crop name. */
export function figuresInventory(extract) {
  const items = (extract.recommended_visuals ?? []).map((v, i) => ({
    label: v.source_label, kind: v.kind, page: v.page, caption: v.suggested_caption, why: v.why,
    rework: REWORK[i] ?? 'Prose', crop: cropName(v.source_label, v.page, i + 1), box: v.box ?? null,
  }));
  const rows = items.map(i => `| ${i.label} | ${i.page} | ${i.caption} | ${i.rework} |`);
  const md = [
    '# Tables and figures in the paper',
    '',
    'Pages are positions in the PDF, starting at 1. Rework means the brief redraws it in the ERC style; Prose means its point is told in words.',
    '',
    '| In the paper | PDF page | What it shows | For the brief |',
    '|---|---|---|---|',
    ...(rows.length ? rows : ['| (nothing earned a place) | | | |']),
    '',
    ...items.map(i => `- ${i.label}, p. ${i.page}: ${i.why} Crop: \`${i.crop}\`.`),
  ].join('\n');
  return { items, md: `${md}\n` };
}

/** The numbers the paper disagrees with itself on, as a numbered list naming what the draft used. */
export function numberFlagsMd(flags) {
  if (!flags?.length) return 'None found: the paper agrees with itself on every number the brief uses.';
  return flags.map((f, i) => `${i + 1}. **${f.claim}** (${f.where}): ${f.conflict}. The draft uses ${f.used}.`).join('\n');
}

const words = text => { const t = String(text ?? '').trim(); return t ? t.split(/\s+/).length : 0; };

/** The body prose, references left out. */
export function bodyWordCount(sections) {
  return Object.entries(sections ?? {}).filter(([key]) => key !== 'references').reduce((n, [, text]) => n + words(text), 0);
}

export const WORD_FLOOR = 1300;
export const WORD_CAP = 2000;
export function wordBand(count) {
  if (count < WORD_FLOOR) return `Under the floor of ${WORD_FLOOR.toLocaleString('en-US')}`;
  if (count > WORD_CAP) return `Over the cap of ${WORD_CAP.toLocaleString('en-US')}`;
  return 'In the band';
}

const JARGON = [
  { term: /regression discontinuity/i, cue: /cutoff/i, label: 'regression discontinuity', plain: 'cutoff-based design' },
  { term: /difference-in-differences/i, cue: /compar\w+ (the )?changes|before and after/i, label: 'difference-in-differences', plain: 'comparing changes before and after' },
  { term: /instrumental variable/i, cue: /indirect|stand-in|proxy/i, label: 'instrumental variable', plain: 'an indirect comparison' },
  { term: /fixed effects/i, cue: /within the same|comparing? \w+ to (itself|themselves)/i, label: 'fixed effects', plain: 'comparisons within the same school or student over time' },
  { term: /propensity score/i, cue: /similar students|matched/i, label: 'propensity score', plain: 'matching similar students' },
];

/** The mechanical style guards, by section: an em dash, "percent" after a number, bare jargon, a missing journal line. */
export function checkStyle(sections, journal) {
  const flags = [];
  for (const s of sections) {
    if (s.content.includes('—')) flags.push({ section: s.key, note: 'Contains an em dash; restructure the sentence.' });
    if (/\b\d+(\.\d+)?\s+percent\b(?!age)/i.test(s.content)) flags.push({ section: s.key, note: 'Uses the word "percent" after a number; use the % symbol.' });
    for (const j of JARGON) {
      if (j.term.test(s.content) && !j.cue.test(s.content)) flags.push({ section: s.key, note: `"${j.label}" appears without a plain-language translation (e.g. "${j.plain}"). Plain term first, jargon in parentheses.` });
    }
    if (s.key === 'exec_summary' && (!s.content.includes(journal) || !/summariz/i.test(s.content))) {
      flags.push({ section: 'exec_summary', note: `Missing the journal-signal line (must name ${journal} and say the brief summarizes a larger study).` });
    }
  }
  return flags;
}

/** The four files that land in the brief's folder. */
export function draftFiles({ plan, draft, grammarly, figures }) {
  const md = text => (String(text ?? '').endsWith('\n') ? String(text) : `${text ?? ''}\n`);
  return [
    { name: 'page-plan.md', contentType: 'text/markdown', text: md(plan) },
    { name: 'brief-draft.md', contentType: 'text/markdown', text: md(draft) },
    { name: 'brief-for-grammarly.md', contentType: 'text/markdown', text: md(grammarly) },
    { name: 'figures.md', contentType: 'text/markdown', text: md(figures) },
  ];
}
