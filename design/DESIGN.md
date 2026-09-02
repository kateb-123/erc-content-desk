# Design spec: ERC Content Desk + Newsletter Builder

One look across both apps. This file is the source of truth for style decisions —
read it before any UI work. There are no mockups: verification is a screenshot from
the running sandbox (`localhost:4173`, serves `/builder/` too), approved by Kate
before deploy.

## Tokens

Canonical values. Mirrored in code at `css/styles.css` `:root` (desk) and
`builder/css/styles.css` `:root` (builder, prefixed `--bp-`).

| Token | Value | Use |
|---|---|---|
| accent | `#1d6ea5` | the one brand color — filled buttons, links, active pills |
| accent hover / active | `#19608f` / `#14507a` | button states |
| tint | `#eaf2f8` | ERC/held row highlight, focus halo, soft fills |
| ink | `#1c2229` | body text |
| muted | `#55606c` | secondary text, quiet labels |
| line | `#dbdfe5` | borders, hairlines |
| page | `#fbfbfd` | page background (both apps) |
| ok | `#1d6f4f` | success |
| err | `#a32d2d` | destructive text/links (Delete, Remove) |
| amber alert | bg `#fdf3d7`, text `#6b4e00` | needs-attention bubbles and alerts |

Known drift (queued for cleanup): the builder's `--bp-ink` is `#131a21` (desk ink is
`#1c2229`; the builder's `--bp-body` matches) and its `--bp-card-border` is `#dfe4ea`
(desk line is `#dbdfe5`). New work uses the desk values.

Maroon `#500000` is FORBIDDEN in-app — it lives only in the newsletter email
template and the public Exchange site.

## Type

- **Outfit** — headings (h1 1.35rem/700 screen titles), buttons at 600, pills at 700.
- **Karla** — body. Both via Google Fonts. No other faces without approval.

## Shape

- Radii: **8px** controls/inputs · **12px** cards/tables · **999px** pills/chips/badges.
- Focus: accent border + `0 0 0 3px` tint halo (quiet — louder highlights were rejected).
- Active nav pill shadow: `0 2px 10px rgba(29,110,165,.35)`.
- Nav is bubble pills everywhere; active = filled accent + white text; the builder's
  wizard pills add numbered circles.

## Icons

Font Awesome 7.3.1 Free via cdnjs — setup in `.font-awesome.md` (read it first).
FA is for small glyph accents; the hand-drawn inline SVGs (drawn check, sliding-dots
loader) stay. Icon elements always carry `aria-hidden="true"`.

## Action vocabulary (the uniformity contract)

Every action element in either app matches this table — same word, same icon, same
look, everywhere it appears.

| Action | Icon | Look | Means |
|---|---|---|---|
| **Keep** | ✓ `fa-check` | filled accent button (the ONE per card) | accept into the pipeline / accept the rewrite |
| **Skip** | — | quiet muted word | park it (status stays `circleback` underneath) |
| **Delete** | `fa-trash-can` | red quiet link | trash the ITEM for good (any screen, any time) |
| **Edit** | `fa-pen` | accent quiet link | inline edit, persists on Save |
| **Use original** | `fa-rotate-left` | quiet word | reject the rewrite, keep the Sheet text |
| **Remove** | `fa-trash-can` | red quiet link | take OUT of the newsletter issue (returns to the pool) — shares Delete's icon by Kate's explicit pick |
| **Verify link ↗ → Confirm / Change** | `fa-triangle-exclamation` | amber bubble, one ask | open the source, then stamp it good or paste a new link |
| **View info / Hide info** | — | accent toggle beside every screen/step title | opens the tinted instruction panel |
| **Re-check** | — | linkish in Publish's lede | force a fresh hub check |
| Door buttons (Go to Finalize/Publish, Send to newsletter) | → `fa-arrow-right` | slim primary (.85rem, .35rem padding), right of the screen head | move along the pipeline |

Placement grammar: tools (Edit) pair with Delete far LEFT of a card footer; the
decision pair (secondary then primary) sits RIGHT; the position counter sits alone
top-right; **one filled button per card**, everything else quiet. Any in-flight
button DISAPPEARS — nothing is re-pushable.

## Motion

All CSS/vanilla; `prefers-reduced-motion` kills everything.

- Decision settle: clone shrinks to 0.955 and fades, 200ms.
- Tab/section switch: ±16px directional slide, 180ms `cubic-bezier(0.33,1,0.68,1)`.
- Confirmations: SVG check draws itself, 350ms.
- Loading: the sliding-dots track (blue ramp `#9ec9e8` → `#14507a`), label under the
  track with typed trailing dots; mini variant inline in control rows.
- Buttons: 150ms hover, press scale 0.98.

## Copy

Sentence case. Terse — no redundant prose, no counts in prose unless load-bearing.
No emojis in UI copy (icons are the sanctioned decoration). Same term for the same
thing everywhere (see the vocabulary table).

## Do not

- No new fonts, icon sets, or UI libraries without approval.
- No maroon in-app.
- No hardcoded colors/radii where a token exists.
- Nothing is "done" without a screenshot from the running sandbox.
