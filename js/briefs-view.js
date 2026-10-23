/**
 * The Research briefs hub (Kate, Oct 20, 2026; docs/research-briefs-handoff.md):
 * the research-brief pipeline, journal article to published brief, as the
 * desk's seventh hub, hers alone. Pure rules, so node --test can hold them;
 * briefs-ui.js draws what these say.
 *
 * The seven stages are her pipeline as she ran the Bowen brief; the last
 * two are round two and drawn greyed. A brief's folder on the team drive is
 * the author's last name, the year and a topic word (her pick, Oct 21,
 * since an author repeats).
 */
import { isoToShort } from './queue-view.js';

import { DRAFT_STEPS, SECTION_DEFS, nextDraftStep, stepWords, sameVisual } from './brief-draft.js';

export const STAGES = [
  { key: 'paper', label: 'Paper and notes' },
  { key: 'draft', label: 'Draft' },
  { key: 'proof', label: 'Your proof' },
  { key: 'author', label: 'With author' },
  { key: 'approved', label: 'Approved' },
  { key: 'html', label: 'HTML', later: true },
  { key: 'live', label: 'Live', later: true },
];

export const stageLabel = key => STAGES.find(s => s.key === key)?.label ?? '';
const stageIndex = key => Math.max(0, STAGES.findIndex(s => s.key === key));

/** Every stage with where a brief stands on it: done, now or later. */
export function stepStates(stage) {
  const at = stageIndex(stage);
  return STAGES.map((s, i) => ({ key: s.key, label: s.label, later: Boolean(s.later), state: i < at ? 'done' : i === at ? 'now' : 'later' }));
}

const dayOf = iso => String(iso ?? '').slice(0, 10);
const short = (iso, today) => isoToShort(dayOf(iso), today);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function daysBetween(fromIso, toIso) {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86400000)) : 0;
}

/** What the hub's table says a brief waits for: a title and a quiet line. */
export function waitsFor(brief, today) {
  const when = short(brief.stageAt, today);
  switch (brief.stage) {
    case 'draft': {
      const step = brief.extra?.draft?.step || (brief.extra?.draft?.done?.length ? nextDraftStep(brief.extra.draft.done) : '');
      return { title: 'Drafting', meta: `${step ? `${stepWords(step)}, ` : ''}started ${when}` };
    }
    case 'proof': return { title: 'Your Grammarly pass', meta: `drafted ${when}${brief.words ? `, ${Number(brief.words).toLocaleString('en-US')} words` : ''}` };
    case 'author': {
      const days = daysBetween(dayOf(brief.stageAt), today);
      const who = brief.authorOfRecord ? `${brief.authorOfRecord}'s` : "The author's";
      return { title: `${who} edits`, meta: `sent ${when}, ${plural(days, 'day', 'days')}` };
    }
    case 'approved': return { title: 'The HTML, round two', meta: `approved ${when}` };
    case 'html': return { title: 'The layout, round two', meta: `since ${when}` };
    case 'live': return { title: 'Live', meta: when };
    default: return { title: 'Write the draft', meta: `since ${when}` };
  }
}

/** A step's name in the running box, the same whatever its state; the icon says done, now or later (Kate's copy edit, Oct 22). */
function stepRowWords(step) {
  const section = SECTION_DEFS.find(s => s.key === step);
  if (section) return section.title;
  return { extract: 'Read the paper', plan: 'Plan the pages', visual: 'Table or chart', check: 'Check against the paper', assemble: 'Put the files together' }[step] ?? step;
}

/** The word count as the Draft box's pill: against 1,300 to 2,000, in two words (Kate's copy edit, Oct 22). */
export function bandPill(words) {
  const n = Number(words) || 0;
  if (n < 1300) return `${(1300 - n).toLocaleString('en-US')} short`;
  if (n > 2000) return `${(n - 2000).toLocaleString('en-US')} over`;
  return 'In range';
}

