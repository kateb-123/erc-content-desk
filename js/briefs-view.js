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
    case 'draft': return { title: 'Drafting', meta: `started ${when}` };
    case 'proof': return { title: 'Your Grammarly pass', meta: `drafted ${when}${brief.words ? `, ${Number(brief.words).toLocaleString('en-US')} words` : ''}` };
    case 'author': {
      const days = daysBetween(dayOf(brief.stageAt), today);
      const who = brief.authorOfRecord ? `${brief.authorOfRecord}'s` : "The author's";
      return { title: `${who} edits`, meta: `sent ${when}, ${plural(days, 'day', 'days')}` };
    }
    case 'approved': return { title: 'The HTML, round two', meta: `approved ${when}` };
    case 'html': return { title: 'The layout, round two', meta: `since ${when}` };
    case 'live': return { title: 'Live', meta: when };
    default: return { title: 'Write the draft', meta: `paper and notes in, ${when}` };
  }
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
export function notesFile(name, text) {
  if (!/\.(md|markdown|txt)$/i.test(String(name ?? ''))) return { ok: false, error: 'Notes come as a .md or .txt file. Save the Word file as text first.' };
  const notes = String(text ?? '').trim();
  if (!notes) return { ok: false, error: 'That file is empty.' };
  if (notes.length > NOTES_MAX) return { ok: false, error: `That file is over ${NOTES_MAX.toLocaleString('en-US')} characters, more than a brief's notes hold. Trim it first.` };
  return { ok: true, notes };
}

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
