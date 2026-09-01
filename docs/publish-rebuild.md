# Publish — real build

*Lean spec, Aug 31 2026. Design approved from the sandbox mock (Aug 30/31), copy trimmed Aug 31. Look = the mock tree with the new theme; this doc is behavior + data. TDD; old publish tests get replaced.*

## The flow

- **Auto-check on arrival.** No Check button. Navigating to Publish clears any old preview and runs the read-only live-CSV check itself: "Reading the live news.csv so nothing gets overwritten or duplicated…" with the goo loader, then the report is the page. (`goTo(key)` in app.js centralizes arrival behaviors: publish = auto-check, finalize = `resetFinalizeEntry()`.)
- **Report.** Lede "Checked against the live Exchange"; primary "Publish N to the Exchange" top-right. If any dupes: one hint line, "Skipping N already on the Exchange." — otherwise no hint at all.
- **Fate groups** as queue-style tables (shared finalize table + expand-in-place for a last look), headers without counts:
  - **Adding** — plain rows.
  - **Newsletter only** — theme tint; hint "Spotlight events stay off the Exchange — webinars excepted." These rows drain once `newsletter_issue` is set.
  - **Needs a type** — amber rows, each with a "Fix in Finalize" jump. Rare (Sort blocks deciding untyped cards).
  - **No "already live" section** — dupes skip silently; the hint line is all.
- **After publishing: bare.** The drawn check + "Published N — the site updates in about a minute." and the **Send to newsletter** button (→ Newsletter screen). No leftover groups. `justPublished` is view state, cleared on re-entry (which re-checks fresh). "Nothing waiting to publish." also gets Send to newsletter.

## Data & API

- **`/api/publish` GET returns row ids** (or links) for adding/skipped — the mock matches skipped rows by headline, which is fragile. Client groups by id.
- **Held-drain lives in `workflow.js`**: `readyToPublish` (and the held filter) gate on `!newsletter_issue`, with tests — fixes the held-forever backlog wart at the model level, not the view.
- POST stays append-only; never stamps `published_at` on newsletter-only holds.

## Out of scope

The Sort dupe badges (built), the Newsletter screen (own spec), styling.
