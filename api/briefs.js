/**
 * /api/briefs: the Research briefs hub (Kate, Oct 20, 2026), hers alone, so
 * every call needs the sign-in.
 *
 *   GET  ?list                       { ok, briefs: [brief] }
 *   GET  ?id=                        { ok, brief, files } (files null when Drive did not answer)
 *   POST { action: 'create', ... }   a new brief: a folder of its own on the
 *                                    team drive (the Sheet's script), the paper
 *                                    and notes.md filed in it, the row at the
 *                                    paper stage
 *   POST { action: 'notes', id, notes }  her notes again, on the row and as notes.md
 *
 * Database only, like the drafts: in Sheet mode, or before ensure-schema has
 * made the briefs table, every call says so plainly.
 */
import { refuseUnlessSignedIn } from './_lib/session.js';
import { pickMode } from './_lib/store.js';
import { liveQuery } from './_lib/db.js';
import { createBriefs, isMissingTable, MAX_PAPER_BYTES, NEEDS_DB, NO_TABLE } from './_lib/briefs.js';
import { briefFolder, saveFile, listFiles } from './_lib/sheets.js';
import Anthropic from '@anthropic-ai/sdk';
import { briefSlug, slugPart, NOTES_MAX } from '../js/briefs-view.js';
import { REWRITE_MODEL } from './_lib/rewrite.js';
import { parseModelJson } from './_lib/reply-json.js';
import { buildPaperPrompt, normalizePaperFields, PAPER_TEXT_MAX, PAPER_SCHEMA } from './_lib/paper-fields.js';
import {
  DRAFT_STEPS, SECTION_DEFS, nextDraftStep, stepWords, STYLE_SYSTEM_PROMPT, EXTRACT_PROMPT, EXTRACT_SCHEMA, normalizeExtract,
  buildPlanPrompt, parsePlan, buildSectionPrompt, buildCheckPrompt, CHECK_SCHEMA,
  VISUAL_SCHEMA, buildVisualPrompt, normalizeVisual, visualMarkdown, budgetFor,
  assembleDraft, grammarlyCopy, figuresInventory, numberFlagsMd, bodyWordCount, wordBand, checkStyle, draftFiles,
} from '../js/brief-draft.js';
import { getFile } from './_lib/sheets.js';

/** The draft's steps read the whole paper and write a section each; five minutes is the plan's ceiling, as for the rewrite. */
export const config = { maxDuration: 300 };

const MAX_TEXT = NOTES_MAX;

/**
 * The read action's one model call: the prompt in, the reply's text out.
 * Held to PAPER_SCHEMA like the desk's other model calls, with room for the
 * model's thinking inside max_tokens (on this model thinking counts against
 * it) and a check that the reply was not cut. Built lazily so importing this
 * file never needs the key.
 */
let client;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 0 }));
/** Each call names its own time: the read is short, a draft step long; one client never lends the other its clock (review, Oct 22). */
const READ_CALL = { timeout: 45_000, maxRetries: 1 };
const DRAFT_CALL = { timeout: 250_000, maxRetries: 0 };   // under the function's 300 s with the Drive calls around it; a retry could never fit
async function liveReadModel(prompt) {
  const response = await anthropic().messages.create({
    model: REWRITE_MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: PAPER_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  }, READ_CALL);
  if (response.stop_reason === 'max_tokens') throw new Error('the reply was cut short');
  return response.content.filter(part => part.type === 'text').map(part => part.text).join('');
}

/** A Word file's words as markdown, through the desk's Word reader (the one the bulk upload uses). */
async function liveWordToMarkdown(buffer) {
  const mammoth = await import('mammoth');
  return String((await mammoth.convertToMarkdown({ buffer })).value ?? '');
}

