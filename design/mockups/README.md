# ERC Content Desk: mockups

## Pick A, the look (Oct 23, 2026)

Kate's pick of four looks, with her line rules for rows. Each is a standalone
HTML page (sample words, no scripts) and its 1280 by 970 render.

| File | Screen |
|---|---|
| `a-front-page.html` / `.png` | The front page: the sidebar, then the hubs as grouped lists |
| `a-sort.html` / `.png` | Content Sort: the list, the card, the decision column |

`design/DESIGN.md` (The look, at its top) says what they set.

## The wireframes (Sep 17, 2026)

Greyscale wireframes exported as plain, standalone HTML. No build step, no
dependencies, no framework. Open `index.html` in a browser and the links
between pages work.

### The files

| File | Screen |
|---|---|
| `index.html` | Main page — submit form on the left, the three lanes on the right |
| `sort.html` | Sort content — triage queue, one item open for review |
| `newsletter.html` | Newsletter — the issue being built, plus what is ready to add |
| `exchange.html` | Policy Exchange — ready to publish, and what is already live |
| `builder.html` | Newsletter builder — all four steps, Back and Next work |

`builder.html` carries about fifteen lines of vanilla JavaScript to move
between Pull, Arrange, Edit and Export. Everything else is static markup.

### What this is and is not

Greyscale on purpose. The palette is settled separately, so gray stands in
for the accent wherever something is selected or interactive. Dropping the
real tokens in is a find-and-replace, not a redesign.

Anything in square brackets — `[N]`, `[NAME]`, `[DATE]`, `[SOURCE]` — is a
value the Desk does not have yet. They are deliberate gaps, not filler.

Type is IBM Plex Sans, pulled from Google Fonts, and spacing follows Carbon's
scale. Corners are square and there are no shadows, in line with the house
rules.

### Turning these into the real thing

The markup is close to what ships but not production code. Fields are real
`<input>` and `<label>` pairs and the buttons are real `<button>` elements,
so the accessibility bones are right, but styling is inline rather than
tokenised. When you build for real, replace the inline hex values with
`var(--accent-60)` and friends from `tokens.css`.
