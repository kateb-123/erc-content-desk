# The highlight the desk writes for the Exchange

Kate picks the Exchange's home-page highlights by hand at Publish (Sep 23,
2026): up to six items, new or already live, in her order, each with a
photo. Since Sep 24 the Exchange keeps its own picks in `data/featured.json`,
the admin door's file, and since Sep 30 the desk writes its picks there as
the **pins**. It reads the file for the Now box, so the desk shows what the
card holds this minute, including the one-off cards made on the Exchange.
`data/highlights.json`, the desk's own file before, is read by nothing and
can be deleted.

What the desk commits (the other three lists pass through as they were):

```
data/featured.json
{
  "pins": [
    { "key": "https://tea.texas.gov/data-summit-2026", "until": "2026-10-08",
      "title": "Texas Education Data Summit",
      "summary": "Bring a data question and leave with a plan: the summit walks through the new records access rules." },
    { "key": "https://erc.tamu.edu/briefs/course-access-2026", "until": "2026-10-07",
      "image": "https://raw.githubusercontent.com/kateb-123/erc-content-desk/main/builder/images/img-20260923-1a2b3c4d.jpg" }
  ],
  "cards": [...], "hidden": [...], "heroes": [...]
}
```

- `key` names the item: the `link` column of a `news.csv` row, exact after
  trimming. A pin is never repeated.
- `until` is the day the pin shows until, always set: the day she gave it on
  the Exchange, else an event's date, an opportunity's deadline, or two weeks
  from the day she published.
- `image` is her upload for that item, absent when the row's own picture
  (its `infographic` column) is the one to show. When she uploads a photo for
  a row the desk is publishing at the same time, the row's `infographic` in
  `news.csv` carries it too.
- `title` and `summary` are the card's words (Kate, Sep 30), present only on
  an event, an ERC event or an opportunity: the summary is 180 characters or
  fewer, one or two plain sentences, the invitation first, with a book or
  journal name in `*stars*`; the title is the row's own unless it ran past 80
  characters, then trimmed to 80. Research and headlines carry neither.

## What the Exchange has to do (the change for the other chat)

1. In the New & upcoming card, a pinned item shows the pin's `title` in place
   of the row's headline and the pin's `summary` in place of the row's blurb,
   when the pin has them. `mark()` already draws the stars as italics; the
   list and the opened summary keep the row's own words.
2. The card's photo is the pin's `image` when it is set, else the row's
   `infographic` when that is a direct image file, as now.
3. `api/_admin.js` must keep a pin's `image`, `title` and `summary` when it
   rewrites the file (pin, unpin, rekey): today it rebuilds pin entries, and
   the desk's fields would be lost the next time she pins something there.

Nothing else changes: the pins' order, the `until` rule, the rail and the
timing stay as built.