/** The Word reader escapes punctuation for strict markdown ("count\."); notes are read by people, so the backslashes go. */
export const plainMarkdown = text => String(text ?? '').replace(/\\([\\.\-*_#`[\]()>+!])/g, '$1');

/** The largest notes file the desk takes: Word files with a picture or two stay well under it. */
export const MAX_NOTES_BYTES = 2 * 1024 * 1024;
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** A crop of the paper's page, as the browser cuts it: a PNG under a plain name, 1.5 MB at most. */
export const MAX_CROP_BYTES = 1.5 * 1024 * 1024;
const CROP_NAME = /^figure-[a-z0-9-]{1,60}-p\d{1,3}\.png$/;
/** The proposed chart as a picture, drawn in the browser (Kate, Oct 22). */
const PROPOSED_NAME = /^proposed-figure-1\.png$/;
/** The cuts and the proposal live in a folder of their own inside the brief's folder. */
const FIGURES = 'figures';

/**
 * The draft's model call: the style prompt and the paper's PDF, both cached
 * across the steps, then the step's prompt; held to a schema where one is
 * given. The paper goes in as a document so the model reads its tables and
 * figures, not a text dump. Built lazily so importing this file never needs
 * the key.
 */
async function liveDraftModel({ system, prompt, pdfB64, schema, maxTokens = 8000, effort = 'high' }) {
  const started = Date.now();
  const response = await anthropic().messages.create({
    model: REWRITE_MODEL,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: schema ? { effort, format: { type: 'json_schema', schema } } : { effort },
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 }, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: prompt },
      ],
    }],
  }, DRAFT_CALL);
  // What each step cost and took, in the logs, so the budgets can be tuned from live runs.
  console.log('draft call', JSON.stringify({ effort, maxTokens, ms: Date.now() - started, stop: response.stop_reason, usage: response.usage }));
  if (response.stop_reason === 'max_tokens') throw new Error('the reply was cut short');
  return response.content.filter(part => part.type === 'text').map(part => part.text).join('');
}

/** "October 2026", College Station's month. */
const monthOf = ms => new Date(ms).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Chicago' });
const text = (value, max = MAX_TEXT) => String(value ?? '').trim().slice(0, max);

/** 'Yell leaders (final).PDF' as 'yell-leaders-final.pdf'. */
const plainPdfName = name => `${slugPart(String(name ?? '').replace(/\.pdf$/i, '')) || 'paper'}.pdf`;

const notesFile = notes => ({ name: 'notes.md', contentType: 'text/markdown', b64: Buffer.from(`${notes}\n`, 'utf8').toString('base64') });

