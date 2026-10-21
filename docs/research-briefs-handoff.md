# Research briefs hub: handoff (Oct 20, 2026)

Written in the erc-research-briefs session for the desk session that builds
the hub. Read this whole file first, then the paths it names, then ask Kate
questions one at a time, then a wireframe in the pane. Build on her go only.

## The decision

The research-brief pipeline becomes the desk's seventh hub, **Research
briefs**. The standalone July app (`~/Projects/erc-brief-builder`, Next 16 +
Supabase, 14 commits, never deployed, no remote) is the source of the logic,
not of the screens. Nothing of it is deployed; its Supabase project is not
reused. The desk's own stack, look and rules apply.

Kate's four answers (Oct 20, all the recommended options):

1. **First slice:** the hub with its status queue, upload the paper and her
   notes, Claude drafts the brief as markdown with the paper's figures and
   tables flagged for rework, download the markdown and the author Word doc.
   The HTML build and page measuring are round two.
2. **Author round:** Word doc by email, as she does it now. The desk makes the
   Word doc and a prefilled email; she sends it from Outlook; edits come back
   by email. The July comment link is not in this round.
3. **Who sees it:** Kate only, behind the desk password, the same lock as Sort
   (`LOCKED_SCREENS` in `js/auth-view.js`). Drafts, paper PDFs and author
   comments never sit on an open page.
4. **Where:** this session, in the desk folder.

## The pipeline as Kate runs it

Learned on the Bowen brief (Sept to Oct 2026). Every stage is a status in
the queue; the queue is the "what is coming up" view she asked for.

