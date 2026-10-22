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
import { buildPaperPrompt, normalizePaperFields, PAPER_TEXT_MAX } from './_lib/paper-fields.js';

export const config = { maxDuration: 60 };

const MAX_TEXT = NOTES_MAX;

/** The read action's one model call: the prompt in, the reply's text out. Built lazily so importing this file never needs the key. */
let client;
async function liveReadModel(prompt) {
  client ??= new Anthropic();
  const response = await client.messages.create({ model: REWRITE_MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
  return response.content.filter(part => part.type === 'text').map(part => part.text).join('');
}
const text = (value, max = MAX_TEXT) => String(value ?? '').trim().slice(0, max);

/** 'Yell leaders (final).PDF' as 'yell-leaders-final.pdf'. */
const plainPdfName = name => `${slugPart(String(name ?? '').replace(/\.pdf$/i, '')) || 'paper'}.pdf`;

const notesFile = notes => ({ name: 'notes.md', contentType: 'text/markdown', b64: Buffer.from(`${notes}\n`, 'utf8').toString('base64') });

/** Built over its dependencies so the tests can hand in fakes. */
export function createBriefsHandler({
  session = { refuse: refuseUnlessSignedIn },
  briefs = () => createBriefs(liveQuery()),
  drive = { briefFolder, saveFile, listFiles },
  mode = () => pickMode(process.env),
  readModel = liveReadModel,
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
      if (action === 'create') return create(store, req.body, res);
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
      return res.status(502).json({ ok: false, error: `The desk couldn't do that: ${err.message}` });
    }
  };

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
    const brief = await store.create({
      id, title: text(body?.title, 300), paperTitle: text(body?.paperTitle, 500), authors: text(body?.authors, 500), journal: text(body?.journal, 200),
      year: Number(year), authorOfRecord: text(body?.authorOfRecord, 120), folderId: folder.id, folderUrl: folder.url ?? '', paperName: fileName, notes,
    });
    return res.status(200).json({ ok: true, brief });
  }
}

export default createBriefsHandler();
