# Frontend Fidelity Playbook for Claude Code

Getting the built UI to match the mockup, with the tooling that makes it verifiable.

Distilled from two r/ClaudeAI threads ("beautiful mockup, botched build" and "how do you actually use Claude Code for a real full-stack app"), the Playwright MCP docs, and the `frontend-design-audit` skill. Install commands were checked against each tool's own docs on 2026-09-02.

---

## How to use this file (for the human)

1. Save it in your project as `docs/CLAUDE-FRONTEND-PLAYBOOK.md`.
2. In Claude Code, type:
   `Read docs/CLAUDE-FRONTEND-PLAYBOOK.md and do Section 1 (SETUP) now. Confirm each install with me before running it. Then wait for my first UI task.`
3. To make Claude Code follow it every session, add this line to your `CLAUDE.md`:
   `@docs/CLAUDE-FRONTEND-PLAYBOOK.md`
   (or paste just the short block in Section 5.2 into `CLAUDE.md` to keep it lean).
4. A few commands are slash commands that only you can type into the Claude Code prompt (`/reload-plugins`, `/mcp`, `/plugin`, `/frontend-design-audit`). Claude Code will tell you when to type one.

---

## 0. Instructions to Claude Code (read first)

Unless the user says otherwise, assume they would rather describe what they want, judge a screenshot, answer multiple-choice questions, and type a command you give them than review code. Do not rely on them to catch mistakes in code. Plan and verify accordingly.

This file has two parts:

- **Section 1, SETUP.** The first time you read this file in a project, run the inventory in 1.1, tell the user what is missing from the Required tier, ask once for permission, then install it. Do not skip this. Do not install Optional items unless the user asks or a specific problem calls for it.
- **Sections 2 to 6, WORKFLOW.** Apply on every UI task. The short version: get the design into the repo, break the work into one component at a time, build primitives first, and never call anything done without a screenshot and a pixel diff.

---

## 1. SETUP (run once per machine and project)

### 1.1 Inventory before installing anything

Run these and report the results to the user in plain language:

```bash
node --version                 # need Node 20 or newer
claude --version
claude plugin list
claude mcp list
which playwright-cli || echo "playwright-cli: not installed"
ls .claude/skills 2>/dev/null || echo "no project skills dir"
ls ~/.claude/skills 2>/dev/null || echo "no user skills dir"
```

Then say which Required items are missing and ask: "OK to install these now?" Wait for a yes.

### 1.2 Required tier

**A. Playwright CLI + its agent skill** (screenshots and snapshots of the real app; more token-efficient than Playwright MCP)

```bash
npm install -g @playwright/cli@latest
cd <project root>
playwright-cli install --skills      # initializes the workspace, writes .claude/skills/playwright-cli (Claude Code picks it up), and detects an installed Chrome
playwright-cli install-browser       # only if the previous step did not find a browser
playwright-cli --help                # command reference; the skill file also documents everything
```

Add `--global` to `install --skills` to put the skill in the home directory instead of the project. Smoke test with the dev server running (use the real port):

```bash
playwright-cli open http://localhost:3000
playwright-cli resize 1440 900
playwright-cli screenshot --filename=.screens/smoke.png --full-page
playwright-cli close
```

Confirm `.screens/smoke.png` exists and looks like the app. Add `--headed` to `open` if the user wants to watch. Workspace config lives in `.playwright/cli.config.json` if launch options ever need changing.

**B. `frontend-design` plugin (Anthropic, official marketplace)** - polished, non-generic UI code

```bash
claude plugin install frontend-design@claude-plugins-official
```

If it says the marketplace is not found: `claude plugin marketplace add anthropics/claude-plugins-official`, then retry.

**C. `frontend-design-audit` plugin** - heuristic audit with severity-rated findings and fixes

```bash
claude plugin marketplace add mistyhx/frontend-design-audit
claude plugin install frontend-design-audit@frontend-design-audit
```

Usage once loaded (the user types these): `/frontend-design-audit` (full audit of the project), `/frontend-design-audit:evaluate <path>` (report only), `/frontend-design-audit:improve` (apply fixes), `/frontend-design-audit:quick`, `/frontend-design-audit http://localhost:3000/page` (audit a live page).