/** The draft's steps as the running box shows them (round 2): done, now (only while the browser is driving them) and later. */
export function draftProgress(brief, { running = false } = {}) {
  const d = brief?.extra?.draft ?? {};
  const done = new Set(d.done ?? []);
  const current = running ? (d.step || nextDraftStep([...done])) : null;
  return DRAFT_STEPS.map(key => {
    const state = done.has(key) ? 'done' : key === current ? 'now' : 'later';
    return { key, state, words: stepRowWords(key) };
  });
}

/** Letters, digits and single dashes, nothing else: a folder or file name Drive and a terminal both like. */
export function slugPart(text) {
  return String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The brief's id and folder: lastname-year-topic; nothing without a last name and a four-digit year. */
export function briefSlug({ authorLast, year, topic }) {
  const a = slugPart(authorLast);
  const y = String(year ?? '').trim();
  if (!a || !/^\d{4}$/.test(y)) return '';
  return [a, y, slugPart(topic)].filter(Boolean).join('-');
}

/** What a brief's notes hold at most: the API's own cap (text() in api/briefs.js), so a file is never cut without a word. */
export const NOTES_MAX = 20000;

/**
 * Her notes as a dropped file (Kate, Oct 22, 2026: "i just want to upload my
 * md"): a .md, .markdown or .txt fills the notes box; anything else is
 * refused with the reason. The text is trimmed, never otherwise changed.
 */
/** What kind of notes file this is: 'text' is read in the browser, 'word' (a .docx) goes to the desk's Word reader, '' is refused. */
export function notesKind(name) {
  const n = String(name ?? '');
  if (/\.(md|markdown|txt)$/i.test(n)) return 'text';
  if (/\.docx$/i.test(n)) return 'word';
  return '';
}

export function notesFile(name, text) {
  if (!notesKind(name)) return { ok: false, error: 'Notes come as a .md, .txt or Word .docx file, or pasted in.' };
  const notes = String(text ?? '').trim();
  if (!notes) return { ok: false, error: 'That file is empty.' };
  if (notes.length > NOTES_MAX) return { ok: false, error: `That file is over ${NOTES_MAX.toLocaleString('en-US')} characters. Trim it first.` };
  return { ok: true, notes };
}

/**
 * Why Create the brief is locked (Kate, Oct 22: "you should have to upload
 * the paper and notes, then it reads and fills out the byline"): the two
 * files come first, then the read has to finish. Empty once it may go.
 */
export function createLock({ paper, notes, reading, bytes = 0 }) {
  if (!paper && !notes) return 'Choose the paper and your notes first.';
  if (!paper) return 'Choose the paper first.';
  if (!notes) return 'Choose your notes file, or paste them, first.';
  if (bytes > UPLOAD_CAP_BYTES) return 'The paper and the Word file are too big together. Shrink the paper, or paste the notes.';
  if (reading) return 'Reading the paper first.';
  return '';
}

/**
 * Why Create the brief refuses on submit, in the form's order: the paper,
 * the notes, the folder name, then the brief author, who goes on the cover
 * and is never filled in for her (Kate, Oct 23). Null once it may go; the
 * focus names the box to put the cursor in.
 */
export function createProblem({ paper, notes, authorLast, year, topic, briefAuthor }) {
  if (!paper) return { why: 'Choose the paper, a PDF.', focus: 'paper' };
  if (!String(notes ?? '').trim()) return { why: 'Choose your notes file, or paste them.', focus: 'notes' };
  if (!briefSlug({ authorLast, year, topic })) return { why: "Add the author's last name and a four-digit year.", focus: 'last' };
  if (!String(briefAuthor ?? '').trim()) return { why: "Add the brief author's name.", focus: 'briefAuthor' };
  return null;
}

/** Brief author as New brief opens: the name this computer typed last, else empty, never a name of the desk's own (Kate, Oct 23). */
export const briefAuthorStart = remembered => String(remembered ?? '');

/** The one ask before Redraft replaces the folder's draft and any edits in it (Kate, Oct 23, her words). */
export const REDRAFT_ASK = { words: 'This replaces brief-draft.md and your edits in it.', yes: 'Write it again', no: 'Cancel' };

/**
 * What one Create can carry: the paper and a Word file go up together as
 * base64 in one body, and the desk's host refuses a body over 4.5 MB
 * (review, Oct 22). 3.1 MiB of files is 4.3 MB encoded, with room for the
 * boxes and pasted notes.
 */
export const UPLOAD_CAP_BYTES = Math.floor(3.1 * 1024 * 1024);

/** The brief as the page should show it the moment Write it again is pressed: the read as now, nothing done (review, Oct 22). */
export function restartDraft(brief) {
  const d = brief?.extra?.draft ?? {};
  return { ...brief, stage: 'draft', extra: { ...(brief?.extra ?? {}), draft: { ...d, done: [], step: 'extract' } } };
}

/** The one wait the steps do not name: once every step is done the browser cuts the crops, and the box says so (review, Oct 22). */
export function draftWait(brief, { running = false } = {}) {
  if (!running) return '';
  const done = new Set(brief?.extra?.draft?.done ?? []);
  return DRAFT_STEPS.every(s => done.has(s)) ? 'Cutting figures' : '';
}

/** Words in a notes file, the way the brief counts its own: a token with a letter or a digit in it, so "#" and "-" are not words. */
export const wordCount = text => String(text ?? '').split(/\s+/).filter(t => /[\p{L}\p{N}]/u.test(t)).length;

/** Her title once there is one, the paper's until then, the folder's name as a last resort. */
export const briefTitle = brief => brief.title || brief.paperTitle || brief.id;

/** The hub's table: in progress first, by stage and then by when it moved; live last. */
export function hubRows(briefs, today) {
  return [...(briefs ?? [])]
    .sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage) || String(a.stageAt ?? '').localeCompare(String(b.stageAt ?? '')))
    .map(b => ({ ...b, title: briefTitle(b), steps: stepStates(b.stage), waits: waitsFor(b, today), href: `/#briefs/${b.id}` }));
}

