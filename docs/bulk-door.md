# Bulk door — real build

*Lean spec, Aug 31 2026. Design approved from the sandbox mock (Aug 31). Shared submit form, so the public /submit page gets it too. Look = the mock tree; this doc is behavior + data. TDD.*

## The flow

- **File drop replaces the paste box.** "Have a whole doc or spreadsheet? Add it here — it gets split into items you review first." Dashed drop zone: "Drop a file here or click to choose one · .docx, .md, .txt, .xlsx, .csv — items are shown for review before anything is saved". Drag-over tints (`--tint`). Unsupported file → terse error. No PDF, no Drive.
- **Choosing a file auto-runs the split** ("Reading sept-issue-draft.docx — this can take a minute…") — read-only, so no extra button; the only gate is the confirm.
- **Review = queue-style table, no summary sentence.** Per item: title with its link muted underneath, Type with subtype underneath ("To review" in red when untyped), a quiet **Remove** per row, click a row to peek its description. Rows settle in once on arrival (the kept stagger). Count lives on the button: "Add 12 to the queue" → "Nothing left to add" at zero. Cancel resets. Splitter warnings go to the status line.
- **Confirm** posts each item through the normal `/api/submit` path (per-item enrichment, same as a single submit).

## Pipelines

- **Docs and text** (.docx/.md/.txt) → the existing Claude split.
- **Spreadsheets** (.xlsx/.csv) → **one row = one item**; recognizable columns map straight in; Claude fills gaps only.
- Client sends text for .md/.txt/.csv; **.docx/.xlsx go up as files** — multipart upload, server-side parsing (mammoth for .docx, a small xlsx reader — both server-side only, no client deps).

## Untyped items (settled — Kate, Aug 31)

Untyped items **enter untyped** on confirm; Sort's "To review" section catches them. (The old forced `headline`/`National` default is gone.)

## Out of scope

The single-item form (confirm screen already built), rate limiting on the public endpoint (backlog), styling.
