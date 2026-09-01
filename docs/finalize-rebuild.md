# Finalize — real build

*Lean spec, Aug 31 2026. Design approved from the sandbox mock (Aug 29/30). Look = the mock tree with the new theme; this doc is behavior + data. TDD throughout; old finalize tests get replaced.*

## The flow (three beats)

**1 — Rewrite first.** Arriving at Finalize shows only the keeps that need an ERC-voice description. Lede: "These need rewriting into ERC voice." plus a quiet "Show all" (a one-visit peek — every navigation to the screen restarts at this stage via `resetFinalizeEntry()`). Nothing pending → straight to beat 3.

- `needsRewrite(row)` = event, OR opportunity, OR research with no description — AND not already checked (see `rewrite_checked` below). Research with an abstract never rewrites; headlines never.

**2 — Rewrite, then check one at a time.** Primary button "Rewrite N descriptions" → busy state ("Rewriting…" button, "Writing N descriptions in ERC voice…" line with the goo loader) → then one card at a time (never in-table flags): lede "Check the rewrites — 1 of 4"; card shows the quiet type line, title, source, and a **word-level Before/After diff** (removed words struck in amber, added words on light green). Buttons: **Looks good** (primary) / **Keep the original** (reverts) / linkish **Edit fields** (field grid with Save/Cancel). A description written from scratch (no old text) is labeled "New description — written from the original text" with Looks good only. Each decision advances to the next card.

**3 — The full table.** Queue-style: Title (source and research authors muted underneath), Type (subtype underneath), Date submitted — sortable. Chevron expands in place: facts box left (Date/Time/Location for events; Deadline/Topic for opportunities; research gets no facts box), description right labeled "Abstract" (research) or "Description", with Edit fields inside. Stacks under 700px.

- Standing order: ERC first (`isErc`), then type order, oldest first per group; column sorts override.
- ERC rows get the theme tint (`--tint`); the amber needs-rewrite tint wins while work is open.
- **Go to Publish** replaces the Rewrite button only when nothing is pending and nothing is unchecked.

## Data & API

- **New Sheet column `rewrite_checked`** (workflow column; header cell via `scripts/setup-sheet.js`). Set on Looks good / Keep the original / Edit-and-save, so checked state survives reload and Rewrite never re-runs on a visit.
- **Widen `/api/rewrite`**: today events + opportunities only → add research-without-description (draft from `original_text` / the link). Response unchanged otherwise.
- Copy rule: "Description" everywhere in UI (never "blurb"); the Sheet/CSV column stays `blurb` — hub contract.

## Out of scope

Publish (own spec), the goo loader itself (built), styling (in the tree).