/** Built over its dependencies so the tests can hand in fakes. */
export function createBriefsHandler({
  session = { refuse: refuseUnlessSignedIn },
  briefs = () => createBriefs(liveQuery()),
  drive = { briefFolder, saveFile, listFiles, getFile },
  mode = () => pickMode(process.env),
  readModel = liveReadModel,
  wordToMarkdown = liveWordToMarkdown,
  draftModel = liveDraftModel,
  now = () => Date.now(),
} = {}) {
  return async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Use GET or POST.' });
    if (await session.refuse(req, res)) return;
    if (mode() !== 'db') return res.status(503).json({ ok: false, error: NEEDS_DB });
    try {
      const store = briefs();
      if (req.method === 'GET') {
        const id = text(req.query?.id, 120);
        if (!id) return res.status(200).json({ ok: true, briefs: await store.list() });
        const brief = await store.get(id);
        if (!brief) return res.status(404).json({ ok: false, error: 'No brief by that name.' });
        if (req.query?.image) {
          // A cut or the proposed chart, as a picture for the brief's page (Kate, Oct 22: "i want to see their figure and the proposed new one").
          const name = text(req.query.image, 80);
          if (!CROP_NAME.test(name) && !PROPOSED_NAME.test(name)) return res.status(400).json({ ok: false, error: 'No picture by that name.' });
          const file = await drive.getFile(brief.folderId, name, { sub: FIGURES });
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'private, max-age=86400');
          return res.status(200).send(Buffer.from(file.b64 ?? '', 'base64'));
        }
        if (req.query?.paper) {
          // The paper itself, for the browser to cut the chosen tables and figures out of.
          const paper = await drive.getFile(brief.folderId, brief.paperName);
          return res.status(200).json({ ok: true, name: paper.name, b64: paper.b64 });
        }
        let files = null;
        try { files = brief.folderId ? await drive.listFiles(brief.folderId) : []; } catch { files = null; }
        return res.status(200).json({ ok: true, brief, files });
      }

      const action = text(req.body?.action, 20);
      if (action === 'read') {
        // The paper's first pages as text (the browser read them with pdf.js); the model names the paper.
        const paper = String(req.body?.text ?? '').trim().slice(0, PAPER_TEXT_MAX);
        if (!paper) return res.status(400).json({ ok: false, error: 'There was nothing to read in that PDF. Type the title, authors, journal and year.' });
        let fields;
        try {
          fields = normalizePaperFields(parseModelJson(await readModel(buildPaperPrompt(paper)), 'the paper read'));
        } catch (err) {
          return res.status(502).json({ ok: false, error: `The desk couldn't read the paper: ${err.message}. Type the title, authors, journal and year.` });
        }
        return res.status(200).json({ ok: true, fields });
      }
      if (action === 'notes-text') {
        // Her notes as a Word file (Kate, Oct 22): the .docx comes up as base64 and goes back as markdown.
        const name = text(req.body?.name, 200);
        if (!/\.docx$/i.test(name)) return res.status(400).json({ ok: false, error: 'Only a Word .docx is read here; a .md or .txt is read in the browser.' });
        const b64 = String(req.body?.b64 ?? '');
        const buffer = Buffer.from(b64, 'base64');
        if (!buffer.length) return res.status(400).json({ ok: false, error: 'That Word file came through empty. Choose it again.' });
        if (buffer.length > MAX_NOTES_BYTES) return res.status(400).json({ ok: false, error: 'That Word file is over 2 MB. Take the pictures out and try again.' });
        let notes;
        try { notes = plainMarkdown(await wordToMarkdown(buffer)).trim(); } catch (err) {
          return res.status(502).json({ ok: false, error: `The desk couldn't read that Word file: ${err.message}. Save it as .txt and choose that instead.` });
        }
        return res.status(200).json({ ok: true, notes: notes.slice(0, MAX_TEXT) });
      }
      if (action === 'create') return await create(store, req.body, res);   // awaited, so a Drive refusal lands in the catch below, not as a crash
      if (action === 'draft') return await draft(store, req.body, res);
      if (action === 'figure') {
        // A crop of the paper's page, cut in the browser, filed beside the draft.
        const id = text(req.body?.id, 120);
        const brief = id && await store.get(id);
        if (!brief) return res.status(404).json({ ok: false, error: 'No brief by that name.' });
        const name = text(req.body?.name, 80);
        if (!CROP_NAME.test(name) && !PROPOSED_NAME.test(name)) return res.status(400).json({ ok: false, error: 'A crop is named figure-<label>-p<page>.png.' });
        const b64 = String(req.body?.b64 ?? '');
        const bytes = Buffer.from(b64, 'base64').length;
        if (!bytes) return res.status(400).json({ ok: false, error: 'The crop came through empty.' });
        if (bytes > MAX_CROP_BYTES) return res.status(400).json({ ok: false, error: 'That crop is over 1.5 MB.' });
        await drive.saveFile({ folderId: brief.folderId, sub: FIGURES, name, contentType: 'image/png', b64 });
        const draftExtra = { ...(brief.extra?.draft ?? {}) };
        draftExtra.crops = [...new Set([...(draftExtra.crops ?? []), name])];
        const updated = await store.update(id, { extra: { ...(brief.extra ?? {}), draft: draftExtra } });
        return res.status(200).json({ ok: true, brief: updated });
      }
      if (action === 'notes') {
        const id = text(req.body?.id, 120);
        const brief = id && await store.get(id);
        if (!brief) return res.status(404).json({ ok: false, error: 'No brief by that name.' });
        const notes = text(req.body?.notes);
        if (brief.folderId) await drive.saveFile({ folderId: brief.folderId, ...notesFile(notes) });
        return res.status(200).json({ ok: true, brief: await store.update(id, { notes }) });
      }
      return res.status(400).json({ ok: false, error: `Unknown action: ${action || '(none)'}.` });
    } catch (err) {
      if (isMissingTable(err)) return res.status(503).json({ ok: false, error: NO_TABLE });
      console.error('briefs failed', err);
      if (/Unknown action/.test(String(err?.message))) {
        return res.status(502).json({ ok: false, error: "The Sheet's script does not know this action yet. Paste the latest Code.gs into it and deploy a new version." });
      }
      return res.status(502).json({ ok: false, error: `The desk couldn't do that: ${err.message}` });
    }
  };

  /**
   * One step of the draft (Kate, Oct 22; the stage in docs/research-briefs-handoff.md):
   * the browser calls this once per step, in order, and shows each step's
   * words; every step keeps what it made on the brief's row and in its
   * folder, so a step that fails can be tried again and a page left mid-way
   * picks up where it stopped.
   */
  async function draft(store, body, res) {
    const id = text(body?.id, 120);
    const brief = id && await store.get(id);
    if (!brief) return res.status(404).json({ ok: false, error: 'No brief by that name.' });
    const extra = { ...(brief.extra ?? {}) };
    if (text(body?.briefAuthor, 120)) extra.briefAuthor = text(body?.briefAuthor, 120);
    const d = { ...(extra.draft ?? {}) };
    d.done = [...(d.done ?? [])];
    d.sections = { ...(d.sections ?? {}) };
    const named = text(body?.step, 40);
    if (named && !DRAFT_STEPS.includes(named)) return res.status(400).json({ ok: false, error: `No draft step named ${named}.` });
    // A step named outright starts over from it (Write it again): what came after it is undone,
    // its sections too, so the new run is never steered by the draft it replaces (review, Oct 22).
    if (named) {
      const at = DRAFT_STEPS.indexOf(named);
      d.done = d.done.filter(s => DRAFT_STEPS.indexOf(s) < at);
      for (const key of Object.keys(d.sections)) if (DRAFT_STEPS.indexOf(key) >= at) delete d.sections[key];
      if (at <= DRAFT_STEPS.indexOf('plan')) { delete d.plan; delete d.title; }
      if (at <= DRAFT_STEPS.indexOf('visual')) delete d.visual;
      if (at <= DRAFT_STEPS.indexOf('check')) delete d.checkFlags;
      delete d.result;
      delete d.crops;
    }
    const step = named || nextDraftStep(d.done);
    if (!step) return res.status(200).json({ ok: true, brief, step: null, next: null });

    const patch = { extra };
    // Notes typed on the page ride the first call, so Write the draft never drops them (review, Oct 22).
    if (typeof body?.notes === 'string' && text(body.notes) !== (brief.notes ?? '')) {
      patch.notes = text(body.notes);
      brief.notes = patch.notes;
      if (brief.folderId) await drive.saveFile({ folderId: brief.folderId, ...notesFile(patch.notes) });
    }
    if (brief.stage === 'paper' || (named && brief.stage !== 'draft')) { patch.stage = 'draft'; patch.stageAt = new Date(now()).toISOString(); }
    const sectionKeys = SECTION_DEFS.map(s => s.key);
    try {
      if (step === 'assemble') {
        const result = assemble(brief, d, extra.briefAuthor);
        d.result = result;
        for (const file of draftFiles(result)) {
          await drive.saveFile({ folderId: brief.folderId, name: file.name, contentType: file.contentType, b64: Buffer.from(file.text, 'utf8').toString('base64') });
        }
        patch.words = result.words;
        if (!text(brief.title) && d.title) patch.title = d.title;
        patch.stage = 'proof';
        patch.stageAt = new Date(now()).toISOString();
      } else {
        const paper = await drive.getFile(brief.folderId, brief.paperName);
        const ask = (prompt, schema) => draftModel({ system: STYLE_SYSTEM_PROMPT, prompt, pdfB64: paper.b64, schema, ...budgetFor(step) });
        if (step === 'extract') {
          d.extract = normalizeExtract(parseModelJson(await ask(EXTRACT_PROMPT, EXTRACT_SCHEMA), 'the read of the paper'));
          // A .md, since the Sheet's script files only the names its rule allows, and .json is not one (Oct 22).
          const md = `# What the desk read from the paper\n\n\`\`\`json\n${JSON.stringify(d.extract, null, 2)}\n\`\`\`\n`;
          await drive.saveFile({ folderId: brief.folderId, name: 'extract.md', contentType: 'text/markdown', b64: Buffer.from(md, 'utf8').toString('base64') });
        } else if (step === 'plan') {
          if (!d.extract) throw new Error('the paper has not been read yet');
          d.plan = String(await ask(buildPlanPrompt(d.extract, brief.notes), null)).trim();
          d.title = parsePlan(d.plan).title;
          await drive.saveFile({ folderId: brief.folderId, name: 'page-plan.md', contentType: 'text/markdown', b64: Buffer.from(`${d.plan}\n`, 'utf8').toString('base64') });
        } else if (step === 'visual') {
          if (!d.extract) throw new Error('the paper has not been read yet');
          d.visual = normalizeVisual(parseModelJson(await ask(buildVisualPrompt(d.extract, d.plan ?? '', brief.notes), VISUAL_SCHEMA), 'the proposal'));
          await drive.saveFile({ folderId: brief.folderId, sub: FIGURES, name: 'proposed-visual.md', contentType: 'text/markdown', b64: Buffer.from(visualMarkdown(d.visual), 'utf8').toString('base64') });
        } else if (sectionKeys.includes(step)) {
          if (!d.extract) throw new Error('the paper has not been read yet');
          const prior = sectionKeys.filter(k => d.sections[k] != null && k !== step).map(k => ({ key: k, content: d.sections[k] }));
          d.sections[step] = String(await ask(buildSectionPrompt(d.extract, d.plan ?? '', brief.notes, step, prior, d.visual ?? null), null)).trim();
        } else if (step === 'check') {
          const sections = sectionKeys.filter(k => d.sections[k] != null).map(k => ({ key: k, content: d.sections[k] }));
          if (!sections.length) throw new Error('no sections to check yet');
          const checked = parseModelJson(await ask(buildCheckPrompt(d.extract, sections), CHECK_SCHEMA), 'the check');
          for (const s of checked.sections ?? []) if (sectionKeys.includes(s.key) && typeof s.content === 'string' && s.content.trim()) d.sections[s.key] = s.content.trim();
          d.checkFlags = (checked.flags ?? []).map(f => ({ section: String(f.section ?? ''), note: String(f.note ?? '') })).filter(f => f.note);
        }
      }
    } catch (err) {
      console.error('draft step failed', step, err);
      return res.status(502).json({ ok: false, error: `The desk couldn't write the draft at ${stepWords(step)}: ${err.message}. Try again.` });
    }
    if (!d.done.includes(step)) d.done.push(step);
    d.step = nextDraftStep(d.done);
    extra.draft = d;
    const updated = await store.update(id, patch);
    return res.status(200).json({ ok: true, brief: updated, step, next: d.step });
  }

  /** The files from what the steps made: the brief, the Grammarly copy, the figures, the flags, the word band. */
  function assemble(brief, d, briefAuthor) {
    const extract = d.extract ?? { title: brief.paperTitle, authors: (brief.authors || '').split(/\s*(?:,|\band\b)\s*/).filter(Boolean), journal: brief.journal, recommended_visuals: [], number_flags: [] };
    const draftMd = assembleDraft({ extract, sections: d.sections, title: d.title, briefAuthor, month: monthOf(now()) });
    const inventory = figuresInventory(extract);
    const sections = SECTION_DEFS.filter(s => d.sections[s.key] != null).map(s => ({ key: s.key, content: d.sections[s.key] }));
    const words = bodyWordCount(d.sections);
    // What the check could not settle and the paper's number conflicts: a file in the folder, not the page (Kate, Oct 22).
    const conflicts = (extract.number_flags ?? []).length ? numberFlagsMd(extract.number_flags) : '';
    const unsettled = [...(d.checkFlags ?? []), ...checkStyle(sections, extract.journal ?? '')].map(f => `- ${String(f.section).replace(/_/g, ' ')}: ${f.note}`);
    const checkNotes = conflicts || unsettled.length
      ? ['# Check notes', '', ...(conflicts ? ['## Numbers the paper disagrees with itself on', '', conflicts, ''] : []), ...(unsettled.length ? ['## What the check could not settle', '', ...unsettled, ''] : [])].join('\n')
      : '';
    return {
      checkNotes,
      plan: d.plan ?? '', draft: draftMd, grammarly: grammarlyCopy(draftMd), figures: inventory.items, figuresMd: inventory.md,
      numberFlags: numberFlagsMd(extract.number_flags), styleFlags: checkStyle(sections, extract.journal ?? ''), words, band: wordBand(words),
      visual: d.visual ?? null,
    };
  }

  async function create(store, body, res) {
    const authorLast = text(body?.authorLast, 80);
    const year = text(body?.year, 4);
    const topic = text(body?.topic, 60);
    if (!authorLast) return res.status(400).json({ ok: false, error: "The author's last name names the folder. Type it." });
    const id = briefSlug({ authorLast, year, topic });
    if (!id) return res.status(400).json({ ok: false, error: 'The year is four digits, like 2026.' });
    const paperB64 = String(body?.paperB64 ?? '');
    if (!paperB64) return res.status(400).json({ ok: false, error: 'The paper came through empty. Choose the PDF again.' });
    const paperName = text(body?.paperName, 200);
    if (!/\.pdf$/i.test(paperName)) return res.status(400).json({ ok: false, error: 'The paper must be a PDF.' });
    const bytes = Buffer.from(paperB64, 'base64').length;
    if (bytes > MAX_PAPER_BYTES) return res.status(400).json({ ok: false, error: 'The paper is over 3 MB. Shrink it (Preview: File, Export, Reduce File Size) and try again.' });
    if (await store.get(id)) return res.status(409).json({ ok: false, error: `A brief named ${id} already exists. Change the topic word.` });

    const notes = text(body?.notes);
    const folder = await drive.briefFolder(id);
    const fileName = plainPdfName(paperName);
    await drive.saveFile({ folderId: folder.id, name: fileName, contentType: 'application/pdf', b64: paperB64 });
    await drive.saveFile({ folderId: folder.id, ...notesFile(notes) });
    // Notes that came as a Word file keep their original beside notes.md; a .md or .txt original is notes.md already.
    const notesName = text(body?.notesName, 200);
    const notesB64 = String(body?.notesB64 ?? '');
    if (/\.docx$/i.test(notesName) && notesB64 && Buffer.from(notesB64, 'base64').length <= MAX_NOTES_BYTES) {
      await drive.saveFile({ folderId: folder.id, name: 'notes-original.docx', contentType: DOCX_TYPE, b64: notesB64 });
    }
    const brief = await store.create({
      id, title: text(body?.title, 300), paperTitle: text(body?.paperTitle, 500), authors: text(body?.authors, 500), journal: text(body?.journal, 200),
      year: Number(year), authorOfRecord: text(body?.authorOfRecord, 120), folderId: folder.id, folderUrl: folder.url ?? '', paperName: fileName, notes,
      extra: text(body?.briefAuthor, 120) ? { briefAuthor: text(body?.briefAuthor, 120) } : {},
    });
    return res.status(200).json({ ok: true, brief });
  }
}

export default createBriefsHandler();
