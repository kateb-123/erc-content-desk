# The highlight file the desk writes for the Exchange

Kate picks the Exchange's home-page highlights by hand at Publish (Sep 23,
2026): up to six items, new or already live, in her order, each with a
photo. The desk commits them to the Exchange repo as one small file, so
`data/news.csv` stays append-only:

```
data/highlights.json
{
  "updated": "2026-09-23T20:05:00.000Z",
  "items": [
    { "link": "https://www.nagb.gov/naep-2026-texas", "image": "" },
    { "link": "https://erc.tamu.edu/briefs/course-access-2026", "image": "https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/builder/images/img-20260923-1a2b3c4d.jpg" }
  ]
}
```

- `link` names the item: it is the `link` column of a `news.csv` row, exact
  after trimming. An item is never repeated.
- `image` is her upload for that item, or blank when the row's own picture
  (its `infographic` column) is the one to show. When she uploads a photo for
  a row the desk is publishing at the same time, the row's `infographic` in
  `news.csv` carries it too.
- The file may be missing (no picks yet), empty, or hold junk: treat all
  three as no picks.

## What the home page does with it

1. Read `/data/highlights.json` with `cache: 'no-store'`.
2. No usable picks: show today's automatic feed (the newest of each section,
   round robin), as now.
3. Otherwise the band is the picks, in file order: each matched to its
   `news.csv` row by `link`; a pick with no row, or whose row the site no
   longer shows (a past event, a closed deadline), is skipped; six at most.
4. The card's photo is `image` when it is set, else the row's `infographic`
   when that is a direct image file (`.jpg`, `.png`, `.webp`, `.gif`, `.avif`);
   with neither, the card has no figure, as the handoff says.
5. The rail and the phone counter run over the same list ("n / 6").

Nothing else changes: the card, the rail, the timing and the pause control
stay as built.