| Status | What happens | Who |
|---|---|---|
| New paper | The PDF and her reading notes are in. Folder named for the TAMU author, `<lastname>-2026`. | Kate |
| Drafting | Claude reads the paper, writes a page plan with word budgets, then the whole brief as one markdown file, plus a flattened "Grammarly copy" (prose and table text only). The paper's tables and figures are inventoried with page numbers; one or two are flagged for rework. | app |
| Kate's proof | She runs the Grammarly copy through Grammarly and pastes her edited text back. Her wording is kept verbatim; fact slips, dropped hedges and grammar fixes are listed as separate groups and she picks which to apply. Number calls are hers, not the author's. Stats shown as two concrete sentences labelled A and B, never stars or p-values. | Kate, then app |
| With author | Clean Word doc (brief text, table in place, then a "Table(s) for Your Review" page: our version beside the paper's original crop, a "What we changed" list, three checkboxes) and a prefilled email to the author of record only. She sends it. | Kate |
| Approved | Wording is frozen. Layout may move content or spacing, never cut words. | author |
| HTML (round two) | Pour the frozen text into `_template/brief-template.html`, measure every page, report px over and slack, download `brief.html`. The layout pass itself stays a Claude Code job with Kate choosing. | app, then Kate |
| Live | PDF rendered, library record. "Live" has no hosting method yet. | Kate |

Visuals: one or two per brief, adapted from the paper's own tables or
figures. A results list stays a table; a figure must show a relationship.
The ERC redesign (matplotlib, `assets/erc_dataviz.mplstyle`) is still made
in Claude Code; the hub needs a place to upload our version next to the
original crop so the Word doc can carry both.

Her edits have to get back in. The July app had both a paste box and a Word
upload (`src/lib/docx-import.ts`). One of the two is needed in this slice.

## Where the rules live (read before writing any prompt or doc builder)

Briefs repo: `/Users/KateBarnes/Library/CloudStorage/GoogleDrive-katebarnes@tamu.edu/My Drive/tamu_style/erc-research-briefs/`

- `STYLE-GUIDE.md`: editorial rules. 1,300 to 2,000 body words, causal
  language only for causal designs, `%` symbol, no em dashes, preserve the
  paper's hedging, verbatim numbers with context, define terms, policy
  section paper-first, build page by page.
- `.claude/brand-voice-guidelines.md`: the voice, with a bank of her real
  sentences. The July prompts already carry it.
- `STANDARDIZATION.md`: layout, locked values, and the page-split rules
  from Oct 19 (split at the end of a full line, never a short sentence end).
- `PIPELINE.md`: the stages as first written; the table above is the lived
  version.
- `README.md`: edit vs locked HTML, how to print.
- `_template/brief-template.html`: the master template, never edited directly.
- `bowen-2026/`: a complete worked example. `page-plan.md`, `brief-draft.md`
  (the approved text), `brief-for-grammarly.md`, `build-bowen-docx.js`
  (parses the draft so the Word doc never drifts), the sent
  `Bowen-ERC-Brief-draft-for-review.docx`, `figures/` (the paper's table
  crop and the option exploration), `brief.html`, and the finished PDF.
- `nagro-2026/`: the earlier example, same pattern.
- The email model: `~/Documents/ERC Research Brief - Draft for Your Review!.eml`
  (her Nagro email). Swap title and journal link, "Dear Dr. <Lastname>,",
  keep the example-brief Drive link `1K8EAAKQFPTTTKBcQ1lChlZ0_nUhF3Ue_`.

## What to reuse from the July app

`~/Projects/erc-brief-builder/src/lib/`, TypeScript, 8 test files in `tests/`:

- `prompts.ts`: `STYLE_SYSTEM_PROMPT` (style guide and voice baked in),
  `EXTRACT_PROMPT` (deep read: design, sample, key numbers, findings, policy
  recommendations, APA citation, recommended visuals with page numbers), and
  per-section instructions.
- `anthropic.ts`: `extractPaper`, `draftSection`, `selfCheck`; the staged
  self-chaining pipeline (`src/app/api/briefs/[id]/advance/route.ts`) that
  survives function timeouts. It pins `claude-opus-4-8`; use whatever the
  desk's reader and rewriter use now.
- `brief.ts`: `SECTION_DEFS`, `DRAFT_STAGES`, word counts.
- `stylecheck.ts`: the word band, em dash, `%`, and jargon guards (RD, DiD,
  IV, FE, propensity need a plain-language cue).
- `citations.ts`, `docx.ts` (`buildBriefDocx` with figure pairs and the
  checkoff page, `buildReviewerEmail`), `docx-import.ts`, `pdf-render.ts`
  (page crops of the paper's figures and tables), `imagemeta.ts`.
- The spec, for the reasoning behind it:
  `erc-research-briefs/docs/superpowers/specs/2026-07-08-brief-builder-app-design.md`.

Do not port the screens, the Supabase clients, the magic-link auth, or the
comment link.

## Desk constraints found on Oct 20

- `api/` holds twelve functions, the Hobby plan's cap. Briefs ride one
  bundled route (`api/briefs.js` with an action field), or Kate moves the
  project to Pro. Her call if the bundle gets ugly.
- The repo is public. Paper PDFs, drafts, notes and author comments need a
  private store (Vercel Blob or similar for files, Neon for text). Never the
  repo, never the newsletter image path.
- New tables only through `scripts/ensure-schema.js`, run by Kate on her
  word before the code that reads them deploys.
- Drafting takes minutes. Chain it the July way, or `waitUntil` from
  `@vercel/functions`, which the desk already depends on.
- Proof is the sandbox (`.superpowers/sandbox/sandbox-server.mjs`, :4173)
  with a screenshot judged against `design/DESIGN.md`, plus `npm test`. A
  push to main is a live deploy, on her word only. The worktree rules are in
  the desk memory (`where-things-live`).
- No maroon in-app. The brief itself keeps its own look; the hub wears the
  desk's.

## The first real paper

`new-articles/holzman-et-al-2026-race-nativity-and-the-labor-market-returns-to-college-major-occupation-alignment.pdf`
(Holzman, Han, Lewis and Chukhray, AERA Open, descriptive, associational
language only, four authors, TAMU corresponding). A second Holzman paper
(2025, English learners) and `Avitabile_JMP.pdf` are also waiting, so the
folder name `holzman-2026b` needs a rethink; `holzman-2026` is the older
EMERGE brief. Her answer (Oct 21): a topic word, `holzman-2026-alignment`.
The folders live on the team drive (Oct 21, her folders): `Education
Research Center/ERC Content Desk/ERC Research Briefs`, the desk's Drive home;
that inner folder's id is the Sheet script's `BRIEFS_FOLDER_ID` property.

## How Kate works on this

Her desk memory already holds her working style. The brief-specific points:
the whole markdown at once, not section by section; she makes the number
calls; she wants to see options rendered on a page, not described; the
author gets only a clean document, no internal notes; replies short, no
emojis, no em dashes, `preview:` line after any page change.