**D. `superpowers`** (brainstorm, write-plan, execute-plan, TDD, verification-before-completion)

The user may already have this. Check `claude plugin list`. If missing:

```bash
claude plugin install superpowers@claude-plugins-official
# or: claude plugin marketplace add obra/superpowers-marketplace && claude plugin install superpowers@superpowers-marketplace
```

**E. Pixel-diff script** (turns "looks close" into a number and a magenta diff image)

```bash
npm install -D pixelmatch pngjs
mkdir -p scripts design/mockups .screens
```

Create `scripts/visual-diff.mjs` with the contents in Section 5.5. Add `.screens/` to `.gitignore`.

### 1.3 Optional tier (only on request, or when a problem calls for it)

| Tool | When it earns its place | Install |
|---|---|---|
| Playwright MCP | You need persistent browser state across many steps, or the CLI is unavailable. Heavier on context than the CLI. | `claude mcp add playwright -- npx @playwright/mcp@latest` (append `--headless` after the package name for no visible window). User verifies with `/mcp`. |
| dev-browser | Alternative to Playwright CLI; persistent page state plus full Playwright API from scripts. | `claude plugin marketplace add sawyerhood/dev-browser` then `claude plugin install dev-browser@dev-browser-marketplace` |
| ui-ux-pro-max | You need a design system generated from scratch (styles, palettes, font pairings, per-stack guidelines). Needs Python 3. | `claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| gstack | The user wants `/design-review`, `/design-shotgun` (4-6 mockup variants), `/qa` (real browser testing), `/review`. Large (23+ skills). Needs Bun and Chrome. | `git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup` |
| Vercel React best practices | React or Next.js projects only. | `npx skills add vercel-labs/agent-skills` |

### 1.4 Activate and verify

1. Ask the user to type `/reload-plugins` (if it warns about re-reading the conversation, `/reload-plugins --force`). Restarting Claude Code also works.
2. Run `claude plugin list` and `playwright-cli --help` and show the user a short table: tool, installed yes/no, how to invoke.
3. Confirm `/frontend-design-audit` appears under `/help` (user checks).

### 1.5 Keep the stack lean

One commenter's advice that proved useful: if output gets worse after adding skills, the skills may have competing objectives. If that happens, disable Optional plugins (`/plugin disable name@marketplace`) and retest with the Required tier only. Add things back one at a time.

---

## 2. Why the build does not match the mockup

These are the causes the threads converged on. Check them in this order when a build comes out flat.

1. **The mockup and the build live in different contexts.** The mockup was rendered in one exchange; the code was written later without that reference locked in. Anything that only exists in the conversation is lost. Fix: the mockup and its tokens must live in the repo (Section 3, Step 1).
2. **Mockups permit hand-waving.** A static HTML mockup can inline styles, fake data, and skip states. A real build needs the design tokens wired into the framework, real data shapes, component boundaries, loading/empty/error states. "Imitation is easy, recreation is hard." Fix: component inventory with inputs and outputs before coding.
3. **One-shotting.** A whole page in one prompt is beyond what can be built reliably. Every build should be a small addition on top of something already verified. Fix: one component per task.
4. **Verifying from code instead of pixels.** Reading the JSX and assuming it renders correctly. Fix: screenshots of the actual app, plus a pixel diff against the mockup, every round.
5. **A broken styling pipeline** (a practical cause worth ruling out first when the result is "completely flat, no styling"): stylesheet not imported, Tailwind content paths wrong so classes get purged, fonts not loaded, CSS variables defined in a file that is never included. Fix: Section 3, Step 1, last bullet.

Also worth knowing: the default output is a grid of cards because that is what the training data favors. Cards are a heavy way to separate sections. Alternatives from the thread: plain whitespace between sections, or leaning into the grid with soft borders and sections of different sizes. Designs made in Stitch tend to feel less "AI". Ask the user which they prefer instead of defaulting.

---

## 3. The workflow: mockup to build

### Step 0. Intake and interrogation (before any code)

1. Get the design into the repo. If it came from Stitch, Claude Design, or an HTML mockup: save the HTML/CSS to `design/mockups/<page>.html`. Always also save a PNG at a known viewport width to `design/mockups/<page>.png`. If the user only has a screenshot, that is enough; save it.
2. Write a **component inventory** to `design/INVENTORY.md`: every visual element top to bottom, with name, purpose, data shown (source and shape), states (loading, empty, error, hover, active), interactions, and which mockup region it maps to.
3. Run a **question round**. Read the mockup and the inventory, then ask the user the questions that remain, in priority order, in batches of five to eight. Give options with a recommended default rather than open-ended questions. Keep going until the inventory has no unknowns. Summarize decisions back into `design/INVENTORY.md`.

### Step 1. Lock the design into the repo

1. Extract **design tokens** from the mockup into `design/DESIGN.md` (template in 5.1): colors, type scale and font families (and how fonts load), spacing scale, radii, shadows, borders, breakpoints, chart palette if any.
2. Put the same tokens **into code** where the framework reads them: `tailwind.config.*` theme, CSS variables in the global stylesheet, or the UI library's theme file. DESIGN.md is for humans and for you; the code file is the source of truth at build time. Keep them identical.
3. Add `@design/DESIGN.md` to `CLAUDE.md` along with the rules in 5.2, so every session starts with the design loaded.
4. **Prove the styling pipeline works** before building anything: render one element that uses a token (a colored box with the primary color and the heading font), screenshot it, confirm the color and font are right. If this fails, fix the pipeline first; nothing else matters until it passes.

### Step 2. Plan in small slices

1. Use `superpowers` brainstorm and write-plan (or `/plan`). The plan is an ordered list of tasks, one component or one small feature each, with acceptance criteria in the format of 5.3.
2. Order: tokens and theme, then primitives (Button, Section/Card, Table, Chart wrapper, Nav, Form controls), then composite components, then page assembly, then responsive pass, then polish.
3. Prefer vertical slices with a concrete deliverable: "add the KPI tile component with loading and empty states, render it with sample data on /dev/kpi, screenshot it" rather than "build the dashboard".
4. Ask the user to confirm the plan before executing. Then one task per session where possible.

### Step 3. Build the primitives first

Build the reusable component library before any page. A few layouts and primitives get reused across every page, and matching the mockup once at the primitive level is far cheaper than matching it page by page. Render each primitive on a scratch route (for example `/dev/components`) with sample data, so it can be screenshotted in isolation.

### Step 4. Build each component and verify visually

For every task:

1. Start the dev server, then screenshot the real page at the mockup's viewport width (check the PNG's width first):

   ```bash
   playwright-cli open http://localhost:<port>/<page>
   playwright-cli resize <mockup width> <height>
   playwright-cli screenshot --filename=.screens/<page>.png --full-page
   playwright-cli console            # any errors? fix them before comparing pixels
   playwright-cli close
   ```

   For a single component, render it on its scratch route and pass an element target to `screenshot` (get the ref from `playwright-cli snapshot`).
2. Run the pixel diff: `node scripts/visual-diff.mjs design/mockups/<page>.png .screens/<page>.png .screens/<page>-diff.png`. It prints a match percentage and writes a diff image (magenta = different). If it warns about a size mismatch, fix the viewport and re-shoot before trusting the number.
3. Look at the diff image (use vision on the file). Fix the largest differing regions first: layout and spacing, then typography, then color, then details. Re-screenshot, re-diff.
4. Report the percentage each round, honestly, including when it goes down. Stop when the user-agreed threshold is met (suggest 95% for a full page, higher for a single component) or the user signs off on the screenshot.
5. Also check a second width (`playwright-cli resize 390 844`, or `open --mobile`), and the empty and loading states.
6. Do not describe the UI from the code. Only screenshots count as evidence.

### Step 5. Audit and polish

1. Once a page assembles, ask the user to run `/frontend-design-audit http://localhost:<port>/<page>` (or `:evaluate` on the components folder). Fix severity 3 and 4 findings first, then `:improve` for the rest.
2. Use the `frontend-design` plugin for an anti-generic pass: consistent icon set, real typographic hierarchy, restrained use of cards, whitespace as a separator, purposeful color rather than gradients everywhere.
3. Re-run the pixel diff after polish so the audit fixes do not drift from the mockup.

