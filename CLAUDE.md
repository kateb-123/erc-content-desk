# ERC Content Desk (+ Newsletter Builder at /builder/)

- Design source of truth: @design/DESIGN.md — tokens + the action vocabulary table.
  Icons: `.font-awesome.md`.
- Frontend process reference: `docs/CLAUDE-FRONTEND-PLAYBOOK.md`. Proof of any UI
  change is a `playwright-cli` screenshot of the sandbox, judged against DESIGN.md.
  When a mockup exists in `design/mockups/`, also run
  `node scripts/visual-diff.mjs <mockup.png> <shot.png>` and report the match %.
- Style changes build in the SANDBOX first
  (`node .superpowers/sandbox/sandbox-server.mjs` → localhost:4173, fake data,
  serves `/builder/` too). Kate reviews there; deploy only on her word.
- `git push` to main IS a live deploy (Vercel). Never submit test data to production.
- Tests: `npm test` runs both apps' suites. Bump `?v=` cache-busters when js/css change.
- Copy: sentence case, terse, no emojis in UI.