/** The front page's card: how many are not live yet, and how many sit with an author. */
export function briefsCard(briefs) {
  if (!Array.isArray(briefs)) return { count: null, sub: '' };
  const open = briefs.filter(b => b.stage !== 'live');
  const withAuthor = open.filter(b => b.stage === 'author').length;
  return { count: open.length, sub: `in progress${withAuthor ? ` · ${plural(withAuthor, 'with an author', 'with authors')}` : ''}` };
}

/**
 * The pair on the Draft box: the proposal's own source, cut by its own box,
 * or the read's cut of the same table or figure named another way; never a
 * different one in its place (review, Oct 22). The others leave it out.
 */
export function pairFor(figures, visual) {
  const list = figures ?? [];
  if (!visual) return { theirs: null, others: list };
  const same = f => sameVisual(f.label, visual.source_label);
  const theirs = visual.crop
    ? { label: visual.source_label, page: visual.page, crop: visual.crop, box: visual.box ?? null }
    : (list.find(same) ?? null);
  const others = list.filter(f => !(theirs && (f.crop === theirs.crop || same(f))));
  return { theirs, others };
}

/** The cuts still to make: each listed table or figure with a page, and the proposal's source, once each, its own box winning. */
export function cutsToMake({ figures = [], visual = null } = {}, done = []) {
  const cuts = new Map();
  for (const f of figures ?? []) if (f.page > 0) cuts.set(f.crop, { crop: f.crop, page: f.page, box: f.box ?? null });
  if (visual?.crop && visual.page > 0) cuts.set(visual.crop, { crop: visual.crop, page: visual.page, box: visual.box ?? null });
  return [...cuts.values()].filter(c => !done.includes(c.crop));
}