### Step 6. Session and repo hygiene

1. Commit after every verified task with a small, descriptive message. This is the undo button for the day the build confidently rewrites three files the user liked.
2. One session per task. When context gets long, write a handoff prompt (5.4) so the next session picks up cleanly.
3. Keep `CLAUDE.md` lean: stack, conventions, test and lint commands, a short "do not do X" list, and the pointer to DESIGN.md.

---

## 4. Rules for Claude Code on UI work

Do:

- Read `design/DESIGN.md` and `design/INVENTORY.md` at the start of every UI task.
- Use tokens from the theme file. If a value is not in the tokens, add it to the tokens, do not hardcode it.
- Build one component per task, screenshot it, diff it, then move on.
- Show the screenshot path and the match percentage in every completion message.
- Ask multiple-choice questions when a design decision is ambiguous.

Do not:

- Do not one-shot a page.
- Do not generate a fresh mockup and then rebuild from memory. The mockup in `design/mockups/` is the reference.
- Do not report "done" or "matches the design" without a screenshot from the running app.
- Do not default to a card grid for every layout.
- Do not add UI libraries, fonts, or icon sets that are not in DESIGN.md without asking.
- Do not silently restyle components that already passed verification.

---

## 5. Templates

### 5.1 `design/DESIGN.md`

