# Newsletter screen — real build

*Lean spec, Aug 31 2026. Design approved from the sandbox mock (Aug 31): Build leaves the desk, the .md dies, the standalone builder pulls stamped items (see `pull-from-the-desk.md`). Look = the mock tree; this doc is behavior + data. TDD.*

## The flow

- Tab named **Newsletter** (internal screen key stays `build`). Pool = `buildPool(rows)`: published + newsletter-only holds, minus anything already stamped with an issue.
- **Grouped like the issue**: ERC Spotlight (isErc) first, then New Ed Policy Research / Events / Opportunities / Headlines — each its own queue-style table with a heading that tracks picks: "ERC Spotlight · 1 of 2 picked".
- **Nothing checked by default** — opt-in only. Row click or checkbox toggles. Held rows note "newsletter only" under Type.
- Lede: "Pick items to send to newsletter". Issue picker (only when more than one date) shows **upcoming dates only** — never past issues.
- **Send** = "Send 3 to the September 1 issue" (disabled and count-free at zero) → persists `markNewsletterIssue` on the selection → items drain from the desk and from Publish's held list. Success: "Sent 3 to the September 1 issue — the builder pulls them from here." plus **"Open the newsletter builder ↗"** (https://kateb-123.github.io/erc-newsletter-builder/ — update when the builder moves to Vercel).
- **Re-share note**: an item whose link went out in a past issue shows "Was in the September 1 issue" — never a blocker (details in `pull-from-the-desk.md`).

## Un-send (mistake recovery) — settled, both ways (Kate, Aug 31)

- On the success state: an **Undo send** link that clears `newsletter_issue` on that batch (available until you leave the screen).
- For mistakes found later: a collapsed muted line under the picker — "Already sent to this issue (5)" — expanding to rows with a per-item **Pull back** (clears the stamp; the item rejoins the pool and Publish's held list).

## Cleanup in the same build

- Dead code sweep: `build-ui.js`, app.js's `exportNewsletter` / `updateDraft` / `state.picks` / `state.draft`, and the old Build tests.
- The "Submit ↗" nav link stays hidden (Kate's call — future intake conversation).
- Home panel keeps "Build newsletter ↗ · pulls from the same items" (settled — Kate, Aug 31). It goes to this screen.

## Out of scope

The builder-side door and Vercel move (`pull-from-the-desk.md`), styling.
