# Pull from the desk

*Spec, Aug 31 2026 — the builder's last door. Replaces the `.md` side door; designed with Kate in chat, lean on purpose.*

## What

The Content Desk's Newsletter screen stamps picked items with an issue date. The builder pulls those items straight in — no `.md` file, no re-picking. One new endpoint on the desk, one new button in the builder, and the `.md` side door retires.

## The door (builder, Review — step 1)

*(Amended Sep 1, Kate: the scrape-era front half — swipe Review / Close Read / Bucket / Quick Glance — is gone entirely. The wizard is now **Review → Outline → Preview & Edit → Save & Export**, and the door leads.)*

- **Step 1 (Review)** holds the issue date, the **"Pull from the desk"** button, and a plain table of everything in the issue (item + section). The `.md` input, its docs link, and `CONTENT_TEMPLATE.md` are gone.
- Click → fetch items stamped with the issue date → merge exactly where `.md` items used to land (the existing `mergeIssues` path). One click, no second review — the picking already happened on the desk.
- **Re-pull adds only what's new.** Items already in the outline (matched by link) are skipped. The button reports: `Pulled 2 new · 5 already here.` Nothing is duplicated; nothing reordered is touched.
- **Date mismatch:** if nothing is staged for the Outline's date, no guessing — `Nothing staged for September 8 — the desk has 7 staged for September 1.` Fix the date on either side and pull again.
- **Desk unreachable:** `Couldn't reach the desk — try again.` Outline untouched.

## The endpoint (desk)

`GET /api/newsletter-pull?issue=YYYY-MM-DD`

- Returns items for that issue **already in builder shape** — the desk's existing `rows-to-issue.js` (sections/groups/fields) does the mapping, so the builder adds almost no new logic: fetch, then the same merge the `.md` door used.
- Response also carries a `staged` summary (`{"2026-09-01": 7}`) so the mismatch message can point at the right date.
- Read-only; never changes a row.
- CORS allows the builder's origin (GitHub Pages now; the Vercel address joins the list when the builder moves).

## The mapping (already in desk code — `NEWSLETTER_MAP`)

| Desk type · subtype | Builder section → group |
|---|---|
| spotlight flag (any type) | ERC Spotlight → Events / This & That |
| research · ERC Research | Featured Research → Research Brief |
| research · Working Paper | Policy Research → Working Papers |
| research · Peer-Reviewed | Policy Research → Peer-Reviewed |
| research · Report | Policy Research → Miscellaneous |
| event · A&M | Upcoming Events → Texas A&M |
| event · Off-Campus / Webinar-Online | Upcoming Events → Online & Off-Campus |
| opportunity · Funding & Grants | Opportunities → Funding & Grants |
| opportunity · Fellowships & Programs | Opportunities → Fellowships & Training |
| opportunity · Call for Proposals | Opportunities → Calls for Proposals |
| opportunity · Other | Opportunities → Miscellaneous |
| headline · National | Education Headlines → Federal |
| headline · Texas | Education Headlines → Texas |

Fields carried per item: title, url, summary, source, authors, date, time, location, deadline (as a meta line).

## Re-share notes (desk)

When a row's link matches a row already stamped with a **past** issue, the desk shows a quiet note — never a blocker:

- **Sort card:** third badge tier alongside "Possible duplicate" / "Already live" → **"In a past issue"**.
- **Newsletter picker:** next to the item → **"Was in the September 1 issue"**. Still pickable — re-sharing is sometimes the point.

## The archive (added Sep 1, Kate: "view past newsletters")

- The builder repo carries `newsletters/` — one HTML file per sent issue plus `index.json` — served by whatever hosts the builder. Seeded with the 13 issues found on Drive (Nov 17, 2025 → Aug 25, 2026).
- **View past newsletters** (header link) → `archive.html`, which lists the index newest-first.
- **Save to the archive** (Save & Export step) → `POST /api/newsletter-archive {issueDate, html}` on the desk, which commits the file and refreshes the index via the GitHub token it already holds. Re-saving an issue replaces it — the last save before sending wins.

## Where the builder lives (settled Sep 1, supersedes the separate-project plan)

The builder moved INTO the desk's project: `builder/` in the erc-content-desk repo, served at **erc-content-desk.vercel.app/builder/**. Same origin, so the pull door and archive save need no CORS; one push deploys both. The archive commits to `builder/newsletters/` in this same repo. The old GitHub Pages address gets a "we've moved" note at deploy time; the old erc-newsletter-builder repo stays as history (and still receives the orphaned Thursday scrape drops).

## Out of scope

Un-send recovery (getting a stamped item back), the desk's link-only fallback UX, and the four mocked desk screens — those ship through their own builds.