```markdown
# Design spec: <project>

## Source
- Mockups: design/mockups/<page>.png (viewport 1440 wide), design/mockups/<page>.html
- Origin: Stitch / Claude Design / hand-drawn (pick one), approved by <user> on <date>

## Tokens (mirrored in <tailwind.config.ts | src/styles/tokens.css | theme file>)
- Colors: background, surface, border, text-primary, text-muted, brand, brand-hover, accent, success, warning, danger (hex for each)
- Chart palette (ordered): c1..c6 (hex), plus sequential and diverging ramps if charts are present
- Typography: heading font (source and load method), body font, mono font; type scale (xs..3xl with px and line-height); weights in use
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64
- Radii: sm, md, lg, full
- Shadows: sm, md (only if the mockup uses them)
- Borders: width, default color
- Breakpoints: sm 640, md 768, lg 1024, xl 1280

## Layout
- Page shell: nav placement, max content width, gutters
- Section separation style: whitespace / soft borders / cards (choose one default)
- Grid: columns and gaps per breakpoint

## Components (one block each, from INVENTORY.md)
- <Name>: purpose, props/data, states, mockup region, notes

## Do not
- No new fonts, icon sets, or UI libraries without approval
- No hardcoded colors or sizes outside the token file
```

### 5.2 Block for `CLAUDE.md`

```markdown
## Frontend
- Design source of truth: @design/DESIGN.md and design/INVENTORY.md. Read both before UI work.
- Full process: @docs/CLAUDE-FRONTEND-PLAYBOOK.md
- Tokens live in <path>. Never hardcode colors, spacing, or fonts.
- One component per task. Screenshot with playwright-cli, then `node scripts/visual-diff.mjs`. Report the match % every time.
- Nothing is done without a screenshot from the running app.
- Dev server: `<command>` on port <port>. Lint: `<command>`. Tests: `<command>`.
```

### 5.3 Task and acceptance template

```markdown
Task: <component or slice name>
Mockup region: design/mockups/<page>.png, <describe area>
Data: <shape or sample file>
States: default, loading, empty, error (delete any that do not apply)
Acceptance:
- Rendered on <route> at <width> wide
- Pixel match >= <N>% against the mockup crop, or user sign-off on .screens/<name>.png
- No console errors
- Uses tokens only
- Committed as "<message>"
```

### 5.4 Handoff prompt (write this when a session gets long)

```markdown
Continue the <project> UI build. Read CLAUDE.md, design/DESIGN.md, design/INVENTORY.md, and docs/CLAUDE-FRONTEND-PLAYBOOK.md.
Done and verified (committed): <list with match %>
In progress: <task>, current match <N>%, last diff at .screens/<name>-diff.png, remaining differences: <list>
Next tasks in order: <list>
Decisions made this session that are not yet in DESIGN.md: <list, then add them>
Do not restyle anything in the "done" list.
```

### 5.5 `scripts/visual-diff.mjs`

```js
// Usage: node scripts/visual-diff.mjs <mockup.png> <screenshot.png> [diff.png]
// Prints a match percentage and writes a diff image (magenta = different).
import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [, , aPath, bPath, outPath = '.screens/diff.png'] = process.argv;
if (!aPath || !bPath) {
  console.error('usage: node scripts/visual-diff.mjs <mockup.png> <screenshot.png> [diff.png]');
  process.exit(2);
}

const a = PNG.sync.read(fs.readFileSync(aPath));
const b = PNG.sync.read(fs.readFileSync(bPath));

if (a.width !== b.width || a.height !== b.height) {
  console.warn(`size mismatch: mockup ${a.width}x${a.height} vs screenshot ${b.width}x${b.height}. ` +
    'Match the viewport to the mockup width before trusting the number.');
}

const width = Math.max(a.width, b.width);
const height = Math.max(a.height, b.height);

function pad(img) {
  if (img.width === width && img.height === height) return img;
  const p = new PNG({ width, height });
  p.data.fill(255);
  PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0);
  return p;
}

const A = pad(a);
const B = pad(b);
const diff = new PNG({ width, height });
const mismatched = pixelmatch(A.data, B.data, diff.data, width, height, {
  threshold: 0.1,
  diffColor: [255, 0, 255],
  alpha: 0.4,
});

fs.mkdirSync(outPath.includes('/') ? outPath.slice(0, outPath.lastIndexOf('/')) : '.', { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(diff));
const pct = (100 * (1 - mismatched / (width * height))).toFixed(2);
console.log(`match: ${pct}%  (${mismatched} of ${width * height} pixels differ)  diff -> ${outPath}`);
```

---

## 6. Beyond the UI (from the full-stack thread, brief)

- Split a big architecture doc into focused context docs (data model, auth, billing, integrations) and a phased plan on top. Point Claude at the relevant doc per task; it is a reference, not a script to run end to end. Gate each phase: do not start the next until the current one works and is committed.
- Have Claude read the design doc and ask prioritized questions interactively, with options and summaries, before planning milestones.
- Testable modules with clear contracts between them. Self-verification loops on every task: unit or integration tests for logic, screenshots for UI.
- Security to verify yourself, never assume: row-level security on the database (it gets left off or wide open without warning), webhook signature verification for payments, every place user input reaches the database.
- Adversarial review of anything touching auth or money, framed as "find what is wrong", ideally by a second model or a persona pass (hacker, competitor, ruthless QA).
- Give the agent read-only access to the database, analytics, and error tracking where possible.
- Private git repo, commit constantly, small commits. Keep a mental map of the system; do not let the agent make big architectural moves you do not understand.

---

## Sources

- r/ClaudeAI: "Claude Code shows a beautiful mockup and then completely botches the actual build" - https://www.reddit.com/r/ClaudeAI/comments/1s4zbwx/
- r/ClaudeAI: "How do you actually use Claude Code properly for building a real full-stack app?" - https://www.reddit.com/r/ClaudeAI/comments/1u6o19k/
- Playwright MCP docs - https://playwright.dev/docs/getting-started-mcp
- Playwright CLI - https://github.com/microsoft/playwright-cli
- frontend-design-audit skill - https://github.com/mistyhx/frontend-design-audit
- Claude Code plugin docs - https://code.claude.com/docs/en/discover-plugins and https://code.claude.com/docs/en/mcp
- Official plugin marketplace (frontend-design, superpowers) - https://github.com/anthropics/claude-plugins-official
- superpowers - https://github.com/obra/superpowers
- dev-browser - https://github.com/SawyerHood/dev-browser
- ui-ux-pro-max - https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- gstack - https://github.com/garrytan/gstack
- Vercel React best practices skill - https://vercel.com/blog/introducing-react-best-practices
